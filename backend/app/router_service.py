"""
SOKORA — Router Services Informels v2
Artisans, RDV, escrow wallet, QR release
"""
import secrets
import json
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from .database import get_db
from .models_service import (
    ServiceCategory, ServiceProvider, ServiceRequest,
    ServiceRequestStatus, ServicePaymentStatus
)
from .models import User, WalletAccount, WalletTransaction
from .security import get_current_user

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(math.sqrt(a))

router = APIRouter(prefix="/services", tags=["services"])

# ── Catégories par défaut ──────────────────────────────────────────────────────
DEFAULT_CATEGORIES = [
    ("Plomberie",             "🔧", "Fuites, tuyaux, sanitaires"),
    ("Électricité",           "⚡", "Installation, dépannage électrique"),
    ("Couture & Retouche",    "🪡", "Couture, retouche, création"),
    ("Coiffure à domicile",   "💇", "Coiffure, tresses, soins capillaires"),
    ("Baby-sitting",          "👶", "Garde d'enfants à domicile"),
    ("Coursier / Livraison",  "🛵", "Livraison express, courses"),
    ("Jardinage",             "🌿", "Entretien jardin, espaces verts"),
    ("Peinture",              "🎨", "Peinture bâtiment, décoration"),
    ("Informatique",          "💻", "Dépannage PC, réseaux, logiciels"),
    ("Nettoyage",             "🧹", "Ménage, nettoyage bureaux/maisons"),
    ("Mécanique auto",        "🔩", "Réparation, entretien véhicules"),
    ("Cuisine / Traiteur",    "🍽️", "Traiteur, cuisinière à domicile"),
    ("Lavage auto",           "🚗", "Lavage, nettoyage intérieur/extérieur"),
    ("Pressing",              "👔", "Nettoyage vêtements, repassage"),
]

# ─────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "🔧"
    description: Optional[str] = None

class ProviderCreate(BaseModel):
    name: str
    phone: str
    category_id: int
    city: Optional[str] = "Abidjan"
    neighborhood: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    price_unit: Optional[str] = "prestation"
    photo_url: Optional[str] = None
    latitude:  Optional[float] = None
    longitude: Optional[float] = None

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    price_unit: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None
    latitude:  Optional[float] = None
    longitude: Optional[float] = None

class RequestCreate(BaseModel):
    client_name: str
    client_phone: str
    provider_id: int
    description: Optional[str] = None
    address: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    agreed_price: Optional[float] = None
    payment_method: Optional[str] = "wallet"
    specialty_data: Optional[str] = None  # JSON string

class StatusUpdate(BaseModel):
    status: ServiceRequestStatus

class ReviewSubmit(BaseModel):
    rating_given: int
    review_text: Optional[str] = None

class PayRequest(BaseModel):
    request_id: int

class ScanRelease(BaseModel):
    qr_token: str


# ─────────────────────────────────────────
#  CATEGORIES
# ─────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    existing_names = {c.name for c in cats}
    added = False
    for name, icon, desc in DEFAULT_CATEGORIES:
        if name not in existing_names:
            db.add(ServiceCategory(name=name, icon=icon, description=desc))
            added = True
    if added:
        db.commit()
    cats = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    return [{"id": c.id, "name": c.name, "icon": c.icon, "description": c.description} for c in cats]

