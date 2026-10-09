from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Customer, InventoryMovement, Payment, Product, Sale, SaleItem, User
from app.schemas import SaleIn, SaleOut
from app.services.sales import calculate_totals, money

router = APIRouter(prefix="/sales", tags=["Ventas"])


@router.get("", response_model=list[SaleOut])
def list_sales(
    search: str = Query(default="", max_length=60),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[Sale]:
    query = select(Sale).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments)
    ).where(Sale.company_id == user.company_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(
            Sale.sale_number.ilike(term),
            Sale.customer.has(or_(
                Customer.name.ilike(term), Customer.document_number.ilike(term),
                Customer.email.ilike(term), Customer.phone.ilike(term),
                Customer.address.ilike(term),
            )),
            Sale.created_by.has(or_(User.full_name.ilike(term), User.dni.ilike(term))),
        ))
    return list(db.scalars(query.order_by(Sale.created_at.desc()).limit(200)).unique().all())


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Sale:
    sale = db.scalar(select(Sale).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments)
    ).where(Sale.id == sale_id, Sale.company_id == user.company_id))
    if sale is None:
        raise HTTPException(status_code=404, detail="No se encontró la venta.")
    return sale


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleIn, db: Session = Depends(get_db), user: User = Depends(require_roles("seller"))) -> Sale:
    if payload.customer_id is not None and db.scalar(select(Customer).where(
        Customer.id == payload.customer_id, Customer.company_id == user.company_id, Customer.is_active.is_(True)
    )) is None:
        raise HTTPException(status_code=404, detail="No se encontró el cliente.")

    quantities: dict[int, int] = {}
    for item in payload.items:
        quantities[item.product_id] = quantities.get(item.product_id, 0) + item.quantity

    products: dict[int, Product] = {}
    for product_id, quantity in quantities.items():
        product = db.scalar(select(Product).where(
            Product.id == product_id, Product.company_id == user.company_id, Product.is_active.is_(True)
        ).with_for_update())
        if product is None:
            raise HTTPException(status_code=404, detail=f"No se encontró el producto #{product_id}.")
        if product.stock < quantity:
            raise HTTPException(status_code=409, detail=f"Stock insuficiente para {product.name}; disponible: {product.stock}.")
        products[product_id] = product

    subtotal = money(sum((products[item.product_id].price * item.quantity for item in payload.items), Decimal("0")))
    try:
        subtotal, tax, total = calculate_totals(subtotal, payload.discount, Decimal(str(settings.tax_rate)))
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error

    sale = Sale(
        company_id=user.company_id, customer_id=payload.customer_id, created_by_id=user.id,
        sale_number=f"VTA-{datetime.now(timezone.utc):%y%m%d%H%M%S%f}", status="completed",
        subtotal=subtotal, discount=payload.discount, tax=tax, total=total, notes=payload.notes,
    )
    db.add(sale)
    db.flush()

    for item in payload.items:
        product = products[item.product_id]
        line_total = money(product.price * item.quantity)
        sale.items.append(SaleItem(
            product_id=product.id, product_name=product.name, quantity=item.quantity,
            unit_price=product.price, line_total=line_total,
        ))

    for product_id, quantity in quantities.items():
        product = products[product_id]
        product.stock -= quantity
        db.add(InventoryMovement(
            company_id=user.company_id, product_id=product_id, sale_id=sale.id,
            movement_type="sale", quantity=-quantity, stock_after=product.stock,
            note=f"Salida por venta {sale.sale_number}",
        ))

    sale.payments.append(Payment(
        amount=total, method=payload.payment_method.strip().lower(), status="paid",
    ))
    db.commit()
    return get_sale(sale.id, db, user)
