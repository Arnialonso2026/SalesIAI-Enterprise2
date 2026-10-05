from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database import get_db
from app.deps import require_roles
from app.models import User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.services.audit import record_audit_event

router = APIRouter(prefix="/users", tags=["Usuarios"])


def get_company_user(user_id: int, company_id: int, db: Session) -> User:
    user = db.scalar(select(User).where(User.id == user_id, User.company_id == company_id))
    if user is None:
        raise HTTPException(status_code=404, detail="No se encontró el usuario.")
    return user


def ensure_last_admin_is_preserved(user: User, new_role: str, is_active: bool, db: Session) -> None:
    remains_admin = new_role == "admin" and is_active
    if user.role != "admin" or not user.is_active or remains_admin:
        return
    other_admin = db.scalar(select(User.id).where(
        User.company_id == user.company_id,
        User.role == "admin",
        User.is_active.is_(True),
        User.id != user.id,
    ).limit(1))
    if other_admin is None:
        raise HTTPException(status_code=409, detail="No puedes quitar o desactivar al último administrador activo.")


@router.get("", response_model=list[UserOut])
def list_users(
    db: Session = Depends(get_db), admin: User = Depends(require_roles()),
) -> list[User]:
    return list(db.scalars(
        select(User).where(User.company_id == admin.company_id).order_by(User.full_name, User.id)
    ).all())


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    request: Request,
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles()),
) -> User:
    if db.scalar(select(User.id).where(User.dni == payload.dni)) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese DNI.")
    email = str(payload.email).lower() if payload.email else None
    if email and db.scalar(select(User.id).where(func.lower(User.email) == email)) is not None:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo.")

    user = User(
        company_id=admin.company_id,
        full_name=payload.full_name.strip(),
        email=email,
        dni=payload.dni,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="El DNI o correo ya está asignado a otro usuario.") from error
    db.refresh(user)
    record_audit_event(
        db,
        company_id=admin.company_id,
        user_id=admin.id,
        action="create_user",
        entity_type="user",
        entity_id=user.id,
        details={"target_role": user.role, "target_dni": user.dni},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user


@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    request: Request,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles()),
) -> User:
    user = get_company_user(user_id, admin.company_id, db)
    data = payload.model_dump(exclude_unset=True)
    new_role = data["role"]
    new_dni = data.get("dni", user.dni)
    new_password = data.get("password", user.password_hash)
    new_active = data["is_active"]

    if new_dni is not None and db.scalar(select(User.id).where(User.dni == new_dni, User.id != user.id)) is not None:
        raise HTTPException(status_code=409, detail="Ese DNI ya está asignado a otro usuario.")
    email_value = data.get("email", user.email)
    email = str(email_value).lower() if email_value else None
    if email and db.scalar(select(User.id).where(
        func.lower(User.email) == email, User.id != user.id
    )) is not None:
        raise HTTPException(status_code=409, detail="Ese correo ya está asignado a otro usuario.")

    effective_active = new_active and new_dni is not None and new_password is not None
    ensure_last_admin_is_preserved(user, new_role, effective_active, db)
    if user.id == admin.id and (new_role != "admin" or not new_active or new_dni is None or new_password is None):
        raise HTTPException(status_code=409, detail="No puedes quitar tus propias credenciales de administrador.")

    previous_email = user.email
    user.full_name = data["full_name"].strip()
    user.email = email
    if email != previous_email:
        user.auth_subject = None
    user.dni = new_dni
    user.role = new_role
    user.is_active = effective_active
    if "password" in data:
        user.password_hash = hash_password(data["password"]) if data["password"] else None
        if data["password"] is None:
            user.is_active = False
    if user.dni is None or user.password_hash is None:
        user.is_active = False

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="El DNI o correo ya está asignado a otro usuario.") from error
    db.refresh(user)
    record_audit_event(
        db,
        company_id=admin.company_id,
        user_id=admin.id,
        action="update_user",
        entity_type="user",
        entity_id=user.id,
        details={
            "previous_role": user.role,
            "new_role": new_role,
            "new_dni": new_dni,
            "new_active": effective_active,
        },
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user


@router.post("/{user_id}/clear-password", response_model=UserOut)
def clear_user_password(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles()),
) -> User:
    user = get_company_user(user_id, admin.company_id, db)
    if user.id == admin.id:
        raise HTTPException(status_code=409, detail="No puedes quitar tu propia contraseña.")
    if user.role == "admin" and user.is_active:
        ensure_last_admin_is_preserved(user, "warehouse", False, db)
    user.password_hash = None
    user.is_active = False
    db.commit()
    db.refresh(user)
    record_audit_event(
        db,
        company_id=admin.company_id,
        user_id=admin.id,
        action="clear_password",
        entity_type="user",
        entity_id=user.id,
        details={"target_user": user.full_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(require_roles()),
) -> Response:
    user = get_company_user(user_id, admin.company_id, db)
    if user.id == admin.id:
        raise HTTPException(status_code=409, detail="No puedes eliminar tu propia cuenta.")
    if user.role == "admin" and user.is_active:
        ensure_last_admin_is_preserved(user, "warehouse", False, db)

    # Se conserva la fila porque puede estar referenciada por ventas históricas.
    user.is_active = False
    user.dni = None
    user.email = None
    user.password_hash = None
    user.auth_subject = None
    db.commit()
    record_audit_event(
        db,
        company_id=admin.company_id,
        user_id=admin.id,
        action="delete_user",
        entity_type="user",
        entity_id=user.id,
        details={"target_user": user.full_name},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
