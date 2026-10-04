from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.database import get_db
from app.models import User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Inicia sesión para continuar.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized
    subject = decode_access_token(credentials.credentials)
    if subject is None:
        raise unauthorized
    user = db.get(User, int(subject))
    if user is None or not user.is_active:
        raise unauthorized
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
