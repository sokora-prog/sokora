"""
SOKORA — Module Petits Services Informels
Plombiers, électriciens, couturiers, baby-sitters, coursiers, etc.
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    Boolean, DateTime, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class ServiceRequestStatus(str, enum.Enum):
    PENDING    = "PENDING"
    CONFIRMED  = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED  = "COMPLETED"
    CANCELLED  = "CANCELLED"


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False, unique=True)
    icon        = Column(String(10),  nullable=True)   # emoji
    description = Column(Text,        nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    providers = relationship("ServiceProvider", back_populates="category")


class ServiceProvider(Base):
    """Un prestataire individuel (plombier, électricien, couturier…)."""
    __tablename__ = "service_providers"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)
    phone        = Column(String(30),  nullable=False, index=True)
    category_id  = Column(Integer, ForeignKey("service_categories.id"), nullable=False)
    city         = Column(String(100), default="Abidjan")
    neighborhood = Column(String(100), nullable=True)
    description  = Column(Text, nullable=True)
    base_price   = Column(Float, nullable=True)           # tarif de base en XOF
    price_unit   = Column(String(50), default="prestation")  # heure / prestation / jour
    rating       = Column(Float, default=0.0)
    reviews_count = Column(Integer, default=0)
    is_active    = Column(Boolean, default=True)
    is_verified  = Column(Boolean, default=False)         # vérifié par SOKORA
    photo_url    = Column(String(500), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    category  = relationship("ServiceCategory", back_populates="providers")
    requests  = relationship("ServiceRequest",  back_populates="provider")


class ServiceRequest(Base):
    """Une demande de service envoyée par un client."""
    __tablename__ = "service_requests"

    id               = Column(Integer, primary_key=True, index=True)
    client_name      = Column(String(200), nullable=False)
    client_phone     = Column(String(30),  nullable=False)
    provider_id      = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    description      = Column(Text, nullable=True)
    address          = Column(String(300), nullable=True)
    scheduled_at     = Column(DateTime(timezone=True), nullable=True)
    status           = Column(SAEnum(ServiceRequestStatus), default=ServiceRequestStatus.PENDING)
    agreed_price     = Column(Float, nullable=True)
    payment_method   = Column(String(30), default="cash")
    rating_given     = Column(Integer, nullable=True)    # 1-5
    review_text      = Column(Text, nullable=True)
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    provider = relationship("ServiceProvider", back_populates="requests")
