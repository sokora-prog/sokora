"""
SOKORA Hotel — Couche CRUD
Logique métier : Hotels, Rooms, Reservations, Escrow
"""
import uuid
import math
from datetime import datetime, date, timedelta, timezone
from typing import Optional, List

from sqlalchemy.orm import Session
from sqlalchemy import select, and_, or_, func
from fastapi import HTTPException

from . import models_hotel as H
from . import models  # ClientAccount, WalletAccount, WalletTransaction, Establishment


# ─────────────────────────────────────────────────────────────
#  UTILS
# ─────────────────────────────────────────────────────────────

def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Distance en km entre deux points GPS."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _get_room_price(db: Session, room_type: H.RoomType, checkin: date, checkout: date) -> float:
    """
    Retourne le prix par nuit applicable selon les tarifs saisonniers.
    Prend le tarif saisonnier le plus récent qui couvre la période.
    """
    rates = db.execute(
        select(H.SeasonRate).where(
            and_(
                H.SeasonRate.hotel_id == room_type.hotel_id,
                H.SeasonRate.is_active == True,
                H.SeasonRate.date_from <= checkin,
                H.SeasonRate.date_to >= checkout,
                or_(
                    H.SeasonRate.room_type_id == room_type.id,
                    H.SeasonRate.room_type_id == None
                )
            )
        ).order_by(H.SeasonRate.room_type_id.desc())
    ).scalars().first()

    return rates.price if rates else room_type.base_price


def _generate_qr_token() -> str:
    return str(uuid.uuid4()).replace("-", "").upper()


# ─────────────────────────────────────────────────────────────
#  HOTEL — CRUD
# ─────────────────────────────────────────────────────────────

def create_hotel(db: Session, establishment_id: int, data: dict) -> H.Hotel:
    """Crée un hôtel lié à un établissement SOKORA existant."""
    existing = db.query(H.Hotel).filter(H.Hotel.establishment_id == establishment_id).first()
    if existing:
        raise HTTPException(400, "Un hôtel existe déjà pour cet établissement")

    hotel = H.Hotel(
        establishment_id=establishment_id,
        name=data.get("name"),
        description=data.get("description"),
        address=data.get("address"),
        city=data.get("city"),
        country=data.get("country", "CI"),
        latitude=data.get("latitude"),
        longitude=data.get("longitude"),
        cover_image_url=data.get("cover_image_url"),
        logo_url=data.get("logo_url"),
        images=data.get("images", []),
        video_url=data.get("video_url"),
        template=data.get("template", H.HotelTemplate.BUSINESS),
        checkin_time=data.get("checkin_time", "14:00"),
        checkout_time=data.get("checkout_time", "12:00"),
        cancellation_hours=data.get("cancellation_hours", 24),
        no_show_penalty_pct=data.get("no_show_penalty_pct", 50.0),
        cleaning_fee=data.get("cleaning_fee", 0.0),
        deposit_pct=data.get("deposit_pct", 100.0),
        sokora_commission_pct=data.get("sokora_commission_pct", 5.0),
        amenities=data.get("amenities", []),
    )
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return hotel


def get_hotel_by_establishment(db: Session, establishment_id: int) -> Optional[H.Hotel]:
    return db.query(H.Hotel).filter(H.Hotel.establishment_id == establishment_id).first()


def update_hotel(db: Session, hotel_id: int, establishment_id: int, data: dict) -> H.Hotel:
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    fields = [
        "name", "description", "address", "city", "country",
        "latitude", "longitude", "cover_image_url", "logo_url",
        "images", "video_url", "template", "checkin_time",
        "checkout_time", "cancellation_hours", "no_show_penalty_pct",
        "cleaning_fee", "deposit_pct", "amenities"
    ]
    for f in fields:
        if f in data:
            setattr(hotel, f, data[f])

    db.commit()
    db.refresh(hotel)
    return hotel


