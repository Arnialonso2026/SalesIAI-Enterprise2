from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import decode_access_token, decode_supabase_access_token
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def authenticate_token(token: str, db: Session) -> tuple[User, bool]:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Inicia sesión para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    subject = decode_access_token(token)
    if subject is not None and subject.isdecimal():
        user = db.get(User, int(subject))
        if user is None or not user.is_active:
            raise unauthorized
        return user, False

    if settings.supabase_enabled:
        claims = decode_supabase_access_token(token)
        if claims is None:
            raise unauthorized
        user = db.scalar(select(User).where(User.auth_subject == claims["sub"]))
        identity_linked = False
        if user is None:
            user = db.scalar(select(User).where(func.lower(User.email) == claims["email"]))
            if user is not None and user.is_active:
                if user.auth_subject not in (None, claims["sub"]):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Este correo ya está vinculado a otra identidad Supabase.",
                    )
                user.auth_subject = claims["sub"]
                db.commit()
                identity_linked = True
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu correo Supabase no está asociado a un usuario activo de SalesIA.",
            )
        return user, identity_linked

    raise unauthorized


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inicia sesión para continuar.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user, identity_linked = authenticate_token(credentials.credentials, db)
    request.state.authenticated_user = user
    request.state.server_data_changed = identity_linked
    return user


def require_roles(*allowed_roles: str):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role != "admin" and user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu rol no tiene permiso para realizar esta operación.",
            )
        return user

    return role_checker
