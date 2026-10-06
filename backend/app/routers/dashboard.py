from datetime import datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Customer, Product, Sale, User

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary")
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, object]:
    now = datetime.now(timezone.utc)
    start_today = datetime.combine(now.date(), time.min, tzinfo=timezone.utc)
    start_month = start_today.replace(day=1)
    sales_query = select(Sale).where(Sale.company_id == user.company_id, Sale.status == "completed")
    total_revenue = db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(
        Sale.company_id == user.company_id, Sale.status == "completed"
    )) or Decimal("0")
    month_revenue = db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(
        Sale.company_id == user.company_id, Sale.status == "completed", Sale.created_at >= start_month
    )) or Decimal("0")
    today_count = db.scalar(select(func.count(Sale.id)).where(
        Sale.company_id == user.company_id, Sale.status == "completed", Sale.created_at >= start_today
    )) or 0
    sales_count = db.scalar(select(func.count(Sale.id)).where(
        Sale.company_id == user.company_id, Sale.status == "completed"
    )) or 0
    customers_count = db.scalar(select(func.count(Customer.id)).where(
        Customer.company_id == user.company_id, Customer.is_active.is_(True)
    )) or 0
    low_stock = db.scalar(select(func.count(Product.id)).where(
        Product.company_id == user.company_id, Product.is_active.is_(True), Product.stock <= Product.min_stock
    )) or 0

    daily_rows = db.execute(
        select(func.date(Sale.created_at), func.sum(Sale.total), func.count(Sale.id))
        .where(Sale.company_id == user.company_id, Sale.status == "completed", Sale.created_at >= start_today - timedelta(days=6))
        .group_by(func.date(Sale.created_at)).order_by(func.date(Sale.created_at))
    ).all()
    recent_sales = db.scalars(sales_query.order_by(Sale.created_at.desc()).limit(6)).all()

    return {
        "total_revenue": float(total_revenue),
        "month_revenue": float(month_revenue),
        "today_sales": today_count,
        "sales_count": sales_count,
        "customers_count": customers_count,
        "low_stock_count": low_stock,
        "daily_sales": [
            {"date": str(day), "total": float(total), "count": int(count)}
            for day, total, count in daily_rows
        ],
        "recent_sales": [{
            "id": sale.id, "sale_number": sale.sale_number, "total": float(sale.total),
            "status": sale.status, "created_at": sale.created_at.isoformat(),
        } for sale in recent_sales],
    }
