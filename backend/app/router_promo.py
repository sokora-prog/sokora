"""
SOKORA PULSE — Router FastAPI
Endpoints : Posts, Réactions, Commentaires, Établissements, Codes Marchand, Conciergerie
"""
import secrets, string
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_, or_, desc

from .database import get_db
from . import security, models, crud
from .models_promo import (
    PromoPost, PromoReaction, PromoComment,
    MerchantPaymentCode, ClientProfile
)
from .models import Establishment  # Table principale partagée

router = APIRouter(prefix="/promo", tags=["pulse"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_client_phone(request: Request) -> str:
    """Récupère l'identifiant client (token ou phone header)"""
    token = request.headers.get("X-Client-Token", "")
    if token:
        return token  # Simplification — en prod vérifier avec crud
    return request.headers.get("X-Phone", "anonymous")


def _format_post(post: PromoPost, client_phone: str = None, db: Session = None) -> dict:
    """Formate un post pour la réponse API"""
    user_reaction = None
    if client_phone and db:
        reaction = db.scalar(
            select(PromoReaction.reaction_key).where(
                and_(PromoReaction.post_id == post.id,
                     PromoReaction.client_phone == client_phone)
            )
        )
        user_reaction = reaction

    # Calcul time_ago
    now = datetime.now(timezone.utc)
    diff = now - (post.created_at if post.created_at.tzinfo else post.created_at.replace(tzinfo=timezone.utc))
    if diff.seconds < 60:
        time_ago = "à l'instant"
    elif diff.seconds < 3600:
        time_ago = f"{diff.seconds // 60}min"
    elif diff.days == 0:
        time_ago = f"{diff.seconds // 3600}h"
    else:
        time_ago = f"{diff.days}j"

    return {
        "id": str(post.id),
        "establishment": {
            "id":         post.establishment_id,
            "name":       post.establishment_name,
            "type":       post.establishment_type,
            "city":       post.establishment_city,
            "isVerified": post.is_verified_estab,
        },
        "content":         post.content,
        "postType":        post.post_type,
        "discount":        post.discount,
        "event_date":      post.event_date,
        "reactions": {
            "fire":         post.react_fire,
            "heart":        post.react_heart,
            "clap":         post.react_clap,
            "wow":          post.react_wow,
            "go":           post.react_go,
            "userReaction": user_reaction,
        },
        "comments_count": post.comments_count,
        "shares_count":   post.shares_count,
        "views_count":    post.views_count,
        "time_ago":       time_ago,
        "is_sponsored":   post.is_sponsored,
        "has_booking":    True,
        "created_at":     post.created_at.isoformat(),
    }


def _generate_payment_code(length: int = 8) -> str:
    """Génère un code alphanumérique unique"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


# ══════════════════════════════════════════════════════════════════════════════
# POSTS — SOKORA PULSE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/posts")
def list_posts(
    category:  Optional[str] = None,   # all, promo, event, new, info
    city:      Optional[str] = None,
    estab_type:Optional[str] = None,
    sponsored: Optional[bool] = None,
    limit:     int = 20,
    offset:    int = 0,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Liste les posts du feed SOKORA PULSE"""
    client_phone = _get_client_phone(request) if request else "anonymous"

    q = select(PromoPost).where(PromoPost.is_active == True)

    if category and category != "all":
        q = q.where(PromoPost.post_type == category)
    if city:
        q = q.where(PromoPost.establishment_city.ilike(f"%{city}%"))
    if estab_type:
        q = q.where(PromoPost.establishment_type == estab_type)
    if sponsored is not None:
        q = q.where(PromoPost.is_sponsored == sponsored)

    # Tri : sponsorisés en premier, puis par date
    q = q.order_by(desc(PromoPost.is_sponsored), desc(PromoPost.created_at))
    q = q.offset(offset).limit(limit)

    posts = list(db.scalars(q))
    return [_format_post(p, client_phone, db) for p in posts]


@router.get("/posts/{post_id}")
def get_post(post_id: int, request: Request, db: Session = Depends(get_db)):
    """Détail d'un post"""
    post = db.get(PromoPost, post_id)
    if not post or not post.is_active:
        raise HTTPException(404, "Post introuvable")

    # Incrémenter les vues
    post.views_count += 1
    db.commit()

    client_phone = _get_client_phone(request)
    return _format_post(post, client_phone, db)


@router.post("/posts")
def create_post(
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(security.get_current_user)
):
    """Créer un nouveau post (admin établissement ou super_admin)"""
    post = PromoPost(
        establishment_id   = payload.get("establishment_id"),
        establishment_name = payload.get("establishment_name", "SOKORA"),
        establishment_type = payload.get("establishment_type", "restaurant"),
        establishment_city = payload.get("establishment_city"),
        content            = payload.get("content", ""),
        post_type          = payload.get("post_type", "info"),
        discount           = payload.get("discount"),
        event_date         = payload.get("event_date"),
        is_sponsored       = payload.get("is_sponsored", False),
        is_verified_estab  = payload.get("is_verified_estab", False),
        media_urls         = payload.get("media_urls", []),
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return _format_post(post)


# ── Réactions ─────────────────────────────────────────────────────────────────

@router.post("/posts/{post_id}/react")
def react_to_post(
    post_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """Ajouter ou retirer une réaction sur un post (toggle)"""
    client_phone = _get_client_phone(request)
    reaction_key = payload.get("reaction_key")

    if reaction_key not in ("fire", "heart", "clap", "wow", "go"):
        raise HTTPException(400, "Réaction invalide")

    post = db.get(PromoPost, post_id)
    if not post:
        raise HTTPException(404, "Post introuvable")

    # Chercher réaction existante
    existing = db.scalar(
        select(PromoReaction).where(
            and_(PromoReaction.post_id == post_id,
                 PromoReaction.client_phone == client_phone)
        )
    )

    if existing:
        if existing.reaction_key == reaction_key:
            # Toggle OFF
            setattr(post, f"react_{existing.reaction_key}",
                    max(0, getattr(post, f"react_{existing.reaction_key}") - 1))
            db.delete(existing)
            db.commit()
            return {"action": "removed", "reaction": reaction_key}
        else:
            # Changer de réaction
            setattr(post, f"react_{existing.reaction_key}",
                    max(0, getattr(post, f"react_{existing.reaction_key}") - 1))
            existing.reaction_key = reaction_key
            setattr(post, f"react_{reaction_key}", getattr(post, f"react_{reaction_key}") + 1)
            db.commit()
            return {"action": "changed", "reaction": reaction_key}
    else:
        # Nouvelle réaction
        new_reaction = PromoReaction(
            post_id=post_id, client_phone=client_phone, reaction_key=reaction_key
        )
        db.add(new_reaction)
        setattr(post, f"react_{reaction_key}", getattr(post, f"react_{reaction_key}") + 1)
        db.commit()
        return {"action": "added", "reaction": reaction_key}


# ── Commentaires ──────────────────────────────────────────────────────────────

@router.get("/posts/{post_id}/comments")
def get_comments(post_id: int, limit: int = 20, db: Session = Depends(get_db)):
    """Liste des commentaires d'un post"""
    comments = list(db.scalars(
        select(PromoComment)
        .where(and_(PromoComment.post_id == post_id, PromoComment.is_active == True))
        .order_by(desc(PromoComment.created_at))
        .limit(limit)
    ))
    return [
        {
            "id":      c.id,
            "author":  c.author_name,
            "text":    c.content,
            "time":    _time_ago(c.created_at),
        }
        for c in comments
    ]


@router.post("/posts/{post_id}/comments")
def add_comment(post_id: int, payload: dict, request: Request, db: Session = Depends(get_db)):
    """Ajouter un commentaire"""
    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(400, "Commentaire vide")
    if len(content) > 500:
        raise HTTPException(400, "Commentaire trop long (max 500 caractères)")

    post = db.get(PromoPost, post_id)
    if not post:
        raise HTTPException(404, "Post introuvable")

    comment = PromoComment(
        post_id      = post_id,
        author_name  = payload.get("author_name", "Client SOKORA"),
        author_phone = _get_client_phone(request),
        content      = content,
    )
    db.add(comment)
    post.comments_count += 1
    db.commit()
    db.refresh(comment)
    return {"id": comment.id, "author": comment.author_name, "text": comment.content, "time": "à l'instant"}


# ══════════════════════════════════════════════════════════════════════════════
# ÉTABLISSEMENTS — SOKORA EXPLORE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/establishments")
def list_establishments(
    category:  Optional[str] = None,
    city:      Optional[str] = None,
    open_only: bool = False,
    sort:      str = "distance",
    search:    Optional[str] = None,
    lat:       Optional[float] = None,
    lon:       Optional[float] = None,
    limit:     int = 50,
    db: Session = Depends(get_db)
):
    """Liste des établissements pour SOKORA EXPLORE"""
    q = select(Establishment).where(Establishment.is_active == True)

    if category and category != "all":
        q = q.where(Establishment.type == category)
    if city:
        q = q.where(Establishment.city.ilike(f"%{city}%"))
    if search:
        q = q.where(or_(
            Establishment.name.ilike(f"%{search}%"),
            Establishment.city.ilike(f"%{search}%"),
            Establishment.description.ilike(f"%{search}%"),
        ))
    if sort == "rating":
        q = q.order_by(desc(Establishment.rating))
    elif sort == "popular":
        q = q.order_by(desc(Establishment.reviews_count))
    else:
        q = q.order_by(desc(Establishment.is_premium), desc(Establishment.rating))

    q = q.limit(limit)
    establishments = list(db.scalars(q))
    return [_fmt_establishment(e) for e in establishments]


@router.get("/establishments/{estab_id}")
def get_establishment(estab_id: int, db: Session = Depends(get_db)):
    """Profil complet d'un établissement"""
    e = db.get(Establishment, estab_id)
    if not e or not e.is_active:
        raise HTTPException(404, "Établissement introuvable")
    return _fmt_establishment(e, full=True)


@router.post("/establishments")
def create_establishment(
    payload: dict,
    db: Session = Depends(get_db),
    current_user = Depends(security.get_current_user)
):
    """Créer un établissement (super_admin)"""
    if current_user.role not in ("super_admin", "manager"):
        raise HTTPException(403, "Accès refusé")

    e = Establishment(
        name        = payload["name"],
        type        = payload["type"],
        description = payload.get("description"),
        address     = payload.get("address"),
        city        = payload.get("city"),
        phone       = payload.get("phone"),
        lat         = payload.get("lat"),
        lon         = payload.get("lon"),
        is_premium  = payload.get("is_premium", False),
        is_verified = payload.get("is_verified", False),
        cashback_rate = payload.get("cashback_rate", 2.0),
        admin_user_id = payload.get("admin_user_id"),
    )
    db.add(e)
    db.commit()
    db.refresh(e)
    return _fmt_establishment(e)


def _fmt_establishment(e: Establishment, full: bool = False) -> dict:
    data = {
        "id":          e.id,
        "name":        e.name,
        "type":        e.type,
        "city":        e.city,
        "address":     e.address,
        "phone":       e.phone,
        "lat":         e.lat,
        "lon":         e.lon,
        "rating":      e.rating,
        "reviews_count": e.reviews_count,
        "is_open":     True,  # TODO: calculer selon horaires
        "is_premium":  e.is_premium,
        "is_verified": e.is_verified,
        "cashback_rate": e.cashback_rate,
        "photos":      e.photos or [],
        "logo_url":    e.logo_url,
        "cover_url":   e.cover_url,
    }
    if full:
        data["description"] = e.description
        data["hours"] = e.hours
        data["email"] = e.email
        data["website"] = e.website
    return data


# ══════════════════════════════════════════════════════════════════════════════
# WALLET — CODE MARCHAND
# ══════════════════════════════════════════════════════════════════════════════

USSD_PREFIXES = {
    "orange": "*144*82*{amount}*{code}#",
    "mtn":    "*133*1*{amount}*{code}#",
    "moov":   "*155*1*{amount}*{code}#",
    "wave":   "wave://pay?amount={amount}&ref={code}",
    "wallet": "QR code SOKORA",
}

@router.post("/wallet/payment-code")
def generate_payment_code(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Génère un code de paiement marchand unique.
    Simule l'appel à l'API Mobile Money du client.
    """
    client_phone = _get_client_phone(request)
    amount  = payload.get("amount", 0)
    method  = payload.get("method", "orange")

    if amount < 100:
        raise HTTPException(400, "Montant minimum : 100 FCFA")
    if method not in USSD_PREFIXES:
        raise HTTPException(400, f"Méthode inconnue. Options: {list(USSD_PREFIXES.keys())}")

    # Générer code unique
    code = _generate_payment_code(6)
    while db.scalar(select(MerchantPaymentCode).where(
        and_(MerchantPaymentCode.code == code,
             MerchantPaymentCode.status == "pending")
    )):
        code = _generate_payment_code(6)

    # Formater USSD selon l'opérateur
    template = USSD_PREFIXES[method]
    ussd_code = template.format(amount=amount, code=code)

    # Expiration : 60 secondes
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=60)

    # Sauvegarder
    payment_code = MerchantPaymentCode(
        code         = code,
        client_phone = client_phone,
        amount       = amount,
        method       = method,
        ussd_code    = ussd_code,
        status       = "pending",
        expires_at   = expires_at,
        establishment_id = payload.get("establishment_id"),
    )
    db.add(payment_code)
    db.commit()

    return {
        "code":       code,
        "ussd_code":  ussd_code,
        "amount":     amount,
        "method":     method,
        "expires_in": 60,
        "expires_at": expires_at.isoformat(),
        "message":    f"Code valable 60 secondes. Composez {ussd_code} ou montrez le QR code.",
    }


@router.get("/wallet/payment-code/{code}/verify")
def verify_payment_code(code: str, db: Session = Depends(get_db)):
    """Vérifier et valider un code de paiement (côté marchand)"""
    payment = db.scalar(
        select(MerchantPaymentCode).where(
            and_(MerchantPaymentCode.code == code,
                 MerchantPaymentCode.status == "pending")
        )
    )
    if not payment:
        raise HTTPException(404, "Code introuvable ou déjà utilisé")

    # Vérifier expiration
    now = datetime.now(timezone.utc)
    expires = payment.expires_at if payment.expires_at.tzinfo else payment.expires_at.replace(tzinfo=timezone.utc)
    if now > expires:
        payment.status = "expired"
        db.commit()
        raise HTTPException(400, "Code expiré. Générez un nouveau code.")

    # Marquer comme utilisé
    payment.status = "used"
    payment.used_at = now
    db.commit()

    return {
        "valid":        True,
        "code":         payment.code,
        "amount":       payment.amount,
        "method":       payment.method,
        "client_phone": payment.client_phone,
        "message":      f"Paiement de {payment.amount:,} FCFA validé !",
    }


# ══════════════════════════════════════════════════════════════════════════════
# CONCIERGERIE — PROFIL PREMIUM
# ══════════════════════════════════════════════════════════════════════════════

TIER_THRESHOLDS = {
    "bronze":   0,
    "silver":   10_000,
    "gold":     50_000,
    "diamond":  200_000,
    "platinum": 1_000_000,
}
TIER_CASHBACK = {
    "bronze": 1, "silver": 2, "gold": 5, "diamond": 10, "platinum": 15,
}

def _compute_tier(total_spent: int) -> str:
    tier = "bronze"
    for t, threshold in TIER_THRESHOLDS.items():
        if total_spent >= threshold:
            tier = t
    return tier


@router.get("/profile/premium")
def get_premium_profile(request: Request, db: Session = Depends(get_db)):
    """Profil conciergerie du client"""
    client_phone = _get_client_phone(request)
    profile = db.scalar(
        select(ClientProfile).where(ClientProfile.client_phone == client_phone)
    )
    if not profile:
        # Créer profil par défaut
        profile = ClientProfile(client_phone=client_phone)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    tier = _compute_tier(profile.total_spent)
    cashback_rate = TIER_CASHBACK[tier]

    return {
        "tier":          tier,
        "tier_label":    tier.capitalize(),
        "cashback_rate": cashback_rate,
        "total_spent":   profile.total_spent,
        "total_cashback": profile.total_cashback,
        "wallet_balance": profile.wallet_balance,
        "loyalty_points": profile.loyalty_points,
        "is_premium":    profile.is_premium,
        "name":          profile.name,
        "phone":         profile.client_phone,
        "next_tier": _next_tier_info(profile.total_spent),
    }


def _next_tier_info(total_spent: int) -> dict | None:
    thresholds = list(TIER_THRESHOLDS.items())
    for i, (t, threshold) in enumerate(thresholds):
        if total_spent < threshold:
            return {
                "tier":      t,
                "needed":    threshold - total_spent,
                "progress":  total_spent / threshold if threshold > 0 else 1,
                "cashback":  TIER_CASHBACK[t],
            }
    return None


# ══════════════════════════════════════════════════════════════════════════════
# COMPTES ADMIN DE TEST
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/admin/test-accounts")
def get_test_accounts(
    db: Session = Depends(get_db),
    current_user = Depends(security.get_current_user)
):
    """Retourne la liste des comptes de test par module (super_admin seulement)"""
    if current_user.role != "super_admin":
        raise HTTPException(403, "Réservé au super admin SOKORA")

    return {
        "super_admin": {
            "phone": "0000000000",
            "password": "sokora360@2025",
            "role": "super_admin",
            "desc": "SOKORA — Vue 360° tous modules, KPI réseau, création comptes"
        },
        "modules": [
            {
                "module": "maquis",
                "name": "Gérant Maquis La Belle Vie",
                "phone": "0700000001",
                "password": "maquis#BV2025",
                "role": "manager",
                "establishment": "Maquis La Belle Vie — Cocody"
            },
            {
                "module": "bar",
                "name": "Gérant Bar Étoile VIP",
                "phone": "0700000002",
                "password": "bar#EtoileVIP25",
                "role": "manager",
                "establishment": "Bar Étoile VIP — Marcory"
            },
            {
                "module": "restaurant",
                "name": "Gérant Restaurant Saveurs",
                "phone": "0700000003",
                "password": "resto#Saveurs25",
                "role": "manager",
                "establishment": "Restaurant Saveurs d'Abidjan — Yopougon"
            },
            {
                "module": "hotel",
                "name": "Gérant Hotel Le Diplomate",
                "phone": "0700000004",
                "password": "hotel#Diplo25",
                "role": "manager",
                "establishment": "Hotel Le Diplomate — Plateau"
            },
            {
                "module": "voyage",
                "name": "Gérant Terminal UTB",
                "phone": "0700000005",
                "password": "voyage#UTB2025",
                "role": "manager",
                "establishment": "Terminal UTB — Adjamé"
            },
            {
                "module": "serveur_maquis",
                "name": "Serveur Maquis",
                "phone": "0700000011",
                "password": "serveur#1234",
                "role": "waiter",
                "establishment": "Maquis La Belle Vie"
            },
            {
                "module": "serveur_bar",
                "name": "Serveur Bar",
                "phone": "0700000012",
                "password": "serveur#5678",
                "role": "waiter",
                "establishment": "Bar Étoile VIP"
            },
            {
                "module": "client",
                "name": "Client Test",
                "phone": "0700000099",
                "password": "client#test25",
                "role": "client",
                "establishment": None
            },
            {
                "module": "chauffeur",
                "name": "Chauffeur UTB",
                "phone": "0700000088",
                "password": "driver#UTB25",
                "role": "driver",
                "establishment": "Terminal UTB"
            }
        ]
    }


# ── Helper time_ago ────────────────────────────────────────────────────────────

def _time_ago(dt: datetime) -> str:
    now  = datetime.now(timezone.utc)
    d    = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    diff = now - d
    if diff.seconds < 60:    return "à l'instant"
    if diff.seconds < 3600:  return f"{diff.seconds // 60}min"
    if diff.days == 0:       return f"{diff.seconds // 3600}h"
    return f"{diff.days}j"
