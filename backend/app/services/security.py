import base64
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
    encoded_salt = base64.b64encode(salt).decode("utf-8")
    encoded_digest = base64.b64encode(digest).decode("utf-8")
    return f"pbkdf2_sha256${encoded_salt}${encoded_digest}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        scheme, encoded_salt, encoded_digest = hashed_password.split("$", 2)
    except ValueError:
        return False

    if scheme != "pbkdf2_sha256":
        return False

    salt = base64.b64decode(encoded_salt.encode("utf-8"))
    expected_digest = base64.b64decode(encoded_digest.encode("utf-8"))
    computed_digest = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 200000)
    return hmac.compare_digest(computed_digest, expected_digest)


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None
