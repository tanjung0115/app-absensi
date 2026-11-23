from datetime import date, datetime
from pydantic import BaseModel, Field


class SuratCreateRequest(BaseModel):
    tanggal: date
    jenis: str = Field(pattern="^(izin|sakit|lupa)$")
    keterangan: str = Field(min_length=1, max_length=500)
    bukti: str = Field(min_length=1)
    bukti_nama: str | None = Field(default=None, max_length=255)


class SuratItem(BaseModel):
    id: int
    user_id: int
    nama: str
    nip: str
    tanggal: date
    jenis: str
    keterangan: str | None
    bukti: str | None = None
    bukti_nama: str | None = None
    status: str
    catatan_review: str | None
    created_at: datetime


class SuratResponse(BaseModel):
    message: str
    id: int
    status: str


class SuratReviewRequest(BaseModel):
    status: str = Field(pattern="^(diterima|ditolak)$")
    catatan_review: str | None = Field(default=None, max_length=500)