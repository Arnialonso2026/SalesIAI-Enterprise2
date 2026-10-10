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
        assert client.get("/api/v1/purchases").status_code == 404

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

        customer_payload = {
            "name": "Empresa de prueba",
            "email": "contacto@ejemplo.com",
            "phone": "+51 900 000 000",
            "document_number": "20601234567",
            "address": "Lima",
            "customer_type": "business",
            "contact_name": "Ana Pérez",
            "industry": "Servicios profesionales",
            "preferred_contact_method": "email",
            "notes": "Facturación mensual",
        }
        created_customer = client.post("/api/v1/customers", headers=headers, json=customer_payload)
        assert created_customer.status_code == 201, created_customer.text
        customer_id = created_customer.json()["id"]
        assert created_customer.json() == {
            **customer_payload,
            "id": customer_id,
            "is_active": True,
            "created_at": created_customer.json()["created_at"],
        }

        optional_document = client.post("/api/v1/customers", headers=headers, json={
            "name": "Cliente sin documento",
            "customer_type": "individual",
        })
        assert optional_document.status_code == 201, optional_document.text
        assert optional_document.json()["document_number"] is None

        formatted_dni = client.post("/api/v1/customers", headers=headers, json={
            "name": "Cliente con DNI formateado",
            "customer_type": "individual",
            "document_number": "DNI-12345678",
        })
        assert formatted_dni.status_code == 201, formatted_dni.text
        assert formatted_dni.json()["document_number"] == "12345678"

        invalid_documents = [
            {"customer_type": "individual", "document_number": "1234567"},
            {"customer_type": "business", "document_number": "1234567890"},
            {"customer_type": "business", "document_number": "DNI-12345678"},
            {"customer_type": "individual", "document_number": "12ABC678"},
        ]
        for invalid_document in invalid_documents:
            invalid_customer = client.post("/api/v1/customers", headers=headers, json={
                "name": "Documento inválido",
                **invalid_document,
            })
            assert invalid_customer.status_code == 422, invalid_customer.text

        customer_payload["industry"] = "Tecnología"
        updated_customer = client.put(
            f"/api/v1/customers/{customer_id}", headers=headers, json=customer_payload,
        )
        assert updated_customer.status_code == 200, updated_customer.text
        assert updated_customer.json()["industry"] == "Tecnología"
        assert client.get(f"/api/v1/customers?search=Ana%20Pérez", headers=headers).json()[0] == updated_customer.json()

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()