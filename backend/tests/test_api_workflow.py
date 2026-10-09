import os

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.database import Base, engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


def test_authenticated_sale_updates_inventory_and_is_atomic() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        products = client.get("/api/v1/products", headers=headers).json()
        product = next(item for item in products if item["sku"] == "ACC-002")
        original_stock = product["stock"]
        customer = client.get(
            "/api/v1/customers", headers=headers, params={"search": "RUC-20601234567"}
        ).json()[0]

        response = client.post("/api/v1/sales", headers=headers, json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": 2}],
            "discount": "10.00", "payment_method": "card",
            "notes": "Llamar para coordinar entrega",
        })
        assert response.status_code == 201, response.text
        sale = response.json()
        assert sale["subtotal"] == "278.00"
        assert sale["tax"] == "48.24"
        assert sale["total"] == "316.24"
        assert sale["payments"][0]["method"] == "card"
        assert sale["created_by"]["full_name"] == "Administrador SalesIA"
        assert sale["notes"] == "Llamar para coordinar entrega"

        dashboard = client.get("/api/v1/dashboard/summary", headers=headers)
        assert dashboard.status_code == 200
        recent_sale = next(item for item in dashboard.json()["recent_sales"] if item["id"] == sale["id"])
        assert recent_sale["created_by"] == "Administrador SalesIA"
        analytics = client.get("/api/v1/analytics/dashboard", headers=headers)
        assert analytics.status_code == 200
        seller_result = next(
            item for item in analytics.json()["sales_by_seller"]
            if item["user_id"] == sale["created_by_id"]
        )
        assert seller_result["sales_count"] == 1
        assert seller_result["revenue"] == 316.24

        matching_sales = client.get("/api/v1/sales", headers=headers, params={"search": "RUC-20601234567"})
        assert matching_sales.status_code == 200
        assert [item["sale_number"] for item in matching_sales.json()] == [sale["sale_number"]]

        customer_history = client.get(f"/api/v1/customers/{customer['id']}/sales", headers=headers)
        assert customer_history.status_code == 200
        assert [item["id"] for item in customer_history.json()] == [sale["id"]]
        customer_summary = client.get(f"/api/v1/customers/{customer['id']}/summary", headers=headers)
        assert customer_summary.status_code == 200
        assert customer_summary.json()["sales_count"] == 1
        assert customer_summary.json()["total_spent"] == 316.24

        category = client.post("/api/v1/categories", headers=headers, json={
            "name": "Pruebas", "description": "Categoría de integración",
        })
        assert category.status_code == 201
        category_id = category.json()["id"]
        updated_category = client.put(f"/api/v1/categories/{category_id}", headers=headers, json={
            "name": "Pruebas editada", "description": None,
        })
        assert updated_category.status_code == 200
        assert updated_category.json()["name"] == "Pruebas editada"
        assert client.delete(f"/api/v1/categories/{category_id}", headers=headers).status_code == 204

        refreshed_product = next(
            item for item in client.get("/api/v1/products", headers=headers).json()
            if item["id"] == product["id"]
        )
        assert refreshed_product["stock"] == original_stock - 2
        movements = client.get("/api/v1/inventory/movements", headers=headers).json()
        sale_movement = next(item for item in movements if item["sale_id"] == sale["id"])
        assert sale_movement["quantity"] == -2
        assert sale_movement["stock_after"] == original_stock - 2

        rejected = client.post("/api/v1/sales", headers=headers, json={
            "items": [{"product_id": product["id"], "quantity": original_stock}],
            "payment_method": "cash",
        })
        assert rejected.status_code == 409
        history = client.get("/api/v1/sales", headers=headers).json()
        assert len(history) == 1

        with SessionLocal() as db:
            admin = db.query(User).filter_by(email="admin@salesia.example.com").one()
            admin.role = "analyst"
            db.commit()
        analyst_login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        analyst_headers = {"Authorization": f"Bearer {analyst_login.json()['access_token']}"}
        forbidden = client.post("/api/v1/categories", headers=analyst_headers, json={
            "name": "No autorizada", "description": None,
        })
        assert forbidden.status_code == 403

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()


def test_demo_access_is_read_only_and_disabled_in_production(monkeypatch) -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    monkeypatch.setattr(settings, "app_env", "development")

    with TestClient(app) as client:
        response = client.post("/api/v1/auth/demo")
        assert response.status_code == 200, response.text
        demo_user = response.json()["user"]
        assert demo_user["role"] == "admin"
        assert demo_user["password_configured"] is False
        headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
        assert client.get("/api/v1/sales", headers=headers).status_code == 200
        allowed = client.post("/api/v1/categories", headers=headers, json={
            "name": "Categoría demo", "description": None,
        })
        assert allowed.status_code == 201

        monkeypatch.setattr(settings, "app_env", "production")
        assert client.post("/api/v1/auth/demo").status_code == 404

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
