import os

from fastapi.testclient import TestClient

from app.database import Base, engine, SessionLocal
from app.main import app
from app.models import Document, User
from app.routers.documents import storage_path


def test_document_lifecycle_requires_admin_and_keeps_files_isolated() -> None:
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

        assert client.get("/api/v1/documents").status_code == 401
        with client.websocket_connect(
            "/api/v1/realtime/ws",
            subprotocols=["salesia", f"bearer.{token}"],
            headers={"origin": "http://localhost:5173"},
        ) as websocket:
            upload = client.post(
                "/api/v1/documents",
                headers=headers,
                files={"file": ("reporte.txt", b"contenido de prueba", "text/plain")},
            )
            assert upload.status_code == 201, upload.text
            event = websocket.receive_json()
            assert event["type"] == "data_changed"
            assert event["resource"] == "documents"
            assert event["operation"] == "post"
            assert event["status_code"] == 201

        documents = client.get("/api/v1/documents", headers=headers)
        assert documents.status_code == 200
        document = documents.json()[0]
        assert document["title"] == "reporte"
        assert document["original_filename"] == "reporte.txt"

        download = client.get(f"/api/v1/documents/{document['id']}/download", headers=headers)
        assert download.status_code == 200
        assert download.content == b"contenido de prueba"

        with SessionLocal() as db:
            user = db.query(User).filter_by(dni=os.environ["ADMIN_DNI"]).one()
            stored = db.query(Document).filter_by(id=document["id"]).one()
            assert stored.company_id == user.company_id
            assert stored.uploaded_by_id == user.id

        assert client.delete(f"/api/v1/documents/{document['id']}", headers=headers).status_code == 200
        assert not storage_path(stored.filename).exists()

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