@router.post("/categories")
def create_category(body: CategoryCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    cat = ServiceCategory(**body.dict())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return {"id": cat.id, "name": cat.name, "icon": cat.icon}


# ─────────────────────────────────────────
#  PROVIDERS
# ─────────────────────────────────────────

@router.get("/providers")
def list_providers(
    category_id: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    verified: Optional[bool] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    client_lat: Optional[float] = Query(None),
    client_lng: Optional[float] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(ServiceProvider).filter(ServiceProvider.is_active == True)
    if category_id:
        q = q.filter(ServiceProvider.category_id == category_id)
    if city:
        q = q.filter(ServiceProvider.city.ilike(f"%{city}%"))
    if search:
        q = q.filter(
            ServiceProvider.name.ilike(f"%{search}%") |
            ServiceProvider.phone.ilike(f"%{search}%")
        )
    if verified is not None:
        q = q.filter(ServiceProvider.is_verified == verified)

    total = q.count()
    providers = q.order_by(desc(ServiceProvider.rating), desc(ServiceProvider.reviews_count))\
                 .offset(offset).limit(limit).all()

    if client_lat is not None and client_lng is not None:
        def dist(p):
            if p.latitude is not None and p.longitude is not None:
                return haversine(client_lat, client_lng, p.latitude, p.longitude)
            return float("inf")
        providers = sorted(providers, key=dist)
        return {
            "providers": [
                {**_fmt_provider(p), "distance_km": round(dist(p), 2) if p.latitude is not None and p.longitude is not None else None}
                for p in providers
            ],
            "total": total,
        }

    return {"providers": [_fmt_provider(p) for p in providers], "total": total}

@router.get("/providers/{provider_id}")
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    p = db.query(ServiceProvider).get(provider_id)
    if not p:
        raise HTTPException(404, "Prestataire introuvable")
    requests = db.query(ServiceRequest)\
                 .filter(ServiceRequest.provider_id == provider_id)\
                 .order_by(desc(ServiceRequest.created_at)).limit(10).all()
    return {**_fmt_provider(p), "recent_requests": [_fmt_request(r) for r in requests]}

@router.post("/providers")
def create_provider(body: ProviderCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    if not db.query(ServiceCategory).get(body.category_id):
        raise HTTPException(400, "Catégorie introuvable")
    p = ServiceProvider(**body.dict())
    db.add(p)
    db.commit()
    db.refresh(p)
    return _fmt_provider(p)

@router.put("/providers/{provider_id}")
def update_provider(provider_id: int, body: ProviderUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(ServiceProvider).get(provider_id)
    if not p:
        raise HTTPException(404, "Prestataire introuvable")
    for k, v in body.dict(exclude_none=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return _fmt_provider(p)

@router.delete("/providers/{provider_id}")
def delete_provider(provider_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    p = db.query(ServiceProvider).get(provider_id)
    if not p:
        raise HTTPException(404, "Prestataire introuvable")
    p.is_active = False
    db.commit()
    return {"ok": True}


# ─────────────────────────────────────────
#  SERVICE REQUESTS (CLIENT)
# ─────────────────────────────────────────

@router.get("/requests")
def list_requests(
    status: Optional[str] = Query(None),
    provider_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(ServiceRequest)
    if status:
        q = q.filter(ServiceRequest.status == status)
    if provider_id:
        q = q.filter(ServiceRequest.provider_id == provider_id)
    total = q.count()
    reqs = q.order_by(desc(ServiceRequest.created_at)).offset(offset).limit(limit).all()
    return {"requests": [_fmt_request(r) for r in reqs], "total": total}

@router.post("/requests")
def create_request(body: RequestCreate, db: Session = Depends(get_db)):
    p = db.query(ServiceProvider).get(body.provider_id)
    if not p or not p.is_active:
        raise HTTPException(404, "Prestataire introuvable ou inactif")
    req = ServiceRequest(**body.dict())
    db.add(req)
    db.commit()
    db.refresh(req)
    return _fmt_request(req)

@router.get("/requests/my")
def my_requests(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Demandes du client connecté"""
    reqs = db.query(ServiceRequest)\
             .filter(ServiceRequest.client_user_id == user.id)\
             .order_by(desc(ServiceRequest.created_at)).limit(50).all()
    return [_fmt_request(r) for r in reqs]

@router.put("/requests/{req_id}/status")
def update_request_status(req_id: int, body: StatusUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    req = db.query(ServiceRequest).get(req_id)
    if not req:
        raise HTTPException(404, "Demande introuvable")
    req.status = body.status
    db.commit()
    return _fmt_request(req)

# ── Paiement escrow ──────────────────────────────────────────────────────────

@router.post("/requests/{req_id}/pay")
def pay_request(req_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Client paie → fonds bloqués en escrow, QR token généré"""
    req = db.query(ServiceRequest).get(req_id)
    if not req:
        raise HTTPException(404, "Demande introuvable")
    if req.status != ServiceRequestStatus.CONFIRMED:
        raise HTTPException(400, "La demande doit être confirmée avant paiement")
    if req.payment_status == ServicePaymentStatus.ESCROWED:
        raise HTTPException(400, "Déjà payé")

    amount = req.agreed_price or 0
    if amount <= 0:
        raise HTTPException(400, "Montant invalide")

    # Vérifier wallet client (WalletAccount lié au ClientAccount)
    # On cherche d'abord via client_accounts puis wallet_accounts
    from .models import ClientAccount
    client_account = db.query(ClientAccount).filter(ClientAccount.phone == user.phone_number).first()
    wallet = db.query(WalletAccount).filter(WalletAccount.client_id == client_account.id).first() if client_account else None
    if not wallet or wallet.balance < amount:
        raise HTTPException(400, "Solde insuffisant")

    # Débiter client
    balance_before = wallet.balance
    wallet.balance -= amount
    wallet.total_loaded = wallet.total_loaded  # inchangé

    # Générer QR token
    qr_token = secrets.token_urlsafe(32)
    req.payment_status   = ServicePaymentStatus.ESCROWED
    req.escrow_amount    = amount
    req.qr_release_token = qr_token
    req.status           = ServiceRequestStatus.PAID
    req.client_user_id   = user.id

    # Transaction wallet
    provider_name = req.provider.name if req.provider else f"#{req.provider_id}"
    tx = WalletTransaction(
        wallet_id=wallet.id,
        tx_type="service_escrow",
        amount=-amount,
        balance_before=balance_before,
        balance_after=wallet.balance,
        description=f"Escrow service #{req_id} — {provider_name}",
    )
    db.add(tx)
    db.commit()

    return {
        "ok": True,
        "qr_release_token": qr_token,
        "escrow_amount": amount,
        "message": "Paiement sécurisé. Présentez ce QR à l'artisan après la prestation."
    }

# ── Scan QR par artisan → libère les fonds ───────────────────────────────────

class LocationUpdate(BaseModel):
    latitude: float
    longitude: float

@router.put("/artisan/location")
def update_artisan_location(
    body: LocationUpdate,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        raise HTTPException(404, "Profil artisan introuvable")
    provider.latitude  = body.latitude
    provider.longitude = body.longitude
    db.commit()
    return {"ok": True, "latitude": body.latitude, "longitude": body.longitude}

@router.post("/artisan/scan-release")
def scan_release(body: ScanRelease, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Artisan scanne le QR du client → fonds libérés dans son wallet"""
    req = db.query(ServiceRequest)\
            .filter(ServiceRequest.qr_release_token == body.qr_token).first()
    if not req:
        raise HTTPException(404, "QR invalide ou expiré")
    if req.payment_status != ServicePaymentStatus.ESCROWED:
        raise HTTPException(400, "Fonds déjà libérés ou non disponibles")

    # Trouver le provider lié à cet artisan
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider or provider.id != req.provider_id:
        raise HTTPException(403, "Vous n'êtes pas le prestataire de cette demande")

    amount = req.escrow_amount or 0

    # Créditer wallet artisan (wallet_balance interne au ServiceProvider)
    provider.wallet_balance += amount
    provider.total_earned   += amount

    # Wallet WalletAccount de l'artisan (si lié à un ClientAccount)
    from .models import ClientAccount
    artisan_client = db.query(ClientAccount).filter(ClientAccount.phone == user.phone_number).first()
    artisan_wallet = db.query(WalletAccount).filter(WalletAccount.client_id == artisan_client.id).first() if artisan_client else None
    if artisan_wallet:
        balance_before = artisan_wallet.balance
        artisan_wallet.balance += amount
        tx = WalletTransaction(
            wallet_id=artisan_wallet.id,
            tx_type="service_release",
            amount=amount,
            balance_before=balance_before,
            balance_after=artisan_wallet.balance,
            description=f"Paiement service #{req.id} — {req.client_name}",
        )
        db.add(tx)

    # Mettre à jour statut
    req.payment_status = ServicePaymentStatus.RELEASED
    req.status         = ServiceRequestStatus.COMPLETED
    req.qr_release_token = None  # invalider le QR

    db.commit()

    # Points fidélité client
    try:
        from . import models as main_models
        client_account = db.query(main_models.ClientAccount).filter(
            main_models.ClientAccount.phone == req.client_phone
        ).first()
        if client_account:
            points = int((req.escrow_amount or 0) / 500)
            if points > 0:
                client_account.total_points = (client_account.total_points or 0) + points
                client_account.total_spent = (client_account.total_spent or 0) + (req.escrow_amount or 0)
                db.commit()
    except Exception:
        pass

    return {
        "ok": True,
        "amount_received": amount,
        "client_name": req.client_name,
        "message": f"{amount:,.0f} FCFA crédités dans votre wallet !"
    }

# ─────────────────────────────────────────
#  ARTISAN — Endpoints dédiés
# ─────────────────────────────────────────

@router.get("/artisan/me")
def artisan_me(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Profil du prestataire connecté"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        raise HTTPException(404, "Profil artisan introuvable")
    return _fmt_provider(provider)

@router.get("/artisan/appointments")
def artisan_appointments(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """RDV de l'artisan connecté"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        raise HTTPException(404, "Profil artisan introuvable")

    q = db.query(ServiceRequest).filter(ServiceRequest.provider_id == provider.id)
    if status:
        q = q.filter(ServiceRequest.status == status)
    reqs = q.order_by(desc(ServiceRequest.created_at)).limit(50).all()
    return [_fmt_request(r) for r in reqs]

@router.put("/artisan/requests/{req_id}/accept")
def artisan_accept(req_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Artisan accepte un RDV"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    req = db.query(ServiceRequest).get(req_id)
    if not req or not provider or req.provider_id != provider.id:
        raise HTTPException(403, "Non autorisé")
    if req.status != ServiceRequestStatus.PENDING_VALIDATION:
        raise HTTPException(400, "Statut invalide pour cette action")
    req.status = ServiceRequestStatus.CONFIRMED
    db.commit()
    return _fmt_request(req)

@router.put("/artisan/requests/{req_id}/reject")
def artisan_reject(req_id: int, db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Artisan refuse un RDV"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    req = db.query(ServiceRequest).get(req_id)
    if not req or not provider or req.provider_id != provider.id:
        raise HTTPException(403, "Non autorisé")
    req.status = ServiceRequestStatus.REJECTED
    db.commit()
    return _fmt_request(req)

@router.get("/artisan/transactions")
def get_artisan_transactions(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """Historique des transactions de l'artisan connecté."""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        raise HTTPException(404, "Profil artisan introuvable")

    requests = db.query(ServiceRequest)\
        .filter(ServiceRequest.provider_id == provider.id)\
        .order_by(desc(ServiceRequest.updated_at))\
        .limit(50).all()

    return [_fmt_request(r) for r in requests]

@router.get("/artisan/dashboard")
def artisan_dashboard(db: Session = Depends(get_db), user=Depends(get_current_user)):
    """Dashboard statistiques artisan"""
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == user.id).first()
    if not provider:
        raise HTTPException(404, "Profil artisan introuvable")

    reqs = db.query(ServiceRequest).filter(ServiceRequest.provider_id == provider.id).all()
    status_counts = {}
    for s in ServiceRequestStatus:
        status_counts[s.value] = sum(1 for r in reqs if r.status == s)

    completed = [r for r in reqs if r.status == ServiceRequestStatus.COMPLETED]
    rated = [r for r in completed if r.rating_given]
    avg_rating = round(sum(r.rating_given for r in rated) / max(len(rated), 1), 1)

    return {
        "provider": _fmt_provider(provider),
        "total_requests":   len(reqs),
        "status_counts":    status_counts,
        "total_earned":     provider.total_earned,
        "wallet_balance":   provider.wallet_balance,
        "avg_rating":       avg_rating,
        "reviews_count":    provider.reviews_count,
        "pending_count":    status_counts.get("PENDING_VALIDATION", 0),
    }

# ── Avis ─────────────────────────────────────────────────────────────────────

@router.post("/requests/{req_id}/review")
def submit_review(req_id: int, body: ReviewSubmit, db: Session = Depends(get_db)):
    req = db.query(ServiceRequest).get(req_id)
    if not req:
        raise HTTPException(404, "Demande introuvable")
    if req.status != ServiceRequestStatus.COMPLETED:
        raise HTTPException(400, "Impossible de noter une prestation non complétée")
    if not (1 <= body.rating_given <= 5):
        raise HTTPException(400, "Note doit être entre 1 et 5")

    req.rating_given = body.rating_given
    req.review_text  = body.review_text

    p = db.query(ServiceProvider).get(req.provider_id)
    if p:
        total = p.rating * p.reviews_count + body.rating_given
        p.reviews_count += 1
        p.rating = round(total / p.reviews_count, 2)

    db.commit()
    return {"ok": True, "provider_rating": p.rating if p else None}

# ── Dashboard admin ───────────────────────────────────────────────────────────

@router.get("/dashboard")
def service_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    total_providers    = db.query(ServiceProvider).filter(ServiceProvider.is_active == True).count()
    verified_providers = db.query(ServiceProvider).filter(ServiceProvider.is_active == True, ServiceProvider.is_verified == True).count()

    status_counts = {}
    for s in ServiceRequestStatus:
        status_counts[s.value] = db.query(ServiceRequest).filter(ServiceRequest.status == s).count()

    cats = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    by_category = []
    for c in cats:
        cnt = db.query(ServiceProvider).filter(ServiceProvider.category_id == c.id, ServiceProvider.is_active == True).count()
        by_category.append({"category": c.name, "icon": c.icon, "count": cnt})

    top_providers = db.query(ServiceProvider)\
        .filter(ServiceProvider.is_active == True)\
        .order_by(desc(ServiceProvider.rating)).limit(5).all()

    return {
        "total_providers":    total_providers,
        "verified_providers": verified_providers,
        "total_requests":     sum(status_counts.values()),
        "status_counts":      status_counts,
        "by_category":        sorted(by_category, key=lambda x: x["count"], reverse=True),
        "top_providers":      [_fmt_provider(p) for p in top_providers],
    }


# ─────────────────────────────────────────
#  HELPERS
# ─────────────────────────────────────────

def _fmt_provider(p: ServiceProvider) -> dict:
    return {
        "id":            p.id,
        "name":          p.name,
        "phone":         p.phone,
        "user_id":       p.user_id,
        "category_id":   p.category_id,
        "category_name": p.category.name if p.category else None,
        "category_icon": p.category.icon if p.category else None,
        "city":          p.city,
        "neighborhood":  p.neighborhood,
        "description":   p.description,
        "base_price":    p.base_price,
        "price_unit":    p.price_unit,
        "rating":        p.rating,
        "reviews_count": p.reviews_count,
        "is_verified":   p.is_verified,
        "photo_url":     p.photo_url,
        "latitude":      p.latitude,
        "longitude":     p.longitude,
        "wallet_balance": p.wallet_balance,
        "total_earned":  p.total_earned,
        "created_at":    p.created_at.isoformat() if p.created_at else None,
    }

def _fmt_request(r: ServiceRequest) -> dict:
    return {
        "id":               r.id,
        "client_name":      r.client_name,
        "client_phone":     r.client_phone,
        "client_user_id":   r.client_user_id,
        "provider_id":      r.provider_id,
        "provider_name":    r.provider.name if r.provider else None,
        "provider_phone":   r.provider.phone if r.provider else None,
        "provider_category": r.provider.category.name if r.provider and r.provider.category else None,
        "description":      r.description,
        "address":          r.address,
        "scheduled_at":     r.scheduled_at.isoformat() if r.scheduled_at else None,
        "specialty_data":   r.specialty_data,
        "status":           r.status.value if r.status else None,
        "payment_status":   r.payment_status.value if r.payment_status else None,
        "agreed_price":     r.agreed_price,
        "payment_method":   r.payment_method,
        "escrow_amount":    r.escrow_amount,
        "has_qr":           bool(r.qr_release_token),
        "qr_release_token": r.qr_release_token,
        "rating_given":     r.rating_given,
        "review_text":      r.review_text,
        "created_at":       r.created_at.isoformat() if r.created_at else None,
    }
