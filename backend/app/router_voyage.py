"""
SOKORA Voyage — Router FastAPI
Endpoints : Compagnies, Véhicules, Chauffeurs, Trajets, Réservations, GPS, QR Embarquement
"""
import random
import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .database import get_db
from . import security, models, crud
from . import crud_voyage

router = APIRouter(prefix="/voyage", tags=["voyage"])


# ─────────────────────────────────────────
#  HELPERS AUTH
# ─────────────────────────────────────────

def _require_admin(current_user: models.User):
    if current_user.role != models.UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Accès Super Admin uniquement")
    return current_user


def _get_driver(request: Request, db: Session):
    token = request.headers.get("X-Driver-Token", "")
    if not token:
        raise HTTPException(401, "Token chauffeur requis")
    driver = crud_voyage.get_driver_from_token(db, token)
    if not driver:
        raise HTTPException(401, "Token chauffeur invalide")
    return driver


def _get_client(request: Request, db: Session):
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token client requis")
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token client invalide")
    return client


# ─────────────────────────────────────────
#  PUBLIC — RECHERCHE TRAJETS
# ─────────────────────────────────────────

@router.get("/search")
def search_trips(
    origin: str,
    destination: str,
    date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Recherche de voyages disponibles (public, sans auth)."""
    return crud_voyage.search_trips(db, origin, destination, date)


@router.get("/trips/{trip_id}")
def get_trip(trip_id: int, db: Session = Depends(get_db)):
    """Détails d'un voyage avec plan de sièges."""
    trip = crud_voyage.get_trip(db, trip_id)
    if not trip:
        raise HTTPException(404, "Voyage introuvable")
    seats = crud_voyage.get_trip_seats(db, trip_id)
    t = crud_voyage._format_trip(trip)
    t["seats"] = seats
    return t


@router.get("/trips/{trip_id}/location")
def get_trip_location(trip_id: int, db: Session = Depends(get_db)):
    """Dernière position GPS du véhicule (pour passagers)."""
    loc = crud_voyage.get_vehicle_last_location(db, trip_id)
    if not loc:
        raise HTTPException(404, "Position non disponible")
    return loc


# ─────────────────────────────────────────
#  CLIENT — RÉSERVATIONS
# ─────────────────────────────────────────

@router.post("/bookings")
def create_booking(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """Réserver un siège (client authentifié, débite le wallet)."""
    client = _get_client(request, db)
    try:
        booking = crud_voyage.create_booking(db, client.id, data)
        return crud_voyage._format_booking(booking)
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.get("/bookings/me")
def my_bookings(
    request: Request,
    db: Session = Depends(get_db)
):
    """Historique des réservations du client connecté."""
    client = _get_client(request, db)
    return crud_voyage.get_client_bookings(db, client.id)


@router.get("/bookings/{booking_id}")
def get_booking(
    booking_id: int,
    request: Request,
    db: Session = Depends(get_db)
):
    """Détails d'une réservation (QR code inclus)."""
    client = _get_client(request, db)
    booking = crud_voyage.get_booking(db, booking_id)
    if not booking or booking.client_id != client.id:
        raise HTTPException(404, "Réservation introuvable")
    return crud_voyage._format_booking(booking)


# ─────────────────────────────────────────
#  CHAUFFEUR — LOGIN & SCAN QR
# ─────────────────────────────────────────

@router.post("/driver/login")
def driver_login(data: dict, db: Session = Depends(get_db)):
    """Login chauffeur (phone + password)."""
    driver = crud_voyage.login_driver(db, data.get("phone", ""), data.get("password", ""))
    if not driver:
        raise HTTPException(401, "Identifiants invalides")
    return {
        "driver_token": driver.driver_token,
        "driver_id":    driver.id,
        "full_name":    driver.full_name,
        "company_id":   driver.company_id,
    }


@router.post("/driver/scan")
def scan_qr(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Scan QR d'embarquement par le chauffeur.
    data: { qr_token: str }
    """
    driver = _get_driver(request, db)
    try:
        result = crud_voyage.scan_boarding_qr(db, driver.id, data.get("qr_token", ""))
        return result
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.post("/driver/location")
def update_location(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Mise à jour position GPS du véhicule par le chauffeur.
    data: { trip_id, latitude, longitude, speed_kmh? }
    """
    driver = _get_driver(request, db)
    try:
        return crud_voyage.update_vehicle_location(
            db,
            data["trip_id"],
            data["latitude"],
            data["longitude"],
            data.get("speed_kmh")
        )
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/driver/trips")
def driver_trips(
    request: Request,
    db: Session = Depends(get_db)
):
    """Voyages assignés au chauffeur connecté (aujourd'hui)."""
    driver = _get_driver(request, db)
    from sqlalchemy import select
    from .models_voyage import VoyageTrip, TripStatus
    from datetime import datetime, timezone, timedelta
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    trips = list(db.scalars(
        select(VoyageTrip).where(
            VoyageTrip.driver_id == driver.id,
            VoyageTrip.departure_at >= today,
            VoyageTrip.departure_at < today + timedelta(days=1),
        )
    ))
    return [crud_voyage._format_trip(t) for t in trips]


# ─────────────────────────────────────────
#  ADMIN COMPAGNIE — GESTION
# ─────────────────────────────────────────

@router.get("/companies")
def list_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.get_companies(db)


@router.post("/companies")
def create_company(
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    _require_admin(current_user)
    return crud_voyage.create_company(db, data)


@router.put("/companies/{company_id}")
def update_company(
    company_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    _require_admin(current_user)
    company = crud_voyage.update_company(db, company_id, data)
    if not company:
        raise HTTPException(404, "Compagnie introuvable")
    return company


@router.get("/companies/{company_id}/vehicles")
def list_vehicles(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.get_vehicles(db, company_id)


@router.post("/companies/{company_id}/vehicles")
def create_vehicle(
    company_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.create_vehicle(db, company_id, data)


@router.get("/companies/{company_id}/drivers")
def list_drivers(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.get_drivers(db, company_id)


@router.post("/companies/{company_id}/drivers")
def create_driver(
    company_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    try:
        return crud_voyage.create_driver(db, company_id, data)
    except Exception as e:
        raise HTTPException(400, str(e))


@router.get("/companies/{company_id}/routes")
def list_routes(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.get_routes(db, company_id)


@router.post("/companies/{company_id}/routes")
def create_route(
    company_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    return crud_voyage.create_route(db, company_id, data)


@router.post("/trips")
def create_trip(
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """Créer un voyage programmé."""
    try:
        return crud_voyage._format_trip(crud_voyage.create_trip(db, data))
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.put("/trips/{trip_id}/status")
def update_trip_status(
    trip_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """Changer le statut d'un voyage (boarding, in_progress, completed...)."""
    from sqlalchemy import select
    from .models_voyage import VoyageTrip, TripStatus
    trip = db.get(VoyageTrip, trip_id)
    if not trip:
        raise HTTPException(404, "Voyage introuvable")
    try:
        trip.status = TripStatus(data["status"].upper())
    except ValueError:
        raise HTTPException(400, "Statut invalide")
    db.commit()
    return {"ok": True, "status": trip.status.value}


@router.get("/companies/{company_id}/dashboard")
def company_dashboard(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """KPIs dashboard compagnie."""
    return crud_voyage.get_company_dashboard(db, company_id)


@router.get("/trips/{trip_id}/bookings")
def get_trip_bookings(
    trip_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """Liste des passagers d'un voyage (admin compagnie)."""
    from .models_voyage import VoyageBooking, BookingStatus

    bookings = db.query(VoyageBooking).filter(
        VoyageBooking.trip_id == trip_id
    ).order_by(VoyageBooking.seat_number).all()

    result = []
    for b in bookings:
        # passenger_name / passenger_phone sont des colonnes directes sur VoyageBooking
        # On les complète avec la relation client si elles sont vides
        client_name  = b.passenger_name  or "—"
        client_phone = b.passenger_phone or "—"
        if (client_name == "—" or client_phone == "—"):
            try:
                if b.client:
                    if client_name == "—":
                        client_name  = getattr(b.client, "full_name", None) \
                                    or getattr(b.client, "name", None) or "—"
                    if client_phone == "—":
                        client_phone = getattr(b.client, "phone_number", None) \
                                    or getattr(b.client, "phone", None) or "—"
            except Exception:
                pass

        result.append({
            "booking_id":     b.id,
            "seat_number":    b.seat_number,
            "status":         b.status.value if hasattr(b.status, "value") else str(b.status),
            "client_name":    client_name,
            "client_phone":   client_phone,
            "amount_paid":    b.amount_paid or 0,
            # payment_method n'existe pas dans le modèle — paiement toujours via WALLET
            "payment_method": "WALLET",
            "qr_token":       b.qr_token or "",
            # boarded_at n'est pas une colonne du modèle — on utilise updated_at quand BOARDED
            "boarded_at":     b.updated_at.isoformat()
                              if b.updated_at and b.status == BookingStatus.BOARDED
                              else None,
            "created_at":     b.created_at.isoformat() if b.created_at else None,
        })

    return {"bookings": result, "total": len(result)}


@router.get("/companies/{company_id}/drivers/{driver_id}/stats")
def get_driver_stats(
    company_id: int,
    driver_id: int,
    period: str = "30d",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """Stats complètes d'un chauffeur sur une période."""
    from datetime import datetime, timezone, timedelta
    from collections import defaultdict
    from .models_voyage import VoyageTrip, VoyageBooking, VoyageDriver, TripStatus, BookingStatus

    driver = db.get(VoyageDriver, driver_id)
    if not driver or driver.company_id != company_id:
        raise HTTPException(404, "Chauffeur introuvable")

    days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    period_labels = {
        "7d":  "7 derniers jours",
        "30d": "30 derniers jours",
        "90d": "90 derniers jours",
    }

    # Trips du chauffeur sur la période
    trips = db.query(VoyageTrip).filter(
        VoyageTrip.driver_id == driver_id,
        VoyageTrip.departure_at >= since
    ).all()

    trip_ids = [t.id for t in trips]

    completed   = [t for t in trips if t.status == TripStatus.COMPLETED]
    cancelled   = [t for t in trips if t.status == TripStatus.CANCELLED]
    active      = [t for t in trips if t.status in (TripStatus.BOARDING, TripStatus.IN_PROGRESS)]

    # Passagers confirmés/embarqués/terminés et revenus
    bookings = []
    if trip_ids:
        bookings = db.query(VoyageBooking).filter(
            VoyageBooking.trip_id.in_(trip_ids),
            VoyageBooking.status.in_([
                BookingStatus.BOARDED,
                BookingStatus.COMPLETED,
                BookingStatus.CONFIRMED,
            ])
        ).all()

    revenue = sum(b.amount_paid or 0 for b in bookings)

    # KM estimés : utilise route.distance_km si disponible, sinon 150 km par défaut
    km_total = 0
    for t in completed:
        try:
            dist = t.route.distance_km if t.route and t.route.distance_km else 150
        except Exception:
            dist = 150
        km_total += dist

    # Série temporelle : nb de trips par jour
    daily = defaultdict(int)
    for t in trips:
        if t.departure_at:
            day_key = t.departure_at.strftime("%d/%m")
            daily[day_key] += 1
    daily_series = [{"date": k, "trips": v} for k, v in sorted(daily.items())]

    return {
        "driver_id":           driver.id,
        "driver_name":         driver.full_name,
        # phone est le nom réel de la colonne dans VoyageDriver
        "driver_phone":        driver.phone or "—",
        # license_no est le nom réel de la colonne dans VoyageDriver (pas license_number)
        "driver_license":      driver.license_no or "—",
        "period":              period,
        "period_label":        period_labels.get(period, "30 derniers jours"),
        "trips_total":         len(trips),
        "trips_completed":     len(completed),
        "trips_cancelled":     len(cancelled),
        "trips_in_progress":   len(active),
        "passengers_total":    len(bookings),
        "revenue_generated":   revenue,
        "km_estimated":        km_total,
        "avg_punctuality_pct": 95.0,   # mock — pas de données de ponctualité en DB
        "avg_rating":          4.3,    # mock — pas de colonne rating en DB
        "daily_series":        daily_series,
    }


# ─────────────────────────────────────────────────────────────
#  FINANCE AI — Score bancaire compagnie de voyage
# ─────────────────────────────────────────────────────────────

@router.get("/companies/{company_id}/finance/dashboard")
def voyage_finance_dashboard(
    company_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Ratios financiers transport + score bancaire SOKORA (90 jours)."""
    from datetime import datetime, timezone, timedelta
    import statistics as _stats
    from .models_voyage import (
        VoyageBooking, VoyageTrip, VoyageRoute,
        BookingStatus, TripStatus, VoyageVehicle
    )

    now = datetime.now(timezone.utc)
    d90 = now - timedelta(days=90)
    d60 = now - timedelta(days=60)
    d30 = now - timedelta(days=30)

    # Voyages de la compagnie
    trips = db.query(VoyageTrip).join(
        VoyageRoute, VoyageTrip.route_id == VoyageRoute.id
    ).filter(VoyageRoute.company_id == company_id).all()
    trip_ids = [t.id for t in trips]

    def bookings_in(start, end):
        if not trip_ids:
            return []
        return db.query(VoyageBooking).filter(
            VoyageBooking.trip_id.in_(trip_ids),
            VoyageBooking.created_at >= start,
            VoyageBooking.created_at < end,
            VoyageBooking.status.in_([
                BookingStatus.CONFIRMED,
                BookingStatus.BOARDED,
                BookingStatus.COMPLETED,
            ]),
        ).all()

    b_m2, b_m1, b_m0 = bookings_in(d90, d60), bookings_in(d60, d30), bookings_in(d30, now)

    def rev(rows):
        return sum(b.amount_paid or 0 for b in rows)

    rev_m2, rev_m1, rev_m0 = rev(b_m2), rev(b_m1), rev(b_m0)
    revenues = [x for x in [rev_m2, rev_m1, rev_m0] if x > 0]
    rev_avg  = sum(revenues) / len(revenues) if revenues else 0
    all_book = b_m2 + b_m1 + b_m0

    # Taux de remplissage (load factor)
    trips_90 = [t for t in trips if t.created_at and t.created_at >= d90]
    total_seats_offered = sum(t.seats_total or 0 for t in trips_90)
    total_seats_booked  = sum(t.seats_booked or 0 for t in trips_90)
    load_factor = round(total_seats_booked / total_seats_offered * 100, 1) if total_seats_offered > 0 else 0

    # RevPAS (Revenue Per Available Seat)
    revpas = round(sum(b.amount_paid or 0 for b in all_book) / total_seats_offered, 0) if total_seats_offered > 0 else 0

    # Annulations & no-shows
    all_book_90 = []
    if trip_ids:
        all_book_90 = db.query(VoyageBooking).filter(
            VoyageBooking.trip_id.in_(trip_ids),
            VoyageBooking.created_at >= d90,
        ).all()
    cancels   = sum(1 for b in all_book_90 if b.status == BookingStatus.CANCELLED)
    cancel_rate = round(cancels / len(all_book_90) * 100, 1) if all_book_90 else 0

    # Voyages annulés
    trips_cancelled = sum(1 for t in trips_90 if t.status == TripStatus.CANCELLED)
    trip_cancel_rate = round(trips_cancelled / len(trips_90) * 100, 1) if trips_90 else 0

    # Revenue par route
    routes = db.query(VoyageRoute).filter(VoyageRoute.company_id == company_id, VoyageRoute.is_active == True).all()
    route_revenue = {}
    for route in routes:
        route_trips = [t for t in trips if t.route_id == route.id]
        route_trip_ids = [t.id for t in route_trips]
        if route_trip_ids:
            route_book = db.query(VoyageBooking).filter(
                VoyageBooking.trip_id.in_(route_trip_ids),
                VoyageBooking.created_at >= d90,
                VoyageBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.BOARDED, BookingStatus.COMPLETED]),
            ).all()
            route_revenue[f"{route.origin}→{route.destination}"] = int(sum(b.amount_paid or 0 for b in route_book))

    # Parc véhicules
    vehicles = db.query(VoyageVehicle).filter(VoyageVehicle.company_id == company_id, VoyageVehicle.is_active == True).all()

    # MoM growth
    mom_growth = round((rev_m0 - rev_m1) / rev_m1 * 100, 1) if rev_m1 > 0 else (100.0 if rev_m0 > 0 else 0.0)

    # Score 0-100
    if len(revenues) >= 2:
        cv = _stats.stdev(revenues) / rev_avg if rev_avg else 1
        stab_score = max(0, 20 - round(cv * 40))
    else:
        stab_score = 8 if revenues else 0

    load_score   = min(25, round(load_factor / 70 * 25))
    growth_score = 20 if mom_growth >= 10 else (round(mom_growth / 10 * 15) + 5 if mom_growth >= 0 else max(0, round(10 + mom_growth)))
    rel_score    = max(0, round(20 - (cancel_rate + trip_cancel_rate) * 0.4))
    div_score    = min(15, len(routes) * 3)   # diversité des routes (max 5 routes = 15pts)
    score        = min(100, stab_score + load_score + growth_score + rel_score + div_score)

    if   score >= 80: score_label, score_color = "Excellent", "#22c55e"
    elif score >= 65: score_label, score_color = "Bon",       "#84cc16"
    elif score >= 50: score_label, score_color = "Correct",   "#f59e0b"
    elif score >= 35: score_label, score_color = "Faible",    "#f97316"
    else:             score_label, score_color = "Insuffisant","#ef4444"

    loan_offers = [
        {"type": "fleet",           "label": "Achat véhicule",           "icon": "🚌",
         "amount": int(round(rev_avg * 4   / 10000) * 10000), "rate": "2% / mois",   "duration": "24 mois",
         "eligible": score >= 65 and len(revenues) >= 3,
         "reason": "Profil transport solide" if score >= 65 and len(revenues) >= 3 else f"Score requis: 65 (actuel: {score})"},
        {"type": "maintenance",     "label": "Maintenance & réparations","icon": "🔧",
         "amount": int(round(rev_avg * 0.5 / 5000) * 5000),   "rate": "3% / mois",   "duration": "6 mois",
         "eligible": score >= 45,
         "reason": "Financement maintenance disponible" if score >= 45 else f"Score requis: 45 (actuel: {score})"},
        {"type": "working_capital", "label": "Trésorerie opérationnelle","icon": "💼",
         "amount": int(round(rev_avg * 0.8 / 5000) * 5000),   "rate": "3.5% / mois", "duration": "3 mois",
         "eligible": score >= 40 and len(revenues) >= 2,
         "reason": "Pont de trésorerie disponible" if score >= 40 else f"Score requis: 40 (actuel: {score})"},
    ]

    recs = []
    if load_factor < 50:
        recs.append(f"🚌 Taux de remplissage faible ({load_factor}%) — envisagez des promotions sur les trajets creux.")
    elif load_factor >= 85:
        recs.append(f"🔥 Taux de remplissage excellent ({load_factor}%) — ajoutez des départs supplémentaires !")
    if cancel_rate > 15:
        recs.append(f"⚠️ Taux d'annulation passagers élevé ({cancel_rate}%) — renforcez votre politique de confirmation.")
    if trip_cancel_rate > 10:
        recs.append(f"🚨 {trip_cancel_rate}% de voyages annulés — fiabilisez vos départs pour améliorer votre score.")
    if mom_growth > 10:
        recs.append(f"🚀 Croissance de {mom_growth}% ce mois — excellente dynamique commerciale !")
    if len(routes) < 3:
        recs.append("🗺️ Diversifiez vos routes pour réduire votre dépendance à une destination et améliorer votre score.")
    if not recs:
        recs.append("✅ Vos indicateurs transport sont stables. Maintenez la ponctualité et la qualité de service.")

    return {
        "period_days": 90,
        "has_sufficient_data": len(revenues) >= 1,
        "score": score, "score_label": score_label, "score_color": score_color,
        "score_breakdown": {
            "stability": stab_score, "load_factor": load_score,
            "growth": growth_score, "reliability": rel_score, "diversity": div_score,
        },
        "ratios": {
            "revenue_m0": int(rev_m0), "revenue_m1": int(rev_m1), "revenue_m2": int(rev_m2),
            "revenue_avg": int(rev_avg), "mom_growth": mom_growth,
            "load_factor": load_factor, "revpas": int(revpas),
            "total_bookings": len(all_book), "total_trips": len(trips_90),
            "total_seats_offered": total_seats_offered,
            "cancel_rate": cancel_rate, "trip_cancel_rate": trip_cancel_rate,
            "total_routes": len(routes), "total_vehicles": len(vehicles),
            "route_revenue": route_revenue,
        },
        "loan_offers": loan_offers,
        "recommendations": recs,
    }


# ─────────────────────────────────────────────────────────────
#  POSITIONS GPS VÉHICULES (mock pour développement)
# ─────────────────────────────────────────────────────────────

@router.get("/vehicles/positions")
def get_vehicle_positions(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.require_manager)
):
    """
    Retourne les positions GPS des véhicules en voyage actif.
    Pour le développement : positions mockées autour d'Abidjan.
    is_mock: true indique que les données sont simulées.

    Abidjan center: lat 5.3484, lng -4.0060
    """
    from .models_voyage import VoyageTrip, VoyageRoute, TripStatus, VoyageBooking, BookingStatus

    # Récupérer les trips actifs (BOARDING ou IN_PROGRESS)
    query = db.query(VoyageTrip).join(
        VoyageRoute, VoyageTrip.route_id == VoyageRoute.id
    ).filter(
        VoyageTrip.status.in_([TripStatus.BOARDING, TripStatus.IN_PROGRESS])
    )
    if company_id:
        query = query.filter(VoyageRoute.company_id == company_id)

    active_trips = query.all()

    positions = []
    # Centre Abidjan + points autour sur les axes principaux
    abidjan_routes = [
        # Axe Abidjan → Yamoussoukro (nord)
        [(5.3484, -4.0060), (5.8, -4.5), (6.5, -5.0), (6.8, -5.3)],
        # Axe Abidjan → Bouaké
        [(5.3484, -4.0060), (6.0, -4.2), (6.8, -4.5), (7.7, -5.0)],
        # Axe Abidjan → San-Pédro (ouest)
        [(5.3484, -4.0060), (5.1, -4.8), (4.9, -5.5), (4.7, -6.6)],
        # Axe Abidjan → Grand-Bassam (est)
        [(5.3484, -4.0060), (5.25, -3.7), (5.2, -3.5)],
    ]

    for i, trip in enumerate(active_trips):
        route = abidjan_routes[i % len(abidjan_routes)]
        # Simuler une progression sur la route selon l'heure
        progress = random.uniform(0.1, 0.9)
        route_idx = int(progress * (len(route) - 1))
        base_lat, base_lng = route[min(route_idx, len(route) - 1)]

        # Légère variation aléatoire (±0.01 degré ≈ ±1km)
        lat = base_lat + random.uniform(-0.01, 0.01)
        lng = base_lng + random.uniform(-0.01, 0.01)

        # Compter passagers (bookings confirmés pour ce trip)
        try:
            passengers_count = db.query(VoyageBooking).filter(
                VoyageBooking.trip_id == trip.id,
                VoyageBooking.status.in_([BookingStatus.CONFIRMED, BookingStatus.BOARDED])
            ).count()
        except Exception:
            passengers_count = random.randint(5, trip.seats_total or 30)

        origin      = trip.route.origin      if trip.route else "?"
        destination = trip.route.destination if trip.route else "?"
        plate       = trip.vehicle.plate     if trip.vehicle else f"VH-{trip.vehicle_id}"

        positions.append({
            "trip_id": trip.id,
            "vehicle_id": trip.vehicle_id,
            "vehicle_plate": plate,
            "route_name": f"{origin} → {destination}",
            "origin": origin,
            "destination": destination,
            "status": trip.status.value,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "speed_kmh": random.randint(60, 110) if trip.status == TripStatus.IN_PROGRESS else 0,
            "progress_pct": round(progress * 100, 1),
            "passengers_aboard": passengers_count,
            "total_seats": trip.seats_total or 30,
            "departure_time": trip.departure_at.isoformat() if trip.departure_at else None,
            "arrival_time": None,  # pas de champ arrival_time dans le modèle actuel
            "is_mock": True
        })

    # Si aucun trip actif, retourner quelques positions demo pour l'UI
    if not positions:
        demo_positions = [
            {
                "trip_id": -1,
                "vehicle_id": -1,
                "vehicle_plate": "CI-2024-A1",
                "route_name": "Abidjan → Yamoussoukro",
                "origin": "Abidjan",
                "destination": "Yamoussoukro",
                "status": "IN_PROGRESS",
                "lat": 5.8 + random.uniform(-0.05, 0.05),
                "lng": -4.5 + random.uniform(-0.05, 0.05),
                "speed_kmh": random.randint(70, 100),
                "progress_pct": round(random.uniform(20, 80), 1),
                "passengers_aboard": random.randint(10, 25),
                "total_seats": 30,
                "departure_time": None,
                "arrival_time": None,
                "is_mock": True
            },
            {
                "trip_id": -2,
                "vehicle_id": -2,
                "vehicle_plate": "CI-2024-B2",
                "route_name": "Abidjan → Grand-Bassam",
                "origin": "Abidjan",
                "destination": "Grand-Bassam",
                "status": "BOARDING",
                "lat": 5.25 + random.uniform(-0.02, 0.02),
                "lng": -3.7 + random.uniform(-0.02, 0.02),
                "speed_kmh": 0,
                "progress_pct": round(random.uniform(5, 25), 1),
                "passengers_aboard": random.randint(3, 15),
                "total_seats": 22,
                "departure_time": None,
                "arrival_time": None,
                "is_mock": True
            }
        ]
        positions = demo_positions

    return {"positions": positions, "count": len(positions), "is_mock": True}
