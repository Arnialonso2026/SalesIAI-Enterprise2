import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi.testclient import TestClient  # noqa: E402

from app.core.config import settings  # noqa: E402
from app.database import Base, engine, SessionLocal  # noqa: E402
from app.main import app  # noqa: E402
from app.models import InventoryMovement, User  # noqa: E402


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
            "/api/v1/customers", headers=headers, params={"search": "20601234567"}
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

        sales_history = client.get(
            "/api/v1/sales/history",
            headers=headers,
            params={"limit": 100, "offset": 0},
        )
        assert sales_history.status_code == 200, sales_history.text
        history_item = next(
            item for item in sales_history.json() if item["sale"]["id"] == sale["id"]
        )
        assert history_item["paid_amount"] == sale["total"]
        assert history_item["balance"] == "0.00"

        invoice_response = client.post(
            f"/api/v1/sales/{sale['id']}/documents",
            headers=headers,
            json={"document_type": "factura"},
        )
        assert invoice_response.status_code == 201, invoice_response.text
        invoice = invoice_response.json()
        assert invoice["document_type"] == "factura"
        assert invoice["document_number"].startswith("F001-")
        assert invoice["customer_name"] == customer["name"]
        assert invoice["customer_document"] == customer["document_number"]
        assert invoice["items"][0]["product_name"] == product["name"]
        assert invoice["total"] == sale["total"]
        receipts_response = client.get("/api/v1/sales/documents/payment-receipts", headers=headers)
        assert receipts_response.status_code == 200, receipts_response.text
        listed_invoice = next(
            item for item in receipts_response.json()
            if item["document_number"] == invoice["document_number"]
        )
        assert listed_invoice["sale_number"] == sale["sale_number"]
        assert listed_invoice["sale_id"] == sale["id"]
        assert listed_invoice["items"][0]["product_name"] == product["name"]
        assert listed_invoice["customer_name"] == customer["name"]
        assert client.post(
            f"/api/v1/sales/{sale['id']}/documents",
            headers=headers,
            json={"document_type": "boleta"},
        ).status_code == 409

        dashboard = client.get("/api/v1/dashboard/summary", headers=headers)
        assert dashboard.status_code == 200
        dashboard_summary = dashboard.json()
        assert "previous_period_revenue" in dashboard_summary
        if dashboard_summary["previous_period_revenue"]:
            expected_change = (
                (dashboard_summary["month_revenue"] - dashboard_summary["previous_period_revenue"])
                / dashboard_summary["previous_period_revenue"] * 100
            )
            assert abs(dashboard_summary["month_revenue_change_percent"] - expected_change) < 0.0001
        else:
            assert dashboard_summary["month_revenue_change_percent"] is None
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

        matching_sales = client.get("/api/v1/sales", headers=headers, params={"search": "20601234567"})
        assert matching_sales.status_code == 200
        assert [item["sale_number"] for item in matching_sales.json()] == [sale["sale_number"]]
        assert matching_sales.json()[0]["document"]["document_number"] == invoice["document_number"]
        sale_created_at = datetime.fromisoformat(sale["created_at"])
        filtered_sales = client.get("/api/v1/sales", headers=headers, params={
            "status": "completed",
            "start_at": sale_created_at.isoformat(),
            "end_before": (sale_created_at + timedelta(microseconds=1)).isoformat(),
        })
        assert filtered_sales.status_code == 200, filtered_sales.text
        assert [item["id"] for item in filtered_sales.json()] == [sale["id"]]
        assert client.get("/api/v1/sales", headers=headers, params={"status": "pending"}).json() == []
        invalid_range = client.get("/api/v1/sales", headers=headers, params={
            "start_at": sale_created_at.isoformat(),
            "end_before": sale_created_at.isoformat(),
        })
        assert invalid_range.status_code == 422

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

        with SessionLocal() as db:
            movement_time = datetime.now(timezone.utc)
            company_id = db.query(User).filter_by(dni=os.environ["ADMIN_DNI"]).one().company_id
            db.add_all([
                InventoryMovement(
                    company_id=company_id,
                    product_id=product["id"],
                    movement_type="entry",
                    quantity=1,
                    stock_after=original_stock - 2 + index,
                    note=f"Prueba de paginación {index}",
                    created_at=movement_time + timedelta(seconds=index),
                )
                for index in range(105)
            ])
            db.commit()
        first_movement_page = client.get(
            "/api/v1/inventory/movements", headers=headers, params={"limit": 100, "offset": 0}
        )
        second_movement_page = client.get(
            "/api/v1/inventory/movements", headers=headers, params={"limit": 100, "offset": 100}
        )
        assert first_movement_page.status_code == 200
        assert second_movement_page.status_code == 200
        first_page = first_movement_page.json()
        second_page = second_movement_page.json()
        assert len(first_page) == 100
        assert len(second_page) >= 5
        paged_movements = first_page + second_page
        assert len({movement["id"] for movement in paged_movements}) == len(paged_movements)
        assert sum(movement["note"].startswith("Prueba de paginación") for movement in paged_movements) == 105

        rejected = client.post("/api/v1/sales", headers=headers, json={
            "items": [{"product_id": product["id"], "quantity": original_stock}],
            "payment_method": "cash",
        })
        assert rejected.status_code == 409
        history = client.get("/api/v1/sales", headers=headers).json()
        assert len(history) == 1

        partial_sale_response = client.post("/api/v1/sales", headers=headers, json={
            "items": [{"product_id": product["id"], "quantity": 1}],
            "payment_method": "cash",
            "payment_amount": "50.00",
        })
        assert partial_sale_response.status_code == 201, partial_sale_response.text
        partial_sale = partial_sale_response.json()
        partial_sale_id = partial_sale["id"]
        sale_total = Decimal(partial_sale["total"])
        assert Decimal(partial_sale["payments"][0]["amount"]) == Decimal("50.00")
        invalid_invoice = client.post(
            f"/api/v1/sales/{partial_sale_id}/documents",
            headers=headers,
            json={"document_type": "factura"},
        )
        assert invalid_invoice.status_code == 422
        receipt_response = client.post(
            f"/api/v1/sales/{partial_sale_id}/documents",
            headers=headers,
            json={"document_type": "boleta"},
        )
        assert receipt_response.status_code == 201, receipt_response.text
        assert receipt_response.json()["customer_name"] == "Cliente de mostrador"

        receivables_response = client.get("/api/v1/sales/accounts-receivable", headers=headers)
        assert receivables_response.status_code == 200, receivables_response.text
        receivable = next(item for item in receivables_response.json() if item["sale"]["id"] == partial_sale_id)
        assert Decimal(receivable["balance"]) == sale_total - Decimal("50.00")

        first_payment = client.post(f"/api/v1/sales/{partial_sale_id}/payments", headers=headers, json={
            "amount": "20.00",
            "method": "transfer",
        })
        assert first_payment.status_code == 200, first_payment.text
        assert len(first_payment.json()["payments"]) == 2

        remaining_balance = sale_total - Decimal("70.00")
        overpayment = client.post(f"/api/v1/sales/{partial_sale_id}/payments", headers=headers, json={
            "amount": str(remaining_balance + Decimal("0.01")),
            "method": "cash",
        })
        assert overpayment.status_code == 409

        final_payment = client.post(f"/api/v1/sales/{partial_sale_id}/payments", headers=headers, json={
            "amount": str(remaining_balance),
            "method": "cash",
        })
        assert final_payment.status_code == 200, final_payment.text
        remaining_receivables = client.get("/api/v1/sales/accounts-receivable", headers=headers).json()
        assert all(item["sale"]["id"] != partial_sale_id for item in remaining_receivables), remaining_receivables

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


