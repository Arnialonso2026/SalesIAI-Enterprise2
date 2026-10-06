import os

from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


ADMIN_DNI = os.environ["ADMIN_DNI"]
ADMIN_PASSWORD = os.environ["ADMIN_PASSWORD"]


def test_auth_api_contract_rejects_invalid_access_and_returns_current_user() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "ok", "service": "salesia-api"}
        assert client.get("/api/v1/auth/me").status_code == 401
        assert client.get("/api/v1/sales").status_code == 401

        invalid_login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": "incorrecta",
        })
        assert invalid_login.status_code == 401

        malformed_login = client.post("/api/v1/auth/login", json={
            "dni": "123", "password": "corta",
        })
        assert malformed_login.status_code == 422

        login = client.post("/api/v1/auth/login", json={
            "dni": ADMIN_DNI, "password": ADMIN_PASSWORD,
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        current_user = client.get("/api/v1/auth/me", headers=headers)
        assert current_user.status_code == 200, current_user.text
        assert current_user.json()["dni"] == ADMIN_DNI
        assert current_user.json()["role"] == "admin"
        assert "password_hash" not in current_user.json()

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()