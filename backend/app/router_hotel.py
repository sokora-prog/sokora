"""
SOKORA Hotel — Router FastAPI
Endpoints : Hotels, Rooms, Reservations, Escrow, Check-in
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from . import security, models, crud_hotel

router = APIRouter(prefix="/hotel", tags=["hotel"])


# ─────────────────────────────────────────────────────────────
#  HELPERS AUTH
# ─────────────────────────────────────────────────────────────

def _require_manager(db, current_user):
    if current_user.role not in [models.UserRole.MANAGER, models.UserRole.SUPER_ADMIN]:
        raise HTTPException(403, "Accès réservé au gérant")
    return current_user

def _get_client(request: Request, db: Session):
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token client requis")
    from . import crud
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token invalide")
    return client


# ─────────────────────────────────────────────────────────────
#  HOTEL — GÉRANT
# ─────────────────────────────────────────────────────────────

@router.post("/setup")
def setup_hotel(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Créer ou configurer l'hôtel de l'établissement."""
    return crud_hotel.create_hotel(db, current_user.establishment_id, data)


@router.get("/me")
def get_my_hotel(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Récupérer les infos de son hôtel."""
    hotel = crud_hotel.get_hotel_by_establishment(db, current_user.establishment_id)
    if not hotel:
        raise HTTPException(404, "Hôtel non configuré")
    return hotel


@router.patch("/{hotel_id}")
def update_hotel(
    hotel_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Mettre à jour les infos de l'hôtel."""
    return crud_hotel.update_hotel(db, hotel_id, current_user.establishment_id, data)


@router.get("/{hotel_id}/dashboard")
def hotel_dashboard(
    hotel_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Dashboard du gérant hôtel — stats du jour."""
    return crud_hotel.get_hotel_dashboard(db, hotel_id, current_user.establishment_id)


# ─────────────────────────────────────────────────────────────
#  ROOM TYPES
# ─────────────────────────────────────────────────────────────

@router.post("/{hotel_id}/room-types")
def create_room_type(
    hotel_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Créer un type de chambre."""
    return crud_hotel.create_room_type(db, hotel_id, current_user.establishment_id, data)


@router.get("/{hotel_id}/room-types")
def list_room_types(
    hotel_id: int,
    db: Session = Depends(get_db)
):
    """Lister les types de chambres (public)."""
    return crud_hotel.get_room_types(db, hotel_id)


# ─────────────────────────────────────────────────────────────
#  ROOMS
# ─────────────────────────────────────────────────────────────

@router.post("/{hotel_id}/rooms")
def create_room(
    hotel_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Ajouter une chambre physique."""
    return crud_hotel.create_room(db, hotel_id, current_user.establishment_id, data)


@router.get("/{hotel_id}/rooms")
def list_rooms(
    hotel_id: int,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Lister toutes les chambres avec statut temps réel."""
    return crud_hotel.get_rooms(db, hotel_id)


@router.patch("/{hotel_id}/rooms/{room_id}/status")
def update_room_status(
    hotel_id: int,
    room_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Changer le statut d'une chambre manuellement."""
    return crud_hotel.update_room_status(db, room_id, hotel_id, data.get("status"))


# ─────────────────────────────────────────────────────────────
#  DISPONIBILITÉ
# ─────────────────────────────────────────────────────────────

@router.get("/{hotel_id}/availability")
def get_availability(
    hotel_id: int,
    checkin_date: str,
    checkout_date: str,
    db: Session = Depends(get_db)
):
    """
    Chambres disponibles pour une période donnée.
    Public — utilisé par l'app client.
    """
    try:
        checkin  = date.fromisoformat(checkin_date)
        checkout = date.fromisoformat(checkout_date)
    except ValueError:
        raise HTTPException(400, "Format de date invalide. Utilisez YYYY-MM-DD")

    return crud_hotel.get_hotel_availability(db, hotel_id, checkin, checkout)


# ─────────────────────────────────────────────────────────────
#  RECHERCHE GÉOLOCALISÉE (CLIENT)
# ─────────────────────────────────────────────────────────────

@router.get("/nearby")
def hotels_nearby(
    lat: float,
    lng: float,
    radius_km: float = 2.0,
    checkin_date: Optional[str] = None,
    checkout_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Hôtels disponibles autour d'une position GPS.
    Rayon par défaut: 2 km.
    """
    checkin  = date.fromisoformat(checkin_date)  if checkin_date  else None
    checkout = date.fromisoformat(checkout_date) if checkout_date else None
    return crud_hotel.get_hotels_nearby(db, lat, lng, radius_km, checkin, checkout)


# ─────────────────────────────────────────────────────────────
#  RÉSERVATIONS — CLIENT
# ─────────────────────────────────────────────────────────────

@router.post("/reservations")
def create_reservation(
    request: Request,
    data: dict,
    db: Session = Depends(get_db)
):
    """
    Créer une réservation.
    Débite le wallet client et place les fonds en escrow.
    """
    client = _get_client(request, db)
    return crud_hotel.create_reservation(db, client.id, data)


@router.get("/reservations/my")
def my_reservations(
    request: Request,
    db: Session = Depends(get_db)
):
    """Réservations du client connecté."""
    client = _get_client(request, db)
    from . import models_hotel as H
    from sqlalchemy import select
    reservations = db.query(H.Reservation).filter(
        H.Reservation.client_id == client.id
    ).order_by(H.Reservation.checkin_date.desc()).all()

    result = []
    for r in reservations:
        hotel = db.get(H.Hotel, r.hotel_id)
        room  = db.get(H.Room,  r.room_id)
        result.append({
            "id": r.id,
            "hotel_name": hotel.name if hotel else "—",
            "hotel_cover": hotel.cover_image_url if hotel else None,
            "room_number": room.number if room else None,
            "checkin_date": str(r.checkin_date),
            "checkout_date": str(r.checkout_date),
            "nights": r.nights,
            "total_amount": r.total_amount,
            "status": r.status,
            "qr_code": r.qr_code if r.status == "CONFIRMED" else None,
        })
    return result


@router.post("/reservations/{reservation_id}/cancel")
def cancel_reservation(
    reservation_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Annuler une réservation — remboursement selon politique."""
    client = _get_client(request, db)
    return crud_hotel.cancel_reservation(db, reservation_id, client.id)


# ─────────────────────────────────────────────────────────────
#  RÉSERVATIONS — GÉRANT
# ─────────────────────────────────────────────────────────────

@router.get("/{hotel_id}/reservations")
def list_reservations(
    hotel_id: int,
    status: Optional[str] = None,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Liste des réservations de l'hôtel."""
    return crud_hotel.get_reservations(db, hotel_id, current_user.establishment_id, status)


# ─────────────────────────────────────────────────────────────
#  CHECK-IN / CHECK-OUT / NO-SHOW
# ─────────────────────────────────────────────────────────────

@router.post("/checkin/scan")
def scan_checkin(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Scanner le QR Code du client à l'arrivée.
    Libère les fonds de l'escrow vers le wallet du gérant.
    Vérification géofencing optionnelle (lat/lng).
    """
    qr_code = data.get("qr_code")
    lat     = data.get("lat")
    lng     = data.get("lng")

    if not qr_code:
        raise HTTPException(400, "QR Code requis")

    result = crud_hotel.process_checkin(db, qr_code, current_user.id, lat, lng)

    # Ajouter points fidélité (1 point par 500F dépensé)
    try:
        from .models_hotel import Reservation
        reservation = db.query(Reservation).filter(Reservation.qr_code == qr_code).first()
        if reservation:
            client = db.query(models.ClientAccount).filter(
                models.ClientAccount.id == reservation.client_id
            ).first()
            if client:
                points_earned = int((reservation.total_amount or 0) / 500)
                if points_earned > 0:
                    client.total_points = (client.total_points or 0) + points_earned
                    client.total_spent = (client.total_spent or 0) + (reservation.total_amount or 0)
                    db.commit()
    except Exception:
        pass

    return result


@router.post("/reservations/{reservation_id}/checkout")
def process_checkout(
    reservation_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Clôturer un séjour — chambre passe en CLEANING."""
    return crud_hotel.process_checkout(db, reservation_id, current_user.establishment_id)


@router.post("/reservations/{reservation_id}/no-show")
def process_no_show(
    reservation_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """
    Déclarer un no-show.
    Applique la pénalité et rembourse le reste au client.
    """
    return crud_hotel.process_no_show(db, reservation_id, current_user.establishment_id)


# ─────────────────────────────────────────────────────────────
#  TARIFS SAISONNIERS
# ─────────────────────────────────────────────────────────────

@router.post("/{hotel_id}/season-rates")
def create_season_rate(
    hotel_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Créer un tarif saisonnier."""
    from . import models_hotel as H
    from datetime import date as d
    hotel = db.query(H.Hotel).filter(
        H.Hotel.id == hotel_id,
        H.Hotel.establishment_id == current_user.establishment_id
    ).first()
    if not hotel:
        raise HTTPException(404, "Hôtel introuvable")

    rate = H.SeasonRate(
        hotel_id     = hotel_id,
        room_type_id = data.get("room_type_id"),
        name         = data.get("name"),
        price        = data.get("price"),
        date_from    = d.fromisoformat(data.get("date_from")),
        date_to      = d.fromisoformat(data.get("date_to")),
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.get("/{hotel_id}/season-rates")
def list_season_rates(
    hotel_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Lister les tarifs saisonniers."""
    from . import models_hotel as H
    return db.query(H.SeasonRate).filter(
        H.SeasonRate.hotel_id == hotel_id,
        H.SeasonRate.is_active == True
    ).all()


# ─────────────────────────────────────────────────────────────
#  TRANSACTIONS
# ─────────────────────────────────────────────────────────────

@router.get("/{hotel_id}/transactions")
def hotel_transactions(
    hotel_id: int,
    period: str = "today",
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Transactions de la période : réservations créées + paiements reçus."""
    if period not in ("today", "week", "month"):
        raise HTTPException(400, "period doit être today, week ou month")
    return crud_hotel.get_hotel_transactions(db, hotel_id, current_user.establishment_id, period)


# ─────────────────────────────────────────────────────────────
#  BLOCAGE CALENDRIER
# ─────────────────────────────────────────────────────────────

@router.post("/{hotel_id}/blocks")
def block_room(
    hotel_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Bloquer une chambre manuellement (réservation directe, travaux...)."""
    return crud_hotel.block_room(db, hotel_id, current_user.establishment_id, data)


# ─────────────────────────────────────────────────────────────
#  AVIS
# ─────────────────────────────────────────────────────────────

@router.post("/reviews")
def add_review(
    request: Request,
    data: dict,
    db: Session = Depends(get_db)
):
    """Laisser un avis après un séjour terminé."""
    client = _get_client(request, db)
    return crud_hotel.add_review(db, client.id, data)


@router.get("/{hotel_id}/reviews")
def get_reviews(
    hotel_id: int,
    db: Session = Depends(get_db)
):
    """Avis clients d'un hôtel (public)."""
    return crud_hotel.get_hotel_reviews(db, hotel_id)


# ─────────────────────────────────────────────────────────────
#  FINANCE AI — Score bancaire hôtel
# ─────────────────────────────────────────────────────────────

@router.get("/{hotel_id}/finance/dashboard")
def hotel_finance_dashboard(
    hotel_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Ratios financiers hôteliers + score bancaire SOKORA (90 jours)."""
    from datetime import datetime, timezone, timedelta
    import statistics as _stats
    from .models_hotel import Reservation, ReservationStatus, Room, HotelReview

    now = datetime.now(timezone.utc)
    d90 = now - timedelta(days=90)
    d60 = now - timedelta(days=60)
    d30 = now - timedelta(days=30)

    def resa_in(start, end):
        return db.query(Reservation).filter(
            Reservation.hotel_id == hotel_id,
            Reservation.created_at >= start,
            Reservation.created_at < end,
            Reservation.status.in_([
                ReservationStatus.CONFIRMED,
                ReservationStatus.CHECKED_IN,
                ReservationStatus.COMPLETED,
            ]),
        ).all()

    r_m2, r_m1, r_m0 = resa_in(d90, d60), resa_in(d60, d30), resa_in(d30, now)

    def rev(rows):
        return sum(r.hotel_amount or r.total_amount or 0 for r in rows)

    rev_m2, rev_m1, rev_m0 = rev(r_m2), rev(r_m1), rev(r_m0)
    revenues = [x for x in [rev_m2, rev_m1, rev_m0] if x > 0]
    rev_avg  = sum(revenues) / len(revenues) if revenues else 0
    all_resa = r_m2 + r_m1 + r_m0
    total_nights = sum(r.nights or 0 for r in all_resa)

    adr = (sum(r.price_per_night or 0 for r in all_resa) / len(all_resa)) if all_resa else 0
    total_rooms = db.query(Room).filter(Room.hotel_id == hotel_id, Room.is_active == True).count()
    occ_rate = round((total_nights / (total_rooms * 90)) * 100, 1) if total_rooms > 0 else 0
    revpar   = round(sum(r.price_per_night or 0 for r in all_resa) / (total_rooms * 90), 0) if total_rooms > 0 else 0

    all_90 = db.query(Reservation).filter(
        Reservation.hotel_id == hotel_id,
        Reservation.created_at >= d90,
    ).all()
    no_shows = sum(1 for r in all_90 if r.status == ReservationStatus.NO_SHOW)
    cancels  = sum(1 for r in all_90 if r.status == ReservationStatus.CANCELLED)
    no_show_rate = round(no_shows / len(all_90) * 100, 1) if all_90 else 0
    cancel_rate  = round(cancels  / len(all_90) * 100, 1) if all_90 else 0

    mom_growth = round((rev_m0 - rev_m1) / rev_m1 * 100, 1) if rev_m1 > 0 else (100.0 if rev_m0 > 0 else 0.0)

    reviews    = db.query(HotelReview).filter(HotelReview.hotel_id == hotel_id).all()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0

    lead_times = [
        (r.checkin_date - r.created_at.date()).days
        for r in all_resa
        if r.checkin_date and r.created_at and (r.checkin_date - r.created_at.date()).days >= 0
    ]
    avg_lead_time = round(sum(lead_times) / len(lead_times), 0) if lead_times else 0

    # Score 0-100
    if len(revenues) >= 2:
        cv = _stats.stdev(revenues) / rev_avg if rev_avg else 1
        stab_score = max(0, 20 - round(cv * 40))
    else:
        stab_score = 8 if revenues else 0

    occ_score    = min(25, round(occ_rate / 70 * 25))
    growth_score = 20 if mom_growth >= 10 else (round(mom_growth / 10 * 15) + 5 if mom_growth >= 0 else max(0, round(10 + mom_growth)))
    noshow_score = max(0, round(20 - (no_show_rate + cancel_rate) * 0.5))
    review_score = round(avg_rating / 5 * 15) if avg_rating else 0
    score        = min(100, stab_score + occ_score + growth_score + noshow_score + review_score)

    if   score >= 80: score_label, score_color = "Excellent", "#22c55e"
    elif score >= 65: score_label, score_color = "Bon",       "#84cc16"
    elif score >= 50: score_label, score_color = "Correct",   "#f59e0b"
    elif score >= 35: score_label, score_color = "Faible",    "#f97316"
    else:             score_label, score_color = "Insuffisant","#ef4444"

    loan_offers = [
        {"type": "renovation",      "label": "Crédit rénovation",       "icon": "🏗️",
         "amount": int(round(rev_avg * 3   / 5000) * 5000), "rate": "2.5% / mois", "duration": "18 mois",
         "eligible": score >= 65 and len(revenues) >= 3,
         "reason": "Profil hôtelier solide" if score >= 65 and len(revenues) >= 3 else f"Score requis: 65 (actuel: {score})"},
        {"type": "equipment",       "label": "Équipement & literie",     "icon": "🛏️",
         "amount": int(round(rev_avg * 1.5 / 5000) * 5000), "rate": "3% / mois",   "duration": "12 mois",
         "eligible": score >= 50,
         "reason": "Financement équipement disponible" if score >= 50 else f"Score requis: 50 (actuel: {score})"},
        {"type": "working_capital", "label": "Trésorerie basse saison", "icon": "💼",
         "amount": int(round(rev_avg * 0.8 / 5000) * 5000), "rate": "3.5% / mois", "duration": "3 mois",
         "eligible": score >= 40 and len(revenues) >= 2,
         "reason": "Pont de trésorerie disponible" if score >= 40 else f"Score requis: 40 (actuel: {score})"},
    ]

    recs = []
    if occ_rate < 40:
        recs.append(f"🏨 Taux d'occupation faible ({occ_rate}%) — activez des promos SOKORA pour remplir vos chambres.")
    elif occ_rate >= 75:
        recs.append(f"🌟 Excellent taux d'occupation ({occ_rate}%) — envisagez d'augmenter vos tarifs.")
    if no_show_rate > 10:
        recs.append(f"⚠️ Taux de no-show élevé ({no_show_rate}%) — activez la pénalité de dépôt.")
    if avg_rating >= 4.5:
        recs.append(f"⭐ Note client exceptionnelle ({avg_rating}/5) — valorisez vos avis pour attirer plus de réservations.")
    elif avg_rating > 0 and avg_rating < 3.5:
        recs.append(f"😟 Note client faible ({avg_rating}/5) — répondez aux avis et améliorez l'accueil.")
    if mom_growth > 10:
        recs.append(f"🚀 Croissance de {mom_growth}% ce mois — votre hôtel gagne en visibilité SOKORA !")
    if avg_lead_time < 2:
        recs.append("📅 Réservations très tardives — proposez des tarifs early-bird pour lisser l'occupation.")
    if not recs:
        recs.append("✅ Vos indicateurs hôteliers sont stables. Maintenez la qualité de service.")

    if   occ_rate > 75: pricing = {"action": "augmenter", "pct": 10, "reason": "Fort taux d'occupation — hausser les prix de 10%"}
    elif occ_rate < 40: pricing = {"action": "baisser",   "pct": 15, "reason": "Faible occupation — promotion -15% pour stimuler les réservations"}
    else:               pricing = {"action": "maintenir", "pct": 0,  "reason": "Taux d'occupation équilibré — tarifs optimaux"}

    return {
        "period_days": 90,
        "has_sufficient_data": len(revenues) >= 1,
        "score": score, "score_label": score_label, "score_color": score_color,
        "score_breakdown": {
            "stability": stab_score, "occupancy": occ_score,
            "growth": growth_score, "reliability": noshow_score, "reviews": review_score,
        },
        "ratios": {
            "revenue_m0": int(rev_m0), "revenue_m1": int(rev_m1), "revenue_m2": int(rev_m2),
            "revenue_avg": int(rev_avg), "mom_growth": mom_growth,
            "occupancy_rate": occ_rate, "adr": int(adr), "revpar": int(revpar),
            "total_bookings": len(all_resa), "total_nights": total_nights,
            "no_show_rate": no_show_rate, "cancel_rate": cancel_rate,
            "avg_rating": avg_rating, "reviews_count": len(reviews),
            "avg_lead_time_days": int(avg_lead_time), "total_rooms": total_rooms,
        },
        "loan_offers": loan_offers,
        "recommendations": recs,
        "smart_pricing": pricing,
    }


# ─────────────────────────────────────────────────────────────
#  RAPPORT PDF MENSUEL
# ─────────────────────────────────────────────────────────────

@router.get("/{hotel_id}/reports/monthly")
def hotel_monthly_report(
    hotel_id: int,
    month: str = None,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Rapport PDF mensuel hôtel : revenus, occupancy, top room types."""
    from datetime import datetime, timezone, timedelta
    from calendar import monthrange
    from fastapi.responses import StreamingResponse
    import io

    if month:
        year, mo = int(month.split("-")[0]), int(month.split("-")[1])
    else:
        now = datetime.now(timezone.utc)
        year, mo = now.year, now.month

    _, last_day = monthrange(year, mo)
    start = datetime(year, mo, 1, tzinfo=timezone.utc)
    end   = datetime(year, mo, last_day, 23, 59, 59, tzinfo=timezone.utc)

    from .models_hotel import Reservation, ReservationStatus, Room, RoomType

    # Données
    hotel = db.query(crud_hotel.H.Hotel).filter(crud_hotel.H.Hotel.id == hotel_id).first()
    hotel_name = hotel.name if hotel else f"Hôtel #{hotel_id}"

    reservations = db.query(Reservation).filter(
        Reservation.hotel_id == hotel_id,
        Reservation.created_at >= start,
        Reservation.created_at <= end,
        Reservation.status.in_([ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN, ReservationStatus.COMPLETED]),
    ).all()

    total_revenue  = sum(r.hotel_amount or r.total_amount or 0 for r in reservations)
    total_nights   = sum(r.nights or 0 for r in reservations)
    total_rooms    = db.query(Room).filter(Room.hotel_id == hotel_id, Room.is_active == True).count()
    occ_rate       = round((total_nights / (total_rooms * last_day)) * 100, 1) if total_rooms > 0 else 0
    adr            = round(sum(r.price_per_night or 0 for r in reservations) / len(reservations), 0) if reservations else 0
    no_shows       = db.query(Reservation).filter(
        Reservation.hotel_id == hotel_id,
        Reservation.created_at >= start,
        Reservation.created_at <= end,
        Reservation.status == ReservationStatus.NO_SHOW,
    ).count()

    # Top room types
    rt_stats = {}
    for r in reservations:
        room = db.query(Room).filter(Room.id == r.room_id).first()
        if room:
            rt = db.query(RoomType).filter(RoomType.id == room.room_type_id).first()
            name = rt.name if rt else "Chambre"
            if name not in rt_stats:
                rt_stats[name] = {"count": 0, "revenue": 0}
            rt_stats[name]["count"]   += 1
            rt_stats[name]["revenue"] += r.hotel_amount or r.total_amount or 0

    month_names = ["","Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

    try:
        from fpdf import FPDF
        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        def fmt(n): return f"{int(n):,} F CFA".replace(",", " ")

        # En-tête
        pdf.set_font("Helvetica","B",20); pdf.set_text_color(15,30,53)
        pdf.cell(0,12,"SOKORA HÔTEL",ln=True,align="C")
        pdf.set_font("Helvetica","",13); pdf.set_text_color(122,143,171)
        pdf.cell(0,8,f"Rapport mensuel — {month_names[mo]} {year}",ln=True,align="C")
        pdf.cell(0,8,hotel_name,ln=True,align="C")
        pdf.ln(6)
        pdf.set_draw_color(221,228,240); pdf.line(10,pdf.get_y(),200,pdf.get_y()); pdf.ln(8)

        def section(t):
            pdf.set_font("Helvetica","B",12); pdf.set_text_color(15,30,53)
            pdf.cell(0,8,t,ln=True); pdf.ln(2)

        def row(l,v,color=None):
            pdf.set_font("Helvetica","",10); pdf.set_text_color(122,143,171)
            pdf.cell(110,7,l)
            pdf.set_font("Helvetica","B",10)
            if color: pdf.set_text_color(*color)
            else: pdf.set_text_color(15,30,53)
            pdf.cell(0,7,str(v),ln=True)

        section("PERFORMANCE HÔTELIÈRE")
        row("Chiffre d'affaires",     fmt(total_revenue), color=(25,169,157))
        row("Réservations confirmées", str(len(reservations)))
        row("Nuitées vendues",         str(total_nights))
        row("Taux d'occupation",       f"{occ_rate}%", color=(34,197,94) if occ_rate>=60 else (249,115,22))
        row("ADR (prix moyen/nuit)",   fmt(adr))
        row("No-shows",               str(no_shows), color=(232,64,64) if no_shows>0 else None)
        pdf.ln(6)

        if rt_stats:
            section("REVENUS PAR TYPE DE CHAMBRE")
            for name,(d) in sorted(rt_stats.items(), key=lambda x:-x[1]["revenue"]):
                row(name, f"{d['count']} séjours — {fmt(d['revenue'])}")
            pdf.ln(6)

        pdf.set_y(-25); pdf.set_font("Helvetica","",8); pdf.set_text_color(122,143,171)
        pdf.cell(0,5,f"Généré par SOKORA Platform · {datetime.now().strftime('%d/%m/%Y %H:%M')}",align="C",ln=True)

        buf = io.BytesIO(pdf.output())
        fname = f"sokora_hotel_{hotel_name.replace(' ','_')}_{year}_{mo:02d}.pdf"
        return StreamingResponse(buf, media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}"'})
    except ImportError:
        return {"revenue": int(total_revenue), "occ_rate": occ_rate, "adr": int(adr),
                "reservations": len(reservations), "note": "Installez fpdf2"}