def test_sale_creates_selected_document_with_temporary_customer_snapshot() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"],
            "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        customer = client.get("/api/v1/customers", headers=headers).json()[0]
        product = client.get("/api/v1/products", headers=headers).json()[0]
        original_customer = customer.copy()

        response = client.post("/api/v1/sales", headers=headers, json={
            "customer_id": customer["id"],
            "items": [{"product_id": product["id"], "quantity": 1}],
            "document_type": "factura",
            "document_customer": {
                "name": "Empresa temporal de prueba",
                "customer_type": "business",
                "document_number": "20601234567",
                "address": "Dirección exclusiva para esta venta",
                "email": "venta@example.com",
                "phone": "+51 900 111 222",
            },
        })
        assert response.status_code == 201, response.text
        sale = response.json()
        document = sale["document"]
        assert document["document_type"] == "factura"
        assert document["document_number"].startswith("F001-")
        assert document["customer_name"] == "Empresa temporal de prueba"
        assert document["customer_document"] == "20601234567"
        assert document["customer_address"] == "Dirección exclusiva para esta venta"
        assert document["customer_email"] == "venta@example.com"
        assert document["customer_phone"] == "+51 900 111 222"
        assert document["total"] == sale["total"]

        unchanged_customer = client.get(
            "/api/v1/customers", headers=headers,
            params={"search": original_customer["document_number"]},
        ).json()[0]
        assert unchanged_customer == original_customer

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
