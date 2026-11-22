from pydantic import BaseModel

class UserCreate(BaseModel):
    nip: str
    nama: str
    password: str