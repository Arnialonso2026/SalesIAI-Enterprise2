import asyncio

import pytest
from fastapi import HTTPException
import os

from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal
from app.deps import authenticate_token
from app.main import app
from app.services.realtime import RealtimeHub


class FakeWebSocket:
    def __init__(self) -> None:
        self.messages: list[dict[str, object]] = []
        self.accepted_protocol: str | None = None

    async def accept(self, subprotocol: str) -> None:
        self.accepted_protocol = subprotocol

    async def send_json(self, event: dict[str, object]) -> None:
        self.messages.append(event)


def test_realtime_hub_scopes_events_to_company() -> None:
    async def check_scope() -> None:
        hub = RealtimeHub()
        first_company = FakeWebSocket()
        second_company = FakeWebSocket()
        await hub.connect(1, first_company)
        await hub.connect(2, second_company)

        await hub.publish_change(1, "sales", "post", 201)

        assert first_company.accepted_protocol == "salesia"
        assert len(first_company.messages) == 1
        assert first_company.messages[0]["resource"] == "sales"
        assert second_company.messages == []

        hub.disconnect(1, first_company)
        hub.disconnect(2, second_company)

    asyncio.run(check_scope())


def test_authenticated_websocket_receives_successful_api_changes() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
        headers = {"origin": "http://localhost:5173"}

        with client.websocket_connect(
            "/api/v1/realtime/ws",
            subprotocols=["salesia", f"bearer.{token}"],
            headers=headers,
        ) as websocket, client.websocket_connect(
            "/api/v1/realtime/ws",
            subprotocols=["salesia", f"bearer.{token}"],
            headers=headers,
        ) as second_websocket:
            invalid = client.post("/api/v1/customers", headers={
                **headers,
                "Authorization": f"Bearer {token}",
            }, json={"name": "x"})
            assert invalid.status_code == 422

            response = client.post("/api/v1/customers", headers={
                **headers,
                "Authorization": f"Bearer {token}",
            }, json={"name": "Cambio en tiempo real"})
            assert response.status_code == 201, response.text

            for connection in (websocket, second_websocket):
                event = connection.receive_json()
                assert event["type"] == "data_changed"
                assert event["resource"] == "customers"
                assert event["operation"] == "post"
                assert event["status_code"] == 201
                assert "event_id" in event

        with SessionLocal() as db:
            with pytest.raises(HTTPException) as rejection:
                authenticate_token("invalid-token", db)
            assert rejection.value.status_code == 401

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
