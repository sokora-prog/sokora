import enum
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    Boolean, DateTime, Text, Enum as SAEnum, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ─────────────────────────────────────────
#  ENUMS
# ─────────────────────────────────────────

class UserRole(str, enum.Enum):
    SUPER_ADMIN = "SUPER_ADMIN"
    MANAGER     = "MANAGER"
    WAITER      = "WAITER"
    DRIVER      = "DRIVER"
    CLIENT      = "CLIENT"


class SubscriptionStatus(str, enum.Enum):
    TRIAL     = "TRIAL"
    ACTIVE    = "ACTIVE"
    EXPIRED   = "EXPIRED"
    SUSPENDED = "SUSPENDED"


class TableStatus(str, enum.Enum):
    FREE     = "FREE"
    OCCUPIED = "OCCUPIED"
    RESERVED = "RESERVED"


class OrderStatus(str, enum.Enum):
    OPEN        = "OPEN"
    SENT        = "SENT"
    IN_PROGRESS = "IN_PROGRESS"
    READY       = "READY"
    SERVED      = "SERVED"
    PAID        = "PAID"
    CANCELLED   = "CANCELLED"


class PaymentMethod(str, enum.Enum):
    CASH         = "CASH"
    CARD         = "CARD"
    MOBILE_MONEY = "MOBILE_MONEY"
    WAVE         = "WAVE"
    ORANGE_MONEY = "ORANGE_MONEY"
    MTN_MONEY    = "MTN_MONEY"
    WALLET       = "WALLET"
    CREDIT       = "CREDIT"


class ExpenseCategory(str, enum.Enum):
    STOCK    = "STOCK"
    SALARY   = "SALARY"
    RENT     = "RENT"
    UTILITY  = "UTILITY"
    OTHER    = "OTHER"


# ─────────────────────────────────────────
#  SAAS — ÉTABLISSEMENTS & ABONNEMENTS
# ─────────────────────────────────────────

class Establishment(Base):
    __tablename__ = "establishments"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, nullable=False)
    address          = Column(String, nullable=True)
    phone            = Column(String, nullable=True)
    is_active        = Column(Boolean, default=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    latitude         = Column(Float, nullable=True)
    longitude        = Column(Float, nullable=True)
    description      = Column(Text, nullable=True)
    logo_url         = Column(String, nullable=True)
    points_per_100f  = Column(Float, default=1.0)

    # ── SOKORA EXPLORE — champs étendus ──────────────────────────────────────
    type          = Column(String(50), nullable=True)    # maquis, bar, restaurant, hotel, voyage
    city          = Column(String(100), nullable=True)
    country       = Column(String(50), default="Côte d'Ivoire")
    email         = Column(String(200), nullable=True)
    website       = Column(String(200), nullable=True)
    hours         = Column(String(200), nullable=True)
    lat           = Column(Float, nullable=True)         # alias lisible (ex. GPS)
    lon           = Column(Float, nullable=True)
    photos        = Column(JSON, default=list)
    cover_url     = Column(String(500), nullable=True)
    rating        = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    is_verified   = Column(Boolean, default=False)
    is_premium    = Column(Boolean, default=False)
    cashback_rate = Column(Float, default=2.0)
    admin_user_id = Column(Integer, nullable=True)  # ID de l'utilisateur manager lié

    # Relations
    subscription = relationship("Subscription", back_populates="establishment", uselist=False)
    users        = relationship("User",          back_populates="establishment")
    tables       = relationship("Table",         back_populates="establishment")
    categories   = relationship("Category",      back_populates="establishment")
    products     = relationship("Product",       back_populates="establishment")
    orders       = relationship("Order",         back_populates="establishment")
    expenses     = relationship("Expense",       back_populates="establishment")


class Subscription(Base):
    """Un abonnement par établissement."""
    __tablename__ = "subscriptions"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), unique=True)
    status           = Column(SAEnum(SubscriptionStatus), default=SubscriptionStatus.TRIAL)
    trial_ends_at    = Column(DateTime(timezone=True), nullable=True)
    current_period_end = Column(DateTime(timezone=True), nullable=True)
    plan             = Column(String, default="starter")   # starter / pro / enterprise
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    establishment = relationship("Establishment", back_populates="subscription")


