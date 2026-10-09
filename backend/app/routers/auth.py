import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.database import get_db
from app.deps import get_current_user
from app.models import Company, User
from app.schemas import LoginIn, TokenOut, UserOut
from app.services.audit import record_audit_event

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenOut)
def login(request: Request, payload: LoginIn, db: Session = Depends(get_db)) -> TokenOut:
    user = db.scalar(select(User).where(User.dni == payload.dni))
    if (
        user is None
        or not user.is_active
        or not user.password_hash
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="DNI o contraseña incorrectos.")
    record_audit_event(
        db,
        company_id=user.company_id,
        user_id=user.id,
        action="login",
        entity_type="auth",
        entity_id=user.id,
        details={"method": "dni"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return TokenOut(access_token=create_access_token(str(user.id)), user=UserOut.model_validate(user))


@router.post("/demo", response_model=TokenOut)
def demo_login(request: Request, db: Session = Depends(get_db)) -> TokenOut:
    if settings.app_env.strip().lower() != "development":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado.")

    company = db.scalar(select(Company).order_by(Company.id).limit(1))
    if company is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="La empresa demo no está inicializada.")

    demo_email = "demo-access@salesia.example.com"
    user = db.scalar(select(User).where(User.email == demo_email))
    if user is None:
        while True:
            demo_dni = f"{secrets.randbelow(100_000_000):08d}"
            if db.scalar(select(User.id).where(User.dni == demo_dni)) is None:
                break
        user = User(
            company_id=company.id, full_name="Administrador de demostración",
            email=demo_email, dni=demo_dni, role="admin", is_active=True,
        )
        db.add(user)
        db.flush()
    elif user.company_id != company.id or not user.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado.")
    else:
        user.full_name = "Administrador de demostración"
        user.role = "admin"
        user.password_hash = None

    record_audit_event(
        db,
        company_id=company.id,
        user_id=user.id,
        action="demo_login",
        entity_type="auth",
        entity_id=user.id,
        details={"method": "development_demo"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    db.commit()
    db.refresh(user)
    return TokenOut(
        access_token=create_access_token(str(user.id), expires_minutes=60),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user
