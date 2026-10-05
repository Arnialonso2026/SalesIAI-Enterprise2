from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import AuditLog, User
from app.schemas import AuditLogOut

router = APIRouter(prefix="/audit", tags=["Auditoría"])


@router.get("/logs", response_model=list[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin", "manager")),
) -> list[AuditLog]:
    return list(db.scalars(
        select(AuditLog)
        .where(AuditLog.company_id == user.company_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(200)
    ).all())