def get_hotels_nearby(db: Session, lat: float, lng: float, radius_km: float = 2.0,
                       checkin: Optional[date] = None, checkout: Optional[date] = None) -> list:
    """
    Retourne les hôtels actifs dans un rayon donné avec disponibilités et prix.
    """
    hotels = db.query(H.Hotel).filter(
        H.Hotel.is_active == True,
        H.Hotel.latitude != None,
        H.Hotel.longitude != None
    ).all()

    result = []
    for hotel in hotels:
        dist = _haversine_km(lat, lng, hotel.latitude, hotel.longitude)
        if dist > radius_km:
            continue

        # Chambres disponibles
        available_rooms = _get_available_rooms(db, hotel.id, checkin, checkout)

        # Prix min
        min_price = None
        if available_rooms:
            prices = [rt["price_per_night"] for rt in available_rooms]
            min_price = min(prices) if prices else None

        # Note moyenne
        avg_rating = db.execute(
            select(func.avg(H.HotelReview.rating)).where(
                H.HotelReview.hotel_id == hotel.id,
                H.HotelReview.is_visible == True
            )
        ).scalar()

        result.append({
            "id": hotel.id,
            "name": hotel.name,
            "description": hotel.description,
            "address": hotel.address,
            "city": hotel.city,
            "latitude": hotel.latitude,
            "longitude": hotel.longitude,
            "distance_km": round(dist, 2),
            "cover_image_url": hotel.cover_image_url,
            "images": hotel.images,
            "template": hotel.template,
            "amenities": hotel.amenities,
            "checkin_time": hotel.checkin_time,
            "checkout_time": hotel.checkout_time,
            "min_price_per_night": min_price,
            "available_rooms_count": len(available_rooms),
            "avg_rating": round(float(avg_rating), 1) if avg_rating else None,
            "cleaning_fee": hotel.cleaning_fee,
            "cancellation_hours": hotel.cancellation_hours,
        })

    result.sort(key=lambda x: x["distance_km"])
    return result


# ─────────────────────────────────────────────────────────────
#  ROOM TYPES
# ─────────────────────────────────────────────────────────────

def create_room_type(db: Session, hotel_id: int, establishment_id: int, data: dict) -> H.RoomType:
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    rt = H.RoomType(
        hotel_id=hotel_id,
        name=data.get("name"),
        description=data.get("description"),
        bed_type=data.get("bed_type", H.RoomBedType.DOUBLE),
        capacity=data.get("capacity", 2),
        base_price=data.get("base_price"),
        images=data.get("images", []),
        amenities=data.get("amenities", []),
    )
    db.add(rt)
    db.commit()
    db.refresh(rt)
    return rt


def get_room_types(db: Session, hotel_id: int) -> List[H.RoomType]:
    return db.query(H.RoomType).filter(
        H.RoomType.hotel_id == hotel_id,
        H.RoomType.is_active == True
    ).all()


# ─────────────────────────────────────────────────────────────
#  ROOMS
# ─────────────────────────────────────────────────────────────

