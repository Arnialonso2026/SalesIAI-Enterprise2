from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import Category, Company, Customer, InventoryMovement, Product, User


def seed_demo_data() -> None:
    with SessionLocal() as db:
        company = db.scalar(select(Company).limit(1))
        if company is None:
            company = Company(name=settings.company_name)
            db.add(company)
            db.flush()

        admin = db.scalar(select(User).where(User.email == "admin@salesia.example.com"))
        if admin is None:
            db.add(User(
                company_id=company.id, full_name="Administradora SalesIA",
                email="admin@salesia.example.com", dni="00000001",
                password_hash=hash_password("SalesIA2026!"), role="admin",
            ))
        else:
            if admin.dni is None:
                admin.dni = "00000001"
            if admin.password_hash is None:
                admin.password_hash = hash_password("SalesIA2026!")

        categories = {
            "Tecnología": "Equipos y accesorios tecnológicos",
            "Oficina": "Suministros para el trabajo diario",
            "Accesorios": "Complementos y periféricos",
        }
        category_rows: dict[str, Category] = {}
        for name, description in categories.items():
            row = db.scalar(select(Category).where(Category.company_id == company.id, Category.name == name))
            if row is None:
                row = Category(company_id=company.id, name=name, description=description)
                db.add(row)
                db.flush()
            category_rows[name] = row

        products = [
            ("TEC-001", "Laptop Pro 14\"", "Equipo portátil para trabajo profesional", "Tecnología", "3899.00", 12),
            ("TEC-002", "Monitor 27\" UHD", "Monitor de alta resolución", "Tecnología", "1299.00", 8),
            ("ACC-001", "Teclado mecánico", "Teclado inalámbrico retroiluminado", "Accesorios", "249.00", 24),
            ("ACC-002", "Mouse ergonómico", "Mouse inalámbrico con sensor de precisión", "Accesorios", "139.00", 4),
            ("OFI-001", "Silla ejecutiva", "Silla ergonómica de oficina", "Oficina", "799.00", 6),
            ("OFI-002", "Cuaderno premium", "Cuaderno de tapa dura, 120 hojas", "Oficina", "28.50", 42),
        ]
        for sku, name, description, category, price, stock in products:
            if db.scalar(select(Product).where(Product.company_id == company.id, Product.sku == sku)) is None:
                product = Product(
                    company_id=company.id, category_id=category_rows[category].id,
                    sku=sku, name=name, description=description, price=Decimal(price),
                    stock=stock, min_stock=5,
                )
                db.add(product)
                db.flush()
                db.add(InventoryMovement(
                    company_id=company.id, product_id=product.id, movement_type="initial",
                    quantity=stock, stock_after=stock, note="Existencia inicial de demostración",
                ))

        customers = [
            ("María Fernández", "maria.fernandez@example.com", "+51 987 654 321", "DNI-45892316"),
            ("Carlos Mendoza", "carlos.mendoza@example.com", "+51 976 123 450", "DNI-71420583"),
            ("Empresa Andina SAC", "compras@andina.example.com", "+51 1 555 0101", "RUC-20601234567"),
        ]
        for name, email, phone, document in customers:
            if db.scalar(select(Customer).where(Customer.company_id == company.id, Customer.email == email)) is None:
                db.add(Customer(company_id=company.id, name=name, email=email, phone=phone, document_number=document))
        db.commit()
