from datetime import datetime, timedelta, timezone

import jwt as pyjwt
from jwt import PyJWKClient, PyJWKClientError
from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.core.config import settings

ALGORITHM = "HS256"
password_hash = PasswordHash.recommended()
supabase_jwks_client = (
    PyJWKClient(settings.supabase_jwks_url, cache_jwk_set=True, cache_keys=True, timeout=5)
    if settings.supabase_enabled
    else None
)


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return password_hash.verify(password, hashed_password)


def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expires = datetime.now(timezone.utc) + timedelta(
        minutes=expires_minutes or settings.access_token_expire_minutes
    )
    return jwt.encode({"sub": subject, "exp": expires}, settings.secret_key, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None


def decode_supabase_access_token(token: str) -> dict[str, str] | None:
    if not settings.supabase_enabled or supabase_jwks_client is None:
        return None
    try:
        signing_key = supabase_jwks_client.get_signing_key_from_jwt(token)
        claims = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "EdDSA"],
            audience=settings.supabase_jwt_audience,
            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            options={"require": ["exp", "iat", "sub"]},
        )
    except (pyjwt.PyJWTError, PyJWKClientError, ValueError):
        return None

    subject = claims.get("sub")
    email = claims.get("email")
    if not isinstance(subject, str) or not isinstance(email, str) or not email.strip():
        return None
    return {"sub": subject, "email": email.strip().lower()}
