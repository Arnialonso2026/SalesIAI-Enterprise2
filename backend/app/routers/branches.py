from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Branch, User
from app.schemas import BranchIn, BranchOut

router = APIRouter(prefix="/branches", tags=["Sucursales"])


@router.get("", response_model=list[BranchOut])
def list_branches(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Branch]:
    return list(db.scalars(
        select(Branch)
        .where(Branch.company_id == user.company_id)
        .order_by(Branch.is_active.desc(), Branch.name)
    ).all())


@router.post("", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(
    payload: BranchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> Branch:
    duplicate = db.scalar(select(Branch.id).where(
        Branch.company_id == user.company_id,
        Branch.name == payload.name,
    ))
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Ya existe una sucursal con ese nombre.")
    branch = Branch(company_id=user.company_id, **payload.model_dump())
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return branch


@router.put("/{branch_id}", response_model=BranchOut)
def update_branch(
    branch_id: int,
    payload: BranchIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> Branch:
    branch = db.scalar(select(Branch).where(
        Branch.id == branch_id,
        Branch.company_id == user.company_id,
    ))
    if branch is None:
        raise HTTPException(status_code=404, detail="No se encontró la sucursal.")
    duplicate = db.scalar(select(Branch.id).where(
        Branch.company_id == user.company_id,
        Branch.name == payload.name,
        Branch.id != branch_id,
    ))
    if duplicate is not None:
        raise HTTPException(status_code=409, detail="Ya existe una sucursal con ese nombre.")
    for key, value in payload.model_dump().items():
        setattr(branch, key, value)
    branch.is_active = True
    db.commit()
    db.refresh(branch)
    return branch


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_branch(
    branch_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> Response:
    branch = db.scalar(select(Branch).where(
        Branch.id == branch_id,
        Branch.company_id == user.company_id,
    ))
    if branch is None:
        raise HTTPException(status_code=404, detail="No se encontró la sucursal.")
    branch.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
