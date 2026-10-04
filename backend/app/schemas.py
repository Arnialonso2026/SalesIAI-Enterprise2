from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

UserRole = Literal["admin", "manager", "seller", "analyst", "warehouse"]


def validate_dni(value: str) -> str:
    normalized = value.strip()
    if len(normalized) != 8 or not normalized.isdigit():
        raise ValueError("El DNI debe contener exactamente 8 dígitos.")
    return normalized


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


class UserOut(ORMModel):
    id: int
    full_name: str
    email: EmailStr | None
    dni: str | None
    role: str
    company_id: int
    is_active: bool
    password_configured: bool


class LoginIn(BaseModel):
    dni: str = Field(min_length=8, max_length=8)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("dni")
    @classmethod
    def normalize_dni(cls, value: str) -> str:
        return validate_dni(value)


class UserCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    dni: str
    password: str = Field(min_length=8, max_length=128)
    role: UserRole

    @field_validator("dni")
    @classmethod
    def normalize_dni(cls, value: str) -> str:
        return validate_dni(value)


class UserUpdate(BaseModel):
    full_name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    dni: str | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole
    is_active: bool

    @field_validator("dni")
    @classmethod
    def normalize_dni(cls, value: str | None) -> str | None:
        return validate_dni(value) if value is not None else None


class CustomerIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    document_number: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)


class CustomerOut(ORMModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    document_number: str | None
    address: str | None
    is_active: bool
    created_at: datetime


class CategoryIn(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=255)


class CategoryOut(ORMModel):
    id: int
    name: str
    description: str | None


class ProductIn(BaseModel):
    sku: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    description: str | None = None
    category_id: int | None = None
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    stock: int = Field(default=0, ge=0)
    min_stock: int = Field(default=5, ge=0)


class ProductOut(ORMModel):
    id: int
    sku: str
    name: str
    description: str | None
    category_id: int | None
    price: Decimal
    stock: int
    min_stock: int
    is_active: bool
    category: CategoryOut | None = None


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=10000)


class SaleIn(BaseModel):
    customer_id: int | None = None
    items: list[SaleItemIn] = Field(min_length=1)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(default="cash", min_length=2, max_length=30)
    notes: str | None = Field(default=None, max_length=500)


class SaleItemOut(ORMModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class PaymentOut(ORMModel):
    id: int
    amount: Decimal
    method: str
    status: str
    paid_at: datetime


class SaleOut(ORMModel):
    id: int
    sale_number: str
    customer_id: int | None
    customer: CustomerOut | None = None
    status: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    notes: str | None
    created_at: datetime
    items: list[SaleItemOut]
    payments: list[PaymentOut]


class InventoryAdjustmentIn(BaseModel):
    quantity: int
    note: str = Field(min_length=2, max_length=255)

    @field_validator("quantity")
    @classmethod
    def quantity_must_not_be_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("La cantidad del ajuste no puede ser cero.")
        return value


class InventoryMovementOut(ORMModel):
    id: int
    product_id: int
    sale_id: int | None
    movement_type: str
    quantity: int
    stock_after: int
    note: str | None
    created_at: datetime
