from datetime import date, datetime

from pydantic import BaseModel, Field


class ClockInRequest(BaseModel):
    status: str = Field(pattern="^(hadir|absen|sakit|izin|wfh)$")
    foto_masuk: str | None = None
    lat_masuk: float | None = None
    long_masuk: float | None = None
    catatan: str | None = None


class ClockOutRequest(BaseModel):
    foto_keluar: str
    lat_keluar: float
    long_keluar: float


class AbsensiItem(BaseModel):
    id: int
    tanggal: date
    jam_masuk: datetime | None
    jam_keluar: datetime | None
    status: str
    catatan: str | None
    jarak_masuk: float | None
    jarak_keluar: float | None


class ClockResponse(BaseModel):
    message: str
    tanggal: date
    status: str