# ─────────────────────────────────────────
#  UTILISATEURS
# ─────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True, index=True)
    full_name        = Column(String, nullable=False)
    phone_number     = Column(String, unique=True, index=True, nullable=False)
    password_hash    = Column(String, nullable=False)
    role             = Column(SAEnum(UserRole), nullable=False, default=UserRole.WAITER)
    is_active        = Column(Boolean, default=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=True)
    staff_code       = Column(String, nullable=True)   # code court pour login rapide serveur
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    establishment = relationship("Establishment", back_populates="users")
    orders        = relationship("Order",  back_populates="waiter")
    sales         = relationship("Sale",   back_populates="seller")


# ─────────────────────────────────────────
#  MENU — CATÉGORIES & PRODUITS
# ─────────────────────────────────────────

class Category(Base):
    __tablename__ = "categories"

    id               = Column(Integer, primary_key=True, index=True)
    name             = Column(String, nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    is_kitchen       = Column(Boolean, default=False)

    establishment = relationship("Establishment", back_populates="categories")
    products      = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id                    = Column(Integer, primary_key=True, index=True)
    name                  = Column(String, index=True, nullable=False)
    description           = Column(Text, nullable=True)
    price                 = Column(Float, nullable=False)
    purchase_price        = Column(Float, nullable=True)
    stock_quantity        = Column(Integer, default=0)
    stock_alert_threshold = Column(Integer, default=5)
    stock_unit            = Column(String, default="pcs")
    reorder_threshold     = Column(Integer, default=20)
    is_available          = Column(Boolean, default=True)
    category_id           = Column(Integer, ForeignKey("categories.id"), nullable=True)
    establishment_id      = Column(Integer, ForeignKey("establishments.id"), nullable=False)

    category      = relationship("Category", back_populates="products")
    establishment = relationship("Establishment", back_populates="products")
    order_items   = relationship("OrderItem", back_populates="product")
    sale_items    = relationship("SaleItem",  back_populates="product")


# ─────────────────────────────────────────
#  TABLES DU RESTAURANT
# ─────────────────────────────────────────

class Table(Base):
    __tablename__ = "tables"

    id               = Column(Integer, primary_key=True, index=True)
    number           = Column(Integer, nullable=False)          # ex: Table 5
    label            = Column(String, nullable=True)            # ex: "Terrasse"
    capacity         = Column(Integer, default=4)
    status           = Column(SAEnum(TableStatus), default=TableStatus.FREE)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)

    establishment = relationship("Establishment", back_populates="tables")
    orders        = relationship("Order", back_populates="table")


# ─────────────────────────────────────────
#  COMMANDES
# ─────────────────────────────────────────

