"""
SOKORA PULSE — Modèles Promotions & Social Feed
Posts d'établissements, réactions, commentaires, partages
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base


class PromoPost(Base):
    """Post de promotion d'un établissement (SOKORA PULSE)"""
    __tablename__ = "promo_posts"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, nullable=True)  # FK souple vers establishments.id
    establishment_name = Column(String(200), nullable=False)
    establishment_type = Column(String(50), default="restaurant")  # maquis, bar, restaurant, hotel, voyage
    establishment_city = Column(String(100), nullable=True)

    # Contenu
    title        = Column(String(300), nullable=True)
    content      = Column(Text, nullable=False)
    media_urls   = Column(JSON, default=list)  # liste d'URLs images/vidéos
    post_type    = Column(String(20), default="info")  # promo, event, new, info

    # Promo spécifique
    discount     = Column(String(50), nullable=True)  # "-25%", "2500F", etc.
    event_date   = Column(String(100), nullable=True)  # "Samedi 5 Avr."
    expires_at   = Column(DateTime(timezone=True), nullable=True)

    # Stats réactions
    react_fire   = Column(Integer, default=0)
    react_heart  = Column(Integer, default=0)
    react_clap   = Column(Integer, default=0)
    react_wow    = Column(Integer, default=0)
    react_go     = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    shares_count   = Column(Integer, default=0)
    views_count    = Column(Integer, default=0)

    # Statut
    is_active    = Column(Boolean, default=True)
    is_sponsored = Column(Boolean, default=False)
    is_verified_estab = Column(Boolean, default=False)

    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                          onupdate=lambda: datetime.now(timezone.utc))

    reactions  = relationship("PromoReaction", back_populates="post", cascade="all, delete-orphan")
    comments   = relationship("PromoComment",  back_populates="post", cascade="all, delete-orphan")


class PromoReaction(Base):
    """Réaction d'un client sur un post (🔥 ❤️ 👏 😮 🚀)"""
    __tablename__ = "promo_reactions"

    id           = Column(Integer, primary_key=True, index=True)
    post_id      = Column(Integer, ForeignKey("promo_posts.id"), nullable=False)
    client_phone = Column(String(20), nullable=False)  # identifiant client
    reaction_key = Column(String(20), nullable=False)  # fire, heart, clap, wow, go
    created_at   = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    post = relationship("PromoPost", back_populates="reactions")


class PromoComment(Base):
    """Commentaire sur un post"""
    __tablename__ = "promo_comments"

    id          = Column(Integer, primary_key=True, index=True)
    post_id     = Column(Integer, ForeignKey("promo_posts.id"), nullable=False)
    author_name = Column(String(100), default="Client SOKORA")
    author_phone = Column(String(20), nullable=True)
    content     = Column(Text, nullable=False)
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    post = relationship("PromoPost", back_populates="comments")



class MerchantPaymentCode(Base):
    """Code de paiement marchand unique (USSD-style)"""
    __tablename__ = "merchant_payment_codes"

    id               = Column(Integer, primary_key=True, index=True)
    code             = Column(String(20), unique=True, nullable=False, index=True)
    client_phone     = Column(String(20), nullable=False)
    amount           = Column(Integer, nullable=False)
    method           = Column(String(20), default="orange")  # orange, mtn, moov, wave, wallet
    ussd_code        = Column(String(100), nullable=True)
    status           = Column(String(20), default="pending")  # pending, used, expired
    establishment_id = Column(Integer, nullable=True)
    created_at       = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at       = Column(DateTime(timezone=True), nullable=False)
    used_at          = Column(DateTime(timezone=True), nullable=True)


class ClientProfile(Base):
    """Profil étendu du client avec conciergerie"""
    __tablename__ = "client_profiles"

    id            = Column(Integer, primary_key=True, index=True)
    client_phone  = Column(String(20), unique=True, nullable=False, index=True)
    name          = Column(String(200), nullable=True)
    email         = Column(String(200), nullable=True)
    avatar_url    = Column(String(500), nullable=True)
    city          = Column(String(100), nullable=True)

    # Wallet
    wallet_balance = Column(Integer, default=0)
    total_spent    = Column(Integer, default=0)
    total_cashback = Column(Integer, default=0)

    # Fidélité / Tier
    tier           = Column(String(20), default="bronze")  # bronze, silver, gold, diamond, platinum
    loyalty_points = Column(Integer, default=0)
    is_premium     = Column(Boolean, default=False)

    # GPS préférences
    preferred_city = Column(String(100), nullable=True)
    lat            = Column(Float, nullable=True)
    lon            = Column(Float, nullable=True)

    created_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at  = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc),
                         onupdate=lambda: datetime.now(timezone.utc))
