from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    nip = Column(String, unique=True, index=True, nullable=False)
    nama = Column(String, nullable=False)
    password = Column(String, nullable=False)
    foto = Column(String, nullable=True)
    role = Column(String, nullable=False, default="user")
    status = Column(String, nullable=False, default="pending")
    kepegawaian = Column(String, nullable=True)
    divisi = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    absensi = relationship("Absensi", back_populates="user", cascade="all, delete-orphan")
    surat_keterangan = relationship("SuratKeterangan", back_populates="user", cascade="all, delete-orphan")