class Order(Base):
    __tablename__ = "orders"

    id               = Column(Integer, primary_key=True, index=True)
    table_id         = Column(Integer, ForeignKey("tables.id"), nullable=False)
    waiter_id        = Column(Integer, ForeignKey("users.id"),  nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    status           = Column(SAEnum(OrderStatus), default=OrderStatus.OPEN)
    notes            = Column(Text, nullable=True)
    client_phone     = Column(String, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    table         = relationship("Table",     back_populates="orders")
    waiter        = relationship("User",      back_populates="orders")
    establishment = relationship("Establishment", back_populates="orders")
    items         = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    payment       = relationship("Payment",   back_populates="order", uselist=False)


class OrderItem(Base):
    __tablename__ = "order_items"

    id                   = Column(Integer, primary_key=True, index=True)
    order_id             = Column(Integer, ForeignKey("orders.id"),   nullable=False)
    product_id           = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity             = Column(Integer, nullable=False, default=1)
    unit_price           = Column(Float,   nullable=False)
    notes                = Column(String,  nullable=True)
    is_complimentary     = Column(Boolean, default=False)
    complimentary_reason = Column(String,  nullable=True)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")


# ─────────────────────────────────────────
#  PAIEMENTS
# ─────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    id               = Column(Integer, primary_key=True, index=True)
    order_id         = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    amount           = Column(Float, nullable=False)
    method           = Column(SAEnum(PaymentMethod), nullable=False)
    processed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)  # gérant ou serveur
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", back_populates="payment")


# ─────────────────────────────────────────
#  DÉPENSES
# ─────────────────────────────────────────

class Expense(Base):
    __tablename__ = "expenses"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    label            = Column(String, nullable=False)
    amount           = Column(Float,  nullable=False)
    category         = Column(SAEnum(ExpenseCategory), default=ExpenseCategory.OTHER)
    recorded_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    establishment = relationship("Establishment", back_populates="expenses")


# ─────────────────────────────────────────
#  VENTES DIRECTES (caisse rapide, sans table)
# ─────────────────────────────────────────

class Sale(Base):
    __tablename__ = "sales"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    seller_id        = Column(Integer, ForeignKey("users.id"), nullable=False)
    total_amount     = Column(Float,   nullable=False)
    payment_method   = Column(SAEnum(PaymentMethod), default=PaymentMethod.CASH)
    note             = Column(String,  nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    seller = relationship("User", back_populates="sales")
    items  = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id         = Column(Integer, primary_key=True, index=True)
    sale_id    = Column(Integer, ForeignKey("sales.id"),    nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False)
    quantity   = Column(Integer, nullable=False)
    unit_price = Column(Float,   nullable=False)

    sale    = relationship("Sale",    back_populates="items")
    product = relationship("Product", back_populates="sale_items")


# ─────────────────────────────────────────
#  CLIENT PWA & WALLET
# ─────────────────────────────────────────

class ClientAccount(Base):
    __tablename__ = "client_accounts"

    id           = Column(Integer, primary_key=True, index=True)
    phone        = Column(String, unique=True, index=True, nullable=False)
    name         = Column(String, nullable=True)
    total_points = Column(Integer, default=0)
    total_spent  = Column(Float,   default=0.0)
    visit_count  = Column(Integer, default=0)
    otp_code     = Column(String,  nullable=True)
    otp_expires  = Column(DateTime(timezone=True), nullable=True)
    client_token = Column(String,  nullable=True, index=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    wallet       = relationship("WalletAccount", back_populates="client", uselist=False)


class LoyaltyTransaction(Base):
    __tablename__ = "loyalty_transactions"

    id               = Column(Integer, primary_key=True, index=True)
    client_id        = Column(Integer, ForeignKey("client_accounts.id"), nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=True)
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=True)
    points           = Column(Integer, nullable=False)
    tx_type          = Column(String, nullable=False, default="earn")  # earn / redeem / bonus
    description      = Column(String, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


class WalletAccount(Base):
    __tablename__ = "wallet_accounts"

    id           = Column(Integer, primary_key=True, index=True)
    client_id    = Column(Integer, ForeignKey("client_accounts.id"), unique=True, nullable=False)
    balance      = Column(Float, default=0.0)
    total_loaded = Column(Float, default=0.0)
    updated_at   = Column(DateTime(timezone=True), server_default=func.now())

    client       = relationship("ClientAccount", back_populates="wallet")
    transactions = relationship("WalletTransaction", back_populates="wallet")


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    id               = Column(Integer, primary_key=True, index=True)
    wallet_id        = Column(Integer, ForeignKey("wallet_accounts.id"), nullable=False)
    tx_type          = Column(String, nullable=False)   # topup / payment / transfer
    amount           = Column(Float, nullable=False)
    balance_before   = Column(Float, nullable=False)
    balance_after    = Column(Float, nullable=False)
    description      = Column(String, nullable=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=True)
    service_type     = Column(String, default="restaurant")  # restaurant / hotel / voyage / etc.
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    wallet = relationship("WalletAccount", back_populates="transactions")


class WalletTopup(Base):
    __tablename__ = "wallet_topups"

    id               = Column(Integer, primary_key=True, index=True)
    client_id        = Column(Integer, ForeignKey("client_accounts.id"), nullable=False)
    amount           = Column(Float, nullable=False)
    method           = Column(String, default="cash")
    phone_used       = Column(String, nullable=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=True)
    status           = Column(String, default="pending")  # pending / confirmed / rejected
    confirmed_by     = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────
#  STOCK MOVEMENTS
# ─────────────────────────────────────────

class StockMovement(Base):
    __tablename__ = "stock_movements"

    id               = Column(Integer, primary_key=True, index=True)
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    movement_type    = Column(String, nullable=False)   # in / out / adjustment
    quantity         = Column(Integer, nullable=False)
    reason           = Column(String, nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product")


# ─────────────────────────────────────────
#  ARDOISE / CREDIT CLIENT
# ─────────────────────────────────────────

class CreditAccount(Base):
    __tablename__ = "credit_accounts"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    client_name      = Column(String, nullable=False)
    client_phone     = Column(String, nullable=True)
    balance          = Column(Float, default=0.0)   # montant dû (positif = client doit)
    credit_limit     = Column(Float, nullable=True)  # plafond de crédit autorisé
    notes            = Column(Text, nullable=True)
    is_active        = Column(Boolean, default=True)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    transactions = relationship("CreditTransaction", back_populates="account")


class CreditTransaction(Base):
    __tablename__ = "credit_transactions"

    id               = Column(Integer, primary_key=True, index=True)
    credit_account_id = Column(Integer, ForeignKey("credit_accounts.id"), nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    transaction_type = Column(String, nullable=False)   # credit / debit
    amount           = Column(Float, nullable=False)
    description      = Column(String, nullable=True)
    payment_method   = Column(String, nullable=True)   # cash / orange_money / wave / mtn / wallet
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("CreditAccount", back_populates="transactions", foreign_keys=[credit_account_id])


# ─────────────────────────────────────────
#  INVENTAIRE
# ─────────────────────────────────────────

class InventorySnapshot(Base):
    __tablename__ = "inventory_snapshots"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    items            = relationship("InventorySnapshotItem", back_populates="snapshot")


class InventorySnapshotItem(Base):
    __tablename__ = "inventory_snapshot_items"

    id          = Column(Integer, primary_key=True, index=True)
    snapshot_id = Column(Integer, ForeignKey("inventory_snapshots.id"), nullable=False)
    product_id  = Column(Integer, ForeignKey("products.id"), nullable=False)
    counted     = Column(Integer, nullable=False)
    expected    = Column(Integer, nullable=False)
    difference  = Column(Integer, nullable=False)

    snapshot = relationship("InventorySnapshot", back_populates="items")


# ─────────────────────────────────────────
#  PAYMENT REQUESTS (QR Code payment flow)
# ─────────────────────────────────────────

class PaymentRequest(Base):
    __tablename__ = "payment_requests"

    id               = Column(Integer, primary_key=True, index=True)
    token            = Column(String, unique=True, index=True, nullable=False)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=False)
    table_id         = Column(Integer, ForeignKey("tables.id"), nullable=True)
    table_number     = Column(Integer, nullable=True)
    order_ids        = Column(JSON, nullable=False, default=list)   # [1, 2, 3]
    items_snapshot   = Column(JSON, nullable=True)                  # [{name, qty, price, order_id}]
    total_amount     = Column(Float, nullable=False)
    status           = Column(String, default="pending")  # pending / paid / expired / cancelled
    payment_method   = Column(String, nullable=True)
    client_phone     = Column(String, nullable=True)
    client_id        = Column(Integer, ForeignKey("client_accounts.id"), nullable=True)
    change_amount    = Column(Float, default=0.0)   # monnaie à rendre si espèces
    change_sent      = Column(Boolean, default=False)
    establishment_name = Column(String, nullable=True)
    created_by       = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    paid_at          = Column(DateTime(timezone=True), nullable=True)
