import enum
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    Boolean, DateTime, Text, Enum as SAEnum, Date, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ─────────────────────────────────────────────────────────────
#  ENUMS HOTEL
# ─────────────────────────────────────────────────────────────

class RoomStatus(str, enum.Enum):
    AVAILABLE   = "AVAILABLE"    # Libre et propre
    OCCUPIED    = "OCCUPIED"     # Client présent
    RESERVED    = "RESERVED"     # Réservation confirmée
    CLEANING    = "CLEANING"     # En ménage
    MAINTENANCE = "MAINTENANCE"  # Hors service
    BLOCKED     = "BLOCKED"      # Bloqué manuellement


class ReservationStatus(str, enum.Enum):
    PENDING    = "PENDING"     # En attente de paiement
    CONFIRMED  = "CONFIRMED"   # Payé — escrow actif
    CHECKED_IN = "CHECKED_IN"  # Client arrivé — fonds libérés
    COMPLETED  = "COMPLETED"   # Séjour terminé
    CANCELLED  = "CANCELLED"   # Annulé
    NO_SHOW    = "NO_SHOW"     # Client absent — pénalité appliquée


class EscrowStatus(str, enum.Enum):
    HELD      = "HELD"       # Fonds séquestrés
    RELEASED  = "RELEASED"   # Libérés vers l'hôtel
    REFUNDED  = "REFUNDED"   # Remboursés au client
    PENALIZED = "PENALIZED"  # Pénalité no-show appliquée


class HotelTemplate(str, enum.Enum):
    LUXE         = "LUXE"
    BUSINESS     = "BUSINESS"
    STUDIO_URBAIN = "STUDIO_URBAIN"
    VILLA_VACANCES = "VILLA_VACANCES"
    AUBERGE      = "AUBERGE"


class RoomBedType(str, enum.Enum):
    SIMPLE    = "SIMPLE"
    DOUBLE    = "DOUBLE"
    TWIN      = "TWIN"
    KING      = "KING"
    SUITE     = "SUITE"


# ─────────────────────────────────────────────────────────────
#  HOTEL — Établissement hôtelier
# ─────────────────────────────────────────────────────────────

class Hotel(Base):
    """
    Un hôtel est lié à un Establishment SOKORA existant.
    Cela permet de partager : ClientAccount, WalletAccount, Subscription.
    """
    __tablename__ = "hotels"

    id               = Column(Integer, primary_key=True, index=True)
    establishment_id = Column(Integer, ForeignKey("establishments.id"), unique=True, nullable=False)

    # Identité
    name             = Column(String, nullable=False)
    description      = Column(Text, nullable=True)
    address          = Column(String, nullable=True)
    city             = Column(String, nullable=True)
    country          = Column(String, default="CI")

    # Géolocalisation
    latitude         = Column(Float, nullable=True)
    longitude        = Column(Float, nullable=True)

    # Médias
    cover_image_url  = Column(String, nullable=True)
    logo_url         = Column(String, nullable=True)
    images           = Column(JSON, default=list)      # liste d'URLs photos
    video_url        = Column(String, nullable=True)   # Reels/présentation

    # Template CMS
    template         = Column(SAEnum(HotelTemplate), default=HotelTemplate.BUSINESS)

    # Politique tarifaire
    checkin_time     = Column(String, default="14:00")
    checkout_time    = Column(String, default="12:00")
    cancellation_hours = Column(Integer, default=24)   # heures avant annulation gratuite
    no_show_penalty_pct = Column(Float, default=50.0)  # % du montant prélevé en no-show
    cleaning_fee     = Column(Float, default=0.0)
    deposit_pct      = Column(Float, default=100.0)    # % du montant mis en escrow

    # Commission SOKORA
    sokora_commission_pct = Column(Float, default=5.0)

    # Équipements (liste JSON)
    amenities        = Column(JSON, default=list)      # ["wifi", "piscine", "parking", ...]

    # Status
    is_active        = Column(Boolean, default=True)
    is_verified      = Column(Boolean, default=False)  # vérifié par SOKORA
    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    room_types   = relationship("RoomType",   back_populates="hotel", cascade="all, delete-orphan")
    rooms        = relationship("Room",        back_populates="hotel", cascade="all, delete-orphan")
    season_rates = relationship("SeasonRate",  back_populates="hotel", cascade="all, delete-orphan")
    reservations = relationship("Reservation", back_populates="hotel")


