import os

from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


def test_admin_manages_dni_password_roles_and_access() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    with TestClient(app) as client:
        admin_login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        assert admin_login.status_code == 200, admin_login.text
        admin_headers = {"Authorization": f"Bearer {admin_login.json()['access_token']}"}
        admin_user = admin_login.json()["user"]
        last_admin_removal = client.put(f"/api/v1/users/{admin_user['id']}", headers=admin_headers, json={
            "full_name": admin_user["full_name"], "email": admin_user["email"], "dni": None,
            "role": "admin", "is_active": True,
        })
        assert last_admin_removal.status_code == 409

        created = client.post("/api/v1/users", headers=admin_headers, json={
            "full_name": "Luis Vendedor", "email": None, "dni": "87654321",
            "password": "Vendedor2026!", "role": "seller",
        })
        assert created.status_code == 201, created.text
        user = created.json()
        user_id = user["id"]
        assert user["password_configured"] is True
        assert "password_hash" not in user
        assert "password" not in user

        seller_login = client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "Vendedor2026!",
        })
        assert seller_login.status_code == 200
        seller_headers = {"Authorization": f"Bearer {seller_login.json()['access_token']}"}
        assert client.get("/api/v1/users", headers=seller_headers).status_code == 403

        updated = client.put(f"/api/v1/users/{user_id}", headers=admin_headers, json={
            "full_name": "Luis Torres", "email": None, "dni": "87654321",
            "password": "NuevoPassword2026!", "role": "warehouse", "is_active": True,
        })
        assert updated.status_code == 200, updated.text
        assert updated.json()["role"] == "warehouse"
        assert updated.json()["dni"] == "87654321"
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "Vendedor2026!",
        }).status_code == 401
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "NuevoPassword2026!",
        }).status_code == 200

        dni_removed = client.put(f"/api/v1/users/{user_id}", headers=admin_headers, json={
            "full_name": "Luis Torres", "email": None, "dni": None,
            "role": "warehouse", "is_active": True,
        })
        assert dni_removed.status_code == 200
        assert dni_removed.json()["dni"] is None
        assert dni_removed.json()["is_active"] is False
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "NuevoPassword2026!",
        }).status_code == 401

        dni_restored = client.put(f"/api/v1/users/{user_id}", headers=admin_headers, json={
            "full_name": "Luis Torres", "email": None, "dni": "87654321",
            "role": "warehouse", "is_active": True,
        })
        assert dni_restored.status_code == 200
        assert dni_restored.json()["is_active"] is True

        cleared_password = client.post(f"/api/v1/users/{user_id}/clear-password", headers=admin_headers)
        assert cleared_password.status_code == 200
        assert cleared_password.json()["password_configured"] is False
        assert cleared_password.json()["is_active"] is False
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "NuevoPassword2026!",
        }).status_code == 401

        restored = client.put(f"/api/v1/users/{user_id}", headers=admin_headers, json={
            "full_name": "Luis Torres", "email": None, "dni": "87654321",
            "password": "Restaurada2026!", "role": "warehouse", "is_active": True,
        })
        assert restored.status_code == 200
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "Restaurada2026!",
        }).status_code == 200

        deleted = client.delete(f"/api/v1/users/{user_id}", headers=admin_headers)
        assert deleted.status_code == 204
        assert client.post("/api/v1/auth/login", json={
            "dni": "87654321", "password": "Restaurada2026!",
        }).status_code == 401

        audit_logs = client.get("/api/v1/audit/logs", headers=admin_headers)
        assert audit_logs.status_code == 200, audit_logs.text
        audit_items = audit_logs.json()["items"]
        actions = {item["action"] for item in audit_items}
        assert "login" in actions
        assert any(item["entity_type"] == "user" for item in audit_items)
        assert all(item["actor_name"] for item in audit_items if item["user_id"] == admin_user["id"])

        listed = client.get("/api/v1/users", headers=admin_headers)
        assert listed.status_code == 200
        archived = next(item for item in listed.json() if item["id"] == user_id)
        assert archived["dni"] is None
        assert archived["password_configured"] is False

        invalid_dni = client.post("/api/v1/users", headers=admin_headers, json={
            "full_name": "DNI incorrecto", "dni": "1234", "password": "Password2026!", "role": "seller",
        })
        assert invalid_dni.status_code == 422
        duplicate_dni = client.post("/api/v1/users", headers=admin_headers, json={
            "full_name": "DNI duplicado", "dni": os.environ["ADMIN_DNI"], "password": "Password2026!", "role": "seller",
        })
        assert duplicate_dni.status_code == 409

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