def create_room(db: Session, hotel_id: int, establishment_id: int, data: dict) -> H.Room:
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    room = H.Room(
        hotel_id=hotel_id,
        room_type_id=data.get("room_type_id"),
        number=data.get("number"),
        floor=data.get("floor", 1),
        notes=data.get("notes"),
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return room


def get_rooms(db: Session, hotel_id: int) -> list:
    rooms = db.query(H.Room).filter(
        H.Room.hotel_id == hotel_id,
        H.Room.is_active == True
    ).all()
    result = []
    for r in rooms:
        rt = db.get(H.RoomType, r.room_type_id)
        result.append({
            "id": r.id,
            "number": r.number,
            "floor": r.floor,
            "status": r.status,
            "notes": r.notes,
            "room_type": {
                "id": rt.id,
                "name": rt.name,
                "bed_type": rt.bed_type,
                "capacity": rt.capacity,
                "base_price": rt.base_price,
                "amenities": rt.amenities,
                "images": rt.images,
            } if rt else None,
        })
    return result


def update_room_status(db: Session, room_id: int, hotel_id: int, status: str) -> H.Room:
    room = db.query(H.Room).filter(
        H.Room.id == room_id,
        H.Room.hotel_id == hotel_id
    ).first()
    if not room:
        raise HTTPException(404, "Chambre introuvable")
    room.status = status
    db.commit()
    return room


def _get_available_rooms(db: Session, hotel_id: int,
                          checkin: Optional[date] = None,
                          checkout: Optional[date] = None) -> list:
    """
    Retourne les chambres disponibles pour une période donnée.
    Vérifie : statut AVAILABLE + pas de réservation/blocage conflictuel.
    """
    rooms = db.query(H.Room).filter(
        H.Room.hotel_id == hotel_id,
        H.Room.is_active == True,
        H.Room.status == H.RoomStatus.AVAILABLE
    ).all()

    result = []
    for room in rooms:
        if checkin and checkout:
            # Vérifier conflit réservation
            conflict_resa = db.query(H.Reservation).filter(
                H.Reservation.room_id == room.id,
                H.Reservation.status.in_([
                    H.ReservationStatus.CONFIRMED,
                    H.ReservationStatus.CHECKED_IN
                ]),
                H.Reservation.checkin_date < checkout,
                H.Reservation.checkout_date > checkin,
            ).first()

            if conflict_resa:
                continue

            # Vérifier blocage manuel
            conflict_block = db.query(H.RoomBlock).filter(
                H.RoomBlock.room_id == room.id,
                H.RoomBlock.date_from < checkout,
                H.RoomBlock.date_to > checkin,
            ).first()

            if conflict_block:
                continue

        rt = db.get(H.RoomType, room.room_type_id)
        nights = (checkout - checkin).days if checkin and checkout else 1
        price = _get_room_price(db, rt, checkin, checkout) if rt and checkin and checkout else (rt.base_price if rt else 0)

        result.append({
            "room_id": room.id,
            "room_number": room.number,
            "floor": room.floor,
            "room_type_id": rt.id if rt else None,
            "room_type_name": rt.name if rt else None,
            "bed_type": rt.bed_type if rt else None,
            "capacity": rt.capacity if rt else None,
            "price_per_night": price,
            "total_price": price * nights,
            "nights": nights,
            "amenities": rt.amenities if rt else [],
            "images": rt.images if rt else [],
        })

    return result


def get_hotel_availability(db: Session, hotel_id: int,
                            checkin: date, checkout: date) -> dict:
    """Vue disponibilité complète d'un hôtel pour une période."""
    hotel = db.query(H.Hotel).filter(H.Hotel.id == hotel_id).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    nights = (checkout - checkin).days
    if nights <= 0:
        raise HTTPException(400, "Dates invalides")

    available = _get_available_rooms(db, hotel_id, checkin, checkout)

    return {
        "hotel_id": hotel_id,
        "hotel_name": hotel.name,
        "checkin_date": str(checkin),
        "checkout_date": str(checkout),
        "nights": nights,
        "cleaning_fee": hotel.cleaning_fee,
        "available_rooms": available,
        "total_available": len(available),
    }


# ─────────────────────────────────────────────────────────────
#  RÉSERVATION + ESCROW
# ─────────────────────────────────────────────────────────────

def create_reservation(db: Session, client_id: int, data: dict) -> dict:
    """
    Crée une réservation et débite le wallet client vers l'escrow.
    """
    hotel = db.query(H.Hotel).filter(H.Hotel.id == data.get("hotel_id")).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    room = db.query(H.Room).filter(
        H.Room.id == data.get("room_id"),
        H.Room.hotel_id == hotel.id
    ).first()
    if not room:
        raise HTTPException(404, "Chambre introuvable")

    checkin  = date.fromisoformat(data.get("checkin_date"))
    checkout = date.fromisoformat(data.get("checkout_date"))
    nights   = (checkout - checkin).days

    if nights <= 0:
        raise HTTPException(400, "Dates invalides")

    # Vérifier disponibilité
    available = _get_available_rooms(db, hotel.id, checkin, checkout)
    available_ids = [r["room_id"] for r in available]
    if room.id not in available_ids:
        raise HTTPException(409, "Chambre non disponible pour ces dates")

    # Calcul tarif
    rt = db.get(H.RoomType, room.room_type_id)
    price_per_night = _get_room_price(db, rt, checkin, checkout)
    cleaning_fee    = hotel.cleaning_fee
    total_amount    = price_per_night * nights + cleaning_fee
    commission      = round(total_amount * hotel.sokora_commission_pct / 100, 0)
    hotel_amount    = total_amount - commission

    # Vérifier solde wallet client
    client = db.get(models.ClientAccount, client_id)
    if not client:
        raise HTTPException(404, "Client introuvable")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client_id
    ).first()
    if not wallet or wallet.balance < total_amount:
        raise HTTPException(400, f"Solde insuffisant. Requis: {total_amount} F, Disponible: {wallet.balance if wallet else 0} F")

    # Débiter le wallet client
    balance_before  = wallet.balance
    wallet.balance -= total_amount
    wallet.updated_at = datetime.now(timezone.utc)

    # Transaction wallet
    tx = models.WalletTransaction(
        wallet_id      = wallet.id,
        tx_type        = "escrow_hold",
        amount         = -total_amount,
        balance_before = balance_before,
        balance_after  = wallet.balance,
        description    = f"Réservation {hotel.name} — {checkin} au {checkout}",
    )
    db.add(tx)

    # Créer la réservation
    qr_token = _generate_qr_token()
    reservation = H.Reservation(
        hotel_id        = hotel.id,
        room_id         = room.id,
        client_id       = client_id,
        checkin_date    = checkin,
        checkout_date   = checkout,
        nights          = nights,
        price_per_night = price_per_night,
        cleaning_fee    = cleaning_fee,
        total_amount    = total_amount,
        sokora_commission = commission,
        hotel_amount    = hotel_amount,
        status          = H.ReservationStatus.CONFIRMED,
        qr_code         = qr_token,
        qr_expires_at   = datetime.now(timezone.utc) + timedelta(days=nights + 2),
        guest_count     = data.get("guest_count", 1),
        special_requests = data.get("special_requests"),
    )
    db.add(reservation)
    db.flush()  # pour avoir l'ID

    # Créer l'escrow
    escrow = H.EscrowTransaction(
        reservation_id = reservation.id,
        client_id      = client_id,
        hotel_id       = hotel.id,
        amount         = total_amount,
        commission     = commission,
        hotel_amount   = hotel_amount,
        status         = H.EscrowStatus.HELD,
    )
    db.add(escrow)

    # Marquer la chambre comme réservée
    room.status = H.RoomStatus.RESERVED

    db.commit()
    db.refresh(reservation)

    return {
        "reservation_id": reservation.id,
        "qr_code": qr_token,
        "hotel_name": hotel.name,
        "room_number": room.number,
        "checkin_date": str(checkin),
        "checkout_date": str(checkout),
        "nights": nights,
        "total_amount": total_amount,
        "hotel_amount": hotel_amount,
        "commission": commission,
        "status": reservation.status,
        "new_wallet_balance": wallet.balance,
    }


