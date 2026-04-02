"""
SOKORA Bar — Router FastAPI
Endpoints : Venues, Événements, Tables VIP, Billets, Commandes
"""
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, func

from .database import get_db
from . import security, models, crud
from .models_bar import (
    BarVenue, BarEvent, BarTable, BarTableReservation,
    BarTicket, BarOrder, BarOrderItem,
    BarTableStatus, EventStatus, BarOrderStatus
)
import hashlib, hmac, time

router = APIRouter(prefix="/bar", tags=["bar"])
BAR_QR_SECRET = "sokora_bar_ticket_2025"


def _get_client(request: Request, db: Session):
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token client requis")
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token invalide")
    return client


# ── VENUES ────────────────────────────────────────────

@router.get("/venues")
def list_venues(db: Session = Depends(get_db)):
    """Liste des bars/boîtes actifs (public)."""
    venues = list(db.scalars(select(BarVenue).where(BarVenue.is_active == True)))
    return [_fmt_venue(v) for v in venues]


@router.get("/venues/{venue_id}")
def get_venue(venue_id: int, db: Session = Depends(get_db)):
    v = db.get(BarVenue, venue_id)
    if not v:
        raise HTTPException(404, "Venue introuvable")
    return _fmt_venue(v)


@router.post("/venues")
def create_venue(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    venue = BarVenue(**data)
    db.add(venue); db.commit(); db.refresh(venue)
    return _fmt_venue(venue)


def _fmt_venue(v: BarVenue) -> dict:
    return {
        "id": v.id, "name": v.name, "address": v.address,
        "phone": v.phone, "cover_charge": v.cover_charge,
        "vip_price": v.vip_price, "capacity": v.capacity,
        "logo_url": v.logo_url, "description": v.description,
    }


# ── ÉVÉNEMENTS ────────────────────────────────────────

@router.get("/events")
def list_events(upcoming_only: bool = True, db: Session = Depends(get_db)):
    """Événements à venir (public)."""
    q = select(BarEvent).options(joinedload(BarEvent.venue))
    if upcoming_only:
        q = q.where(BarEvent.status.in_([EventStatus.UPCOMING, EventStatus.LIVE]))
    q = q.order_by(BarEvent.event_date.asc())
    events = list(db.scalars(q))
    return [_fmt_event(e) for e in events]


@router.post("/events")
def create_event(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    event_data = dict(data)
    if "event_date" in event_data:
        event_data["event_date"] = datetime.fromisoformat(event_data["event_date"])
    event = BarEvent(**event_data)
    db.add(event); db.commit(); db.refresh(event)
    return _fmt_event(event)


@router.put("/events/{event_id}/status")
def update_event_status(
    event_id: int, data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    event = db.get(BarEvent, event_id)
    if not event:
        raise HTTPException(404, "Événement introuvable")
    event.status = EventStatus(data["status"].upper())
    db.commit()
    return {"ok": True}


def _fmt_event(e: BarEvent) -> dict:
    return {
        "id": e.id, "venue_id": e.venue_id,
        "venue_name": e.venue.name if e.venue else None,
        "name": e.name, "description": e.description,
        "dj_name": e.dj_name, "poster_url": e.poster_url,
        "event_date": e.event_date.isoformat() if e.event_date else None,
        "entry_price": e.entry_price, "vip_price": e.vip_price,
        "capacity": e.capacity, "tickets_sold": e.tickets_sold,
        "status": e.status.value,
        "tickets_left": max(0, e.capacity - e.tickets_sold),
    }


# ── BILLETS ───────────────────────────────────────────

@router.post("/tickets")
def buy_ticket(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Acheter un billet (débite le wallet).
    data: { event_id, ticket_type: 'standard'|'vip' }
    """
    client = _get_client(request, db)
    event = db.get(BarEvent, data.get("event_id"))
    if not event:
        raise HTTPException(404, "Événement introuvable")
    if event.status == EventStatus.ENDED or event.status == EventStatus.CANCELLED:
        raise HTTPException(400, "Événement terminé ou annulé")
    if event.tickets_sold >= event.capacity:
        raise HTTPException(400, "Événement complet")

    ttype = data.get("ticket_type", "standard")
    price = event.vip_price if ttype == "vip" else event.entry_price

    # Débiter wallet
    wallet = db.scalar(select(models.WalletAccount).where(models.WalletAccount.client_id == client.id))
    if not wallet:
        raise HTTPException(400, "Wallet introuvable")
    if wallet.balance < price:
        raise HTTPException(400, f"Solde insuffisant ({wallet.balance:.0f} FCFA requis: {price:.0f})")

    balance_before = wallet.balance
    wallet.balance -= price

    tx = models.WalletTransaction(
        wallet_id=wallet.id, tx_type="payment",
        amount=price, balance_before=balance_before,
        balance_after=wallet.balance,
        description=f"Billet {ttype} — {event.name}",
        service_type="bar",
    )
    db.add(tx); db.flush()

    # QR token
    payload = f"ticket:{client.id}:{event.id}:{ttype}:{int(time.time())}"
    sig = hmac.new(BAR_QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:16]
    qr_token = f"{payload}:{sig}"

    ticket = BarTicket(
        event_id=event.id, client_id=client.id,
        ticket_type=ttype, price=price,
        qr_token=qr_token, wallet_tx_id=tx.id,
    )
    db.add(ticket)
    event.tickets_sold += 1
    db.commit(); db.refresh(ticket)

    return {
        "id": ticket.id, "event_name": event.name,
        "ticket_type": ttype, "price": price,
        "qr_token": qr_token,
        "event_date": event.event_date.isoformat(),
        "venue_name": event.venue.name if event.venue else None,
    }


@router.post("/tickets/scan")
def scan_ticket(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Scan billet à l'entrée."""
    qr = data.get("qr_token", "")
    ticket = db.scalar(select(BarTicket).where(BarTicket.qr_token == qr))
    if not ticket:
        raise HTTPException(400, "Billet invalide")
    if ticket.is_used:
        raise HTTPException(400, "Billet déjà utilisé")
    ticket.is_used = True
    ticket.used_at = datetime.now(timezone.utc)
    db.commit()
    event = db.get(BarEvent, ticket.event_id)
    return {
        "ok": True,
        "ticket_type": ticket.ticket_type,
        "event_name": event.name if event else "—",
        "client_id": ticket.client_id,
    }


@router.get("/tickets/me")
def my_tickets(request: Request, db: Session = Depends(get_db)):
    """Mes billets (client connecté)."""
    client = _get_client(request, db)
    tickets = list(db.scalars(
        select(BarTicket)
        .options(joinedload(BarTicket.event).joinedload(BarEvent.venue))
        .where(BarTicket.client_id == client.id)
        .order_by(BarTicket.created_at.desc())
    ))
    return [
        {
            "id": t.id,
            "event_name": t.event.name if t.event else "—",
            "venue_name": t.event.venue.name if t.event and t.event.venue else "—",
            "event_date": t.event.event_date.isoformat() if t.event else None,
            "ticket_type": t.ticket_type,
            "price": t.price,
            "qr_token": t.qr_token if not t.is_used else None,
            "is_used": t.is_used,
        }
        for t in tickets
    ]


# ── TABLES VIP ────────────────────────────────────────

@router.get("/venues/{venue_id}/tables")
def list_tables(venue_id: int, db: Session = Depends(get_db)):
    tables = list(db.scalars(
        select(BarTable).where(BarTable.venue_id == venue_id, BarTable.is_active == True)
    ))
    return [
        {
            "id": t.id, "number": t.number, "zone": t.zone,
            "capacity": t.capacity, "min_conso": t.min_conso,
            "status": t.status.value,
        }
        for t in tables
    ]


@router.post("/tables/reserve")
def reserve_table(
    data: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """Réserver une table VIP (débite wallet si min_conso > 0)."""
    client = _get_client(request, db)
    table = db.get(BarTable, data.get("table_id"))
    if not table or table.status != BarTableStatus.FREE:
        raise HTTPException(400, "Table non disponible")

    amount = data.get("amount_paid", table.min_conso)
    wallet_tx_id = None

    if amount > 0:
        wallet = db.scalar(select(models.WalletAccount).where(models.WalletAccount.client_id == client.id))
        if not wallet or wallet.balance < amount:
            raise HTTPException(400, "Solde insuffisant")
        bal = wallet.balance
        wallet.balance -= amount
        tx = models.WalletTransaction(
            wallet_id=wallet.id, tx_type="payment",
            amount=amount, balance_before=bal,
            balance_after=wallet.balance,
            description=f"Réservation table {table.number}",
            service_type="bar",
        )
        db.add(tx); db.flush()
        wallet_tx_id = tx.id

    resa = BarTableReservation(
        table_id=table.id,
        event_id=data.get("event_id"),
        client_id=client.id,
        client_name=data.get("client_name"),
        client_phone=data.get("client_phone"),
        guests_count=data.get("guests_count", 1),
        amount_paid=amount,
        wallet_tx_id=wallet_tx_id,
        notes=data.get("notes"),
    )
    db.add(resa)
    table.status = BarTableStatus.RESERVED
    db.commit()
    return {"ok": True, "reservation_id": resa.id, "table": table.number}


# ── DASHBOARD BAR ─────────────────────────────────────

@router.get("/venues/{venue_id}/dashboard")
def bar_dashboard(
    venue_id: int,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    nb_events = db.scalar(select(func.count(BarEvent.id)).where(
        BarEvent.venue_id == venue_id,
        BarEvent.status.in_([EventStatus.UPCOMING, EventStatus.LIVE])
    )) or 0

    tickets_today = db.scalar(select(func.count(BarTicket.id)).join(BarEvent).where(
        BarEvent.venue_id == venue_id,
        BarTicket.created_at >= today,
    )) or 0

    ca_today = db.scalar(
        select(func.coalesce(func.sum(BarTicket.price), 0)).join(BarEvent).where(
            BarEvent.venue_id == venue_id,
            BarTicket.created_at >= today,
        )
    ) or 0

    tables_free = db.scalar(select(func.count(BarTable.id)).where(
        BarTable.venue_id == venue_id,
        BarTable.status == BarTableStatus.FREE,
        BarTable.is_active == True,
    )) or 0

    return {
        "nb_events":     nb_events,
        "tickets_today": tickets_today,
        "ca_today":      ca_today,
        "tables_free":   tables_free,
    }
