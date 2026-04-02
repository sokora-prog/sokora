"""
SOKORA Black — Programme de fidélité
Tiers : Bronze (0-999pts) · Silver (1000-4999pts) · Gold (5000-14999pts) · Black (15000+pts)
Cashback : Bronze 1% · Silver 2% · Gold 3% · Black 5%
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta

from .database import get_db
from .models import ClientAccount, LoyaltyTransaction, Establishment
from .security import get_current_user

router = APIRouter(prefix="/loyalty", tags=["loyalty"])

# ─────────────────────────────────────────
#  TIER LOGIC
# ─────────────────────────────────────────

TIERS = [
    {"name": "Black",  "min": 15000, "cashback": 5.0,  "color": "#1a1a2e", "badge": "⬛"},
    {"name": "Gold",   "min": 5000,  "cashback": 3.0,  "color": "#FFD700", "badge": "🥇"},
    {"name": "Silver", "min": 1000,  "cashback": 2.0,  "color": "#C0C0C0", "badge": "🥈"},
    {"name": "Bronze", "min": 0,     "cashback": 1.0,  "color": "#CD7F32", "badge": "🥉"},
]

def get_tier(points: int) -> dict:
    for t in TIERS:
        if points >= t["min"]:
            return t
    return TIERS[-1]

def next_tier(points: int) -> Optional[dict]:
    """Returns next tier info + points needed, or None if already Black."""
    current = get_tier(points)
    if current["name"] == "Black":
        return None
    idx = next(i for i, t in enumerate(TIERS) if t["name"] == current["name"])
    if idx == 0:
        return None
    nxt = TIERS[idx - 1]
    return {"name": nxt["name"], "points_needed": nxt["min"] - points, "min": nxt["min"]}

def enrich_client(c: ClientAccount) -> dict:
    tier = get_tier(c.total_points)
    nxt  = next_tier(c.total_points)
    return {
        "id":           c.id,
        "phone":        c.phone,
        "name":         c.name or c.phone,
        "total_points": c.total_points,
        "total_spent":  round(c.total_spent, 0),
        "visit_count":  c.visit_count,
        "tier":         tier["name"],
        "tier_badge":   tier["badge"],
        "tier_color":   tier["color"],
        "cashback_pct": tier["cashback"],
        "next_tier":    nxt,
        "created_at":   c.created_at.isoformat() if c.created_at else None,
    }


# ─────────────────────────────────────────
#  SCHEMAS
# ─────────────────────────────────────────

class EarnRequest(BaseModel):
    phone:            str
    amount:           float          # amount spent in XOF
    establishment_id: Optional[int] = None
    order_id:         Optional[int] = None
    description:      Optional[str] = None

class RedeemRequest(BaseModel):
    phone:            str
    points:           int
    establishment_id: Optional[int] = None
    description:      Optional[str] = None

class BonusRequest(BaseModel):
    phone:            str
    points:           int
    description:      Optional[str] = "Bonus SOKORA Black"


# ─────────────────────────────────────────
#  ENDPOINTS
# ─────────────────────────────────────────

@router.get("/dashboard")
def loyalty_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Aggregate stats for manager dashboard."""
    clients = db.query(ClientAccount).all()

    tier_counts = {"Bronze": 0, "Silver": 0, "Gold": 0, "Black": 0}
    total_points_issued = 0
    top_clients = []

    for c in clients:
        t = get_tier(c.total_points)
        tier_counts[t["name"]] += 1
        total_points_issued += c.total_points

    # Top 5 by points
    top_q = db.query(ClientAccount).order_by(desc(ClientAccount.total_points)).limit(5).all()
    top_clients = [enrich_client(c) for c in top_q]

    # Recent transactions (last 30 days)
    since = datetime.utcnow() - timedelta(days=30)
    recent_earn = db.query(func.sum(LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tx_type == "earn",
        LoyaltyTransaction.created_at >= since,
    ).scalar() or 0

    recent_redeem = db.query(func.sum(LoyaltyTransaction.points)).filter(
        LoyaltyTransaction.tx_type == "redeem",
        LoyaltyTransaction.created_at >= since,
    ).scalar() or 0

    return {
        "total_clients":        len(clients),
        "tier_distribution":    tier_counts,
        "total_points_issued":  total_points_issued,
        "points_earned_30d":    recent_earn,
        "points_redeemed_30d":  abs(recent_redeem),
        "top_clients":          top_clients,
    }


@router.get("/clients")
def list_clients(
    tier:   Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(ClientAccount)
    if search:
        q = q.filter(
            ClientAccount.phone.ilike(f"%{search}%") |
            ClientAccount.name.ilike(f"%{search}%")
        )
    clients = q.order_by(desc(ClientAccount.total_points)).offset(offset).limit(limit).all()
    enriched = [enrich_client(c) for c in clients]

    if tier:
        enriched = [c for c in enriched if c["tier"].lower() == tier.lower()]

    return {"clients": enriched, "total": len(enriched)}


@router.get("/clients/{phone}")
def get_client(phone: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    c = db.query(ClientAccount).filter(ClientAccount.phone == phone).first()
    if not c:
        raise HTTPException(404, f"Client {phone} introuvable")

    txs = (
        db.query(LoyaltyTransaction)
        .filter(LoyaltyTransaction.client_id == c.id)
        .order_by(desc(LoyaltyTransaction.created_at))
        .limit(20)
        .all()
    )
    tx_list = [{
        "id":          t.id,
        "points":      t.points,
        "tx_type":     t.tx_type,
        "description": t.description,
        "created_at":  t.created_at.isoformat() if t.created_at else None,
    } for t in txs]

    return {**enrich_client(c), "transactions": tx_list}


@router.post("/earn")
def earn_points(req: EarnRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Award loyalty points proportional to amount spent (1pt per 100 XOF)."""
    c = db.query(ClientAccount).filter(ClientAccount.phone == req.phone).first()
    if not c:
        raise HTTPException(404, f"Client {req.phone} introuvable")

    # Calculate points: 1 pt per 100 XOF spent
    est = db.query(Establishment).get(req.establishment_id) if req.establishment_id else None
    pts_per_100 = est.points_per_100f if est else 1.0
    points_earned = max(1, int(req.amount / 100 * pts_per_100))

    tier_before = get_tier(c.total_points)["name"]
    c.total_points += points_earned
    c.total_spent  += req.amount
    c.visit_count  += 1
    tier_after = get_tier(c.total_points)["name"]

    tx = LoyaltyTransaction(
        client_id=c.id,
        establishment_id=req.establishment_id,
        order_id=req.order_id,
        points=points_earned,
        tx_type="earn",
        description=req.description or f"+{points_earned} pts · Achat {int(req.amount)} XOF",
    )
    db.add(tx)
    db.commit()
    db.refresh(c)

    return {
        "points_earned":  points_earned,
        "total_points":   c.total_points,
        "tier":           tier_after,
        "tier_upgraded":  tier_after != tier_before,
        "tier_before":    tier_before,
    }


@router.post("/redeem")
def redeem_points(req: RedeemRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Redeem points for cashback (100 pts = 100 XOF cashback)."""
    c = db.query(ClientAccount).filter(ClientAccount.phone == req.phone).first()
    if not c:
        raise HTTPException(404, f"Client {req.phone} introuvable")
    if c.total_points < req.points:
        raise HTTPException(400, f"Points insuffisants : {c.total_points} disponibles, {req.points} demandés")

    c.total_points -= req.points
    cashback_xof = req.points  # 1pt = 1 XOF cashback

    tx = LoyaltyTransaction(
        client_id=c.id,
        establishment_id=req.establishment_id,
        points=-req.points,
        tx_type="redeem",
        description=req.description or f"Remboursement {cashback_xof} XOF",
    )
    db.add(tx)
    db.commit()
    db.refresh(c)

    return {
        "points_redeemed": req.points,
        "cashback_xof":    cashback_xof,
        "remaining_points": c.total_points,
        "tier":            get_tier(c.total_points)["name"],
    }


@router.post("/bonus")
def award_bonus(req: BonusRequest, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Manually award bonus points (SOKORA admin action)."""
    c = db.query(ClientAccount).filter(ClientAccount.phone == req.phone).first()
    if not c:
        raise HTTPException(404, f"Client {req.phone} introuvable")

    c.total_points += req.points
    tx = LoyaltyTransaction(
        client_id=c.id,
        points=req.points,
        tx_type="bonus",
        description=req.description,
    )
    db.add(tx)
    db.commit()
    db.refresh(c)

    return {
        "points_awarded": req.points,
        "total_points":   c.total_points,
        "tier":           get_tier(c.total_points)["name"],
    }


@router.get("/transactions")
def list_transactions(
    limit:  int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    tx_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(LoyaltyTransaction)
    if tx_type:
        q = q.filter(LoyaltyTransaction.tx_type == tx_type)
    txs = q.order_by(desc(LoyaltyTransaction.created_at)).offset(offset).limit(limit).all()

    result = []
    for t in txs:
        c = db.query(ClientAccount).get(t.client_id)
        result.append({
            "id":          t.id,
            "client_id":   t.client_id,
            "client_name": c.name or c.phone if c else "—",
            "client_phone": c.phone if c else "—",
            "points":      t.points,
            "tx_type":     t.tx_type,
            "description": t.description,
            "created_at":  t.created_at.isoformat() if t.created_at else None,
        })
    return {"transactions": result, "total": len(result)}
