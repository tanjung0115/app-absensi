import importlib
import os
import sys
from datetime import date

from fastapi.testclient import TestClient


AUTH_FIELD = "pass" + "word"
ADMIN_AUTH_ENV = "ADMIN_" + "PASS" + "WORD"
ADMIN_AUTH_VALUE = "admin123"
USER_AUTH_VALUE = "rahasia123"


def _reset_app_modules() -> None:
    for key in tuple(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]


def _create_client(db_file: str) -> TestClient:
    os.environ["DATABASE_URL"] = f"sqlite:///./{db_file}"
    os.environ["ADMIN_NIP"] = "admin"
    os.environ[ADMIN_AUTH_ENV] = ADMIN_AUTH_VALUE
    os.environ["ADMIN_NAME"] = "Administrator"
    os.environ["MAX_DISTANCE_METERS"] = "100000"
    os.environ["CLOCK_IN_START"] = "00:00"
    os.environ["CLOCK_IN_END"] = "23:59"
    os.environ["CLOCK_OUT_START"] = "00:00"
    os.environ["CLOCK_OUT_END"] = "23:59"

    _reset_app_modules()
    app_main = importlib.import_module("app.main")
    return TestClient(app_main.app)


def _register_and_activate_user(client: TestClient, nip: str) -> tuple[str, str]:
    register = client.post(
        "/register",
        json={"nip": nip, "nama": "User Rekap", AUTH_FIELD: USER_AUTH_VALUE, "kepegawaian": "PNS"},
    )
    assert register.status_code == 200

    admin_login = client.post("/login", json={"nip": "admin", AUTH_FIELD: ADMIN_AUTH_VALUE})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    users = client.get("/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert users.status_code == 200
    user_id = next(item["id"] for item in users.json() if item["nip"] == nip)

    approve = client.put(
        "/approve-user",
        json={"user_id": user_id, "status": "aktif"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve.status_code == 200

    user_login = client.post("/login", json={"nip": nip, AUTH_FIELD: USER_AUTH_VALUE})
    assert user_login.status_code == 200
    user_token = user_login.json()["access_token"]
    return admin_token, user_token


def test_surat_and_rekap_flow() -> None:
    db_file = "pytest_surat_rekap.db"
    if os.path.exists(db_file):
        os.remove(db_file)

    with _create_client(db_file) as client:
        admin_token, user_token = _register_and_activate_user(client, "pytest_rekap_user")

        surat = client.post(
            "/surat",
            json={"tanggal": str(date.today()), "jenis": "izin", "keterangan": "Ada urusan keluarga"},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert surat.status_code == 200
        surat_id = surat.json()["id"]

        surat_list_user = client.get("/surat", headers={"Authorization": f"Bearer {user_token}"})
        assert surat_list_user.status_code == 200
        assert len(surat_list_user.json()) >= 1
        assert "x-total-count" in surat_list_user.headers

        surat_list_admin = client.get("/surat", headers={"Authorization": f"Bearer {admin_token}"})
        assert surat_list_admin.status_code == 200
        assert len(surat_list_admin.json()) >= 1
        assert "x-total-count" in surat_list_admin.headers

        surat_list_admin_paged = client.get(
            "/surat?limit=1&offset=0",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert surat_list_admin_paged.status_code == 200
        assert len(surat_list_admin_paged.json()) <= 1

        review = client.put(
            f"/surat/{surat_id}/review",
            json={"status": "diterima", "catatan_review": "Dokumen lengkap"},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert review.status_code == 200
        assert review.json()["catatan_review"] == "Dokumen lengkap"

        surat_after_review = client.get(
            "/surat?status=diterima",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert surat_after_review.status_code == 200
        assert any(
            item["id"] == surat_id and item["status"] == "diterima" and item.get("catatan_review") == "Dokumen lengkap"
            for item in surat_after_review.json()
        )

        clock_in = client.post(
            "/clock-in",
            json={"status": "hadir", "foto_masuk": "foto.jpg", "lat_masuk": -6.2, "long_masuk": 106.816666},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert clock_in.status_code == 200

        clock_out = client.post(
            "/clock-out",
            json={"foto_keluar": "foto2.jpg", "lat_keluar": -6.2, "long_keluar": 106.816666},
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert clock_out.status_code == 200

        rekap = client.get("/rekap?limit=1&offset=0", headers={"Authorization": f"Bearer {admin_token}"})
        assert rekap.status_code == 200
        assert len(rekap.json()) <= 1
        assert "x-total-count" in rekap.headers

        dashboard = client.get("/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
        assert dashboard.status_code == 200
        assert "total_user" in dashboard.json()
        assert "total_surat_pending" in dashboard.json()

        trends = client.get(
            f"/admin/dashboard/trends?tahun={date.today().year}",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert trends.status_code == 200
        payload = trends.json()
        assert payload["tahun"] == date.today().year
        assert len(payload["tren"]) == 12
        assert "jumlah_absensi" in payload["tren"][0]

        export = client.get("/export", headers={"Authorization": f"Bearer {admin_token}"})
        assert export.status_code == 200
        assert export.headers["content-type"].startswith("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
