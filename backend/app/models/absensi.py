from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class Absensi(Base):
    __tablename__ = "absensi"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    tanggal = Column(Date, nullable=False, index=True)
    jam_masuk = Column(DateTime, nullable=True)
    jam_keluar = Column(DateTime, nullable=True)

    foto_masuk = Column(String, nullable=True)
    foto_keluar = Column(String, nullable=True)

    lat_masuk = Column(Float, nullable=True)
    long_masuk = Column(Float, nullable=True)
    jarak_masuk = Column(Float, nullable=True)

    lat_keluar = Column(Float, nullable=True)
    long_keluar = Column(Float, nullable=True)
    jarak_keluar = Column(Float, nullable=True)

    status = Column(String, nullable=False)
    catatan = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="absensi")
