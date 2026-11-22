from pydantic import BaseModel, Field


class ApproveUserRequest(BaseModel):
    user_id: int
    status: str = Field(pattern="^(aktif|ditolak)$")


class UserListItem(BaseModel):
    id: int
    nip: str
    nama: str
    role: str
    status: str
    kepegawaian: str | None
