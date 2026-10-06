import asyncio

import os

from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.proxy import TrustedProxyMiddleware, is_trusted_proxy, parse_trusted_proxy_hosts
from app.database import Base, engine, SessionLocal
from app.main import app
from app.models import AuditLog, User


def test_trusted_proxy_uses_forwarded_ip() -> None:
    async def run() -> None:
        request = Request({
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": [(b"x-forwarded-for", b"203.0.113.10")],
            "client": ("10.0.0.1", 12345),
            "server": ("testserver", 80),
            "scheme": "http",
            "http_version": "1.1",
            "query_string": b"",
        })
        middleware = TrustedProxyMiddleware(lambda scope, receive, send: None, "10.0.0.1")

        async def call_next(current_request):
            assert current_request.client.host == "203.0.113.10"

        await middleware.dispatch(request, call_next)

        untrusted_request = Request({
            **request.scope,
            "client": ("198.51.100.99", 12345),
        })

        async def assert_untrusted(current_request):
            assert current_request.client.host == "198.51.100.99"

        await middleware.dispatch(untrusted_request, assert_untrusted)

    assert is_trusted_proxy("10.0.0.1", parse_trusted_proxy_hosts("10.0.0.1"))
    asyncio.run(run())


def test_audit_location_and_ip_registry_contracts(monkeypatch) -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    def fake_location(ip_address: str):
        assert ip_address == "testclient"
        return type(
            "Location",
            (),
            {
                "country": "Perú",
                "region": "Lima",
                "city": "Lima",
                "latitude": -12.0464,
                "longitude": -77.0428,
                "postal_code": "15001",
            },
        )()

    monkeypatch.setattr("app.routers.audit.resolve_ip_location", fake_location)

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        with SessionLocal() as db:
            db.add(AuditLog(
                company_id=1,
                user_id=1,
                action="login_success",
                entity_type="user",
                entity_id=1,
                details={"source": "test"},
                ip_address="203.0.113.10",
                user_agent="SalesIA test",
            ))
            db.commit()

        location = client.get(
            "/api/v1/audit/location",
            headers={**headers, "x-forwarded-for": "203.0.113.10"},
        )
        assert location.status_code == 200, location.text
        assert location.json()["ip_address"] == "testclient"
        assert location.json()["country"] == "Perú"
        assert location.json()["latitude"] == -12.0464

        spoofed_location = client.get(
            "/api/v1/audit/location",
            headers={**headers, "x-forwarded-for": "198.51.100.99"},
        )
        assert spoofed_location.status_code == 200, spoofed_location.text
        assert spoofed_location.json()["ip_address"] == "testclient"

        registry = client.get("/api/v1/audit/ip-registry", headers=headers)
        assert registry.status_code == 200, registry.text
        assert registry.json()[0]["ip_address"] == "203.0.113.10"
        assert registry.json()[0]["action_count"] == 1
        assert registry.json()[0]["last_seen"]
        assert registry.json()[0]["users"] == [1]

        with SessionLocal() as db:
            user = db.query(AuditLog).filter_by(ip_address="203.0.113.10").one().user_id
            assert user is not None
            user_record = db.get(User, user)
            user_record.role = "manager"
            db.commit()

        manager_login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        manager_headers = {"Authorization": f"Bearer {manager_login.json()['access_token']}"}
        assert client.get("/api/v1/audit/logs", headers=manager_headers).status_code == 403

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