def process_checkin(db: Session, qr_code: str, staff_user_id: int,
                     lat: Optional[float] = None, lng: Optional[float] = None) -> dict:
    """
    Validation physique du QR code au check-in.
    Libère les fonds de l'escrow vers le wallet du gérant.
    """
    reservation = db.query(H.Reservation).filter(
        H.Reservation.qr_code == qr_code,
        H.Reservation.status == H.ReservationStatus.CONFIRMED
    ).first()
    if not reservation:
        raise HTTPException(404, "QR Code invalide ou déjà utilisé")

    # Vérifier expiration
    if reservation.qr_expires_at and datetime.now(timezone.utc) > reservation.qr_expires_at:
        raise HTTPException(400, "QR Code expiré")

    hotel = db.get(H.Hotel, reservation.hotel_id)

    # Géofencing — vérifier distance si GPS fourni
    distance_m = None
    if lat and lng and hotel.latitude and hotel.longitude:
        dist_km = _haversine_km(lat, lng, hotel.latitude, hotel.longitude)
        distance_m = dist_km * 1000
        if distance_m > 500:  # 500 mètres max
            raise HTTPException(400, f"Vous êtes trop loin de l'hôtel ({int(distance_m)}m). Maximum: 500m")

    # Récupérer l'escrow
    escrow = db.query(H.EscrowTransaction).filter(
        H.EscrowTransaction.reservation_id == reservation.id
    ).first()
    if not escrow:
        raise HTTPException(500, "Escrow introuvable")

    # Trouver le wallet du gérant (establishment owner)
    establishment = db.get(models.Establishment, hotel.establishment_id)
    manager = db.query(models.User).filter(
        models.User.establishment_id == hotel.establishment_id,
        models.User.role == models.UserRole.MANAGER
    ).first()

    # Libérer l'escrow → wallet gérant
    # Note: le gérant doit avoir un ClientAccount lié à son téléphone
    manager_client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == manager.phone_number
    ).first() if manager else None

    if manager_client:
        manager_wallet = db.query(models.WalletAccount).filter(
            models.WalletAccount.client_id == manager_client.id
        ).first()
        if not manager_wallet:
            manager_wallet = models.WalletAccount(client_id=manager_client.id, balance=0.0)
            db.add(manager_wallet)
            db.flush()

        bal_before = manager_wallet.balance
        manager_wallet.balance += escrow.hotel_amount
        manager_wallet.updated_at = datetime.now(timezone.utc)

        db.add(models.WalletTransaction(
            wallet_id      = manager_wallet.id,
            tx_type        = "escrow_release",
            amount         = escrow.hotel_amount,
            balance_before = bal_before,
            balance_after  = manager_wallet.balance,
            description    = f"Libération séquestre — Réservation #{reservation.id}",
            establishment_id = hotel.establishment_id,
        ))

    # Mettre à jour escrow
    escrow.status       = H.EscrowStatus.RELEASED
    escrow.released_at  = datetime.now(timezone.utc)
    escrow.checkin_lat  = lat
    escrow.checkin_lng  = lng
    escrow.checkin_distance_m = distance_m

    # Mettre à jour réservation
    reservation.status      = H.ReservationStatus.CHECKED_IN
    reservation.checkin_at  = datetime.now(timezone.utc)
    reservation.checked_in_by = staff_user_id

    # Chambre → OCCUPIED
    room = db.get(H.Room, reservation.room_id)
    if room:
        room.status = H.RoomStatus.OCCUPIED

    db.commit()

    return {
        "success": True,
        "reservation_id": reservation.id,
        "client_name": db.get(models.ClientAccount, reservation.client_id).name or "Client",
        "room_number": room.number if room else None,
        "hotel_amount_released": escrow.hotel_amount,
        "checkin_at": reservation.checkin_at.isoformat(),
        "distance_m": distance_m,
    }


