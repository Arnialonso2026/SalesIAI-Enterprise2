from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User  # noqa: E402


def test_authenticated_sale_updates_inventory_and_is_atomic() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": "00000001", "password": "SalesIA2026!",
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        products = client.get("/api/v1/products", headers=headers).json()
        product = next(item for item in products if item["sku"] == "ACC-002")
        original_stock = product["stock"]
        customer = client.get("/api/v1/customers", headers=headers).json()[0]

        response = client.post("/api/v1/sales", headers=headers, json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": 2}],
            "discount": "10.00", "payment_method": "card",
        })
        assert response.status_code == 201, response.text
        sale = response.json()
        assert sale["subtotal"] == "278.00"
        assert sale["tax"] == "48.24"
        assert sale["total"] == "316.24"
        assert sale["payments"][0]["method"] == "card"

        customer_history = client.get(f"/api/v1/customers/{customer['id']}/sales", headers=headers)
        assert customer_history.status_code == 200
        assert [item["id"] for item in customer_history.json()] == [sale["id"]]

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
            "dni": "00000001", "password": "SalesIA2026!",
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
