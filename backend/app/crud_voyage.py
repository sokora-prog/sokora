"""
SOKORA Voyage — CRUD Functions
Transport interurbain : Compagnies, Véhicules, Trajets, Réservations, GPS, QR Embarquement
"""
import hashlib
import hmac
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, List

from sqlalchemy import select, and_, func
from sqlalchemy.orm import Session, joinedload

from . import models
from .models_voyage import (
    VoyageCompany, VoyageVehicle, VoyageDriver,
    VoyageRoute, VoyageTrip, VoyageTripSeat,
    VoyageBooking, VoyageVehicleLocation,
    BookingStatus, SeatStatus, TripStatus
)

# Secret pour signer les QR tokens d'embarquement
VOYAGE_QR_SECRET = "sokora_voyage_qr_secret_2025"


# ─────────────────────────────────────────
#  COMPAGNIES
# ─────────────────────────────────────────

def get_companies(db: Session) -> List[VoyageCompany]:
    return list(db.scalars(select(VoyageCompany).where(VoyageCompany.is_active == True)))


def get_company(db: Session, company_id: int) -> Optional[VoyageCompany]:
    return db.get(VoyageCompany, company_id)


def create_company(db: Session, data: dict) -> VoyageCompany:
    company = VoyageCompany(**data)
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def update_company(db: Session, company_id: int, data: dict) -> Optional[VoyageCompany]:
    company = db.get(VoyageCompany, company_id)
    if not company:
        return None
    for k, v in data.items():
        setattr(company, k, v)
    db.commit()
    db.refresh(company)
    return company


# ─────────────────────────────────────────
#  VÉHICULES
# ─────────────────────────────────────────

def get_vehicles(db: Session, company_id: int) -> List[VoyageVehicle]:
    return list(db.scalars(
        select(VoyageVehicle).where(
            VoyageVehicle.company_id == company_id,
            VoyageVehicle.is_active == True
        )
    ))


def create_vehicle(db: Session, company_id: int, data: dict) -> VoyageVehicle:
    vehicle = VoyageVehicle(company_id=company_id, **data)
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


# ─────────────────────────────────────────
#  CHAUFFEURS
# ─────────────────────────────────────────

def get_drivers(db: Session, company_id: int) -> List[VoyageDriver]:
    return list(db.scalars(
        select(VoyageDriver).where(
            VoyageDriver.company_id == company_id,
            VoyageDriver.is_active == True
        )
    ))


def create_driver(db: Session, company_id: int, data: dict) -> VoyageDriver:
    from passlib.hash import bcrypt
    driver_data = dict(data)
    if "password" in driver_data:
        driver_data["password_hash"] = bcrypt.hash(driver_data.pop("password"))
    driver = VoyageDriver(company_id=company_id, **driver_data)
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


def login_driver(db: Session, phone: str, password: str) -> Optional[VoyageDriver]:
    from passlib.hash import bcrypt
    driver = db.scalar(select(VoyageDriver).where(VoyageDriver.phone == phone))
    if not driver or not driver.password_hash:
        return None
    if not bcrypt.verify(password, driver.password_hash):
        return None
    # Générer un token session
    token = hashlib.sha256(f"{driver.id}{time.time()}".encode()).hexdigest()
    driver.driver_token = token
    db.commit()
    return driver


def get_driver_from_token(db: Session, token: str) -> Optional[VoyageDriver]:
    return db.scalar(select(VoyageDriver).where(VoyageDriver.driver_token == token))


# ─────────────────────────────────────────
#  LIGNES / ROUTES
# ─────────────────────────────────────────

def get_routes(db: Session, company_id: Optional[int] = None) -> List[VoyageRoute]:
    q = select(VoyageRoute).where(VoyageRoute.is_active == True)
    if company_id:
        q = q.where(VoyageRoute.company_id == company_id)
    return list(db.scalars(q))


def create_route(db: Session, company_id: int, data: dict) -> VoyageRoute:
    route = VoyageRoute(company_id=company_id, **data)
    db.add(route)
    db.commit()
    db.refresh(route)
    return route


# ─────────────────────────────────────────
#  VOYAGES PROGRAMMÉS
# ─────────────────────────────────────────

