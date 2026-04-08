"""
SOKORA — Module Petits Services Informels v2
Artisans avec wallet, escrow, RDV, QR release
"""
import enum
import secrets
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    Boolean, DateTime, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class ServiceRequestStatus(str, enum.Enum):
    PENDING_VALIDATION = "PENDING_VALIDATION"   # client a demandé, artisan doit valider
    CONFIRMED          = "CONFIRMED"             # artisan a accepté
    PAID               = "PAID"                  # client a payé (escrow)
    IN_PROGRESS        = "IN_PROGRESS"           # prestation en cours
    COMPLETED          = "COMPLETED"             # terminée, fonds libérés
    CANCELLED          = "CANCELLED"             # annulée, remboursement
    REJECTED           = "REJECTED"              # artisan a refusé


class ServicePaymentStatus(str, enum.Enum):
    UNPAID   = "UNPAID"
    ESCROWED = "ESCROWED"   # fonds bloqués chez SOKORA
    RELEASED = "RELEASED"   # fonds libérés à l'artisan
    REFUNDED = "REFUNDED"   # remboursé au client


class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False, unique=True)
    icon        = Column(String(10),  nullable=True)
    description = Column(Text,        nullable=True)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    providers = relationship("ServiceProvider", back_populates="category")


class ServiceProvider(Base):
    """Prestataire/artisan enregistré sur la plateforme."""
    __tablename__ = "service_providers"

    id             = Column(Integer, primary_key=True, index=True)
    name           = Column(String(200), nullable=False)
    phone          = Column(String(30),  nullable=False, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=True)  # compte artisan
    category_id    = Column(Integer, ForeignKey("service_categories.id"), nullable=False)
    city           = Column(String(100), default="Abidjan")
    neighborhood   = Column(String(100), nullable=True)
    description    = Column(Text, nullable=True)
    base_price     = Column(Float, nullable=True)
    price_unit     = Column(String(50), default="prestation")
    rating         = Column(Float, default=0.0)
    reviews_count  = Column(Integer, default=0)
    is_active      = Column(Boolean, default=True)
    is_verified    = Column(Boolean, default=False)
    photo_url      = Column(String(500), nullable=True)
    latitude       = Column(Float, nullable=True)   # GPS artisan
    longitude      = Column(Float, nullable=True)   # GPS artisan
    # Wallet artisan
    wallet_balance = Column(Float, default=0.0)
    total_earned   = Column(Float, default=0.0)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())

    category  = relationship("ServiceCategory", back_populates="providers")
    requests  = relationship("ServiceRequest",  back_populates="provider")


class ServiceRequest(Base):
    """Demande/RDV de service avec système escrow."""
    __tablename__ = "service_requests"

    id                = Column(Integer, primary_key=True, index=True)
    # Client
    client_name       = Column(String(200), nullable=False)
    client_phone      = Column(String(30),  nullable=False)
    client_user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Prestataire
    provider_id       = Column(Integer, ForeignKey("service_providers.id"), nullable=False)
    # Détails
    description       = Column(Text, nullable=True)
    address           = Column(String(300), nullable=True)
    scheduled_at      = Column(DateTime(timezone=True), nullable=True)
    # Champs spécialisés par métier (JSON stocké en text)
    specialty_data    = Column(Text, nullable=True)  # JSON string
    # Statut & paiement
    status            = Column(SAEnum(ServiceRequestStatus), default=ServiceRequestStatus.PENDING_VALIDATION)
    payment_status    = Column(SAEnum(ServicePaymentStatus), default=ServicePaymentStatus.UNPAID)
    agreed_price      = Column(Float, nullable=True)
    payment_method    = Column(String(30), default="wallet")
    escrow_amount     = Column(Float, default=0.0)  # montant bloqué
    qr_release_token  = Column(String(64), nullable=True, unique=True)  # QR que l'artisan scanne
    # Avis
    rating_given      = Column(Integer, nullable=True)
    review_text       = Column(Text, nullable=True)
    # Timestamps
    created_at        = Column(DateTime(timezone=True), server_default=func.now())
    updated_at        = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    provider = relationship("ServiceProvider", back_populates="requests")