def process_checkout(db: Session, reservation_id: int, establishment_id: int) -> dict:
    """Clôture un séjour — chambre repassée en CLEANING."""
    reservation = db.query(H.Reservation).filter(
        H.Reservation.id == reservation_id,
        H.Reservation.status == H.ReservationStatus.CHECKED_IN
    ).first()
    if not reservation:
        raise HTTPException(404, "Réservation introuvable ou non active")

    hotel = db.get(H.Hotel, reservation.hotel_id)
    if hotel.establishment_id != establishment_id:
        raise HTTPException(403, "Accès refusé")

    reservation.status     = H.ReservationStatus.COMPLETED
    reservation.checkout_at = datetime.now(timezone.utc)

    room = db.get(H.Room, reservation.room_id)
    if room:
        room.status = H.RoomStatus.CLEANING

    db.commit()
    return {"success": True, "reservation_id": reservation_id, "room_status": "CLEANING"}


def process_no_show(db: Session, reservation_id: int, establishment_id: int) -> dict:
    """
    No-show : applique la pénalité et rembourse le reste au client.
    """
    reservation = db.query(H.Reservation).filter(
        H.Reservation.id == reservation_id,
        H.Reservation.status == H.ReservationStatus.CONFIRMED
    ).first()
    if not reservation:
        raise HTTPException(404, "Réservation introuvable")

    hotel = db.get(H.Hotel, reservation.hotel_id)
    if hotel.establishment_id != establishment_id:
        raise HTTPException(403, "Accès refusé")

    escrow = db.query(H.EscrowTransaction).filter(
        H.EscrowTransaction.reservation_id == reservation_id
    ).first()

    penalty = round(reservation.total_amount * hotel.no_show_penalty_pct / 100, 0)
    refund  = reservation.total_amount - penalty

    # Rembourser le client
    client_wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == reservation.client_id
    ).first()
    if client_wallet and refund > 0:
        bal = client_wallet.balance
        client_wallet.balance += refund
        db.add(models.WalletTransaction(
            wallet_id      = client_wallet.id,
            tx_type        = "no_show_refund",
            amount         = refund,
            balance_before = bal,
            balance_after  = client_wallet.balance,
            description    = f"Remboursement partiel no-show — Réservation #{reservation_id}",
        ))

    # Mettre à jour escrow et réservation
    if escrow:
        escrow.status       = H.EscrowStatus.PENALIZED
        escrow.penalized_at = datetime.now(timezone.utc)

    reservation.status          = H.ReservationStatus.NO_SHOW
    reservation.no_show_penalty = penalty

    room = db.get(H.Room, reservation.room_id)
    if room:
        room.status = H.RoomStatus.AVAILABLE

    db.commit()

    return {
        "success": True,
        "penalty_applied": penalty,
        "refund_to_client": refund,
        "reservation_id": reservation_id,
    }


