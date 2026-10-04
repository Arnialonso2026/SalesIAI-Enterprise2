from collections import Counter
from datetime import date, datetime, time, timedelta, timezone
from math import fsum, sqrt
from statistics import median
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Customer, Payment, Product, Sale, SaleItem


def calculate_statistics(values: list[float], threshold: float | None = None) -> dict[str, Any]:
    count = len(values)
    mean = fsum(values) / count
    sorted_values = sorted(values)
    variance = fsum((value - mean) ** 2 for value in values) / count
    frequencies = Counter(values)
    highest_frequency = max(frequencies.values())
    modes = sorted(value for value, frequency in frequencies.items() if frequency == highest_frequency)

    return {
        "count": count,
        "mean": mean,
        "median": median(sorted_values),
        "mode": modes if highest_frequency > 1 else [],
        "minimum": sorted_values[0],
        "maximum": sorted_values[-1],
        "range": sorted_values[-1] - sorted_values[0],
        "variance_population": variance,
        "standard_deviation_population": sqrt(variance),
        "probability_at_or_above_threshold": (
            sum(value >= threshold for value in values) / count if threshold is not None else None
        ),
        "threshold": threshold,
    }


def _period_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    return (
        datetime.combine(start_date, time.min, tzinfo=timezone.utc),
        datetime.combine(end_date + timedelta(days=1), time.min, tzinfo=timezone.utc),
    )


def analytics_dashboard(db: Session, company_id: int, start_date: date, end_date: date) -> dict[str, Any]:
    start_at, end_at = _period_bounds(start_date, end_date)
    period_days = (end_date - start_date).days + 1
    previous_start = start_date - timedelta(days=period_days)
    previous_start_at, _ = _period_bounds(previous_start, start_date - timedelta(days=1))

    completed_sales = select(Sale).where(
        Sale.company_id == company_id,
        Sale.status == "completed",
        Sale.created_at >= start_at,
        Sale.created_at < end_at,
    )
    revenue = db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(
        Sale.company_id == company_id,
        Sale.status == "completed",
        Sale.created_at >= start_at,
        Sale.created_at < end_at,
    )) or 0
    previous_revenue = db.scalar(select(func.coalesce(func.sum(Sale.total), 0)).where(
        Sale.company_id == company_id,
        Sale.status == "completed",
        Sale.created_at >= previous_start_at,
        Sale.created_at < start_at,
    )) or 0
    sales_count = db.scalar(select(func.count(Sale.id)).where(
        Sale.company_id == company_id,
        Sale.status == "completed",
        Sale.created_at >= start_at,
        Sale.created_at < end_at,
    )) or 0
    active_customers = db.scalar(select(func.count(Customer.id)).where(
        Customer.company_id == company_id, Customer.is_active.is_(True)
    )) or 0
    low_stock_products = db.scalar(select(func.count(Product.id)).where(
        Product.company_id == company_id,
        Product.is_active.is_(True),
        Product.stock <= Product.min_stock,
    )) or 0

    daily_rows = db.execute(
        select(func.date(Sale.created_at), func.sum(Sale.total))
        .where(
            Sale.company_id == company_id,
            Sale.status == "completed",
            Sale.created_at >= start_at,
            Sale.created_at < end_at,
        )
        .group_by(func.date(Sale.created_at))
        .order_by(func.date(Sale.created_at))
    ).all()
    product_rows = db.execute(
        select(SaleItem.product_name, func.sum(SaleItem.quantity), func.sum(SaleItem.line_total))
        .join(Sale, Sale.id == SaleItem.sale_id)
        .where(
            Sale.company_id == company_id,
            Sale.status == "completed",
            Sale.created_at >= start_at,
            Sale.created_at < end_at,
        )
        .group_by(SaleItem.product_name)
        .order_by(func.sum(SaleItem.line_total).desc())
        .limit(5)
    ).all()
    payment_rows = db.execute(
        select(Payment.method, func.sum(Payment.amount))
        .join(Sale, Sale.id == Payment.sale_id)
        .where(
            Sale.company_id == company_id,
            Sale.status == "completed",
            Payment.status == "paid",
            Sale.created_at >= start_at,
            Sale.created_at < end_at,
        )
        .group_by(Payment.method)
        .order_by(func.sum(Payment.amount).desc())
    ).all()

    revenue_value = float(revenue)
    previous_value = float(previous_revenue)
    return {
        "start_date": start_date,
        "end_date": end_date,
        "revenue": revenue_value,
        "previous_revenue": previous_value,
        "revenue_change_percent": (
            (revenue_value - previous_value) / previous_value * 100 if previous_value else None
        ),
        "sales_count": int(sales_count),
        "average_ticket": revenue_value / sales_count if sales_count else 0.0,
        "active_customers": int(active_customers),
        "low_stock_products": int(low_stock_products),
        "daily_sales": [{"date": str(day), "total": float(total)} for day, total in daily_rows],
        "top_products": [
            {"name": name, "quantity": int(quantity), "revenue": float(total)}
            for name, quantity, total in product_rows
        ],
        "payment_methods": [
            {"method": method, "amount": float(amount)} for method, amount in payment_rows
        ],
    }


