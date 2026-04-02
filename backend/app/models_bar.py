"""
SOKORA Bar/Boîte de nuit — Modèles SQLAlchemy
Gestion : Venues, Événements, Tables VIP, Commandes bouteilles, Entrées
"""
import enum
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Boolean, DateTime, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class BarTableStatus(str, enum.Enum):
    FREE      = "FREE"
    RESERVED  = "RESERVED"
    OCCUPIED  = "OCCUPIED"
    CLEANING  = "CLEANING"


class EventStatus(str, enum.Enum):
    UPCOMING   = "UPCOMING"
    LIVE       = "LIVE"
    ENDED      = "ENDED"
    CANCELLED  = "CANCELLED"


class BarOrderStatus(str, enum.Enum):
    PENDING    = "PENDING"
    CONFIRMED  = "CONFIRMED"
    SERVED     = "SERVED"
    PAID       = "PAID"
    CANCELLED  = "CANCELLED"


class BarVenue(Base):
    """Bar ou boîte de nuit."""
    __tablename__ = "bar_venues"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), nullable=True)
    name             = Column(String, nullable=False)
    address          = Column(String, nullable=True)
    phone            = Column(String, nullable=True)
    cover_charge     = Column(Float, default=0.0)   # Prix entrée standard
    vip_price        = Column(Float, default=0.0)   # Prix entrée VIP
    capacity         = Column(Integer, default=200)
    is_active        = Column(Boolean, default=True)
    logo_url         = Column(String, nullable=True)
    description      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    events = relationship("BarEvent",   back_populates="venue")
    tables = relationship("BarTable",   back_populates="venue")


class BarEvent(Base):
    """Événement / Soirée."""
    __tablename__ = "bar_events"

    id           = Column(Integer, primary_key=True, index=True)
    venue_id     = Column(Integer, ForeignKey("bar_venues.id"), nullable=False)
    name         = Column(String, nullable=False)
    description  = Column(Text, nullable=True)
    dj_name      = Column(String, nullable=True)
    poster_url   = Column(String, nullable=True)
    event_date   = Column(DateTime(timezone=True), nullable=False)
    entry_price  = Column(Float, default=0.0)
    vip_price    = Column(Float, default=0.0)
    capacity     = Column(Integer, default=200)
    tickets_sold = Column(Integer, default=0)
    status       = Column(SAEnum(EventStatus), default=EventStatus.UPCOMING)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    venue    = relationship("BarVenue", back_populates="events")
    tickets  = relationship("BarTicket", back_populates="event")


class BarTable(Base):
    """Table VIP / Lounge."""
    __tablename__ = "bar_tables"

    id           = Column(Integer, primary_key=True, index=True)
    venue_id     = Column(Integer, ForeignKey("bar_venues.id"), nullable=False)
    number       = Column(String, nullable=False)   # ex: "VIP-01", "LOUNGE-A"
    zone         = Column(String, nullable=True)    # ex: "VIP", "Lounge", "Bar"
    capacity     = Column(Integer, default=6)
    min_conso    = Column(Float, default=0.0)       # Consommation minimum
    status       = Column(SAEnum(BarTableStatus), default=BarTableStatus.FREE)
    is_active    = Column(Boolean, default=True)

    venue        = relationship("BarVenue", back_populates="tables")
    reservations = relationship("BarTableReservation", back_populates="table")


class BarTableReservation(Base):
    """Réservation de table VIP."""
    __tablename__ = "bar_table_reservations"

    id           = Column(Integer, primary_key=True, index=True)
    table_id     = Column(Integer, ForeignKey("bar_tables.id"), nullable=False)
    event_id     = Column(Integer, ForeignKey("bar_events.id"), nullable=True)
    client_id    = Column(Integer, ForeignKey("client_accounts.id"), nullable=True)
    client_name  = Column(String, nullable=True)
    client_phone = Column(String, nullable=True)
    guests_count = Column(Integer, default=1)
    amount_paid  = Column(Float, default=0.0)
    wallet_tx_id = Column(Integer, ForeignKey("wallet_transactions.id"), nullable=True)
    notes        = Column(Text, nullable=True)
    status       = Column(String, default="confirmed")  # confirmed/cancelled/arrived
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    table = relationship("BarTable", back_populates="reservations")


class BarTicket(Base):
    """Billet d'entrée pour un événement."""
    __tablename__ = "bar_tickets"

    id           = Column(Integer, primary_key=True, index=True)
    event_id     = Column(Integer, ForeignKey("bar_events.id"), nullable=False)
    client_id    = Column(Integer, ForeignKey("client_accounts.id"), nullable=True)
    ticket_type  = Column(String, default="standard")  # standard / vip
    price        = Column(Float, nullable=False)
    qr_token     = Column(String, nullable=True, index=True)
    wallet_tx_id = Column(Integer, ForeignKey("wallet_transactions.id"), nullable=True)
    is_used      = Column(Boolean, default=False)
    used_at      = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    event  = relationship("BarEvent", back_populates="tickets")
    client = relationship("ClientAccount", foreign_keys=[client_id])


class BarOrder(Base):
    """Commande bouteilles/service à table."""
    __tablename__ = "bar_orders"

    id               = Column(Integer, primary_key=True, index=True)
    venue_id         = Column(Integer, ForeignKey("bar_venues.id"), nullable=False)
    table_id         = Column(Integer, ForeignKey("bar_tables.id"), nullable=True)
    client_id        = Column(Integer, ForeignKey("client_accounts.id"), nullable=True)
    client_name      = Column(String, nullable=True)
    staff_id         = Column(Integer, ForeignKey("users.id"), nullable=True)
    status           = Column(SAEnum(BarOrderStatus), default=BarOrderStatus.PENDING)
    total_amount     = Column(Float, default=0.0)
    payment_method   = Column(String, nullable=True)
    wallet_tx_id     = Column(Integer, ForeignKey("wallet_transactions.id"), nullable=True)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())

    items = relationship("BarOrderItem", back_populates="order", cascade="all, delete-orphan")


class BarOrderItem(Base):
    """Item d'une commande bar."""
    __tablename__ = "bar_order_items"

    id         = Column(Integer, primary_key=True, index=True)
    order_id   = Column(Integer, ForeignKey("bar_orders.id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True)
    name       = Column(String, nullable=False)   # nom libre si pas de product_id
    quantity   = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)

    order = relationship("BarOrder", back_populates="items")