def cancel_reservation(db: Session, reservation_id: int, client_id: int) -> dict:
    """
    Annulation par le client.
    Remboursement total si dans les délais, partiel sinon.
    """
    reservation = db.query(H.Reservation).filter(
        H.Reservation.id == reservation_id,
        H.Reservation.client_id == client_id,
        H.Reservation.status == H.ReservationStatus.CONFIRMED
    ).first()
    if not reservation:
        raise HTTPException(404, "Réservation introuvable")

    hotel = db.get(H.Hotel, reservation.hotel_id)
    now   = datetime.now(timezone.utc)
    checkin_dt = datetime.combine(reservation.checkin_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    hours_before = (checkin_dt - now).total_seconds() / 3600

    # Remboursement total si annulation dans les délais
    if hours_before >= hotel.cancellation_hours:
        refund = reservation.total_amount
        penalty = 0.0
    else:
        penalty = round(reservation.total_amount * hotel.no_show_penalty_pct / 100, 0)
        refund  = reservation.total_amount - penalty

    # Rembourser wallet client
    client_wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client_id
    ).first()
    if client_wallet and refund > 0:
        bal = client_wallet.balance
        client_wallet.balance += refund
        db.add(models.WalletTransaction(
            wallet_id      = client_wallet.id,
            tx_type        = "cancellation_refund",
            amount         = refund,
            balance_before = bal,
            balance_after  = client_wallet.balance,
            description    = f"Remboursement annulation — Réservation #{reservation_id}",
        ))

    escrow = db.query(H.EscrowTransaction).filter(
        H.EscrowTransaction.reservation_id == reservation_id
    ).first()
    if escrow:
        escrow.status      = H.EscrowStatus.REFUNDED
        escrow.refunded_at = now

    reservation.status = H.ReservationStatus.CANCELLED

    room = db.get(H.Room, reservation.room_id)
    if room:
        room.status = H.RoomStatus.AVAILABLE

    db.commit()

    return {
        "success": True,
        "refund": refund,
        "penalty": penalty,
        "reservation_id": reservation_id,
    }


# ─────────────────────────────────────────────────────────────
#  DASHBOARD GÉRANT HOTEL
# ─────────────────────────────────────────────────────────────