# ─────────────────────────────────────────────────────────────
#  TYPE DE CHAMBRE
# ─────────────────────────────────────────────────────────────

class RoomType(Base):
    """
    Catégorie de chambre : Standard, Deluxe, Suite, etc.
    Chaque type a un tarif de base et des équipements spécifiques.
    """
    __tablename__ = "room_types"

    id          = Column(Integer, primary_key=True, index=True)
    hotel_id    = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    name        = Column(String, nullable=False)       # "Standard", "Suite Présidentielle"
    description = Column(Text, nullable=True)
    bed_type    = Column(SAEnum(RoomBedType), default=RoomBedType.DOUBLE)
    capacity    = Column(Integer, default=2)           # nb de personnes max
    base_price  = Column(Float, nullable=False)        # prix par nuit (saison normale)
    images      = Column(JSON, default=list)
    amenities   = Column(JSON, default=list)           # équipements spécifiques à ce type
    is_active   = Column(Boolean, default=True)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())

    hotel = relationship("Hotel", back_populates="room_types")
    rooms = relationship("Room",  back_populates="room_type")


# ─────────────────────────────────────────────────────────────
#  CHAMBRE INDIVIDUELLE
# ─────────────────────────────────────────────────────────────

class Room(Base):
    """
    Chambre physique avec numéro et statut en temps réel.
    """
    __tablename__ = "rooms"

    id           = Column(Integer, primary_key=True, index=True)
    hotel_id     = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=False)

    number       = Column(String, nullable=False)      # "101", "Suite A", "Villa 3"
    floor        = Column(Integer, default=1)
    status       = Column(SAEnum(RoomStatus), default=RoomStatus.AVAILABLE)
    notes        = Column(Text, nullable=True)         # notes internes gérant
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    hotel        = relationship("Hotel",     back_populates="rooms")
    room_type    = relationship("RoomType",  back_populates="rooms")
    reservations = relationship("Reservation", back_populates="room")


# ─────────────────────────────────────────────────────────────
#  TARIFS SAISONNIERS (Yield Management)
# ─────────────────────────────────────────────────────────────

class SeasonRate(Base):
    """
    Tarif différencié par période (Haute saison, Week-end, Noël, etc.)
    Le prix de la SeasonRate écrase le base_price du RoomType si elle est active.
    """
    __tablename__ = "season_rates"

    id           = Column(Integer, primary_key=True, index=True)
    hotel_id     = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    room_type_id = Column(Integer, ForeignKey("room_types.id"), nullable=True)  # null = s'applique à tous

    name         = Column(String, nullable=False)      # "Haute saison", "Week-end", "Noël 2026"
    price        = Column(Float, nullable=False)
    date_from    = Column(Date, nullable=False)
    date_to      = Column(Date, nullable=False)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    hotel     = relationship("Hotel", back_populates="season_rates")
    room_type = relationship("RoomType")


# ─────────────────────────────────────────────────────────────
#  RÉSERVATION
# ─────────────────────────────────────────────────────────────

