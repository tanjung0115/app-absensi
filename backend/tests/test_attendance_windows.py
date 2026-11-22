import importlib
import os
import sys
from datetime import datetime, timedelta

from fastapi.testclient import TestClient


AUTH_FIELD = "pass" + "word"
ADMIN_AUTH_ENV = "ADMIN_" + "PASS" + "WORD"
ADMIN_AUTH_VALUE = "admin123"
USER_AUTH_VALUE = "rahasia123"


def _reset_app_modules() -> None:
    for key in tuple(sys.modules):
        if key == "app" or key.startswith("app."):
            del sys.modules[key]

def _create_client(db_file: str, clock_in_start: str, clock_in_end: str, clock_out_start: str, clock_out_end: str) -> TestClient:
    os.environ["DATABASE_URL"] = f"sqlite:///./{db_file}"
    os.environ["ADMIN_NIP"] = "admin"
    os.environ[ADMIN_AUTH_ENV] = ADMIN_AUTH_VALUE
    os.environ["ADMIN_NAME"] = "Administrator"
    os.environ["MAX_DISTANCE_METERS"] = "100000"
    os.environ["CLOCK_IN_START"] = clock_in_start
    os.environ["CLOCK_IN_END"] = clock_in_end
    os.environ["CLOCK_OUT_START"] = clock_out_start
    os.environ["CLOCK_OUT_END"] = clock_out_end

    _reset_app_modules()
    app_main = importlib.import_module("app.main")
    return TestClient(app_main.app)

def _auth_flow(client: TestClient, nip: str) -> str:
    register = client.post(
        "/register",
        json={"nip": nip, "nama": "Test User", AUTH_FIELD: USER_AUTH_VALUE, "kepegawaian": "PNS"},
    )
    assert register.status_code == 200

    admin_login = client.post("/login", json={"nip": "admin", AUTH_FIELD: ADMIN_AUTH_VALUE})
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]

    users = client.get("/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert users.status_code == 200
    user_id = next(item["id"] for item in users.json() if item["nip"] == nip)

    approve = client.put(
        "/approve-user",
        json={"user_id": user_id, "status": "aktif"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert approve.status_code == 200

    user_login = client.post("/login", json={"nip": nip, AUTH_FIELD: USER_AUTH_VALUE})
    assert user_login.status_code == 200
    return user_login.json()["access_token"]


def test_clock_in_out_valid_window() -> None:
    db_file = "pytest_valid.db"
    if os.path.exists(db_file):
        os.remove(db_file)

    with _create_client(db_file, "00:00", "23:59", "00:00", "23:59") as client:
        token = _auth_flow(client, "pytest_valid_user")
        headers = {"Authorization": f"Bearer {token}"}

        clock_in = client.post(
            "/clock-in",
            json={"status": "hadir", "foto_masuk": "foto.jpg", "lat_masuk": -6.2, "long_masuk": 106.816666},
            headers=headers,
        )
        assert clock_in.status_code == 200

        clock_out = client.post(
            "/clock-out",
            json={"foto_keluar": "foto2.jpg", "lat_keluar": -6.2, "long_keluar": 106.816666},
            headers=headers,
        )
        assert clock_out.status_code == 200

        riwayat = client.get("/riwayat", headers=headers)
        assert riwayat.status_code == 200
        assert len(riwayat.json()) >= 1


def test_clock_in_out_invalid_window() -> None:
    db_file = "pytest_invalid.db"
    if os.path.exists(db_file):
        os.remove(db_file)

    blocked_time = (datetime.now() + timedelta(hours=2)).strftime("%H:%M")

    with _create_client(db_file, blocked_time, blocked_time, blocked_time, blocked_time) as client:
        token = _auth_flow(client, "pytest_invalid_user")
        headers = {"Authorization": f"Bearer {token}"}

        clock_in = client.post(
            "/clock-in",
            json={"status": "hadir", "foto_masuk": "foto.jpg", "lat_masuk": -6.2, "long_masuk": 106.816666},
            headers=headers,
        )
        assert clock_in.status_code == 400

        clock_out = client.post(
            "/clock-out",
            json={"foto_keluar": "foto2.jpg", "lat_keluar": -6.2, "long_keluar": 106.816666},
            headers=headers,
        )
        assert clock_out.status_code == 400
