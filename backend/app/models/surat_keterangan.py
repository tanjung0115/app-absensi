from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class SuratKeterangan(Base):
    __tablename__ = "surat_keterangan"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tanggal = Column(Date, nullable=False, index=True)
    jenis = Column(String, nullable=False)
    keterangan = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    catatan_review = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="surat_keterangan")
