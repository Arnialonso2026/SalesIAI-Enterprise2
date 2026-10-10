from datetime import date, datetime
from decimal import Decimal
from math import isfinite
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

UserRole = Literal["admin", "manager", "seller", "analyst", "warehouse"]
CustomerType = Literal["individual", "business"]
CustomerContactMethod = Literal["whatsapp", "phone", "email"]


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


class AuditLogOut(ORMModel):
    id: int
    company_id: int
    user_id: int | None
    actor_name: str | None
    action: str
    entity_type: str
    entity_id: int | None
    details: dict[str, object]
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class AuditLogPageOut(BaseModel):
    items: list[AuditLogOut]
    total: int
    limit: int
    offset: int


class LocationOut(BaseModel):
    ip_address: str
    country: str
    region: str
    city: str
    latitude: float
    longitude: float
    postal_code: str | None


class BranchIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    address: str | None = Field(default=None, max_length=255)
    latitude: float = Field(ge=-18.5, le=0.2, allow_inf_nan=False)
    longitude: float = Field(ge=-81.5, le=-68.5, allow_inf_nan=False)

    @field_validator("name")
    @classmethod
    def normalize_branch_name(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("El nombre debe contener al menos 2 caracteres.")
        return value

    @field_validator("address")
    @classmethod
    def normalize_branch_address(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None


class BranchOut(ORMModel):
    id: int
    company_id: int
    name: str
    address: str | None
    latitude: float
    longitude: float
    is_active: bool
    created_at: datetime


class IpRegistryOut(BaseModel):
    ip_address: str
    last_seen: datetime
    action_count: int
    users: list[int]
    user_agents: list[str]
    country: str = "No disponible"
    region: str = ""
    city: str = ""
    latitude: float | None = None
    longitude: float | None = None


class DocumentOut(ORMModel):
    id: int
    company_id: int
    uploaded_by_id: int | None
    title: str
    filename: str
    original_filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime


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
    customer_type: CustomerType = "individual"
    contact_name: str | None = Field(default=None, max_length=160)
    industry: str | None = Field(default=None, max_length=120)
    preferred_contact_method: CustomerContactMethod = "whatsapp"
    notes: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def normalize_customer_document(self) -> "CustomerIn":
        value = self.document_number
        if value is None or not value.strip():
            self.document_number = None
            return self

        normalized = value.strip().upper()
        expected_prefix = "RUC" if self.customer_type == "business" else "DNI"
        if normalized.startswith(("DNI", "RUC")):
            prefix, separator, remainder = normalized.partition("-")
            if not separator:
                prefix, _, remainder = normalized.partition(" ")
            if prefix != expected_prefix:
                raise ValueError(f"El documento debe corresponder al tipo de cliente ({expected_prefix}).")
            normalized = remainder.strip()

        digits = normalized.replace(" ", "").replace("-", "")
        expected_length = 11 if self.customer_type == "business" else 8
        if not digits.isdigit() or len(digits) != expected_length:
            raise ValueError(f"El {expected_prefix} debe contener exactamente {expected_length} dígitos.")
        self.document_number = digits
        return self


class CustomerOut(ORMModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    document_number: str | None
    address: str | None
    customer_type: CustomerType
    contact_name: str | None
    industry: str | None
    preferred_contact_method: CustomerContactMethod
    notes: str | None
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


class PurchaseItemIn(BaseModel):
    product_id: int = Field(gt=0)
    quantity: int = Field(gt=0, le=10000)
    unit_cost: Decimal = Field(gt=0, max_digits=12, decimal_places=2)


class PurchaseIn(BaseModel):
    supplier_name: str = Field(min_length=2, max_length=160)
    supplier_document_number: str | None = Field(default=None, max_length=30)
    supplier_address: str | None = Field(default=None, max_length=255)
    items: list[PurchaseItemIn] = Field(min_length=1)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("supplier_name")
    @classmethod
    def normalize_supplier_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("supplier_document_number", "supplier_address")
    @classmethod
    def normalize_supplier_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @model_validator(mode="after")
    def reject_duplicate_products(self) -> "PurchaseIn":
        product_ids = [item.product_id for item in self.items]
        if len(product_ids) != len(set(product_ids)):
            raise ValueError("Cada producto debe aparecer una sola vez en la compra.")
        return self


class PurchaseItemOut(ORMModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    quantity: int
    unit_cost: Decimal
    line_total: Decimal


class PurchaseOut(ORMModel):
    id: int
    purchase_number: str
    supplier_name: str
    supplier_document_number: str | None
    supplier_address: str | None
    created_by_id: int | None
    created_by_name: str
    total: Decimal
    notes: str | None
    created_at: datetime
    items: list[PurchaseItemOut]


class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=10000)


class SalesDocumentCustomerIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    customer_type: CustomerType
    document_number: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator("document_number", "address", "phone")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return value.strip() or None if value is not None else None

    @field_validator("document_number")
    @classmethod
    def validate_document_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        digits = value.upper().replace("DNI", "").replace("RUC", "").replace("-", "").replace(" ", "")
        if not digits.isdigit():
            raise ValueError("El documento debe contener solo dígitos.")
        return digits

    @model_validator(mode="after")
    def validate_document_for_customer_type(self) -> "SalesDocumentCustomerIn":
        if self.document_number is None:
            return self
        expected_length = 11 if self.customer_type == "business" else 8
        if len(self.document_number) != expected_length:
            document_name = "RUC" if self.customer_type == "business" else "DNI"
            raise ValueError(f"El {document_name} debe contener exactamente {expected_length} dígitos.")
        return self


class SaleIn(BaseModel):
    customer_id: int | None = None
    items: list[SaleItemIn] = Field(min_length=1)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(default="cash", min_length=2, max_length=30)
    payment_amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=500)
    document_type: Literal["boleta", "factura"] | None = None
    document_customer: SalesDocumentCustomerIn | None = None

    @model_validator(mode="after")
    def validate_document_request(self) -> "SaleIn":
        if self.document_type is None:
            if self.document_customer is not None:
                raise ValueError("Selecciona el tipo de comprobante para los datos del cliente.")
            return self
        if self.document_customer is None:
            raise ValueError("Completa los datos del cliente para generar el comprobante.")
        if self.document_type == "factura" and (
            self.document_customer.customer_type != "business"
            or self.document_customer.document_number is None
            or len(self.document_customer.document_number) != 11
        ):
            raise ValueError("La factura interna requiere una empresa con RUC válido de 11 dígitos.")
        return self


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


class SalesDocumentCreateIn(BaseModel):
    document_type: Literal["boleta", "factura"]


class SalesDocumentItemOut(ORMModel):
    id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class SalesDocumentOut(ORMModel):
    id: int
    sale_id: int
    document_type: Literal["boleta", "factura"]
    document_number: str
    customer_name: str
    customer_document: str | None
    customer_address: str | None
    customer_email: str | None
    customer_phone: str | None
    currency: str
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    issued_at: datetime
    items: list[SalesDocumentItemOut]


class PaymentReceiptListOut(SalesDocumentOut):
    sale_number: str
    sale_created_at: datetime


class SaleCreatorOut(ORMModel):
    id: int
    full_name: str
    role: str

class SaleOut(ORMModel):
    id: int
    sale_number: str
    created_by_id: int | None
    created_by: SaleCreatorOut | None = None
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
    document: SalesDocumentOut | None = None


class ReceivablePaymentIn(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    method: str = Field(min_length=2, max_length=30)


class ReceivableOut(BaseModel):
    sale: SaleOut
    paid_amount: Decimal
    balance: Decimal


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
    purchase_id: int | None
    movement_type: str
    quantity: int
    stock_after: int
    note: str | None
    created_at: datetime


class StatisticalAnalysisIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    variable_name: str = Field(default="value", min_length=1, max_length=100)
    values: list[float] = Field(min_length=1, max_length=10000)
    threshold: float | None = None

    @field_validator("values")
    @classmethod
    def values_must_be_finite(cls, values: list[float]) -> list[float]:
        if any(not isfinite(value) for value in values):
            raise ValueError("Todos los valores deben ser números finitos.")
        return values


class LinearAnalysisIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    variable_x: str = Field(min_length=1, max_length=100)
    values_x: list[float] = Field(min_length=2, max_length=10000)
    variable_y: str = Field(min_length=1, max_length=100)
    values_y: list[float] = Field(min_length=2, max_length=10000)

    @model_validator(mode="after")
    def validate_paired_values(self) -> "LinearAnalysisIn":
        if len(self.values_x) != len(self.values_y):
            raise ValueError("Las dos variables deben tener el mismo número de observaciones.")
        if any(not isfinite(value) for value in self.values_x + self.values_y):
            raise ValueError("Todos los valores deben ser números finitos.")
        return self


class BayesianAnalysisIn(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    question: str = Field(min_length=5, max_length=1000)
    prior_probability: float = Field(ge=0, le=1)
    likelihood_if_true: float = Field(ge=0, le=1)
    likelihood_if_false: float = Field(ge=0, le=1)


class AnalyticsDashboardOut(BaseModel):
    start_date: date
    end_date: date
    revenue: float
    previous_revenue: float
    revenue_change_percent: float | None
    sales_count: int
    average_ticket: float
    active_customers: int
    low_stock_products: int
    daily_sales: list[dict[str, str | float]]
    top_products: list[dict[str, str | int | float]]
    payment_methods: list[dict[str, str | float]]
    sales_by_seller: list[dict[str, int | float | str]]


class InsightStatusIn(BaseModel):
    status: Literal["new", "read", "dismissed"]


class InsightOut(ORMModel):
    id: int
    title: str
    description: str
    severity: str
    status: str
    created_at: datetime
    evidence: list[dict[str, object]] = Field(default_factory=list)


class ReportExportIn(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    format: Literal["csv", "json"] = "csv"


class ReportOut(ORMModel):
    id: int
    name: str
    report_type: str
    status: str
    parameters: dict[str, object]
    created_at: datetime
    generated_at: datetime | None