def search_trips(
    db: Session,
    origin: str,
    destination: str,
    date: Optional[str] = None
) -> List[dict]:
    """Recherche de voyages disponibles."""
    q = (
        select(VoyageTrip)
        .join(VoyageRoute)
        .options(
            joinedload(VoyageTrip.route),
            joinedload(VoyageTrip.vehicle),
            joinedload(VoyageTrip.driver),
        )
        .where(
            VoyageRoute.origin.ilike(f"%{origin}%"),
            VoyageRoute.destination.ilike(f"%{destination}%"),
            VoyageTrip.status.in_([TripStatus.SCHEDULED, TripStatus.BOARDING]),
            VoyageTrip.seats_booked < VoyageTrip.seats_total,
        )
    )
    if date:
        try:
            d = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            q = q.where(
                VoyageTrip.departure_at >= d,
                VoyageTrip.departure_at < d + timedelta(days=1)
            )
        except ValueError:
            pass
    trips = list(db.scalars(q))
    return [_format_trip(t) for t in trips]


def _format_trip(trip: VoyageTrip) -> dict:
    return {
        "id":           trip.id,
        "origin":       trip.route.origin,
        "destination":  trip.route.destination,
        "departure_at": trip.departure_at.isoformat(),
        "price":        trip.price,
        "seats_total":  trip.seats_total,
        "seats_booked": trip.seats_booked,
        "seats_left":   trip.seats_total - trip.seats_booked,
        "status":       trip.status.value,
        "company":      trip.route.company_id,
        "vehicle_type": trip.vehicle.vehicle_type.value if trip.vehicle else None,
        "driver_name":  trip.driver.full_name if trip.driver else None,
        "duration_min": trip.route.duration_min,
        "distance_km":  trip.route.distance_km,
    }


def get_trip(db: Session, trip_id: int) -> Optional[VoyageTrip]:
    return db.scalar(
        select(VoyageTrip)
        .options(
            joinedload(VoyageTrip.route).joinedload(VoyageRoute.company),
            joinedload(VoyageTrip.vehicle),
            joinedload(VoyageTrip.driver),
            joinedload(VoyageTrip.seats),
        )
        .where(VoyageTrip.id == trip_id)
    )


def create_trip(db: Session, data: dict) -> VoyageTrip:
    """Crée un voyage et génère automatiquement les sièges."""
    vehicle = db.get(VoyageVehicle, data["vehicle_id"])
    if not vehicle:
        raise ValueError("Véhicule introuvable")

    trip = VoyageTrip(
        route_id=data["route_id"],
        vehicle_id=data["vehicle_id"],
        driver_id=data.get("driver_id"),
        departure_at=datetime.fromisoformat(data["departure_at"]),
        price=data["price"],
        seats_total=vehicle.seat_count,
    )
    db.add(trip)
    db.flush()

    # Générer les sièges
    for i in range(1, vehicle.seat_count + 1):
        seat = VoyageTripSeat(trip_id=trip.id, seat_number=i)
        db.add(seat)

    db.commit()
    db.refresh(trip)
    return trip


def get_trip_seats(db: Session, trip_id: int) -> List[dict]:
    seats = list(db.scalars(
        select(VoyageTripSeat).where(VoyageTripSeat.trip_id == trip_id)
        .order_by(VoyageTripSeat.seat_number)
    ))
    return [
        {
            "seat_number": s.seat_number,
            "status":      s.status.value,
            "booking_id":  s.booking_id,
        }
        for s in seats
    ]


# ─────────────────────────────────────────
#  RÉSERVATIONS
# ─────────────────────────────────────────

