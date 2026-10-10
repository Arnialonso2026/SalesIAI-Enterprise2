import os

from fastapi.testclient import TestClient

from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import Branch, Company


def test_company_scoped_branch_maintenance_and_peru_coordinates() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"],
            "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        admin_headers = {"Authorization": "Bearer " + login.json()["access_token"]}

        with SessionLocal() as db:
            other_company = Company(name="Otra empresa")
            db.add(other_company)
            db.flush()
            db.add(Branch(
                company_id=other_company.id,
                name="Sucursal ajena",
                latitude=-12.0464,
                longitude=-77.0428,
            ))
            db.commit()

        payload = {
            "name": "Lima Centro",
            "address": "Lima, Perú",
            "latitude": -12.0464,
            "longitude": -77.0428,
        }
        created = client.post("/api/v1/branches", headers=admin_headers, json=payload)
        assert created.status_code == 201, created.text
        branch = created.json()
        assert branch["is_active"] is True
        assert branch["latitude"] == -12.0464

        listing = client.get("/api/v1/branches", headers=admin_headers)
        assert listing.status_code == 200, listing.text
        assert [item["name"] for item in listing.json()] == ["Lima Centro"]

        duplicate = client.post("/api/v1/branches", headers=admin_headers, json=payload)
        assert duplicate.status_code == 409

        invalid_coordinates = client.post(
            "/api/v1/branches",
            headers=admin_headers,
            json={**payload, "latitude": 15.0},
        )
        assert invalid_coordinates.status_code == 422

        updated = client.put(
            f"/api/v1/branches/{branch['id']}",
            headers=admin_headers,
            json={**payload, "name": "Lima Norte"},
        )
        assert updated.status_code == 200, updated.text
        assert updated.json()["name"] == "Lima Norte"

        deactivated = client.delete(f"/api/v1/branches/{branch['id']}", headers=admin_headers)
        assert deactivated.status_code == 204
        inactive = client.get("/api/v1/branches", headers=admin_headers).json()[0]
        assert inactive["is_active"] is False

        reactivated = client.put(
            f"/api/v1/branches/{branch['id']}",
            headers=admin_headers,
            json={**payload, "name": "Lima Norte"},
        )
        assert reactivated.status_code == 200, reactivated.text
        assert reactivated.json()["is_active"] is True

        seller = client.post("/api/v1/users", headers=admin_headers, json={
            "full_name": "Vendedor de prueba",
            "dni": "87654321",
            "password": "Vendedor2026!",
            "role": "seller",
        })
        assert seller.status_code == 201, seller.text
        seller_login = client.post("/api/v1/auth/login", json={
            "dni": "87654321",
            "password": "Vendedor2026!",
        })
        seller_headers = {"Authorization": "Bearer " + seller_login.json()["access_token"]}
        denied = client.post("/api/v1/branches", headers=seller_headers, json=payload)
        assert denied.status_code == 403

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
