from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.config import settings
from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import (
    Customer, InventoryMovement, Payment, Product, Sale, SaleItem, SalesDocument,
    SalesDocumentItem, User,
)
from app.schemas import (
    ReceivableOut, ReceivablePaymentIn, SaleIn, SaleOut,
    PaymentReceiptListOut, SalesDocumentCreateIn, SalesDocumentCustomerIn,
    SalesDocumentOut,
)
from app.services.sales import calculate_totals, money

router = APIRouter(prefix="/sales", tags=["Ventas"])


def build_sales_document(
    sale: Sale,
    user: User,
    document_type: Literal["boleta", "factura"],
    customer_snapshot: SalesDocumentCustomerIn | None = None,
) -> SalesDocument:
    customer = sale.customer
    name = customer_snapshot.name if customer_snapshot else customer.name if customer else "Cliente de mostrador"
    customer_type = customer_snapshot.customer_type if customer_snapshot else customer.customer_type if customer else "individual"
    document_number = (
        customer_snapshot.document_number if customer_snapshot
        else customer.document_number if customer
        else None
    )
    address = customer_snapshot.address if customer_snapshot else customer.address if customer else None
    email = customer_snapshot.email if customer_snapshot else customer.email if customer else None
    phone = customer_snapshot.phone if customer_snapshot else customer.phone if customer else None

    if document_type == "factura" and (
        customer_type != "business"
        or document_number is None
        or len(document_number) != 11
        or not document_number.isdigit()
    ):
        raise HTTPException(
            status_code=422,
            detail="La factura interna requiere una empresa con RUC válido de 11 dígitos.",
        )

    document = SalesDocument(
        company_id=user.company_id,
        sale_id=sale.id,
        document_type=document_type,
        document_number=f"TMP-{uuid4().hex}",
        customer_name=name,
        customer_document=document_number,
        customer_address=address,
        customer_email=str(email) if email else None,
        customer_phone=phone,
        currency="PEN",
        subtotal=sale.subtotal,
        discount=sale.discount,
        tax=sale.tax,
        total=sale.total,
        items=[
            SalesDocumentItem(
                product_name=item.product_name,
                quantity=item.quantity,
                unit_price=item.unit_price,
                line_total=item.line_total,
            )
            for item in sale.items
        ],
    )
    return document


@router.get("", response_model=list[SaleOut])
def list_sales(
    search: str = Query(default="", max_length=60),
    status_filter: Literal["completed", "pending", "cancelled"] | None = Query(default=None, alias="status"),
    start_at: datetime | None = None,
    end_before: datetime | None = None,
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[Sale]:
    if start_at and start_at.tzinfo is None or end_before and end_before.tzinfo is None:
        raise HTTPException(status_code=422, detail="Las fechas deben incluir zona horaria.")
    if start_at and end_before and start_at >= end_before:
        raise HTTPException(status_code=422, detail="La fecha inicial debe ser anterior a la fecha final.")

    query = select(Sale).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments), selectinload(Sale.document)
    ).where(Sale.company_id == user.company_id)
    if status_filter:
        query = query.where(Sale.status == status_filter)
    if start_at:
        query = query.where(Sale.created_at >= start_at.astimezone(timezone.utc))
    if end_before:
        query = query.where(Sale.created_at < end_before.astimezone(timezone.utc))
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


@router.get("/documents/payment-receipts", response_model=list[PaymentReceiptListOut])
def list_payment_receipts(
    search: str = Query(default="", max_length=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PaymentReceiptListOut]:
    query = select(SalesDocument).join(Sale).options(
        selectinload(SalesDocument.items),
        joinedload(SalesDocument.sale),
    ).where(SalesDocument.company_id == user.company_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(
            SalesDocument.document_number.ilike(term),
            SalesDocument.customer_name.ilike(term),
            SalesDocument.customer_document.ilike(term),
            Sale.sale_number.ilike(term),
        ))
    documents = db.scalars(
        query.order_by(SalesDocument.issued_at.desc(), SalesDocument.id.desc())
    ).unique().all()
    return [
        PaymentReceiptListOut(
            **SalesDocumentOut.model_validate(document).model_dump(),
            sale_number=document.sale.sale_number,
            sale_created_at=document.sale.created_at,
        )
        for document in documents
    ]


@router.get("/accounts-receivable", response_model=list[ReceivableOut])
def list_accounts_receivable(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[ReceivableOut]:
    payment_totals = select(
        Payment.sale_id.label("sale_id"),
        func.sum(Payment.amount).label("paid_amount"),
    ).where(Payment.status == "paid").group_by(Payment.sale_id).subquery()
    paid_amount = func.coalesce(payment_totals.c.paid_amount, Decimal("0.00"))
    query = select(Sale, paid_amount).outerjoin(
        payment_totals, payment_totals.c.sale_id == Sale.id
    ).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments), selectinload(Sale.document),
    ).where(
        Sale.company_id == user.company_id,
        Sale.status == "completed",
        Sale.total > func.round(paid_amount, 2),
    ).order_by(Sale.created_at.desc(), Sale.id.desc()).offset(offset).limit(limit)

    return [
        ReceivableOut(sale=sale, paid_amount=total_paid, balance=money(sale.total - total_paid))
        for sale, total_paid in db.execute(query).all()
    ]