def create_booking(db: Session, client_id: int, data: dict) -> VoyageBooking:
    """
    Réserve un siège et débite le wallet du client.
    data: { trip_id, seat_number, passenger_name?, passenger_phone? }
    """
    trip = db.get(VoyageTrip, data["trip_id"])
    if not trip:
        raise ValueError("Voyage introuvable")
    if trip.status not in [TripStatus.SCHEDULED, TripStatus.BOARDING]:
        raise ValueError("Ce voyage n'accepte plus de réservations")

    # Vérifier le siège
    seat = db.scalar(
        select(VoyageTripSeat).where(
            VoyageTripSeat.trip_id == trip.id,
            VoyageTripSeat.seat_number == data["seat_number"]
        )
    )
    if not seat or seat.status != SeatStatus.FREE:
        raise ValueError("Ce siège n'est plus disponible")

    # Vérifier et débiter le wallet
    wallet = db.scalar(
        select(models.WalletAccount).where(
            models.WalletAccount.client_id == client_id
        )
    )
    if not wallet:
        raise ValueError("Wallet introuvable")
    if wallet.balance < trip.price:
        raise ValueError(f"Solde insuffisant ({wallet.balance:.0f} FCFA / {trip.price:.0f} FCFA requis)")

    balance_before = wallet.balance
    wallet.balance -= trip.price
    wallet.updated_at = func.now()

    # Enregistrer la transaction wallet
    tx = models.WalletTransaction(
        wallet_id=wallet.id,
        tx_type="payment",
        amount=trip.price,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=f"Réservation voyage {trip.route.origin} → {trip.route.destination}",
        service_type="voyage",
    )
    db.add(tx)
    db.flush()

    # Créer la réservation
    booking = VoyageBooking(
        trip_id=trip.id,
        client_id=client_id,
        seat_number=data["seat_number"],
        amount_paid=trip.price,
        status=BookingStatus.CONFIRMED,
        wallet_tx_id=tx.id,
        passenger_name=data.get("passenger_name"),
        passenger_phone=data.get("passenger_phone"),
    )
    db.add(booking)
    db.flush()

    # Générer QR token d'embarquement
    booking.qr_token = _generate_boarding_qr(booking.id, trip.id)

    # Mettre à jour le siège
    seat.status = SeatStatus.BOOKED
    seat.booking_id = booking.id

    # Mettre à jour le compteur de sièges
    trip.seats_booked += 1

    db.commit()
    db.refresh(booking)
    return booking