def insight_candidates(db: Session, company_id: int, start_date: date, end_date: date) -> list[dict[str, Any]]:
    dashboard = analytics_dashboard(db, company_id, start_date, end_date)
    candidates: list[dict[str, Any]] = []

    if dashboard["sales_count"] == 0:
        candidates.append({
            "title": "Todavía no hay ventas en el periodo",
            "description": "Registra ventas para habilitar comparaciones y tendencias comerciales.",
            "severity": "info",
            "evidence": {"start_date": str(start_date), "end_date": str(end_date), "sales_count": 0},
        })
    elif dashboard["revenue_change_percent"] is not None:
        change = dashboard["revenue_change_percent"]
        if change <= -15:
            candidates.append({
                "title": "Los ingresos disminuyeron frente al periodo anterior",
                "description": f"Los ingresos bajaron {abs(change):.1f}% respecto a los {period_days_label(start_date, end_date)} días anteriores.",
                "severity": "warning",
                "evidence": {
                    "revenue": dashboard["revenue"],
                    "previous_revenue": dashboard["previous_revenue"],
                    "change_percent": change,
                },
            })
        elif change >= 15:
            candidates.append({
                "title": "Los ingresos crecieron frente al periodo anterior",
                "description": f"Los ingresos subieron {change:.1f}% respecto a los {period_days_label(start_date, end_date)} días anteriores.",
                "severity": "positive",
                "evidence": {
                    "revenue": dashboard["revenue"],
                    "previous_revenue": dashboard["previous_revenue"],
                    "change_percent": change,
                },
            })

    if dashboard["low_stock_products"]:
        low_stock = db.scalars(select(Product).where(
            Product.company_id == company_id,
            Product.is_active.is_(True),
            Product.stock <= Product.min_stock,
        ).order_by(Product.stock).limit(5)).all()
        candidates.append({
            "title": f"{dashboard['low_stock_products']} productos necesitan revisión de stock",
            "description": "Revisa las existencias mínimas antes de que afecten la disponibilidad de venta.",
            "severity": "warning",
            "evidence": {
                "products": [
                    {"name": product.name, "stock": product.stock, "minimum": product.min_stock}
                    for product in low_stock
                ],
                "total_products": dashboard["low_stock_products"],
            },
        })

    if dashboard["sales_count"] and dashboard["top_products"]:
        product = dashboard["top_products"][0]
        candidates.append({
            "title": f"{product['name']} lidera los ingresos del periodo",
            "description": f"Este producto generó S/ {product['revenue']:.2f} en {product['quantity']} unidades vendidas.",
            "severity": "info",
            "evidence": product,
        })

    return candidates


def period_days_label(start_date: date, end_date: date) -> int:
    return (end_date - start_date).days + 1
