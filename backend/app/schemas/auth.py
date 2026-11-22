from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    nip: str = Field(min_length=3, max_length=50)
    nama: str = Field(min_length=2, max_length=100)
    password: str = Field(min_length=6, max_length=100)
    kepegawaian: str | None = Field(default=None, pattern="^(staff|magang)$")


class LoginRequest(BaseModel):
    nip: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    message: str
    nip: str
    status: str
