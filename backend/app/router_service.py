"""
SOKORA — Router Petits Services Informels
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

from .database import get_db
from .models_service import ServiceCategory, ServiceProvider, ServiceRequest, ServiceRequestStatus
from .security import get_current_user

router = APIRouter(prefix="/services", tags=["services"])


# ─────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────

class CategoryCreate(BaseModel):
    name:        str
    icon:        Optional[str] = "🔧"
    description: Optional[str] = None

class ProviderCreate(BaseModel):
    name:         str
    phone:        str
    category_id:  int
    city:         Optional[str] = "Abidjan"
    neighborhood: Optional[str] = None
    description:  Optional[str] = None
    base_price:   Optional[float] = None
    price_unit:   Optional[str]  = "prestation"
    photo_url:    Optional[str]  = None

class ProviderUpdate(BaseModel):
    name:         Optional[str]   = None
    phone:        Optional[str]   = None
    description:  Optional[str]   = None
    base_price:   Optional[float] = None
    is_active:    Optional[bool]  = None
    is_verified:  Optional[bool]  = None

class RequestCreate(BaseModel):
    client_name:  str
    client_phone: str
    provider_id:  int
    description:  Optional[str]  = None
    address:      Optional[str]  = None
    scheduled_at: Optional[datetime] = None
    agreed_price: Optional[float]    = None
    payment_method: Optional[str]    = "cash"

class StatusUpdate(BaseModel):
    status: ServiceRequestStatus

class ReviewSubmit(BaseModel):
    rating_given: int   # 1-5
    review_text:  Optional[str] = None


# ─────────────────────────────────────────
#  CATEGORIES
# ─────────────────────────────────────────

@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    if not cats:
        # Seed default categories on first call
        defaults = [
            ("Plomberie",         "🔧"),
            ("Électricité",       "⚡"),
            ("Couture & Retouche","🪡"),
            ("Coiffure à domicile","💇"),
            ("Baby-sitting",      "👶"),
            ("Coursier / Livraison","🛵"),
            ("Jardinage",         "🌿"),
            ("Peinture",          "🎨"),
            ("Informatique",      "💻"),
            ("Nettoyage",         "🧹"),
            ("Mécanique auto",    "🔩"),
            ("Cuisine / Traiteur","🍽️"),
        ]
        for name, icon in defaults:
            db.add(ServiceCategory(name=name, icon=icon))
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
    category_id: Optional[int]  = Query(None),
    city:        Optional[str]  = Query(None),
    search:      Optional[str]  = Query(None),
    verified:    Optional[bool] = Query(None),
    limit:       int = Query(50, ge=1, le=200),
    offset:      int = Query(0, ge=0),
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

    return {
        "providers": [_fmt_provider(p) for p in providers],
        "total": total,
    }

@router.get("/providers/{provider_id}")
def get_provider(provider_id: int, db: Session = Depends(get_db)):
    p = db.query(ServiceProvider).get(provider_id)
    if not p:
        raise HTTPException(404, "Prestataire introuvable")
    requests = db.query(ServiceRequest)\
                 .filter(ServiceRequest.provider_id == provider_id)\
                 .order_by(desc(ServiceRequest.created_at)).limit(10).all()
    return {
        **_fmt_provider(p),
        "recent_requests": [_fmt_request(r) for r in requests],
    }

@router.post("/providers")
def create_provider(body: ProviderCreate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    # Check category exists
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
#  SERVICE REQUESTS
# ─────────────────────────────────────────

@router.get("/requests")
def list_requests(
    status:      Optional[str] = Query(None),
    provider_id: Optional[int] = Query(None),
    limit:       int = Query(50, ge=1, le=200),
    offset:      int = Query(0, ge=0),
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

@router.put("/requests/{req_id}/status")
def update_request_status(req_id: int, body: StatusUpdate, db: Session = Depends(get_db), _=Depends(get_current_user)):
    req = db.query(ServiceRequest).get(req_id)
    if not req:
        raise HTTPException(404, "Demande introuvable")
    req.status = body.status
    db.commit()
    return _fmt_request(req)

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

    # Update provider average rating
    p = db.query(ServiceProvider).get(req.provider_id)
    if p:
        total_rating = p.rating * p.reviews_count + body.rating_given
        p.reviews_count += 1
        p.rating = round(total_rating / p.reviews_count, 2)

    db.commit()
    return {"ok": True, "provider_rating": p.rating if p else None}


# ─────────────────────────────────────────
#  DASHBOARD STATS
# ─────────────────────────────────────────

@router.get("/dashboard")
def service_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    total_providers = db.query(ServiceProvider).filter(ServiceProvider.is_active == True).count()
    verified_providers = db.query(ServiceProvider).filter(
        ServiceProvider.is_active == True,
        ServiceProvider.is_verified == True,
    ).count()

    status_counts = {}
    for s in ServiceRequestStatus:
        cnt = db.query(ServiceRequest).filter(ServiceRequest.status == s).count()
        status_counts[s.value] = cnt

    by_category = []
    cats = db.query(ServiceCategory).filter(ServiceCategory.is_active == True).all()
    for c in cats:
        cnt = db.query(ServiceProvider).filter(
            ServiceProvider.category_id == c.id,
            ServiceProvider.is_active == True,
        ).count()
        by_category.append({"category": c.name, "icon": c.icon, "count": cnt})

    top_providers = db.query(ServiceProvider)\
        .filter(ServiceProvider.is_active == True)\
        .order_by(desc(ServiceProvider.rating))\
        .limit(5).all()

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
        "id":           p.id,
        "name":         p.name,
        "phone":        p.phone,
        "category_id":  p.category_id,
        "category_name": p.category.name  if p.category else None,
        "category_icon": p.category.icon  if p.category else None,
        "city":         p.city,
        "neighborhood": p.neighborhood,
        "description":  p.description,
        "base_price":   p.base_price,
        "price_unit":   p.price_unit,
        "rating":       p.rating,
        "reviews_count": p.reviews_count,
        "is_verified":  p.is_verified,
        "photo_url":    p.photo_url,
        "created_at":   p.created_at.isoformat() if p.created_at else None,
    }

def _fmt_request(r: ServiceRequest) -> dict:
    return {
        "id":            r.id,
        "client_name":   r.client_name,
        "client_phone":  r.client_phone,
        "provider_id":   r.provider_id,
        "provider_name": r.provider.name  if r.provider else None,
        "description":   r.description,
        "address":       r.address,
        "scheduled_at":  r.scheduled_at.isoformat() if r.scheduled_at else None,
        "status":        r.status.value if r.status else None,
        "agreed_price":  r.agreed_price,
        "payment_method": r.payment_method,
        "rating_given":  r.rating_given,
        "review_text":   r.review_text,
        "created_at":    r.created_at.isoformat() if r.created_at else None,
    }
