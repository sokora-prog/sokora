"""
SOKORA Voyage — Modèles SQLAlchemy
Transport interurbain : Compagnies, Véhicules, Chauffeurs, Trajets, Réservations, GPS
"""
import enum
from sqlalchemy import (
    Column, Integer, String, Float, ForeignKey,
    Boolean, DateTime, Text, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# ─────────────────────────────────────────
#  ENUMS VOYAGE
# ─────────────────────────────────────────

class BookingStatus(str, enum.Enum):
    PENDING   = "PENDING"
    CONFIRMED = "CONFIRMED"
    BOARDED   = "BOARDED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class SeatStatus(str, enum.Enum):
    FREE    = "FREE"
    BOOKED  = "BOOKED"
    BOARDED = "BOARDED"


class VehicleType(str, enum.Enum):
    MINIBUS = "MINIBUS"
    BUS     = "BUS"
    VAN     = "VAN"
    SHARED  = "SHARED"   # taxi brousse


class TripStatus(str, enum.Enum):
    SCHEDULED   = "SCHEDULED"
    BOARDING    = "BOARDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED   = "COMPLETED"
    CANCELLED   = "CANCELLED"


# ─────────────────────────────────────────
#  COMPAGNIES DE TRANSPORT
# ─────────────────────────────────────────

class VoyageCompany(Base):
    __tablename__ = "voyage_companies"

    id         = Column(Integer, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    phone      = Column(String, nullable=True)
    address    = Column(String, nullable=True)
    logo_url   = Column(String, nullable=True)
    latitude   = Column(Float, nullable=True)
    longitude  = Column(Float, nullable=True)
    is_active  = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    vehicles = relationship("VoyageVehicle", back_populates="company")
    routes   = relationship("VoyageRoute",   back_populates="company")
    drivers  = relationship("VoyageDriver",  back_populates="company")


# ─────────────────────────────────────────
#  VÉHICULES
# ─────────────────────────────────────────

class VoyageVehicle(Base):
    __tablename__ = "voyage_vehicles"

    id           = Column(Integer, primary_key=True, index=True)
    company_id   = Column(Integer, ForeignKey("voyage_companies.id"), nullable=False)
    name         = Column(String, nullable=False)       # ex: "Bus 07"
    plate        = Column(String, nullable=True)        # immatriculation
    vehicle_type = Column(SAEnum(VehicleType), default=VehicleType.BUS)
    seat_count   = Column(Integer, nullable=False)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("VoyageCompany", back_populates="vehicles")
    trips   = relationship("VoyageTrip",   back_populates="vehicle")


# ─────────────────────────────────────────
#  CHAUFFEURS
# ─────────────────────────────────────────

class VoyageDriver(Base):
    __tablename__ = "voyage_drivers"

    id            = Column(Integer, primary_key=True, index=True)
    company_id    = Column(Integer, ForeignKey("voyage_companies.id"), nullable=False)
    full_name     = Column(String, nullable=False)
    phone         = Column(String, nullable=True, unique=True)
    license_no    = Column(String, nullable=True)
    is_active     = Column(Boolean, default=True)
    password_hash = Column(String, nullable=True)
    driver_token  = Column(String, nullable=True, index=True)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("VoyageCompany", back_populates="drivers")
    trips   = relationship("VoyageTrip",   back_populates="driver")


# ─────────────────────────────────────────
#  LIGNES / ROUTES
# ─────────────────────────────────────────

class VoyageRoute(Base):
    __tablename__ = "voyage_routes"

    id           = Column(Integer, primary_key=True, index=True)
    company_id   = Column(Integer, ForeignKey("voyage_companies.id"), nullable=False)
    origin       = Column(String, nullable=False)       # ex: "Abidjan"
    destination  = Column(String, nullable=False)       # ex: "Aboisso"
    distance_km  = Column(Float,  nullable=True)
    duration_min = Column(Integer, nullable=True)       # durée estimée en minutes
    base_price   = Column(Float,  nullable=False)
    is_active    = Column(Boolean, default=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    company = relationship("VoyageCompany", back_populates="routes")
    trips   = relationship("VoyageTrip",   back_populates="route")


# ─────────────────────────────────────────
#  VOYAGES PROGRAMMÉS
# ─────────────────────────────────────────

class VoyageTrip(Base):
    __tablename__ = "voyage_trips"

    id           = Column(Integer, primary_key=True, index=True)
    route_id     = Column(Integer, ForeignKey("voyage_routes.id"),   nullable=False)
    vehicle_id   = Column(Integer, ForeignKey("voyage_vehicles.id"), nullable=False)
    driver_id    = Column(Integer, ForeignKey("voyage_drivers.id"),  nullable=True)
    departure_at = Column(DateTime(timezone=True), nullable=False)
    price        = Column(Float, nullable=False)
    status       = Column(SAEnum(TripStatus), default=TripStatus.SCHEDULED)
    seats_total  = Column(Integer, nullable=False)
    seats_booked = Column(Integer, default=0)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    route    = relationship("VoyageRoute",   back_populates="trips")
    vehicle  = relationship("VoyageVehicle", back_populates="trips")
    driver   = relationship("VoyageDriver",  back_populates="trips")
    seats    = relationship("VoyageTripSeat", back_populates="trip",
                            cascade="all, delete-orphan",
                            foreign_keys="VoyageTripSeat.trip_id")
    bookings = relationship("VoyageBooking", back_populates="trip")
    locations = relationship("VoyageVehicleLocation", back_populates="trip")


# ─────────────────────────────────────────
#  SIÈGES PAR VOYAGE
# ─────────────────────────────────────────

class VoyageTripSeat(Base):
    __tablename__ = "voyage_trip_seats"
    __table_args__ = (
        UniqueConstraint("trip_id", "seat_number", name="uq_voyage_trip_seat"),
    )

    id          = Column(Integer, primary_key=True, index=True)
    trip_id     = Column(Integer, ForeignKey("voyage_trips.id"), nullable=False)
    seat_number = Column(Integer, nullable=False)
    status      = Column(SAEnum(SeatStatus), default=SeatStatus.FREE)
    booking_id  = Column(Integer, ForeignKey("voyage_bookings.id"), nullable=True)

    trip    = relationship("VoyageTrip",    back_populates="seats",
                           foreign_keys=[trip_id])
    booking = relationship("VoyageBooking", foreign_keys=[booking_id])


# ─────────────────────────────────────────
#  RÉSERVATIONS PASSAGER
# ─────────────────────────────────────────

class VoyageBooking(Base):
    __tablename__ = "voyage_bookings"

    id           = Column(Integer, primary_key=True, index=True)
    trip_id      = Column(Integer, ForeignKey("voyage_trips.id"),         nullable=False)
    client_id    = Column(Integer, ForeignKey("client_accounts.id"),      nullable=False)
    seat_number  = Column(Integer, nullable=False)
    amount_paid  = Column(Float,   nullable=False)
    status       = Column(SAEnum(BookingStatus), default=BookingStatus.PENDING)
    qr_token     = Column(String, nullable=True, index=True)    # token embarquement (HMAC signé)
    wallet_tx_id = Column(Integer, ForeignKey("wallet_transactions.id"), nullable=True)
    passenger_name  = Column(String, nullable=True)
    passenger_phone = Column(String, nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())

    trip   = relationship("VoyageTrip",    back_populates="bookings")
    client = relationship("ClientAccount", foreign_keys=[client_id])


# ─────────────────────────────────────────
#  POSITIONS GPS VÉHICULES
# ─────────────────────────────────────────

class VoyageVehicleLocation(Base):
    __tablename__ = "voyage_vehicle_locations"

    id          = Column(Integer, primary_key=True, index=True)
    trip_id     = Column(Integer, ForeignKey("voyage_trips.id"), nullable=False)
    latitude    = Column(Float, nullable=False)
    longitude   = Column(Float, nullable=False)
    speed_kmh   = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    trip = relationship("VoyageTrip", back_populates="locations")