class Reservation(Base):
    """
    Réservation d'une chambre par un ClientAccount SOKORA.
    Le paiement est immédiatement mis en escrow à la confirmation.
    """
    __tablename__ = "reservations"

    id               = Column(Integer, primary_key=True, index=True)
    hotel_id         = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    room_id          = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    client_id        = Column(Integer, ForeignKey("client_accounts.id"), nullable=False)

    # Dates
    checkin_date     = Column(Date, nullable=False)
    checkout_date    = Column(Date, nullable=False)
    nights           = Column(Integer, nullable=False)

    # Tarification
    price_per_night  = Column(Float, nullable=False)
    cleaning_fee     = Column(Float, default=0.0)
    total_amount     = Column(Float, nullable=False)   # prix total client
    sokora_commission = Column(Float, default=0.0)     # commission SOKORA prélevée
    hotel_amount     = Column(Float, nullable=False)   # montant reversé à l'hôtel

    # Statut
    status           = Column(SAEnum(ReservationStatus), default=ReservationStatus.PENDING)

    # QR Code Pass SOKORA
    qr_code          = Column(String, nullable=True, unique=True, index=True)  # token unique
    qr_expires_at    = Column(DateTime(timezone=True), nullable=True)

    # Infos client
    guest_count      = Column(Integer, default=1)
    special_requests = Column(Text, nullable=True)

    # Check-in physique
    checkin_at       = Column(DateTime(timezone=True), nullable=True)   # heure réelle arrivée
    checkout_at      = Column(DateTime(timezone=True), nullable=True)   # heure réelle départ
    checked_in_by    = Column(Integer, ForeignKey("users.id"), nullable=True)  # staff qui a scanné

    # No-show
    no_show_penalty  = Column(Float, default=0.0)

    created_at       = Column(DateTime(timezone=True), server_default=func.now())
    updated_at       = Column(DateTime(timezone=True), onupdate=func.now())

    # Relations
    hotel    = relationship("Hotel",         back_populates="reservations")
    room     = relationship("Room",          back_populates="reservations")
    client   = relationship("ClientAccount")
    escrow   = relationship("EscrowTransaction", back_populates="reservation", uselist=False)


# ─────────────────────────────────────────────────────────────
#  ESCROW (SÉQUESTRE)
# ─────────────────────────────────────────────────────────────

class EscrowTransaction(Base):
    """
    Séquestre lié à une réservation.
    Les fonds sont débités du wallet client à la réservation
    et libérés vers le wallet du gérant au check-in physique.
    """
    __tablename__ = "escrow_transactions"

    id             = Column(Integer, primary_key=True, index=True)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    client_id      = Column(Integer, ForeignKey("client_accounts.id"), nullable=False)
    hotel_id       = Column(Integer, ForeignKey("hotels.id"), nullable=False)

    amount         = Column(Float, nullable=False)       # montant total séquestré
    commission     = Column(Float, default=0.0)          # part SOKORA
    hotel_amount   = Column(Float, nullable=False)       # montant à libérer à l'hôtel

    status         = Column(SAEnum(EscrowStatus), default=EscrowStatus.HELD)

    # Horodatages clés
    held_at        = Column(DateTime(timezone=True), server_default=func.now())
    released_at    = Column(DateTime(timezone=True), nullable=True)   # check-in validé
    refunded_at    = Column(DateTime(timezone=True), nullable=True)   # annulation
    penalized_at   = Column(DateTime(timezone=True), nullable=True)   # no-show

    # Géofencing check (coordonnées GPS au moment du scan)
    checkin_lat    = Column(Float, nullable=True)
    checkin_lng    = Column(Float, nullable=True)
    checkin_distance_m = Column(Float, nullable=True)  # distance en mètres à l'hôtel

    notes          = Column(Text, nullable=True)

    reservation = relationship("Reservation", back_populates="escrow")


# ─────────────────────────────────────────────────────────────
#  AVIS CLIENT
# ─────────────────────────────────────────────────────────────

class HotelReview(Base):
    """
    Avis laissé par un client après son séjour (uniquement si COMPLETED).
    """
    __tablename__ = "hotel_reviews"

    id             = Column(Integer, primary_key=True, index=True)
    hotel_id       = Column(Integer, ForeignKey("hotels.id"), nullable=False)
    reservation_id = Column(Integer, ForeignKey("reservations.id"), unique=True, nullable=False)
    client_id      = Column(Integer, ForeignKey("client_accounts.id"), nullable=False)

    rating         = Column(Integer, nullable=False)    # 1 à 5
    comment        = Column(Text, nullable=True)
    is_visible     = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())


# ─────────────────────────────────────────────────────────────
#  DISPONIBILITÉ MANUELLE (Calendrier gérant)
# ─────────────────────────────────────────────────────────────

class RoomBlock(Base):
    """
    Blocage manuel d'une chambre par le gérant
    (réservation hors-plateforme, maintenance, etc.)
    """
    __tablename__ = "room_blocks"

    id         = Column(Integer, primary_key=True, index=True)
    room_id    = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    date_from  = Column(Date, nullable=False)
    date_to    = Column(Date, nullable=False)
    reason     = Column(String, nullable=True)    # "Réservation directe", "Travaux"
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    room = relationship("Room")
