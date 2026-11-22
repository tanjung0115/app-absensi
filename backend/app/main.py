import os
from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response, status
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from sqlalchemy import extract, func, inspect
from sqlalchemy.orm import Session
from openpyxl import Workbook

from app.config import (
    CLOCK_IN_END,
    CLOCK_IN_START,
    CLOCK_OUT_END,
    CLOCK_OUT_START,
    MAX_DISTANCE_METERS,
    OFFICE_LAT,
    OFFICE_LONG,
)
from app.database import Base, SessionLocal, engine, get_db
from app.models import Absensi, SuratKeterangan, User
from app.schemas.absensi import AbsensiItem, ClockInRequest, ClockOutRequest, ClockResponse
from app.schemas.admin import ApproveUserRequest
from app.schemas.auth import LoginRequest, RegisterRequest, RegisterResponse, TokenResponse
from app.schemas.profile import ProfileResponse, UpdateProfileRequest
from app.schemas.surat import SuratCreateRequest, SuratItem, SuratResponse, SuratReviewRequest
from app.services.attendance import current_local_datetime, haversine_distance_meters, is_time_between
from app.services.security import create_access_token, decode_token, hash_password, verify_password


@asynccontextmanager
async def lifespan(_: FastAPI):
    db = SessionLocal()
    try:
        ensure_admin_exists(db)
        yield
    finally:
        db.close()


app = FastAPI(lifespan=lifespan)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend"
FRONTEND_INDEX = FRONTEND_DIR / "index.html"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

Base.metadata.create_all(bind=engine)
with engine.begin() as _conn:
    _user_cols = {col["name"] for col in inspect(_conn).get_columns("users")}
    if "divisi" not in _user_cols:
        _conn.exec_driver_sql("ALTER TABLE users ADD COLUMN divisi VARCHAR")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    nip = decode_token(token)
    if not nip:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token tidak valid")

    user = db.query(User).filter(User.nip == nip).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User tidak ditemukan")
    return user


def get_current_admin(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Khusus admin")
    return current_user


def validate_office_distance(lat: float, lon: float) -> float:
    distance = haversine_distance_meters(lat, lon, OFFICE_LAT, OFFICE_LONG)
    if distance > MAX_DISTANCE_METERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Jarak ke kantor {distance:.2f}m melebihi batas {MAX_DISTANCE_METERS}m",
        )
    return distance


def ensure_admin_exists(db: Session) -> None:
    admin_nip = os.getenv("ADMIN_NIP")
    admin_password = os.getenv("ADMIN_PASSWORD")
    admin_name = os.getenv("ADMIN_NAME", "Administrator")

    if not admin_nip or not admin_password:
        return

    existing_admin = db.query(User).filter(User.nip == admin_nip).first()
    if existing_admin:
        return

    db.add(
        User(
            nip=admin_nip,
            nama=admin_name,
            password=hash_password(admin_password),
            role="admin",
            status="aktif",
        )
    )
    db.commit()

@app.get("/")
def root(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept and FRONTEND_INDEX.exists():
        return FileResponse(str(FRONTEND_INDEX))
    return {"message": "API jalan"}


@app.get("/admin")
def admin_portal():
    if FRONTEND_INDEX.exists():
        return FileResponse(str(FRONTEND_INDEX))
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Frontend tidak ditemukan")


@app.post("/register", response_model=RegisterResponse)
def register(data: RegisterRequest, db: Annotated[Session, Depends(get_db)]):
    existing = db.query(User).filter(User.nip == data.nip).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="NIP sudah terdaftar")

    new_user = User(
        nip=data.nip,
        nama=data.nama,
        password=hash_password(data.password),
        role="user",
        status="pending",
        kepegawaian=data.kepegawaian,
    )
    db.add(new_user)
    db.commit()
    return RegisterResponse(message="Registrasi berhasil, menunggu verifikasi admin", nip=new_user.nip, status=new_user.status)


@app.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Annotated[Session, Depends(get_db)]):
    user = db.query(User).filter(User.nip == data.nip).first()
    if not user or not verify_password(data.password, user.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="NIP atau password salah")

    if user.status != "aktif":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akun belum aktif")

    token = create_access_token(user.nip)
    return TokenResponse(access_token=token)


@app.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: Annotated[User, Depends(get_current_user)]):
    return ProfileResponse(
        id=current_user.id,
        nip=current_user.nip,
        nama=current_user.nama,
        foto=current_user.foto,
        role=current_user.role,
        status=current_user.status,
        kepegawaian=current_user.kepegawaian,
        divisi=current_user.divisi,
    )


