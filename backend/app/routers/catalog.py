from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.models import Category, Customer, InventoryMovement, Product, Sale, User
from app.schemas import (
    CategoryIn, CategoryOut, CustomerIn, CustomerOut, InventoryAdjustmentIn,
    InventoryMovementOut, ProductIn, ProductOut, SaleOut,
)

router = APIRouter(tags=["Catálogos e inventario"])


@router.get("/customers", response_model=list[CustomerOut])
def list_customers(
    search: str = Query(default="", max_length=100),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[Customer]:
    query = select(Customer).where(Customer.company_id == user.company_id, Customer.is_active.is_(True))
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(
            Customer.name.ilike(term), Customer.document_number.ilike(term),
            Customer.email.ilike(term), Customer.phone.ilike(term), Customer.address.ilike(term),
            Customer.contact_name.ilike(term), Customer.industry.ilike(term),
        ))
    return list(db.scalars(query.order_by(Customer.name).limit(200)).all())


@router.post("/customers", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(payload: CustomerIn, db: Session = Depends(get_db), user: User = Depends(require_roles("seller"))) -> Customer:
    customer = Customer(company_id=user.company_id, **payload.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


@router.put("/customers/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, payload: CustomerIn, db: Session = Depends(get_db), user: User = Depends(require_roles("seller"))) -> Customer:
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.company_id == user.company_id))
    if customer is None:
        raise HTTPException(status_code=404, detail="No se encontró el cliente.")
    for key, value in payload.model_dump().items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return customer


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_customer(customer_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("seller"))) -> Response:
    customer = db.scalar(select(Customer).where(Customer.id == customer_id, Customer.company_id == user.company_id))
    if customer is None:
        raise HTTPException(status_code=404, detail="No se encontró el cliente.")
    customer.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/customers/{customer_id}/sales", response_model=list[SaleOut])
def customer_sales(customer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Sale]:
    customer = db.scalar(select(Customer).where(
        Customer.id == customer_id, Customer.company_id == user.company_id
    ))
    if customer is None:
        raise HTTPException(status_code=404, detail="No se encontró el cliente.")
    query = select(Sale).options(
        joinedload(Sale.customer), joinedload(Sale.created_by),
        selectinload(Sale.items), selectinload(Sale.payments), selectinload(Sale.document)
    ).where(Sale.customer_id == customer_id, Sale.company_id == user.company_id)
    return list(db.scalars(query.order_by(Sale.created_at.desc()).limit(100)).unique().all())


@router.get("/customers/{customer_id}/summary")
def customer_sales_summary(
    customer_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> dict[str, object]:
    customer = db.scalar(select(Customer.id).where(
        Customer.id == customer_id, Customer.company_id == user.company_id
    ))
    if customer is None:
        raise HTTPException(status_code=404, detail="No se encontró el cliente.")
    count, total, last_purchase = db.execute(
        select(func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0), func.max(Sale.created_at))
        .where(
            Sale.customer_id == customer_id,
            Sale.company_id == user.company_id,
            Sale.status == "completed",
        )
    ).one()
    total_value = float(total)
    return {
        "customer_id": customer_id,
        "sales_count": count,
        "total_spent": total_value,
        "average_ticket": total_value / count if count else 0.0,
        "last_purchase_at": last_purchase.isoformat() if last_purchase else None,
    }


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[Category]:
    rows = db.scalars(select(Category).where(Category.company_id == user.company_id).order_by(Category.name)).all()
    return list(rows)


