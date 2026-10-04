from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import deps
from app.core import security
from app.core.config import Settings
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import User


class FakeJwksClient:
    def __init__(self, key: object) -> None:
        self.key = key

    def get_signing_key_from_jwt(self, _: str) -> SimpleNamespace:
        return SimpleNamespace(key=self.key)


def make_token(private_key: object, *, issuer: str = "https://salesia-test.supabase.co/auth/v1", audience: str = "authenticated") -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": "f3d919f1-fb04-4c10-b351-43ca571a91a4",
            "email": "member@example.com",
            "aud": audience,
            "iss": issuer,
            "iat": now,
            "exp": now + timedelta(minutes=5),
        },
        private_key,
        algorithm="ES256",
    )


def test_supabase_jwks_token_is_verified_and_normalized(monkeypatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    monkeypatch.setattr(security, "settings", Settings(
        supabase_url="https://salesia-test.supabase.co",
        supabase_jwks_url="https://salesia-test.supabase.co/auth/v1/.well-known/jwks.json",
        supabase_jwt_audience="authenticated",
    ))
    monkeypatch.setattr(security, "supabase_jwks_client", FakeJwksClient(public_key))

    claims = security.decode_supabase_access_token(make_token(private_key))

    assert claims == {"sub": "f3d919f1-fb04-4c10-b351-43ca571a91a4", "email": "member@example.com"}


def test_supabase_jwks_token_rejects_wrong_issuer(monkeypatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(security, "settings", Settings(
        supabase_url="https://salesia-test.supabase.co",
        supabase_jwks_url="https://salesia-test.supabase.co/auth/v1/.well-known/jwks.json",
        supabase_jwt_audience="authenticated",
    ))
    monkeypatch.setattr(security, "supabase_jwks_client", FakeJwksClient(private_key.public_key()))

    claims = security.decode_supabase_access_token(make_token(private_key, issuer="https://attacker.example/auth/v1"))

    assert claims is None


def test_supabase_jwks_token_rejects_wrong_audience(monkeypatch) -> None:
    private_key = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(security, "settings", Settings(
        supabase_url="https://salesia-test.supabase.co",
        supabase_jwks_url="https://salesia-test.supabase.co/auth/v1/.well-known/jwks.json",
        supabase_jwt_audience="authenticated",
    ))
    monkeypatch.setattr(security, "supabase_jwks_client", FakeJwksClient(private_key.public_key()))

    claims = security.decode_supabase_access_token(make_token(private_key, audience="other"))

    assert claims is None


def test_supabase_identity_must_match_active_salesia_user(monkeypatch) -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    monkeypatch.setattr(deps.settings, "supabase_url", "https://salesia-test.supabase.co")
    monkeypatch.setattr(deps.settings, "supabase_jwks_url", "https://salesia-test.supabase.co/auth/v1/.well-known/jwks.json")
    monkeypatch.setattr(security, "decode_supabase_access_token", lambda _: {
        "sub": "f3d919f1-fb04-4c10-b351-43ca571a91a4", "email": "admin@salesia.example.com",
    })
    monkeypatch.setattr(deps, "decode_supabase_access_token", security.decode_supabase_access_token)

    with TestClient(app) as client:
        linked = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer signed-supabase-token"})
        assert linked.status_code == 200, linked.text
        assert linked.json()["email"] == "admin@salesia.example.com"
        with SessionLocal() as db:
            admin = db.query(User).filter_by(email="admin@salesia.example.com").one()
            assert admin.auth_subject == "f3d919f1-fb04-4c10-b351-43ca571a91a4"

        monkeypatch.setattr(security, "decode_supabase_access_token", lambda _: {
            "sub": "a062af3d-3675-4845-886d-86ccfe10140c", "email": "unknown@example.com",
        })
        monkeypatch.setattr(deps, "decode_supabase_access_token", security.decode_supabase_access_token)
        unlinked = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer another-token"})
        assert unlinked.status_code == 403

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
    engine.dispose()