def _generate_boarding_qr(booking_id: int, trip_id: int) -> str:
    """Génère un token QR unique pour l'embarquement (non expirant, scanné 1 seule fois)."""
    payload = f"booking:{booking_id}:trip:{trip_id}:ts:{int(time.time())}"
    sig = hmac.new(VOYAGE_QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    return f"{payload}:{sig}"


def get_booking(db: Session, booking_id: int) -> Optional[VoyageBooking]:
    return db.scalar(
        select(VoyageBooking)
        .options(
            joinedload(VoyageBooking.trip).joinedload(VoyageTrip.route),
            joinedload(VoyageBooking.trip).joinedload(VoyageTrip.vehicle),
            joinedload(VoyageBooking.client),
        )
        .where(VoyageBooking.id == booking_id)
    )


def get_client_bookings(db: Session, client_id: int) -> List[dict]:
    bookings = list(db.scalars(
        select(VoyageBooking)
        .options(
            joinedload(VoyageBooking.trip).joinedload(VoyageTrip.route),
            joinedload(VoyageBooking.trip).joinedload(VoyageTrip.vehicle),
        )
        .where(VoyageBooking.client_id == client_id)
        .order_by(VoyageBooking.created_at.desc())
    ))
    return [_format_booking(b) for b in bookings]


def _format_booking(b: VoyageBooking) -> dict:
    return {
        "id":             b.id,
        "trip_id":        b.trip_id,
        "origin":         b.trip.route.origin if b.trip and b.trip.route else "",
        "destination":    b.trip.route.destination if b.trip and b.trip.route else "",
        "departure_at":   b.trip.departure_at.isoformat() if b.trip else "",
        "seat_number":    b.seat_number,
        "amount_paid":    b.amount_paid,
        "status":         b.status.value,
        "qr_token":       b.qr_token if b.status == BookingStatus.CONFIRMED else None,
        "passenger_name": b.passenger_name,
        "created_at":     b.created_at.isoformat(),
    }


# ─────────────────────────────────────────
#  SCAN QR — EMBARQUEMENT (CHAUFFEUR)
# ─────────────────────────────────────────

def scan_boarding_qr(db: Session, driver_id: int, qr_token: str) -> dict:
    """
    Valide un QR code d'embarquement scanné par le chauffeur.
    Retourne les infos du passager et marque comme embarqué.
    """
    booking = db.scalar(
        select(VoyageBooking)
        .options(
            joinedload(VoyageBooking.trip).joinedload(VoyageTrip.route),
            joinedload(VoyageBooking.client),
        )
        .where(VoyageBooking.qr_token == qr_token)
    )
    if not booking:
        raise ValueError("QR code invalide")
    if booking.status == BookingStatus.BOARDED:
        raise ValueError("Passager déjà embarqué")
    if booking.status == BookingStatus.CANCELLED:
        raise ValueError("Réservation annulée")

    # Vérifier que le chauffeur est bien assigné à ce voyage
    driver = db.get(VoyageDriver, driver_id)
    if booking.trip.driver_id and booking.trip.driver_id != driver_id:
        raise ValueError("Ce voyage ne vous est pas assigné")

    # Marquer comme embarqué
    booking.status = BookingStatus.BOARDED

    # Mettre à jour le siège
    seat = db.scalar(
        select(VoyageTripSeat).where(
            VoyageTripSeat.trip_id == booking.trip_id,
            VoyageTripSeat.seat_number == booking.seat_number
        )
    )
    if seat:
        seat.status = SeatStatus.BOARDED

    db.commit()

    return {
        "ok": True,
        "booking_id":     booking.id,
        "passenger_name": booking.passenger_name or (booking.client.name if booking.client else "Passager"),
        "seat_number":    booking.seat_number,
        "origin":         booking.trip.route.origin,
        "destination":    booking.trip.route.destination,
        "departure_at":   booking.trip.departure_at.isoformat(),
    }


# ─────────────────────────────────────────
#  GPS TRACKING
# ─────────────────────────────────────────

def update_vehicle_location(db: Session, trip_id: int, lat: float, lng: float, speed: Optional[float] = None) -> dict:
    loc = VoyageVehicleLocation(
        trip_id=trip_id,
        latitude=lat,
        longitude=lng,
        speed_kmh=speed,
    )
    db.add(loc)
    db.commit()
    return {"ok": True, "recorded_at": loc.recorded_at.isoformat() if loc.recorded_at else None}


def get_vehicle_last_location(db: Session, trip_id: int) -> Optional[dict]:
    loc = db.scalar(
        select(VoyageVehicleLocation)
        .where(VoyageVehicleLocation.trip_id == trip_id)
        .order_by(VoyageVehicleLocation.recorded_at.desc())
        .limit(1)
    )
    if not loc:
        return None
    return {
        "trip_id":     trip_id,
        "latitude":    loc.latitude,
        "longitude":   loc.longitude,
        "speed_kmh":   loc.speed_kmh,
        "recorded_at": loc.recorded_at.isoformat(),
    }


# ─────────────────────────────────────────
#  DASHBOARD COMPAGNIE — STATS
# ─────────────────────────────────────────

def get_company_dashboard(db: Session, company_id: int) -> dict:
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    nb_vehicles = db.scalar(
        select(func.count(VoyageVehicle.id)).where(
            VoyageVehicle.company_id == company_id,
            VoyageVehicle.is_active == True
        )
    ) or 0

    nb_drivers = db.scalar(
        select(func.count(VoyageDriver.id)).where(
            VoyageDriver.company_id == company_id,
            VoyageDriver.is_active == True
        )
    ) or 0

    nb_trips_today = db.scalar(
        select(func.count(VoyageTrip.id))
        .join(VoyageRoute)
        .where(
            VoyageRoute.company_id == company_id,
            VoyageTrip.departure_at >= today,
            VoyageTrip.departure_at < today + timedelta(days=1),
        )
    ) or 0

    ca_today = db.scalar(
        select(func.coalesce(func.sum(VoyageBooking.amount_paid), 0))
        .join(VoyageTrip)
        .join(VoyageRoute)
        .where(
            VoyageRoute.company_id == company_id,
            VoyageBooking.created_at >= today,
            VoyageBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.BOARDED, BookingStatus.COMPLETED])
        )
    ) or 0

    nb_bookings_today = db.scalar(
        select(func.count(VoyageBooking.id))
        .join(VoyageTrip)
        .join(VoyageRoute)
        .where(
            VoyageRoute.company_id == company_id,
            VoyageBooking.created_at >= today,
            VoyageBooking.status != BookingStatus.CANCELLED,
        )
    ) or 0

    return {
        "nb_vehicles":      nb_vehicles,
        "nb_drivers":       nb_drivers,
        "nb_trips_today":   nb_trips_today,
        "nb_bookings_today": nb_bookings_today,
        "ca_today":         ca_today,
    }
