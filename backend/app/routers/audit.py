from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import AuditLog, User
from app.schemas import AuditLogOut, IpRegistryOut, LocationOut
from app.services.location import resolve_ip_location

router = APIRouter(prefix="/audit", tags=["Auditoría"])


def get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@router.get("/logs", response_model=list[AuditLogOut])
def list_audit_logs(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> list[AuditLog]:
    return list(db.scalars(
        select(AuditLog)
        .where(AuditLog.company_id == user.company_id)
        .order_by(AuditLog.created_at.desc(), AuditLog.id.desc())
        .limit(200)
    ).all())


@router.get("/location", response_model=LocationOut)
def current_location(
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> LocationOut:
    ip_address = get_client_ip(request)
    location = resolve_ip_location(ip_address)
    if location is None:
        return LocationOut(
            ip_address=ip_address,
            country="No disponible",
            region="",
            city="",
            latitude=0,
            longitude=0,
            postal_code=None,
        )
    return LocationOut(
        ip_address=ip_address,
        country=location.country,
        region=location.region,
        city=location.city,
        latitude=location.latitude,
        longitude=location.longitude,
        postal_code=location.postal_code,
    )


@router.get("/ip-registry", response_model=list[IpRegistryOut])
def list_ip_registry(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("admin")),
) -> list[IpRegistryOut]:
    rows = db.scalars(
        select(AuditLog)
        .where(
            AuditLog.company_id == user.company_id,
            AuditLog.ip_address.is_not(None),
        )
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    ).all()
    grouped: dict[str, list[AuditLog]] = defaultdict(list)
    for row in rows:
        grouped[row.ip_address].append(row)

    registry_entries = [
        IpRegistryOut(
            ip_address=ip_address,
            last_seen=events[0].created_at,
            action_count=len(events),
            users=sorted({event.user_id for event in events if event.user_id is not None}),
            user_agents=sorted({event.user_agent for event in events if event.user_agent}),
        )
        for ip_address, events in grouped.items()
    ]
    locations = {}
    with ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {
            executor.submit(resolve_ip_location, entry.ip_address): entry.ip_address
            for entry in registry_entries[:20]
        }
        for future in future_map:
            ip_address = future_map[future]
            try:
                location = future.result()
            except Exception:
                continue
            if location is not None:
                locations[ip_address] = location

    return [
        entry.model_copy(update={
            "country": locations.get(entry.ip_address).country if locations.get(entry.ip_address) else "No disponible",
            "region": locations.get(entry.ip_address).region if locations.get(entry.ip_address) else "",
            "city": locations.get(entry.ip_address).city if locations.get(entry.ip_address) else "",
            "latitude": locations.get(entry.ip_address).latitude if locations.get(entry.ip_address) else None,
            "longitude": locations.get(entry.ip_address).longitude if locations.get(entry.ip_address) else None,
        })
        for entry in registry_entries
    ]