@router.post("/categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryIn, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Category:
    if db.scalar(select(Category).where(Category.company_id == user.company_id, Category.name == payload.name)):
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre.")
    category = Category(company_id=user.company_id, **payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.put("/categories/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryIn, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Category:
    category = db.scalar(select(Category).where(Category.id == category_id, Category.company_id == user.company_id))
    if category is None:
        raise HTTPException(status_code=404, detail="No se encontró la categoría.")
    duplicate = db.scalar(select(Category).where(
        Category.company_id == user.company_id, Category.name == payload.name, Category.id != category_id
    ))
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe una categoría con ese nombre.")
    category.name = payload.name
    category.description = payload.description
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Response:
    category = db.scalar(select(Category).where(Category.id == category_id, Category.company_id == user.company_id))
    if category is None:
        raise HTTPException(status_code=404, detail="No se encontró la categoría.")
    if db.scalar(select(Product.id).where(Product.category_id == category_id).limit(1)) is not None:
        raise HTTPException(status_code=409, detail="No se puede eliminar una categoría que todavía tiene productos.")
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/products", response_model=list[ProductOut])
def list_products(
    search: str = Query(default="", max_length=100),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[Product]:
    query = select(Product).options(joinedload(Product.category)).where(
        Product.company_id == user.company_id, Product.is_active.is_(True)
    )
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(Product.name.ilike(term), Product.sku.ilike(term)))
    return list(db.scalars(query.order_by(Product.name).limit(200)).unique().all())


@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(payload: ProductIn, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Product:
    if db.scalar(select(Product).where(Product.company_id == user.company_id, Product.sku == payload.sku)):
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese SKU.")
    if payload.category_id and db.scalar(select(Category).where(Category.id == payload.category_id, Category.company_id == user.company_id)) is None:
        raise HTTPException(status_code=404, detail="No se encontró la categoría.")
    product = Product(company_id=user.company_id, **payload.model_dump())
    db.add(product)
    db.flush()
    if product.stock:
        db.add(InventoryMovement(
            company_id=user.company_id, product_id=product.id, movement_type="initial",
            quantity=product.stock, stock_after=product.stock, note="Existencia inicial",
        ))
    db.commit()
    db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductOut)
def update_product(product_id: int, payload: ProductIn, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Product:
    product = db.scalar(select(Product).options(joinedload(Product.category)).where(
        Product.id == product_id, Product.company_id == user.company_id
    ))
    if product is None:
        raise HTTPException(status_code=404, detail="No se encontró el producto.")
    duplicate = db.scalar(select(Product).where(
        Product.company_id == user.company_id, Product.sku == payload.sku, Product.id != product_id
    ))
    if duplicate:
        raise HTTPException(status_code=409, detail="Ya existe un producto con ese SKU.")
    for key, value in payload.model_dump().items():
        if key != "stock":
            setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_product(product_id: int, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))) -> Response:
    product = db.scalar(select(Product).where(Product.id == product_id, Product.company_id == user.company_id))
    if product is None:
        raise HTTPException(status_code=404, detail="No se encontró el producto.")
    product.is_active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/inventory/movements", response_model=list[InventoryMovementOut])
def list_inventory_movements(
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> list[InventoryMovement]:
    return list(db.scalars(select(InventoryMovement).where(
        InventoryMovement.company_id == user.company_id
    ).order_by(
        InventoryMovement.created_at.desc(), InventoryMovement.id.desc()
    ).offset(offset).limit(limit)).all())


@router.post("/inventory/products/{product_id}/adjust", response_model=InventoryMovementOut)
def adjust_inventory(
    product_id: int, payload: InventoryAdjustmentIn, db: Session = Depends(get_db), user: User = Depends(require_roles("warehouse"))
) -> InventoryMovement:
    product = db.scalar(select(Product).where(
        Product.id == product_id, Product.company_id == user.company_id
    ).with_for_update())
    if product is None:
        raise HTTPException(status_code=404, detail="No se encontró el producto.")
    new_stock = product.stock + payload.quantity
    if new_stock < 0:
        raise HTTPException(status_code=409, detail="El ajuste no puede dejar el stock en negativo.")
    product.stock = new_stock
    movement = InventoryMovement(
        company_id=user.company_id, product_id=product.id,
        movement_type="entry" if payload.quantity > 0 else "adjustment",
        quantity=payload.quantity, stock_after=new_stock, note=payload.note,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement
