import os
from datetime import datetime, time

from dotenv import load_dotenv

load_dotenv()


def _parse_time(value: str, default: str) -> time:
    try:
        return datetime.strptime(value or default, "%H:%M").time()
    except ValueError:
        return datetime.strptime(default, "%H:%M").time()


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/absensi_db",
)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-this-secret")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

OFFICE_LAT = float(os.getenv("OFFICE_LAT", "-6.200000"))
OFFICE_LONG = float(os.getenv("OFFICE_LONG", "106.816666"))
MAX_DISTANCE_METERS = float(os.getenv("MAX_DISTANCE_METERS", "50"))

CLOCK_IN_START = _parse_time(os.getenv("CLOCK_IN_START", "07:00"), "07:00")
CLOCK_IN_END = _parse_time(os.getenv("CLOCK_IN_END", "09:00"), "09:00")
CLOCK_OUT_START = _parse_time(os.getenv("CLOCK_OUT_START", "16:00"), "16:00")
CLOCK_OUT_END = _parse_time(os.getenv("CLOCK_OUT_END", "18:00"), "18:00")
