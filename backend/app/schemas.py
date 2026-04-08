from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime
from .models import UserRole, OrderStatus, TableStatus, PaymentMethod, ExpenseCategory, SubscriptionStatus


# ─────────────────────────────────────────
#  AUTH
# ─────────────────────────────────────────

class UserLogin(BaseModel):
    phone_number: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


# ─────────────────────────────────────────
#  ÉTABLISSEMENTS & ABONNEMENTS
# ─────────────────────────────────────────

class EstablishmentCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None

class EstablishmentResponse(BaseModel):
    id: int
    name: str
    address: Optional[str]
    phone: Optional[str]
    is_active: bool
    created_at: datetime
    class Config:
        from_attributes = True

class SubscriptionResponse(BaseModel):
    id: int
    status: SubscriptionStatus
    plan: str
    trial_ends_at: Optional[datetime]
    current_period_end: Optional[datetime]
    class Config:
        from_attributes = True

class EstablishmentDetail(EstablishmentResponse):
    subscription: Optional[SubscriptionResponse] = None


# ─────────────────────────────────────────
#  UTILISATEURS
# ─────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str
    phone_number: str
    password: str
    role: UserRole = UserRole.WAITER

class UserResponse(BaseModel):
    id: int
    full_name: str
    phone_number: str
    role: UserRole
    is_active: bool
    establishment_id: Optional[int]
    staff_code: Optional[str]
    created_at: datetime
    establishment_name: Optional[str] = None
    establishment_type: Optional[str] = None   # maquis / bar / restaurant / hotel / voyage
    has_kitchen: Optional[bool] = False         # True si l'établissement a des catégories cuisine
    class Config:
        from_attributes = True

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    staff_code: Optional[str] = None

# Inscription d'un gérant (SaaS onboarding)
class ManagerRegister(BaseModel):
    full_name: str
    phone_number: str
    password: str
    establishment_name: str
    establishment_address: Optional[str] = None
    establishment_phone: Optional[str] = None
    establishment_type: Optional[str] = "maquis"  # maquis, bar, restaurant, hotel, voyage
    establishment_city: Optional[str] = None


# ─────────────────────────────────────────
#  CATÉGORIES & PRODUITS
# ─────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str

class CategoryResponse(BaseModel):
    id: int
    name: str
    establishment_id: int
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    stock_quantity: int = 0
    category_id: Optional[int] = None
    is_available: bool = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_available: Optional[bool] = None
    category_id: Optional[int] = None

class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    stock_quantity: int
    is_available: bool
    category_id: Optional[int]
    establishment_id: int
    class Config:
        from_attributes = True


# ─────────────────────────────────────────
#  TABLES
# ─────────────────────────────────────────

class TableCreate(BaseModel):
    number: int
    label: Optional[str] = None
    capacity: int = 4

class TableResponse(BaseModel):
    id: int
    number: int
    label: Optional[str]
    capacity: int
    status: TableStatus
    establishment_id: int
    class Config:
        from_attributes = True

class TableStatusUpdate(BaseModel):
    status: TableStatus


# ─────────────────────────────────────────
#  COMMANDES
# ─────────────────────────────────────────

class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    notes: Optional[str] = None

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    notes: Optional[str]
    product_name: Optional[str] = None
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    table_id: int
    items: List[OrderItemCreate]
    notes: Optional[str] = None

class OrderAddItems(BaseModel):
    items: List[OrderItemCreate]

class OrderResponse(BaseModel):
    id: int
    table_id: int
    waiter_id: Optional[int] = None
    establishment_id: int
    status: OrderStatus
    notes: Optional[str]
    created_at: datetime
    items: List[OrderItemResponse] = []
    table_number: Optional[int] = None
    waiter_name: Optional[str] = None
    client_phone: Optional[str] = None
    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: OrderStatus


# ─────────────────────────────────────────
#  PAIEMENTS
# ─────────────────────────────────────────

class PaymentCreate(BaseModel):
    order_id: int
    amount: float
    method: PaymentMethod
    client_phone: Optional[str] = None
    client_name: Optional[str] = None

class PaymentResponse(BaseModel):
    id: int
    order_id: int
    amount: float
    method: PaymentMethod
    created_at: datetime
    class Config:
        from_attributes = True


# ─────────────────────────────────────────
#  DÉPENSES
# ─────────────────────────────────────────

class ExpenseCreate(BaseModel):
    label: str
    amount: float
    category: ExpenseCategory = ExpenseCategory.OTHER

class ExpenseResponse(BaseModel):
    id: int
    label: str
    amount: float
    category: ExpenseCategory
    created_at: datetime
    class Config:
        from_attributes = True


# ─────────────────────────────────────────
#  VENTES DIRECTES
# ─────────────────────────────────────────

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int

class SaleCreate(BaseModel):
    items: List[SaleItemCreate]

class SaleResponse(BaseModel):
    id: int
    total_amount: float
    created_at: datetime
    class Config:
        from_attributes = True


# ─────────────────────────────────────────
#  DASHBOARD / STATISTIQUES
# ─────────────────────────────────────────

class DashboardStats(BaseModel):
    total_revenue_today: float
    total_revenue_month: float
    open_orders_count: int
    occupied_tables_count: int
    total_expenses_month: float
    net_profit_month: float
    top_product: Optional[str]

class WaiterStats(BaseModel):
    waiter_id: int
    waiter_name: str
    orders_count: int
    total_revenue: float

# Forward reference resolution
Token.model_rebuild()