@app.put("/profile", response_model=ProfileResponse)
def update_profile(
    payload: UpdateProfileRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if payload.nama is not None:
        current_user.nama = payload.nama
    if payload.foto is not None:
        current_user.foto = payload.foto or None
    if payload.kepegawaian is not None:
        current_user.kepegawaian = payload.kepegawaian
    if payload.divisi is not None:
        current_user.divisi = payload.divisi.strip() or None

    db.commit()
    db.refresh(current_user)

    return ProfileResponse(
        id=current_user.id,
        nip=current_user.nip,
        nama=current_user.nama,
        foto=current_user.foto,
        role=current_user.role,
        status=current_user.status,
        kepegawaian=current_user.kepegawaian,
        divisi=current_user.divisi,
    )


@app.post("/surat", response_model=SuratResponse)
def create_surat(
    payload: SuratCreateRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    surat = SuratKeterangan(
        user_id=current_user.id,
        tanggal=payload.tanggal,
        jenis=payload.jenis,
        keterangan=payload.keterangan,
        status="pending",
    )
    db.add(surat)
    db.commit()
    db.refresh(surat)

    return SuratResponse(message="Surat keterangan berhasil dibuat", id=surat.id, status=surat.status)


@app.get("/surat", response_model=list[SuratItem])
def list_surat(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    jenis: Annotated[str | None, Query()] = None,
    tanggal_mulai: Annotated[date | None, Query()] = None,
    tanggal_selesai: Annotated[date | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = db.query(SuratKeterangan).join(User, User.id == SuratKeterangan.user_id)

    if current_user.role != "admin":
        query = query.filter(SuratKeterangan.user_id == current_user.id)
    if status_filter:
        query = query.filter(SuratKeterangan.status == status_filter)
    if jenis:
        query = query.filter(SuratKeterangan.jenis == jenis)
    if tanggal_mulai:
        query = query.filter(SuratKeterangan.tanggal >= tanggal_mulai)
    if tanggal_selesai:
        query = query.filter(SuratKeterangan.tanggal <= tanggal_selesai)

    total_count = query.count()
    rows = query.order_by(SuratKeterangan.created_at.desc()).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)

    return [
        SuratItem(
            id=row.id,
            user_id=row.user_id,
            nama=row.user.nama,
            nip=row.user.nip,
            tanggal=row.tanggal,
            jenis=row.jenis,
            keterangan=row.keterangan,
            status=row.status,
            catatan_review=row.catatan_review,
            created_at=row.created_at,
        )
        for row in rows
    ]


@app.put("/surat/{surat_id}/review")
def review_surat(
    surat_id: int,
    payload: SuratReviewRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    surat = db.query(SuratKeterangan).filter(SuratKeterangan.id == surat_id).first()
    if not surat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surat tidak ditemukan")

    surat.status = payload.status
    surat.catatan_review = payload.catatan_review
    db.commit()
    db.refresh(surat)

    return {
        "message": "Status surat diperbarui",
        "id": surat.id,
        "status": surat.status,
        "catatan_review": surat.catatan_review,
    }


@app.post("/clock-in", response_model=ClockResponse)
def clock_in(
    payload: ClockInRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    if current_user.status != "aktif":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akun belum aktif")

    now = current_local_datetime()
    if not is_time_between(now.time(), CLOCK_IN_START, CLOCK_IN_END):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Absensi masuk hanya di jam {CLOCK_IN_START.strftime('%H:%M')} - {CLOCK_IN_END.strftime('%H:%M')}",
        )

    existing = (
        db.query(Absensi)
        .filter(Absensi.user_id == current_user.id, Absensi.tanggal == date.today())
        .first()
    )
    if existing and existing.jam_masuk:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anda sudah clock-in hari ini")

    jarak_masuk = None
    if payload.status == "hadir":
        if payload.foto_masuk is None or payload.lat_masuk is None or payload.long_masuk is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status hadir wajib kirim foto_masuk, lat_masuk, long_masuk",
            )
        jarak_masuk = validate_office_distance(payload.lat_masuk, payload.long_masuk)

    if existing:
        existing.jam_masuk = now
        existing.status = payload.status
        existing.foto_masuk = payload.foto_masuk
        existing.lat_masuk = payload.lat_masuk
        existing.long_masuk = payload.long_masuk
        existing.jarak_masuk = jarak_masuk
        existing.catatan = payload.catatan
        db.commit()
        return ClockResponse(message="Clock-in berhasil", tanggal=existing.tanggal, status=existing.status)

    record = Absensi(
        user_id=current_user.id,
        tanggal=date.today(),
        jam_masuk=now,
        status=payload.status,
        foto_masuk=payload.foto_masuk,
        lat_masuk=payload.lat_masuk,
        long_masuk=payload.long_masuk,
        jarak_masuk=jarak_masuk,
        catatan=payload.catatan,
    )
    db.add(record)
    db.commit()

    return ClockResponse(message="Clock-in berhasil", tanggal=record.tanggal, status=record.status)


@app.post("/clock-out", response_model=ClockResponse)
def clock_out(
    payload: ClockOutRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    now = current_local_datetime()
    if not is_time_between(now.time(), CLOCK_OUT_START, CLOCK_OUT_END):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Absensi pulang hanya di jam {CLOCK_OUT_START.strftime('%H:%M')} - {CLOCK_OUT_END.strftime('%H:%M')}",
        )

    record = (
        db.query(Absensi)
        .filter(Absensi.user_id == current_user.id, Absensi.tanggal == date.today())
        .first()
    )

    if not record or not record.jam_masuk:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anda belum clock-in hari ini")
    if record.jam_keluar:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Anda sudah clock-out hari ini")

    jarak_keluar = validate_office_distance(payload.lat_keluar, payload.long_keluar)

    record.jam_keluar = now
    record.foto_keluar = payload.foto_keluar
    record.lat_keluar = payload.lat_keluar
    record.long_keluar = payload.long_keluar
    record.jarak_keluar = jarak_keluar
    db.commit()

    return ClockResponse(message="Clock-out berhasil", tanggal=record.tanggal, status=record.status)


@app.get("/riwayat", response_model=list[AbsensiItem])
def riwayat(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    base_query = db.query(Absensi).filter(Absensi.user_id == current_user.id)
    total_count = base_query.count()
    rows = base_query.order_by(Absensi.tanggal.desc(), Absensi.id.desc()).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)

    return [
        AbsensiItem(
            id=row.id,
            tanggal=row.tanggal,
            jam_masuk=row.jam_masuk,
            jam_keluar=row.jam_keluar,
            status=row.status,
            catatan=row.catatan,
            jarak_masuk=row.jarak_masuk,
            jarak_keluar=row.jarak_keluar,
        )
        for row in rows
    ]


@app.get("/users")
def list_users(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    status_filter: Annotated[str | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = db.query(User).filter(User.role == "user")
    if status_filter:
        query = query.filter(User.status == status_filter)

    total_count = query.count()
    users = query.order_by(User.id.desc()).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)
    return [
        {
            "id": item.id,
            "nip": item.nip,
            "nama": item.nama,
            "role": item.role,
            "status": item.status,
            "kepegawaian": item.kepegawaian,
        }
        for item in users
    ]


@app.put("/approve-user")
def approve_user(
    payload: ApproveUserRequest,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    target_user = db.query(User).filter(User.id == payload.user_id, User.role == "user").first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User tidak ditemukan")

    target_user.status = payload.status
    db.commit()

    return {"message": "Status user diperbarui", "user_id": target_user.id, "status": target_user.status}


@app.get("/rekap")
def rekap_presensi(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    bulan: Annotated[int | None, Query(ge=1, le=12)] = None,
    tahun: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    nama: Annotated[str | None, Query()] = None,
    kepegawaian: Annotated[str | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    query = db.query(Absensi).join(User, User.id == Absensi.user_id)

    if bulan is not None:
        query = query.filter(extract("month", Absensi.tanggal) == bulan)
    if tahun is not None:
        query = query.filter(extract("year", Absensi.tanggal) == tahun)
    if nama:
        query = query.filter(User.nama.ilike(f"%{nama}%"))
    if kepegawaian:
        query = query.filter(User.kepegawaian == kepegawaian)

    total_count = query.count()
    rows = query.order_by(Absensi.tanggal.desc(), Absensi.id.desc()).offset(offset).limit(limit).all()

    response.headers["X-Total-Count"] = str(total_count)
    response.headers["X-Limit"] = str(limit)
    response.headers["X-Offset"] = str(offset)

    return [
        {
            "id": item.id,
            "nip": item.user.nip,
            "nama": item.user.nama,
            "kepegawaian": item.user.kepegawaian,
            "tanggal": item.tanggal,
            "jam_masuk": item.jam_masuk,
            "jam_keluar": item.jam_keluar,
            "lokasi_masuk": {
                "lat": item.lat_masuk,
                "long": item.long_masuk,
            },
            "lokasi_keluar": {
                "lat": item.lat_keluar,
                "long": item.long_keluar,
            },
            "jarak_masuk": item.jarak_masuk,
            "jarak_keluar": item.jarak_keluar,
            "catatan": item.catatan,
            "status": item.status,
        }
        for item in rows
    ]


@app.get("/export")
def export_rekap(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    bulan: Annotated[int | None, Query(ge=1, le=12)] = None,
    tahun: Annotated[int | None, Query(ge=2000, le=2100)] = None,
    nama: Annotated[str | None, Query()] = None,
    kepegawaian: Annotated[str | None, Query()] = None,
):
    query = db.query(Absensi).join(User, User.id == Absensi.user_id)

    if bulan is not None:
        query = query.filter(extract("month", Absensi.tanggal) == bulan)
    if tahun is not None:
        query = query.filter(extract("year", Absensi.tanggal) == tahun)
    if nama:
        query = query.filter(User.nama.ilike(f"%{nama}%"))
    if kepegawaian:
        query = query.filter(User.kepegawaian == kepegawaian)

    rows = query.order_by(Absensi.tanggal.desc(), Absensi.id.desc()).all()

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Rekap Presensi"
    sheet.append([
        "NIP",
        "Nama",
        "Kepegawaian",
        "Tanggal",
        "Jam Masuk",
        "Jam Keluar",
        "Status",
        "Lat Masuk",
        "Long Masuk",
        "Jarak Masuk",
        "Lat Keluar",
        "Long Keluar",
        "Jarak Keluar",
        "Catatan",
    ])

    for item in rows:
        sheet.append([
            item.user.nip,
            item.user.nama,
            item.user.kepegawaian,
            item.tanggal.isoformat() if item.tanggal else None,
            item.jam_masuk.isoformat() if item.jam_masuk else None,
            item.jam_keluar.isoformat() if item.jam_keluar else None,
            item.status,
            item.lat_masuk,
            item.long_masuk,
            item.jarak_masuk,
            item.lat_keluar,
            item.long_keluar,
            item.jarak_keluar,
            item.catatan,
        ])

    output = BytesIO()
    workbook.save(output)
    output.seek(0)

    filename = f"rekap_presensi_{date.today().isoformat()}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@app.get("/admin/dashboard")
def admin_dashboard(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
):
    total_user = db.query(User).filter(User.role == "user").count()
    total_user_aktif = db.query(User).filter(User.role == "user", User.status == "aktif").count()
    total_user_pending = db.query(User).filter(User.role == "user", User.status == "pending").count()
    total_surat_pending = db.query(SuratKeterangan).filter(SuratKeterangan.status == "pending").count()
    total_absensi_hari_ini = db.query(Absensi).filter(Absensi.tanggal == date.today()).count()

    return {
        "total_user": total_user,
        "total_user_aktif": total_user_aktif,
        "total_user_pending": total_user_pending,
        "total_surat_pending": total_surat_pending,
        "total_absensi_hari_ini": total_absensi_hari_ini,
    }


@app.get("/admin/dashboard/trends")
def admin_dashboard_trends(
    db: Annotated[Session, Depends(get_db)],
    _: Annotated[User, Depends(get_current_admin)],
    tahun: Annotated[int, Query(ge=2000, le=2100)] = date.today().year,
):
    absensi_rows = (
        db.query(extract("month", Absensi.tanggal).label("bulan"), func.count(Absensi.id).label("jumlah"))
        .filter(extract("year", Absensi.tanggal) == tahun)
        .group_by(extract("month", Absensi.tanggal))
        .all()
    )
    absensi_map = {int(row.bulan): int(row.jumlah) for row in absensi_rows}

    surat_rows = (
        db.query(
            extract("month", SuratKeterangan.tanggal).label("bulan"),
            SuratKeterangan.status.label("status"),
            func.count(SuratKeterangan.id).label("jumlah"),
        )
        .filter(extract("year", SuratKeterangan.tanggal) == tahun)
        .group_by(extract("month", SuratKeterangan.tanggal), SuratKeterangan.status)
        .all()
    )

    surat_map: dict[int, dict[str, int]] = {}
    for row in surat_rows:
        bulan = int(row.bulan)
        status_surat = row.status or "pending"
        if bulan not in surat_map:
            surat_map[bulan] = {"pending": 0, "diterima": 0, "ditolak": 0}
        if status_surat not in surat_map[bulan]:
            surat_map[bulan][status_surat] = 0
        surat_map[bulan][status_surat] += int(row.jumlah)

    tren = []
    for bulan in range(1, 13):
        surat_bulan = surat_map.get(bulan, {"pending": 0, "diterima": 0, "ditolak": 0})
        tren.append(
            {
                "bulan": bulan,
                "jumlah_absensi": absensi_map.get(bulan, 0),
                "surat_pending": surat_bulan.get("pending", 0),
                "surat_diterima": surat_bulan.get("diterima", 0),
                "surat_ditolak": surat_bulan.get("ditolak", 0),
            }
        )

    return {
        "tahun": tahun,
        "tren": tren,
    }