@router.get("/history", response_model=list[ReceivableOut])
def list_sales_history(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[ReceivableOut]:
    payment_totals = select(
        Payment.sale_id.label("sale_id"),
        func.sum(Payment.amount).label("paid_amount"),
    ).where(Payment.status == "paid").group_by(Payment.sale_id).subquery()
    paid_amount = func.coalesce(payment_totals.c.paid_amount, Decimal("0.00"))
    query = select(Sale, paid_amount).outerjoin(
        payment_totals, payment_totals.c.sale_id == Sale.id
    ).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments), selectinload(Sale.document),
    ).where(
        Sale.company_id == user.company_id,
    ).order_by(Sale.created_at.desc(), Sale.id.desc()).offset(offset).limit(limit)

    return [
        ReceivableOut(sale=sale, paid_amount=money(total_paid), balance=money(max(sale.total - total_paid, Decimal("0.00"))))
        for sale, total_paid in db.execute(query).all()
    ]


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Sale:
    sale = db.scalar(select(Sale).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments), selectinload(Sale.document)
    ).where(Sale.id == sale_id, Sale.company_id == user.company_id))
    if sale is None:
        raise HTTPException(status_code=404, detail="No se encontró la venta.")
    return sale


@router.post("/{sale_id}/documents", response_model=SalesDocumentOut, status_code=status.HTTP_201_CREATED)
def create_sales_document(
    sale_id: int,
    payload: SalesDocumentCreateIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("seller")),
) -> SalesDocument:
    sale = db.scalar(select(Sale).options(
        joinedload(Sale.customer), selectinload(Sale.items), selectinload(Sale.document),
    ).where(
        Sale.id == sale_id, Sale.company_id == user.company_id,
    ).with_for_update())
    if sale is None:
        raise HTTPException(status_code=404, detail="No se encontró la venta.")
    if sale.status != "completed":
        raise HTTPException(status_code=409, detail="Solo se pueden emitir comprobantes internos para ventas completadas.")
    if sale.document is not None:
        raise HTTPException(status_code=409, detail="Esta venta ya tiene un comprobante interno.")

    document = build_sales_document(sale, user, payload.document_type)
    db.add(document)
    db.flush()
    series = "F001" if payload.document_type == "factura" else "B001"
    document.document_number = f"{series}-{document.id:08d}"
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se pudo generar el comprobante; verifica si ya existe.") from error

    return db.scalar(select(SalesDocument).options(
        selectinload(SalesDocument.items),
    ).where(
        SalesDocument.id == document.id, SalesDocument.company_id == user.company_id,
    ))


@router.get("/{sale_id}/document", response_model=SalesDocumentOut)
def get_sales_document(
    sale_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SalesDocument:
    document = db.scalar(select(SalesDocument).options(
        selectinload(SalesDocument.items),
    ).where(
        SalesDocument.sale_id == sale_id, SalesDocument.company_id == user.company_id,
    ))
    if document is None:
        raise HTTPException(status_code=404, detail="La venta no tiene un comprobante interno.")
    return document


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(payload: SaleIn, db: Session = Depends(get_db), user: User = Depends(require_roles("seller"))) -> Sale:
    customer = None
    if payload.customer_id is not None:
        customer = db.scalar(select(Customer).where(
            Customer.id == payload.customer_id,
            Customer.company_id == user.company_id,
            Customer.is_active.is_(True),
        ))
        if customer is None:
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
    payment_amount = payload.payment_amount if payload.payment_amount is not None else total
    if payment_amount > total:
        raise HTTPException(status_code=422, detail="El pago inicial no puede superar el total de la venta.")

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
        amount=payment_amount, method=payload.payment_method.strip().lower(), status="paid",
    ))
    if payload.document_type is not None:
        sale.customer = customer
        document = build_sales_document(
            sale, user, payload.document_type, payload.document_customer,
        )
        db.add(document)
        db.flush()
        series = "F001" if payload.document_type == "factura" else "B001"
        document.document_number = f"{series}-{document.id:08d}"
    db.commit()
    return get_sale(sale.id, db, user)


@router.post("/{sale_id}/payments", response_model=SaleOut)
def register_sale_payment(
    sale_id: int,
    payload: ReceivablePaymentIn,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles("seller")),
) -> Sale:
    sale = db.scalar(select(Sale).where(
        Sale.id == sale_id, Sale.company_id == user.company_id
    ).with_for_update())
    if sale is None:
        raise HTTPException(status_code=404, detail="No se encontró la venta.")
    if sale.status != "completed":
        raise HTTPException(status_code=409, detail="No se pueden registrar pagos para una venta que no está completada.")

    paid_amount = db.scalar(select(func.coalesce(func.sum(Payment.amount), Decimal("0.00"))).where(
        Payment.sale_id == sale.id, Payment.status == "paid"
    )) or Decimal("0.00")
    balance = money(sale.total - paid_amount)
    if payload.amount > balance:
        raise HTTPException(status_code=409, detail=f"El pago supera el saldo pendiente de {balance}.")

    sale.payments.append(Payment(
        amount=payload.amount,
        method=payload.method.strip().lower(),
        status="paid",
    ))
    db.commit()
    return get_sale(sale.id, db, user)