def get_hotel_dashboard(db: Session, hotel_id: int, establishment_id: int) -> dict:
    """Stats du jour pour le gérant hôtel."""
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    today = date.today()

    # Réservations aujourd'hui
    checkins_today = db.query(H.Reservation).filter(
        H.Reservation.hotel_id == hotel_id,
        H.Reservation.checkin_date == today,
        H.Reservation.status.in_([H.ReservationStatus.CONFIRMED, H.ReservationStatus.CHECKED_IN])
    ).count()

    checkouts_today = db.query(H.Reservation).filter(
        H.Reservation.hotel_id == hotel_id,
        H.Reservation.checkout_date == today,
        H.Reservation.status == H.ReservationStatus.CHECKED_IN
    ).count()

    # Chambres occupées
    occupied = db.query(H.Room).filter(
        H.Room.hotel_id == hotel_id,
        H.Room.status == H.RoomStatus.OCCUPIED
    ).count()

    total_rooms = db.query(H.Room).filter(
        H.Room.hotel_id == hotel_id,
        H.Room.is_active == True
    ).count()

    available = db.query(H.Room).filter(
        H.Room.hotel_id == hotel_id,
        H.Room.status == H.RoomStatus.AVAILABLE
    ).count()

    # CA du mois
    from sqlalchemy import extract
    ca_month = db.execute(
        select(func.sum(H.Reservation.hotel_amount)).where(
            H.Reservation.hotel_id == hotel_id,
            H.Reservation.status.in_([H.ReservationStatus.CHECKED_IN, H.ReservationStatus.COMPLETED]),
            extract('month', H.Reservation.checkin_date) == today.month,
            extract('year',  H.Reservation.checkin_date) == today.year,
        )
    ).scalar() or 0.0

    # Taux d'occupation
    taux = round(occupied / total_rooms * 100, 1) if total_rooms > 0 else 0

    # Prochaines arrivées (7 jours)
    next_arrivals = db.query(H.Reservation).filter(
        H.Reservation.hotel_id == hotel_id,
        H.Reservation.checkin_date >= today,
        H.Reservation.checkin_date <= today + timedelta(days=7),
        H.Reservation.status == H.ReservationStatus.CONFIRMED
    ).order_by(H.Reservation.checkin_date).limit(10).all()

    arrivals_list = []
    for r in next_arrivals:
        client = db.get(models.ClientAccount, r.client_id)
        room   = db.get(H.Room, r.room_id)
        arrivals_list.append({
            "reservation_id": r.id,
            "client_name": client.name or client.phone if client else "—",
            "client_phone": client.phone if client else None,
            "room_number": room.number if room else None,
            "checkin_date": str(r.checkin_date),
            "checkout_date": str(r.checkout_date),
            "nights": r.nights,
            "total_amount": r.total_amount,
            "status": r.status,
        })

    return {
        "hotel_id": hotel_id,
        "hotel_name": hotel.name,
        "today": str(today),
        "checkins_today": checkins_today,
        "checkouts_today": checkouts_today,
        "occupied_rooms": occupied,
        "available_rooms": available,
        "total_rooms": total_rooms,
        "occupancy_rate_pct": taux,
        "ca_month": ca_month,
        "next_arrivals": arrivals_list,
    }


def get_reservations(db: Session, hotel_id: int, establishment_id: int,
                      status: Optional[str] = None) -> list:
    """Liste des réservations d'un hôtel."""
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    q = db.query(H.Reservation).filter(H.Reservation.hotel_id == hotel_id)
    if status:
        q = q.filter(H.Reservation.status == status)

    reservations = q.order_by(H.Reservation.checkin_date.desc()).all()
    result = []
    for r in reservations:
        client = db.get(models.ClientAccount, r.client_id)
        room   = db.get(H.Room, r.room_id)
        result.append({
            "id": r.id,
            "client_name": client.name or client.phone if client else "—",
            "client_phone": client.phone if client else None,
            "room_number": room.number if room else None,
            "checkin_date": str(r.checkin_date),
            "checkout_date": str(r.checkout_date),
            "nights": r.nights,
            "total_amount": r.total_amount,
            "hotel_amount": r.hotel_amount,
            "status": r.status,
            "qr_code": r.qr_code,
            "checkin_at": r.checkin_at.isoformat() if r.checkin_at else None,
            "special_requests": r.special_requests,
        })
    return result


# ─────────────────────────────────────────────────────────────
#  TRANSACTIONS (RÉSERVATIONS + PAIEMENTS)
# ─────────────────────────────────────────────────────────────

