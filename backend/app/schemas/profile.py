from pydantic import BaseModel, Field


class ProfileResponse(BaseModel):
    id: int
    nip: str
    nama: str
    foto: str | None
    role: str
    status: str
    kepegawaian: str | None
    divisi: str | None = None


class UpdateProfileRequest(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=100)
    foto: str | None = None
    kepegawaian: str | None = Field(default=None, pattern="^(staff|magang)$")
    divisi: str | None = Field(default=None, max_length=100)