def get_hotel_transactions(db: Session, hotel_id: int, establishment_id: int, period: str = "today") -> dict:
    """Transactions du gérant : réservations créées + paiements reçus sur une période."""
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    today = date.today()
    if period == "today":
        date_from = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
    elif period == "week":
        date_from = datetime.combine(today - timedelta(days=6), datetime.min.time()).replace(tzinfo=timezone.utc)
    else:  # month
        date_from = datetime.combine(today.replace(day=1), datetime.min.time()).replace(tzinfo=timezone.utc)

    # Réservations créées dans la période
    new_reservations = db.query(H.Reservation).filter(
        H.Reservation.hotel_id == hotel_id,
        H.Reservation.created_at >= date_from,
        H.Reservation.status != H.ReservationStatus.CANCELLED,
    ).order_by(H.Reservation.created_at.desc()).all()

    # Paiements reçus (escrow libéré) dans la période
    payments = db.query(H.EscrowTransaction).filter(
        H.EscrowTransaction.hotel_id == hotel_id,
        H.EscrowTransaction.released_at >= date_from,
        H.EscrowTransaction.status == H.EscrowStatus.RELEASED,
    ).order_by(H.EscrowTransaction.released_at.desc()).all()

    transactions = []

    for r in new_reservations:
        client = db.get(models.ClientAccount, r.client_id)
        room   = db.get(H.Room, r.room_id)
        transactions.append({
            "id":           f"R{r.id}",
            "type":         "reservation",
            "type_label":   "Réservation",
            "client_name":  (client.name or client.phone) if client else "—",
            "client_phone": client.phone if client else None,
            "room_number":  room.number if room else None,
            "checkin_date": str(r.checkin_date),
            "checkout_date": str(r.checkout_date),
            "nights":       r.nights,
            "amount":       r.total_amount,
            "hotel_amount": r.hotel_amount,
            "status":       r.status,
            "date":         r.created_at.isoformat() if r.created_at else None,
        })

    for e in payments:
        reservation = db.get(H.Reservation, e.reservation_id)
        client      = db.get(models.ClientAccount, e.client_id)
        room        = db.get(H.Room, reservation.room_id) if reservation else None
        transactions.append({
            "id":           f"P{e.id}",
            "type":         "payment",
            "type_label":   "Paiement reçu",
            "client_name":  (client.name or client.phone) if client else "—",
            "client_phone": client.phone if client else None,
            "room_number":  room.number if room else None,
            "checkin_date": str(reservation.checkin_date) if reservation else None,
            "checkout_date": str(reservation.checkout_date) if reservation else None,
            "nights":       reservation.nights if reservation else None,
            "amount":       e.hotel_amount,
            "hotel_amount": e.hotel_amount,
            "status":       "RELEASED",
            "date":         e.released_at.isoformat() if e.released_at else None,
        })

    transactions.sort(key=lambda x: x["date"] or "", reverse=True)

    nb_resa     = len([t for t in transactions if t["type"] == "reservation"])
    nb_pay      = len([t for t in transactions if t["type"] == "payment"])
    ca_reserve  = sum(t["amount"] for t in transactions if t["type"] == "reservation")
    ca_encaisse = sum(t["amount"] for t in transactions if t["type"] == "payment")

    return {
        "period": period,
        "transactions": transactions,
        "summary": {
            "nb_reservations": nb_resa,
            "nb_payments":     nb_pay,
            "ca_reserve":      ca_reserve,
            "ca_encaisse":     ca_encaisse,
        },
    }


# ─────────────────────────────────────────────────────────────
#  AVIS
# ─────────────────────────────────────────────────────────────

def add_review(db: Session, client_id: int, data: dict) -> H.HotelReview:
    reservation = db.query(H.Reservation).filter(
        H.Reservation.id == data.get("reservation_id"),
        H.Reservation.client_id == client_id,
        H.Reservation.status == H.ReservationStatus.COMPLETED
    ).first()
    if not reservation:
        raise HTTPException(400, "Séjour non terminé ou réservation introuvable")

    existing = db.query(H.HotelReview).filter(
        H.HotelReview.reservation_id == reservation.id
    ).first()
    if existing:
        raise HTTPException(400, "Avis déjà soumis pour ce séjour")

    review = H.HotelReview(
        hotel_id       = reservation.hotel_id,
        reservation_id = reservation.id,
        client_id      = client_id,
        rating         = data.get("rating"),
        comment        = data.get("comment"),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def get_hotel_reviews(db: Session, hotel_id: int) -> list:
    reviews = db.query(H.HotelReview).filter(
        H.HotelReview.hotel_id == hotel_id,
        H.HotelReview.is_visible == True
    ).order_by(H.HotelReview.created_at.desc()).all()

    result = []
    for r in reviews:
        client = db.get(models.ClientAccount, r.client_id)
        result.append({
            "id": r.id,
            "rating": r.rating,
            "comment": r.comment,
            "client_name": client.name or "Client anonyme" if client else "—",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    return result


# ─────────────────────────────────────────────────────────────
#  BLOCAGE CALENDRIER
# ─────────────────────────────────────────────────────────────

def block_room(db: Session, hotel_id: int, establishment_id: int, data: dict) -> H.RoomBlock:
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    block = H.RoomBlock(
        room_id   = data.get("room_id"),
        date_from = date.fromisoformat(data.get("date_from")),
        date_to   = date.fromisoformat(data.get("date_to")),
        reason    = data.get("reason"),
    )
    db.add(block)
    db.commit()
    db.refresh(block)
    return block
