from typing import Optional, List
from datetime import datetime, timezone, timedelta
import hashlib, hmac, time, json, math, statistics, asyncio
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas, crud, security
from . import models_hotel    # Hotel module
from . import models_voyage   # Voyage module
from . import models_promo    # Promo / PULSE / Établissements
from . import models_service  # Services informels
from .router_hotel    import router as hotel_router
from .router_voyage   import router as voyage_router
from .router_promo    import router as promo_router
from .router_bar      import router as bar_router
from .router_loyalty  import router as loyalty_router
from .router_service  import router as service_router
from .database import get_db, engine

models.Base.metadata.create_all(bind=engine)
models_service.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SOKORA API", version="3.0.0")
app.include_router(hotel_router)
app.include_router(voyage_router)
app.include_router(promo_router)
app.include_router(bar_router)
app.include_router(loyalty_router)
app.include_router(service_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:19006",
        "http://localhost:19000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════
#  WEBSOCKET — ORDERS (KDS + dashboard temps réel)
# ═══════════════════════════════════════════════════════
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set

_main_loop: asyncio.AbstractEventLoop = None


@app.on_event("startup")
async def _capture_loop():
    global _main_loop
    _main_loop = asyncio.get_event_loop()


class OrderConnectionManager:
    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, ws: WebSocket, est_id: int):
        await ws.accept()
        self.connections.setdefault(est_id, set()).add(ws)

    def disconnect(self, ws: WebSocket, est_id: int):
        if est_id in self.connections:
            self.connections[est_id].discard(ws)

    async def broadcast(self, est_id: int, data: dict):
        dead = set()
        for ws in list(self.connections.get(est_id, set())):
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[est_id].discard(ws)

    def broadcast_sync(self, est_id: int, data: dict):
        """Appelable depuis des handlers synchrones."""
        if _main_loop and not _main_loop.is_closed():
            asyncio.run_coroutine_threadsafe(self.broadcast(est_id, data), _main_loop)


order_ws = OrderConnectionManager()


@app.websocket("/ws/orders/{establishment_id}")
async def orders_websocket(
    ws: WebSocket,
    establishment_id: int,
    token: str = None,
    db: Session = Depends(get_db),
):
    """
    WebSocket temps réel pour les commandes.
    Auth via query param ?token=<jwt>.
    Reçoit des événements : new_order, order_update.
    """
    # Auth
    user = None
    if token:
        try:
            payload = security.decode_token(token)
            uid = payload.get("sub")
            user = db.get(models.User, int(uid)) if uid else None
        except Exception:
            pass
    if not user or user.establishment_id != establishment_id:
        await ws.close(code=1008)
        return

    await order_ws.connect(ws, establishment_id)
    try:
        while True:
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_text("pong")
    except WebSocketDisconnect:
        order_ws.disconnect(ws, establishment_id)


@app.get("/", tags=["health"])
def root():
    return {"status": "SOKORA API v2 is running"}

@app.head("/health", tags=["health"])
@app.get("/health", tags=["health"])
def health():
    """Endpoint léger pour le check de connectivité mobile (mode hors-ligne)."""
    return {"ok": True}

@app.post("/auth/register", response_model=schemas.Token, tags=["auth"])
def register_manager(data: schemas.ManagerRegister, db: Session = Depends(get_db)):
    manager = crud.register_manager(db, data)
    token = security.create_access_token({"sub": str(manager.id)})
    return {"access_token": token, "token_type": "bearer", "user": manager}

@app.post("/auth/login", response_model=schemas.Token, tags=["auth"])
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    # Nettoyage du numéro de téléphone
    phone_clean = data.phone_number.strip().replace(" ", "").replace("-", "")

    user = db.query(models.User).filter(models.User.phone_number == phone_clean).first()

    if not user:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    # Vérification du mot de passe
    if not security.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Compte désactivé")

    token = security.create_access_token({"sub": str(user.id)})

    # Enrichir avec infos établissement
    est_name = None
    est_type = None
    has_kitchen = False
    if user.establishment_id:
        est = db.get(models.Establishment, user.establishment_id)
        if est:
            est_name = est.name
            est_type = est.type
            kitchen_count = db.query(models.Category).filter(
                models.Category.establishment_id == est.id,
                models.Category.is_kitchen == True
            ).count()
            has_kitchen = kitchen_count > 0

    user_dict = {
        "id":               user.id,
        "full_name":        user.full_name,
        "phone_number":     user.phone_number,
        "role":             user.role,
        "is_active":        user.is_active,
        "establishment_id": user.establishment_id,
        "staff_code":       user.staff_code,
        "created_at":       user.created_at,
        "establishment_name": est_name,
        "establishment_type": est_type,
        "has_kitchen":      has_kitchen,
    }
    return {"access_token": token, "token_type": "bearer", "user": user_dict}

def _enrich_user_dict(user: models.User, db: Session) -> dict:
    """Sérialise un User en dict enrichi avec infos établissement."""
    est_name = None
    est_type = None
    has_kitchen = False
    if user.establishment_id:
        est = db.get(models.Establishment, user.establishment_id)
        if est:
            est_name = est.name
            est_type = est.type
            kitchen_count = db.query(models.Category).filter(
                models.Category.establishment_id == est.id,
                models.Category.is_kitchen == True
            ).count()
            has_kitchen = kitchen_count > 0
    return {
        "id":               user.id,
        "full_name":        user.full_name,
        "phone_number":     user.phone_number,
        "role":             user.role,
        "is_active":        user.is_active,
        "establishment_id": user.establishment_id,
        "staff_code":       user.staff_code,
        "created_at":       user.created_at,
        "establishment_name": est_name,
        "establishment_type": est_type,
        "has_kitchen":      has_kitchen,
    }


@app.get("/auth/me", tags=["auth"])
def me(current_user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    return _enrich_user_dict(current_user, db)

@app.post("/staff/", response_model=schemas.UserResponse, tags=["staff"])
def create_staff(data: schemas.UserCreate, current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.create_staff(db, data, current_user.establishment_id)

@app.get("/staff/", response_model=List[schemas.UserResponse], tags=["staff"])
def list_staff(current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.get_staff_list(db, current_user.establishment_id)

@app.patch("/staff/{user_id}", response_model=schemas.UserResponse, tags=["staff"])
def update_staff(user_id: int, data: schemas.UserUpdate, current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.update_staff(db, user_id, data, current_user.establishment_id)

@app.get("/tables/", response_model=List[schemas.TableResponse], tags=["tables"])
def list_tables(current_user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    return crud.get_tables(db, current_user.establishment_id)

@app.post("/tables/", response_model=schemas.TableResponse, tags=["tables"])
def create_table(data: schemas.TableCreate, current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.create_table(db, data, current_user.establishment_id)

@app.patch("/tables/{table_id}/status", response_model=schemas.TableResponse, tags=["tables"])
def update_table_status(table_id: int, data: schemas.TableStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.update_table_status(db, table_id, data.status, current_user.establishment_id)

@app.get("/categories/", tags=["categories"])
def list_categories(current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    return crud.get_categories(db, current_user.establishment_id)

@app.post("/categories/", tags=["categories"])
def create_category(data: schemas.CategoryCreate, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.create_category(db, data, current_user.establishment_id)


@app.get("/products/", response_model=List[schemas.ProductResponse], tags=["products"])
def list_products(current_user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    return crud.get_products(db, current_user.establishment_id)

@app.post("/products/", response_model=schemas.ProductResponse, tags=["products"])
def create_product(data: schemas.ProductCreate, current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.create_product(db, data, current_user.establishment_id)

@app.get("/orders/", response_model=List[schemas.OrderResponse], tags=["orders"])
def list_orders(status: Optional[str] = None, table_id: Optional[int] = None, waiter_id: Optional[int] = None, current_user: models.User = Depends(security.get_current_user), db: Session = Depends(get_db)):
    order_status = models.OrderStatus(status.upper()) if status else None
    return crud.get_orders(db, current_user.establishment_id, order_status, table_id=table_id, waiter_id=waiter_id)  # noqa — crud.get_orders updated to accept these

@app.get("/orders/{order_id}", response_model=schemas.OrderResponse, tags=["orders"])
def get_order(order_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.establishment_id == current_user.establishment_id
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Commande non trouvee")
    from . import models as m
    table = db.get(m.Table, order.table_id)
    if table:
        order.table_number = table.number
    for item in order.items:
        p = db.get(m.Product, item.product_id)
        if p:
            item.product_name = p.name
    return order

@app.post("/orders/", response_model=schemas.OrderResponse, tags=["orders"])
def create_order(data: schemas.OrderCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    order = crud.create_order(db, data, current_user)
    order_ws.broadcast_sync(current_user.establishment_id, {
        "type": "new_order", "order_id": order.id,
        "table_number": getattr(order, "table_number", None),
        "status": order.status.value if hasattr(order.status, "value") else str(order.status),
    })
    return order

@app.post("/orders/{order_id}/items", response_model=schemas.OrderResponse, tags=["orders"])
def add_order_items(order_id: int, data: schemas.OrderAddItems, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    return crud.add_items_to_order(db, order_id, data, current_user)

@app.patch("/orders/{order_id}/status", response_model=schemas.OrderResponse, tags=["orders"])
def update_order_status(order_id: int, data: schemas.OrderStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    order = crud.update_order_status(db, order_id, data.status, current_user.establishment_id)
    order_ws.broadcast_sync(current_user.establishment_id, {
        "type": "order_update", "order_id": order_id, "status": data.status,
    })
    return order

def _loyalty_earn(db, phone: str, amount: float, est_id: int, order_id: int = None, description: str = None):
    from . import models as _m
    client = db.query(_m.ClientAccount).filter(_m.ClientAccount.phone == phone.strip()).first()
    if not client or amount <= 0:
        return
    pts = max(1, int(amount / 100))
    client.total_points = (client.total_points or 0) + pts
    client.total_spent  = (client.total_spent or 0) + amount
    client.visit_count  = (client.visit_count or 0) + 1
    db.add(_m.LoyaltyTransaction(
        client_id        = client.id,
        establishment_id = est_id,
        order_id         = order_id,
        points           = pts,
        tx_type          = "earn",
        description      = description or f"Paiement — {pts} pts",
    ))
    db.commit()


@app.post("/payments/", tags=["payments"])
def process_payment(data: schemas.PaymentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(security.get_current_user)):
    print(f"[PAYMENT] method={data.method} client_phone={data.client_phone} client_name={data.client_name}", flush=True)
    result = crud.process_payment(db, data, current_user)
    # Créditer les points fidélité
    if data.client_phone:
        try:
            _loyalty_earn(db, data.client_phone, data.amount, current_user.establishment_id)
        except:
            pass
    return result

@app.get("/expenses/", tags=["expenses"])
def list_expenses(current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.get_expenses(db, current_user.establishment_id)

@app.post("/expenses/", tags=["expenses"])
def create_expense(data: schemas.ExpenseCreate, current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.create_expense(db, data, current_user)

# ═══════════════════════════════════════════════════════════════════════════════
#  PETITS COMMERCES — POS / Caisse rapide
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/pos/sales", tags=["pos"])
def list_sales(
    limit: int = 50,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Historique des ventes directes (mode caisse rapide)."""
    rows = (
        db.query(models.Sale)
        .filter(models.Sale.establishment_id == current_user.establishment_id)
        .order_by(models.Sale.created_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for s in rows:
        result.append({
            "id": s.id,
            "total_amount": s.total_amount,
            "payment_method": s.payment_method,
            "note": s.note,
            "created_at": s.created_at,
            "seller": s.seller.full_name if s.seller else None,
            "items": [
                {
                    "product_id": i.product_id,
                    "product_name": i.product.name if i.product else str(i.product_id),
                    "quantity": i.quantity,
                    "unit_price": i.unit_price,
                }
                for i in s.items
            ],
        })
    return result


@app.post("/pos/sales", tags=["pos"])
def create_sale(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Enregistre une vente directe (caisse rapide)."""
    items_in = data.get("items", [])
    if not items_in:
        raise HTTPException(status_code=400, detail="Au moins un article requis")

    total = 0.0
    sale_items = []
    for it in items_in:
        product = db.get(models.Product, int(it["product_id"]))
        if not product or product.establishment_id != current_user.establishment_id:
            raise HTTPException(status_code=404, detail=f"Produit {it['product_id']} introuvable")
        qty = int(it.get("quantity", 1))
        price = float(it.get("unit_price", product.price))
        total += price * qty
        sale_items.append(models.SaleItem(product_id=product.id, quantity=qty, unit_price=price))
        # Décrémenter le stock si géré
        if product.stock_quantity is not None and product.stock_quantity > 0:
            product.stock_quantity = max(0, product.stock_quantity - qty)

    sale = models.Sale(
        establishment_id=current_user.establishment_id,
        seller_id=current_user.id,
        total_amount=total,
        payment_method=data.get("payment_method", "CASH"),
        note=data.get("note"),
    )
    db.add(sale)
    db.flush()
    for si in sale_items:
        si.sale_id = sale.id
        db.add(si)
    db.commit()
    db.refresh(sale)
    return {"id": sale.id, "total_amount": sale.total_amount, "payment_method": sale.payment_method}


@app.get("/pos/stats", tags=["pos"])
def pos_stats(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Stats du jour pour le module POS."""
    from datetime import date
    today = date.today()
    sales = (
        db.query(models.Sale)
        .filter(
            models.Sale.establishment_id == current_user.establishment_id,
            func.date(models.Sale.created_at) == today,
        )
        .all()
    )
    total_revenue = sum(s.total_amount for s in sales)
    count = len(sales)
    by_method: dict = {}
    for s in sales:
        m = str(s.payment_method)
        by_method[m] = by_method.get(m, 0) + s.total_amount
    return {"count": count, "total_revenue": total_revenue, "by_method": by_method}


@app.get("/dashboard/stats", response_model=schemas.DashboardStats, tags=["dashboard"])
def dashboard_stats(current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.get_dashboard_stats(db, current_user.establishment_id)

@app.get("/dashboard/waiters", tags=["dashboard"])
def dashboard_waiters(current_user: models.User = Depends(security.require_manager), db: Session = Depends(get_db)):
    return crud.get_waiter_stats(db, current_user.establishment_id)


@app.get("/dashboard/my-stats")
def get_my_stats(
    period: str = "today",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Stats personnelles du serveur connecte - filtrees par periode."""
    return crud.get_waiter_own_stats(db, current_user.id, period)


@app.get("/dashboard/stats-period")
def get_stats_period(
    period: str = "today",
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return crud.get_dashboard_stats_period(db, current_user.establishment_id, period, date_from, date_to)

@app.get("/dashboard/revenue-chart")
def get_revenue_chart(
    period: str = "7d",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return crud.get_revenue_chart(db, current_user.establishment_id, period)

@app.get("/dashboard/revenue-by-method")
def get_revenue_by_method(
    period: str = "7d",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """CA par jour ET par méthode de paiement pour graphes empilés."""
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func, select

    est_id = current_user.establishment_id
    now = datetime.now(timezone.utc)
    days = 30 if period == "30d" else 7

    METHOD_LABELS = {
        "cash": "Espèces", "wave": "Wave", "orange_money": "Orange Money",
        "mtn_money": "MTN Money", "card": "Carte", "wallet": "Wallet SOKORA", "credit": "Ardoise",
    }
    METHOD_COLORS = {
        "cash": "#F97316", "wave": "#0EA5E9", "orange_money": "#F59E0B",
        "mtn_money": "#FACC15", "card": "#8B5CF6", "wallet": "#14B8A6", "credit": "#6B7280",
    }

    # Récupérer tous les paiements de la période groupés par jour + méthode
    date_from = now - timedelta(days=days-1)
    date_from = date_from.replace(hour=0, minute=0, second=0, microsecond=0)

    rows = db.execute(
        select(
            func.date_trunc('day', models.Payment.created_at).label('day'),
            models.Payment.method,
            func.sum(models.Payment.amount).label('total')
        )
        .where(models.Payment.establishment_id == est_id)
        .where(models.Payment.created_at >= date_from)
        .group_by(func.date_trunc('day', models.Payment.created_at), models.Payment.method)
        .order_by(func.date_trunc('day', models.Payment.created_at))
    ).all()

    # Organiser par jour
    days_map = {}
    for i in range(days - 1, -1, -1):
        d = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        key = d.strftime("%Y-%m-%d")
        days_map[key] = {"date": key, "label": d.strftime("%d/%m"), "total": 0}

    methods_seen = set()
    for row in rows:
        day_key = row.day.strftime("%Y-%m-%d") if row.day else None
        if not day_key or day_key not in days_map:
            continue
        method_str = (str(row.method.value) if hasattr(row.method, 'value') else str(row.method)).lower()
        methods_seen.add(method_str)
        days_map[day_key][method_str] = float(row.total or 0)
        days_map[day_key]["total"] += float(row.total or 0)

    # Remplir les méthodes manquantes avec 0
    for day_data in days_map.values():
        for m in methods_seen:
            if m not in day_data:
                day_data[m] = 0

    # Totaux par méthode pour la période
    method_totals = {}
    for m in methods_seen:
        method_totals[m] = {
            "method": m,
            "label": METHOD_LABELS.get(m, m),
            "color": METHOD_COLORS.get(m, "#6B7280"),
            "total": sum(d.get(m, 0) for d in days_map.values()),
        }

    return {
        "period": period,
        "days": list(days_map.values()),
        "methods": list(method_totals.values()),
        "grand_total": sum(d["total"] for d in days_map.values()),
    }



@app.get("/dashboard/waiters-period")
def get_waiters_period(
    period: str = "today",
    date_from: str = None,
    date_to: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    return crud.get_waiter_stats_period(db, current_user.establishment_id, period, date_from, date_to)

@app.patch("/products/{product_id}")
def update_product(
    product_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.establishment_id == current_user.establishment_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for field in ["name", "price", "purchase_price", "stock_quantity", "is_available"]:
        if field in data:
            setattr(product, field, data[field])
    db.commit()
    db.refresh(product)
    return product


@app.post("/tables/transfer")
def transfer_table(
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Transfert toutes les commandes ouvertes de from_table vers to_table."""
    from_id = data.get("from_table_id")
    to_id   = data.get("to_table_id")
    if not from_id or not to_id:
        raise HTTPException(status_code=400, detail="from_table_id et to_table_id requis")
    return crud.transfer_table(db, from_id, to_id, current_user.establishment_id)


@app.post("/tables/merge")
def merge_tables(
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Fusionne les commandes de from_table dans to_table."""
    from_id = data.get("from_table_id")
    to_id   = data.get("to_table_id")
    if not from_id or not to_id:
        raise HTTPException(status_code=400, detail="from_table_id et to_table_id requis")
    return crud.merge_tables(db, from_id, to_id, current_user.establishment_id)


@app.post("/tables/transfer-waiter")
def transfer_waiter(
    data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user)
):
    """Réassigne les commandes d'une table à un autre serveur."""
    table_id   = data.get("table_id")
    waiter_id  = data.get("new_waiter_id")
    if not table_id or not waiter_id:
        raise HTTPException(status_code=400, detail="table_id et new_waiter_id requis")
    return crud.transfer_waiter(db, table_id, waiter_id, current_user.establishment_id)


# ── OFFERTS ──────────────────────────────────────────────────────
@app.patch("/orders/{order_id}/complimentary", tags=["orders"])
def mark_order_complimentary(order_id: int, data: dict, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    result = crud.mark_order_complimentary(
        db, order_id,
        data.get("is_complimentary", True),
        data.get("reason", ""),
        current_user.establishment_id
    )
    if not result:
        raise HTTPException(404, "Commande introuvable")
    return result

@app.patch("/order-items/{item_id}/complimentary", tags=["orders"])
def mark_item_complimentary(item_id: int, data: dict, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    result = crud.mark_item_complimentary(
        db, item_id,
        data.get("is_complimentary", True),
        data.get("reason", ""),
        current_user.establishment_id
    )
    if not result:
        raise HTTPException(404, "Article introuvable")
    return result

@app.patch("/orders/{order_id}/client-phone", tags=["orders"])
def set_client_phone(order_id: int, data: dict, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    result = crud.set_order_client_phone(db, order_id, data.get("phone"), current_user.establishment_id)
    if not result:
        raise HTTPException(404, "Commande introuvable")
    return result

@app.get("/dashboard/complimentary", tags=["dashboard"])
def get_complimentary_stats(period: str="today", current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    start, end = crud.get_period_bounds(period)
    return crud.get_complimentary_stats(db, current_user.establishment_id, start, end)


# ── STOCKS ────────────────────────────────────────────────────────────────────
@app.get("/stock", tags=["stock"])
def get_stock(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_stock_list(db, current_user.establishment_id)

@app.get("/stock/waiter", tags=["stock"])
def get_stock_waiter(current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    # Vue allégée pour le serveur (alertes seulement)
    all_stock = crud.get_stock_list(db, current_user.establishment_id)
    return [s for s in all_stock if s["status"] in ("low", "out")]

@app.patch("/stock/{product_id}", tags=["stock"])
def update_stock(product_id: int, data: dict, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    result = crud.update_stock(
        db, product_id,
        data.get("quantity", 0),
        data.get("movement_type", "adjustment"),
        data.get("reason", ""),
        current_user.establishment_id
    )
    if not result:
        raise HTTPException(404, "Produit introuvable")
    return result

@app.patch("/stock/{product_id}/settings", tags=["stock"])
def update_stock_settings(product_id: int, data: dict, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    result = crud.update_stock_threshold(
        db, product_id,
        data.get("stock_alert_threshold", 5),
        data.get("stock_unit", "pcs"),
        current_user.establishment_id
    )
    if not result:
        raise HTTPException(404, "Produit introuvable")
    return result

@app.get("/stock/{product_id}/movements", tags=["stock"])
def get_movements(product_id: int, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_stock_movements(db, current_user.establishment_id, product_id)

@app.post("/stock/bulk-update", tags=["stock"])
def bulk_update_stock(data: dict, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    items = data.get("items", [])
    updated = crud.bulk_update_stock(db, items, current_user.establishment_id)
    return {"updated": updated, "total": len(items)}


# ── ARDOISE / CRÉDIT CLIENT ───────────────────────────────────────────────────

@app.get("/credit/accounts", tags=["credit"])
def list_accounts(active_only: bool=False, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    return crud.get_credit_accounts(db, current_user.establishment_id, active_only)

@app.get("/credit/accounts/search", tags=["credit"])
def search_accounts(q: str="", current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    return crud.search_credit_account(db, current_user.establishment_id, q)

@app.get("/dashboard/caisse", tags=["dashboard"])
def get_caisse(
    period: str = "today",
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    return crud.get_closing_report(db, current_user.establishment_id)

@app.get("/dashboard/closing", tags=["dashboard"])
def get_closing_report(
    date: Optional[str] = None,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    return crud.get_closing_report(db, current_user.establishment_id, date)

@app.post("/stock/inventory", tags=["stock"])
def submit_inventory(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    items = data.get("items", [])
    return crud.submit_inventory(db, current_user.establishment_id, current_user.id, items)

@app.get("/stock/order-list", tags=["stock"])
def get_supplier_order_list(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    return crud.get_supplier_order_list(db, current_user.establishment_id)

@app.get("/stock/inventory/history", tags=["stock"])
def get_inventory_history(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    return crud.get_inventory_history(db, current_user.establishment_id)

@app.patch("/stock/{product_id}/reorder-threshold", tags=["stock"])
def update_reorder_threshold(
    product_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    return crud.update_reorder_threshold(db, product_id, current_user.establishment_id, data.get("threshold", 20))

@app.get("/credit/stats", tags=["credit"])
def credit_stats(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_credit_stats(db, current_user.establishment_id)

@app.post("/credit/accounts", tags=["credit"])
def create_account(data: dict, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    return crud.create_credit_account(
        db,
        current_user.establishment_id,
        data.get("client_name"),
        data.get("client_phone"),
        data.get("notes", ""),
        current_user.id,
        credit_limit=data.get("credit_limit"),
    )

@app.get("/credit/accounts/{account_id}", tags=["credit"])
def get_account(account_id: int, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    account = crud.get_credit_account(db, account_id, current_user.establishment_id)
    if not account:
        raise HTTPException(404, "Compte introuvable")
    return account

@app.post("/credit/accounts/{account_id}/transactions", tags=["credit"])
def add_transaction(account_id: int, data: dict, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    result = crud.add_credit_transaction(
        db,
        account_id,
        current_user.establishment_id,
        data.get("transaction_type", "credit"),
        data.get("amount", 0),
        data.get("description", ""),
        data.get("order_id"),
        current_user.id,
        payment_method=data.get("payment_method"),
    )
    if not result:
        raise HTTPException(404, "Compte introuvable")
    return result

@app.get("/credit/accounts/{account_id}/transactions", tags=["credit"])
def get_transactions(account_id: int, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    return crud.get_credit_transactions(db, account_id, current_user.establishment_id)

@app.patch("/credit/accounts/{account_id}/close", tags=["credit"])
def close_account(account_id: int, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    result = crud.close_credit_account(db, account_id, current_user.establishment_id)
    if not result:
        raise HTTPException(404, "Compte introuvable")
    return result


# ── KDS — KITCHEN DISPLAY SYSTEM ─────────────────────────────────────────────

@app.get("/kds/orders", tags=["kds"])
def kds_orders(
    status: str = "all",
    current_user = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    from app import models
    from sqlalchemy import or_
    q = db.query(models.Order).filter(
        models.Order.establishment_id == current_user.establishment_id
    )
    if status == "open":
        q = q.filter(models.Order.status == models.OrderStatus.OPEN)
    elif status == "sent":
        q = q.filter(models.Order.status == models.OrderStatus.SENT)
    elif status == "all":
        q = q.filter(models.Order.status.in_([models.OrderStatus.SENT, models.OrderStatus.IN_PROGRESS, models.OrderStatus.READY]))

    orders = q.order_by(models.Order.created_at.asc()).all()

    result = []
    for o in orders:
        all_items = db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).all()
        table = db.query(models.Table).filter(models.Table.id == o.table_id).first()

        # Filtrer uniquement les articles de catégories cuisine (is_kitchen=True)
        kitchen_items = []
        for i in all_items:
            p = db.query(models.Product).filter(models.Product.id == i.product_id).first()
            cat = db.query(models.Category).filter(models.Category.id == p.category_id).first() if p and p.category_id else None
            if cat and cat.is_kitchen:
                kitchen_items.append({
                    "id": i.id,
                    "product_name": p.name if p else f"Article #{i.product_id}",
                    "quantity": i.quantity,
                    "is_complimentary": getattr(i, 'is_complimentary', False),
                    "complimentary_reason": getattr(i, 'complimentary_reason', None),
                    "category_name": cat.name,
                })

        # N'afficher la commande que si elle contient des articles cuisine
        if kitchen_items:
            waiter = db.get(models.User, o.waiter_id) if o.waiter_id else None
            result.append({
                "id": o.id,
                "status": o.status,
                "table_number": table.number if table else o.table_id,
                "table_label": table.label if table else "",
                "waiter_name": waiter.full_name if waiter else None,
                "created_at": o.created_at.isoformat() if o.created_at else None,
                "items": kitchen_items,
            })
    return result

@app.patch("/orders/{order_id}/ready", tags=["kds"])
def mark_order_ready(
    order_id: int,
    current_user = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    from app import models
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.establishment_id == current_user.establishment_id
    ).first()
    if not order:
        raise HTTPException(404, "Commande introuvable")
    order.status = models.OrderStatus.READY
    db.commit()
    db.refresh(order)
    return {"id": order.id, "status": order.status}


@app.patch("/categories/{category_id}/kitchen", tags=["menu"])
def toggle_kitchen_flag(
    category_id: int,
    data: dict,
    current_user = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    from app import models
    cat = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.establishment_id == current_user.establishment_id
    ).first()
    if not cat:
        raise HTTPException(404, "Catégorie introuvable")
    cat.is_kitchen = data.get("is_kitchen", False)
    db.commit()
    return {"id": cat.id, "name": cat.name, "is_kitchen": cat.is_kitchen}


# ═══════════════════════════════════════════════════════
#  CLIENT PWA — ENDPOINTS PUBLICS
# ═══════════════════════════════════════════════════════

@app.post("/client/auth/request-otp", tags=["client"])
def client_request_otp(data: dict, db: Session = Depends(get_db)):
    """Envoyer OTP WhatsApp au numero de telephone."""
    phone = data.get("phone", "").strip()
    if not phone:
        raise HTTPException(400, "Numero requis")
    return crud.request_otp(db, phone)


@app.post("/client/auth/verify-otp", tags=["client"])
def client_verify_otp(data: dict, db: Session = Depends(get_db)):
    """Verifier OTP et retourner token client."""
    phone = data.get("phone", "").strip()
    code  = data.get("code", "").strip()
    if not phone or not code:
        raise HTTPException(400, "Donnees manquantes")
    result = crud.verify_otp(db, phone, code)
    if not result.get("success"):
        raise HTTPException(401, result.get("error", "Code invalide"))
    return result


@app.get("/client/establishments", tags=["client"])
def client_establishments(lat: float = 5.3364, lng: float = -4.0267, radius: float = 999, db: Session = Depends(get_db)):
    """Etablissements SOKORA actifs (avec ou sans GPS)."""
    return crud.get_establishments_nearby(db, lat, lng, radius)


@app.get("/client/menu/{establishment_id}", tags=["client"])
def client_menu(establishment_id: int, db: Session = Depends(get_db)):
    """Menu public d'un etablissement."""
    return crud.get_public_menu(db, establishment_id)


@app.get("/client/order/{establishment_id}/{table_id}", tags=["client"])
def client_order(establishment_id: int, table_id: int, db: Session = Depends(get_db)):
    """Commande en cours sur une table."""
    return crud.get_table_order(db, establishment_id, table_id)


@app.get("/client/receipt/{order_id}", tags=["client"])
def client_receipt(order_id: int, db: Session = Depends(get_db)):
    """Recu digital apres paiement."""
    return crud.get_client_receipt(db, order_id)


@app.patch("/client/profile", tags=["client"])
def client_update_profile(request: Request, data: dict, db: Session = Depends(get_db)):
    """Mettre a jour le profil client."""
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token requis")
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token invalide")
    if "name" in data:
        crud.update_client_name(db, client.id, data["name"])
    return {"success": True}


@app.get("/client/me", tags=["client"])
def client_me(request: Request, db: Session = Depends(get_db)):
    """Profil du client connecte."""
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token requis")
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token invalide")
    return {
        "id": client.id,
        "phone": client.phone,
        "name": client.name,
        "total_points": client.total_points,
        "total_spent": client.total_spent,
        "visit_count": client.visit_count,
    }


@app.patch("/establishments/{establishment_id}/location", tags=["manager"])
def update_establishment_location(
    establishment_id: int,
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Mettre a jour la localisation GPS d'un etablissement."""
    est = db.query(models.Establishment).filter(
        models.Establishment.id == establishment_id
    ).first()
    if not est:
        raise HTTPException(404, "Etablissement non trouve")
    if "latitude"    in data: est.latitude    = data["latitude"]
    if "longitude"   in data: est.longitude   = data["longitude"]
    if "description" in data: est.description = data["description"]
    if "logo_url"    in data: est.logo_url    = data["logo_url"]
    if "points_per_100f" in data: est.points_per_100f = data["points_per_100f"]
    db.commit()
    return {"success": True}


@app.get("/establishments/me", tags=["manager"])
def get_my_establishment(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """Infos de l'établissement du manager connecté (GPS inclus)."""
    est = db.query(models.Establishment).filter(
        models.Establishment.id == current_user.establishment_id
    ).first()
    if not est:
        raise HTTPException(404, "Etablissement non trouve")
    return {
        "id": est.id,
        "name": est.name,
        "address": getattr(est, "address", None),
        "latitude": est.latitude,
        "longitude": est.longitude,
        "logo_url": est.logo_url,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  FINANCE AI — Tableau de bord bancaire & scoring
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/finance/dashboard", tags=["finance"])
def get_finance_dashboard(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """
    Calcule les ratios financiers et le score bancaire de l'établissement
    basé sur les 90 derniers jours d'activité.
    """
    est_id = current_user.establishment_id
    now    = datetime.now(timezone.utc)
    d90    = now - timedelta(days=90)
    d60    = now - timedelta(days=60)
    d30    = now - timedelta(days=30)

    # ── Paiements encaissés par période ──────────────────────────────────────
    def payments_in(start, end):
        rows = (
            db.query(models.Payment)
            .filter(
                models.Payment.establishment_id == est_id,
                models.Payment.created_at >= start,
                models.Payment.created_at <  end,
            )
            .all()
        )
        return rows

    pays_m2 = payments_in(d90, d60)   # mois M-2
    pays_m1 = payments_in(d60, d30)   # mois M-1
    pays_m0 = payments_in(d30, now)   # mois courant

    rev_m2 = sum(p.amount for p in pays_m2)
    rev_m1 = sum(p.amount for p in pays_m1)
    rev_m0 = sum(p.amount for p in pays_m0)
    revenues = [r for r in [rev_m2, rev_m1, rev_m0] if r > 0]
    rev_avg  = sum(revenues) / len(revenues) if revenues else 0

    # ── Panier moyen & jours actifs ──────────────────────────────────────────
    all_pays = pays_m2 + pays_m1 + pays_m0
    avg_ticket = (sum(p.amount for p in all_pays) / len(all_pays)) if all_pays else 0
    active_days = len({p.created_at.date() for p in all_pays if p.created_at})

    # Répartition par mode de paiement
    pay_method_counts: dict = {}
    for p in all_pays:
        m = p.method.value if hasattr(p.method, "value") else str(p.method)
        pay_method_counts[m] = pay_method_counts.get(m, 0) + 1

    # ── Croissance MoM ───────────────────────────────────────────────────────
    if rev_m1 > 0:
        mom_growth = round((rev_m0 - rev_m1) / rev_m1 * 100, 1)
    elif rev_m0 > 0:
        mom_growth = 100.0
    else:
        mom_growth = 0.0

    # ── Dépenses ─────────────────────────────────────────────────────────────
    expenses = (
        db.query(models.Expense)
        .filter(
            models.Expense.establishment_id == est_id,
            models.Expense.created_at >= d90,
        )
        .all()
    )
    total_expenses = sum(e.amount for e in expenses)
    total_revenue_90 = rev_m2 + rev_m1 + rev_m0
    expense_ratio = round(total_expenses / total_revenue_90 * 100, 1) if total_revenue_90 else 0

    # ── Ardoise (crédit) ─────────────────────────────────────────────────────
    credit_accounts = (
        db.query(models.CreditAccount)
        .filter(models.CreditAccount.establishment_id == est_id)
        .all()
    )
    total_credit_granted = 0.0
    total_credit_repaid  = 0.0
    total_outstanding    = 0.0
    for acc in credit_accounts:
        txs = (
            db.query(models.CreditTransaction)
            .filter(models.CreditTransaction.credit_account_id == acc.id)
            .all()
        )
        granted = sum(t.amount for t in txs if t.transaction_type == "credit")
        repaid  = sum(t.amount for t in txs if t.transaction_type == "debit")
        total_credit_granted += granted
        total_credit_repaid  += repaid
        total_outstanding    += max(acc.balance, 0)

    recovery_rate = (
        round(total_credit_repaid / total_credit_granted * 100, 1)
        if total_credit_granted > 0 else 100.0
    )

    # ── SCORE BANCAIRE (0–100) ────────────────────────────────────────────────
    # 1. Stabilité des revenus (écart-type) → 0-25 pts
    if len(revenues) >= 2:
        stdev = statistics.stdev(revenues)
        cv    = stdev / rev_avg if rev_avg else 1  # coefficient de variation
        stability_score = max(0, 25 - round(cv * 50))
    else:
        stability_score = 10 if revenues else 0

    # 2. Taux de recouvrement ardoise → 0-20 pts
    recovery_score = round(recovery_rate / 100 * 20)

    # 3. Volume mensuel moyen → 0-20 pts (barème: 500k CFA = 20pts)
    volume_score = min(20, round(rev_avg / 500_000 * 20))

    # 4. Croissance MoM → 0-20 pts
    if mom_growth >= 10:
        growth_score = 20
    elif mom_growth >= 0:
        growth_score = round(mom_growth / 10 * 15) + 5
    else:
        growth_score = max(0, round(10 + mom_growth))

    # 5. Régularité d'activité → 0-15 pts (90 jours = 15pts)
    regularity_score = min(15, round(active_days / 90 * 15))

    score = stability_score + recovery_score + volume_score + growth_score + regularity_score
    score = max(0, min(100, score))

    if score >= 80:
        score_label, score_color = "Excellent", "#22c55e"
    elif score >= 65:
        score_label, score_color = "Bon", "#84cc16"
    elif score >= 50:
        score_label, score_color = "Correct", "#f59e0b"
    elif score >= 35:
        score_label, score_color = "Faible", "#f97316"
    else:
        score_label, score_color = "Insuffisant", "#ef4444"

    # ── Offres de prêt ───────────────────────────────────────────────────────
    wc_amount   = round(rev_avg * 1.0 / 5000) * 5000   # 1 mois de CA arrondi
    reno_amount = round(rev_avg * 3.0 / 5000) * 5000   # 3 mois de CA arrondi

    loan_offers = [
        {
            "type":     "working_capital",
            "label":    "Fonds de roulement",
            "icon":     "💼",
            "amount":   int(wc_amount),
            "rate":     "3% / mois",
            "duration": "3 mois",
            "eligible": score >= 50 and len(revenues) >= 2,
            "reason":   (
                "Activité stable sur 3 mois" if score >= 50 and len(revenues) >= 2
                else "Minimum 2 mois d'activité et score ≥ 50 requis"
            ),
        },
        {
            "type":     "renovation",
            "label":    "Crédit équipement",
            "icon":     "🏗️",
            "amount":   int(reno_amount),
            "rate":     "2.5% / mois",
            "duration": "12 mois",
            "eligible": score >= 70 and len(revenues) >= 3,
            "reason":   (
                "Profil solide qualifié pour un financement long terme"
                if score >= 70 and len(revenues) >= 3
                else f"Score minimum requis: 70 (votre score: {score})"
            ),
        },
        {
            "type":     "stock",
            "label":    "Avance sur stock",
            "icon":     "📦",
            "amount":   int(min(wc_amount * 0.5, 300_000)),
            "rate":     "2% / mois",
            "duration": "1 mois",
            "eligible": score >= 40,
            "reason":   (
                "Eligible — remboursable sur ventes du mois"
                if score >= 40
                else "Score minimum requis: 40"
            ),
        },
    ]

    # ── Recommandations ──────────────────────────────────────────────────────
    recs = []
    if mom_growth > 5:
        recs.append(f"🚀 Votre CA a progressé de {mom_growth}% ce mois — excellente dynamique !")
    elif mom_growth < -5:
        recs.append(f"⚠️ Baisse de CA de {abs(mom_growth)}% — analysez les heures creuses.")
    if recovery_rate < 70:
        recs.append("💳 Taux de recouvrement ardoise faible — relancez vos clients débiteurs.")
    elif recovery_rate >= 90:
        recs.append("✅ Excellent taux de recouvrement ardoise — continuez !")
    if expense_ratio > 60:
        recs.append(f"💸 Vos dépenses représentent {expense_ratio}% du CA — révisez vos coûts fixes.")
    if avg_ticket < 2000:
        recs.append("🍽️ Panier moyen faible — envisagez des menus ou promotions pour augmenter la commande moyenne.")
    if active_days < 60:
        recs.append(f"📅 Seulement {active_days} jours d'activité sur 90 — la régularité améliore votre score bancaire.")
    if not recs:
        recs.append("🌟 Vos indicateurs sont bons. Maintenez votre cadence pour accéder aux meilleures offres de financement.")

    return {
        "period_days":          90,
        "has_sufficient_data":  len(revenues) >= 1,
        "score":                score,
        "score_label":          score_label,
        "score_color":          score_color,
        "score_breakdown": {
            "stability":   stability_score,
            "recovery":    recovery_score,
            "volume":      volume_score,
            "growth":      growth_score,
            "regularity":  regularity_score,
        },
        "ratios": {
            "revenue_m0":       int(rev_m0),
            "revenue_m1":       int(rev_m1),
            "revenue_m2":       int(rev_m2),
            "revenue_avg":      int(rev_avg),
            "mom_growth":       mom_growth,
            "avg_ticket":       int(avg_ticket),
            "total_orders":     len(all_pays),
            "active_days":      active_days,
            "payment_methods":  pay_method_counts,
            "total_expenses":   int(total_expenses),
            "expense_ratio":    expense_ratio,
            "ardoise_recovery_rate": recovery_rate,
            "ardoise_outstanding":   int(total_outstanding),
            "ardoise_accounts": len(credit_accounts),
        },
        "loan_offers":      loan_offers,
        "recommendations":  recs,
    }


@app.get("/admin/network", tags=["admin"])
def admin_network_stats(
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """Vue réseau complète — Super Admin uniquement."""
    if current_user.role != models.UserRole.SUPER_ADMIN:
        raise HTTPException(403, "Accès réservé au Super Admin")

    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)

    # Établissements
    establishments = db.query(models.Establishment).all()
    active_est = [e for e in establishments if e.is_active]

    # Utilisateurs
    users = db.query(models.User).all()
    managers = [u for u in users if u.role == models.UserRole.MANAGER]
    waiters  = [u for u in users if u.role == models.UserRole.WAITER]
    clients  = [u for u in users if u.role == models.UserRole.CLIENT]

    # Paiements du mois
    payments_month = db.query(models.Payment).filter(models.Payment.created_at >= d30).all()
    revenue_month  = sum(p.amount for p in payments_month)

    # Ardoise outstanding
    credit_accounts = db.query(models.CreditAccount).all()
    total_outstanding = sum(max(a.balance, 0) for a in credit_accounts)

    # Wallet
    wallets = db.query(models.WalletAccount).all()
    total_wallet = sum(w.balance for w in wallets)

    # Par établissement (top 5 par revenue)
    est_stats = []
    for est in active_est:
        pays = [p for p in payments_month if p.establishment_id == est.id]
        rev  = sum(p.amount for p in pays)
        est_stats.append({
            "id": est.id, "name": est.name, "type": getattr(est,"type","restaurant"),
            "city": getattr(est,"city","—"), "revenue_30d": int(rev),
            "orders_30d": len(pays), "is_active": est.is_active,
        })
    est_stats.sort(key=lambda x: x["revenue_30d"], reverse=True)

    # Revenus par méthode
    method_breakdown = {}
    for p in payments_month:
        m = p.method.value if hasattr(p.method,"value") else str(p.method)
        method_breakdown[m] = method_breakdown.get(m, 0) + p.amount

    return {
        "summary": {
            "total_establishments": len(establishments),
            "active_establishments": len(active_est),
            "total_managers": len(managers),
            "total_waiters": len(waiters),
            "total_clients": len(clients),
            "revenue_month": int(revenue_month),
            "orders_month": len(payments_month),
            "wallet_liquidity": int(total_wallet),
            "ardoise_outstanding": int(total_outstanding),
        },
        "top_establishments": est_stats[:10],
        "revenue_by_method": {k: int(v) for k, v in method_breakdown.items()},
    }


# ── SOKORA BLACK — Programme de fidélité ─────────────────────────────────────

@app.post("/client/loyalty/earn", tags=["loyalty"])
def loyalty_earn(
    data: dict,
    db: Session = Depends(get_db),
):
    """
    Créditer des points de fidélité à un client après un paiement.
    Appelé automatiquement par process_payment.
    data: { client_phone, amount, establishment_id }
    """
    phone  = data.get("client_phone", "").strip()
    amount = float(data.get("amount", 0))
    est_id = data.get("establishment_id")
    if not phone or amount <= 0:
        return {"ok": False}

    client = db.query(models.ClientAccount).filter(models.ClientAccount.phone == phone).first()
    if not client:
        return {"ok": False, "reason": "client_not_found"}

    # Points : 1 point par 100 F dépensés
    points_earned = max(1, int(amount / 100))

    client.total_points = (client.total_points or 0) + points_earned
    client.total_spent  = (client.total_spent or 0) + amount
    client.visit_count  = (client.visit_count or 0) + 1
    db.add(models.LoyaltyTransaction(
        client_id        = client.id,
        establishment_id = est_id,
        points           = points_earned,
        tx_type          = "earn",
        description      = f"Paiement — {points_earned} pts",
    ))
    db.commit()

    # Déterminer le tier
    pts = client.total_points
    if   pts >= 50000: tier = "Diamond"
    elif pts >= 15000: tier = "Gold"
    elif pts >= 5000:  tier = "Silver"
    else:              tier = "Bronze"

    return {"ok": True, "points_earned": points_earned, "total_points": client.total_points, "tier": tier}


@app.post("/client/loyalty/redeem", tags=["loyalty"])
def loyalty_redeem(
    request: Request,
    data: dict,
    db: Session = Depends(get_db),
):
    """
    Utiliser des points de fidélité (récompense, remise).
    data: { points, description }
    """
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token client requis")

    client = db.query(models.ClientAccount).filter(models.ClientAccount.client_token == token).first()
    if not client:
        raise HTTPException(404, "Client introuvable")

    points = int(data.get("points", 0))
    if points <= 0:
        raise HTTPException(400, "Nombre de points invalide")
    if (client.total_points or 0) < points:
        raise HTTPException(400, "Points insuffisants")

    client.total_points -= points
    db.add(models.LoyaltyTransaction(
        client_id   = client.id,
        points      = points,
        tx_type     = "redeem",
        description = data.get("description") or f"Récompense utilisée — {points} pts",
    ))
    db.commit()

    return {"ok": True, "points_used": points, "total_points": client.total_points}


@app.get("/client/loyalty", tags=["loyalty"])
def get_loyalty(
    request: Request,
    db: Session = Depends(get_db),
):
    """Profil fidélité du client connecté."""
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token client requis")

    client = db.query(models.ClientAccount).filter(models.ClientAccount.client_token == token).first()
    if not client:
        raise HTTPException(404, "Client introuvable")

    pts = client.total_points or 0
    if   pts >= 50000: tier, tier_color, next_tier, next_pts = "Diamond", "#B9F2FF", None,      None
    elif pts >= 15000: tier, tier_color, next_tier, next_pts = "Gold",    "#FFD700", "Diamond", 50000
    elif pts >= 5000:  tier, tier_color, next_tier, next_pts = "Silver",  "#C0C0C0", "Gold",    15000
    else:              tier, tier_color, next_tier, next_pts = "Bronze",  "#CD7F32", "Silver",  5000

    # Historique réel des points de fidélité
    txs = db.query(models.LoyaltyTransaction).filter(
        models.LoyaltyTransaction.client_id == client.id
    ).order_by(models.LoyaltyTransaction.created_at.desc()).limit(20).all()
    transactions = [
        {
            "id":     tx.id,
            "label":  tx.description or ("Points gagnés" if tx.tx_type == "earn" else "Points utilisés"),
            "points": tx.points,
            "type":   tx.tx_type,
            "date":   tx.created_at.strftime("%d/%m/%Y") if tx.created_at else "—",
        }
        for tx in txs
    ]

    return {
        "client_id":    client.id,
        "name":         client.name or "Client",
        "phone":        client.phone,
        "total_points": pts,
        "total_spent":  client.total_spent or 0,
        "visit_count":  client.visit_count or 0,
        "tier":         tier,
        "tier_color":   tier_color,
        "next_tier":    next_tier,
        "next_tier_pts": next_pts,
        "cashback_rate": {"Bronze":1,"Silver":2,"Gold":3,"Diamond":5}[tier],
        "transactions": transactions,
    }


@app.get("/reports/monthly", tags=["reports"])
def generate_monthly_report(
    month: str = None,  # format "2026-04", défaut = mois en cours
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db),
):
    """
    Génère un rapport PDF mensuel pour l'établissement du manager.
    Contient : CA, dépenses, bénéfice, top produits, ardoise.
    """
    from datetime import datetime, timezone, date
    from fastapi.responses import StreamingResponse
    import io

    # Parser le mois
    if month:
        try:
            year, mo = int(month.split("-")[0]), int(month.split("-")[1])
        except:
            raise HTTPException(400, "Format mois invalide (ex: 2026-04)")
    else:
        now = datetime.now(timezone.utc)
        year, mo = now.year, now.month

    from calendar import monthrange
    _, last_day = monthrange(year, mo)
    start = datetime(year, mo, 1, tzinfo=timezone.utc)
    end   = datetime(year, mo, last_day, 23, 59, 59, tzinfo=timezone.utc)

    est_id = current_user.establishment_id
    est    = db.query(models.Establishment).filter(models.Establishment.id == est_id).first()

    # Données du mois
    payments = db.query(models.Payment).filter(
        models.Payment.establishment_id == est_id,
        models.Payment.created_at >= start,
        models.Payment.created_at <= end,
    ).all()

    expenses = db.query(models.Expense).filter(
        models.Expense.establishment_id == est_id,
        models.Expense.created_at >= start,
        models.Expense.created_at <= end,
    ).all()

    total_revenue  = sum(p.amount for p in payments)
    total_expenses = sum(e.amount for e in expenses)
    profit         = total_revenue - total_expenses

    # Répartition par méthode
    methods = {}
    for p in payments:
        m = p.method.value if hasattr(p.method, "value") else str(p.method)
        methods[m] = methods.get(m, 0) + p.amount

    # Top produits (via order items)
    from sqlalchemy import func
    top_products = db.query(
        models.Product.name,
        func.sum(models.OrderItem.quantity).label("qty"),
        func.sum(models.OrderItem.quantity * models.OrderItem.unit_price).label("revenue"),
    ).join(models.OrderItem, models.Product.id == models.OrderItem.product_id
    ).join(models.Order, models.OrderItem.order_id == models.Order.id
    ).filter(
        models.Order.establishment_id == est_id,
        models.Order.created_at >= start,
        models.Order.created_at <= end,
        models.Order.status == models.OrderStatus.PAID,
    ).group_by(models.Product.name
    ).order_by(func.sum(models.OrderItem.quantity).desc()
    ).limit(10).all()

    # Ardoise (credit)
    credit_accounts = db.query(models.CreditAccount).filter(
        models.CreditAccount.establishment_id == est_id,
        models.CreditAccount.is_active == True,
    ).all()
    total_outstanding = sum(max(a.balance, 0) for a in credit_accounts)

    # Génération du contenu du rapport (texte structuré → PDF)
    month_name = ["", "Janvier","Février","Mars","Avril","Mai","Juin",
                  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"][mo]
    est_name   = est.name if est else "Établissement"

    try:
        from fpdf import FPDF

        pdf = FPDF()
        pdf.add_page()
        pdf.set_auto_page_break(auto=True, margin=15)

        # En-tête
        pdf.set_font("Helvetica", "B", 20)
        pdf.set_text_color(15, 30, 53)
        pdf.cell(0, 12, "SOKORA", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.set_font("Helvetica", "", 13)
        pdf.set_text_color(122, 143, 171)
        pdf.cell(0, 8, f"Rapport mensuel - {month_name} {year}", new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.cell(0, 8, est_name, new_x="LMARGIN", new_y="NEXT", align="C")
        pdf.ln(8)

        # Ligne séparatrice
        pdf.set_draw_color(221, 228, 240)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(8)

        def section(title):
            pdf.set_font("Helvetica", "B", 12)
            pdf.set_text_color(15, 30, 53)
            pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)

        def row(label, value, bold_val=False, color=None):
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(122, 143, 171)
            pdf.cell(100, 7, label)
            pdf.set_font("Helvetica", "B" if bold_val else "", 10)
            if color:
                pdf.set_text_color(*color)
            else:
                pdf.set_text_color(15, 30, 53)
            pdf.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT")

        def fmt(n):
            return f"{int(n):,} F CFA".replace(",", " ")

        # Résumé financier
        section("RÉSUMÉ FINANCIER")
        row("Chiffre d'affaires", fmt(total_revenue), bold_val=True, color=(25, 169, 157))
        row("Total dépenses",     fmt(total_expenses), color=(232, 64, 64))
        row("Bénéfice net",       fmt(profit), bold_val=True, color=(34, 197, 94) if profit >= 0 else (232, 64, 64))
        row("Nombre de commandes", str(len(payments)))
        row("Ticket moyen", fmt(total_revenue / len(payments)) if payments else "—")
        pdf.ln(6)

        # Répartition paiements
        section("MODES DE PAIEMENT")
        LABELS = {
            "CASH": "Espèces", "WAVE": "Wave", "MOBILE_MONEY": "Mobile Money",
            "ORANGE_MONEY": "Orange Money", "MTN_MONEY": "MTN Money",
            "CARD": "Carte", "WALLET": "Wallet", "CREDIT": "Ardoise",
        }
        for m, amt in sorted(methods.items(), key=lambda x: -x[1]):
            pct = round(amt / total_revenue * 100) if total_revenue else 0
            row(LABELS.get(m, m), f"{fmt(amt)}  ({pct}%)")
        pdf.ln(6)

        # Dépenses par catégorie
        if expenses:
            section("DÉPENSES PAR CATÉGORIE")
            cats = {}
            for e in expenses:
                cat = e.category.value if hasattr(e.category, "value") else str(e.category)
                cats[cat] = cats.get(cat, 0) + e.amount
            CAT_FR = {"STOCK": "Stock", "SALARY": "Salaires", "RENT": "Loyer", "UTILITY": "Charges", "OTHER": "Autres"}
            for cat, amt in sorted(cats.items(), key=lambda x: -x[1]):
                row(CAT_FR.get(cat, cat), fmt(amt))
            pdf.ln(6)

        # Top produits
        if top_products:
            section("TOP PRODUITS DU MOIS")
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(122, 143, 171)
            pdf.cell(90, 7, "Produit")
            pdf.cell(30, 7, "Qté vendue", align="R")
            pdf.cell(0,  7, "CA généré", align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.line(10, pdf.get_y(), 200, pdf.get_y())
            for prod in top_products:
                pdf.set_font("Helvetica", "", 10)
                pdf.set_text_color(15, 30, 53)
                pdf.cell(90, 7, str(prod.name)[:40])
                pdf.set_text_color(122, 143, 171)
                pdf.cell(30, 7, str(prod.qty), align="R")
                pdf.set_text_color(25, 169, 157)
                pdf.cell(0,  7, fmt(prod.revenue or 0), align="R", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(6)

        # Ardoise
        section("ARDOISE & CRÉDIT CLIENT")
        row("Encours ardoise total", fmt(total_outstanding), bold_val=True,
            color=(232, 64, 64) if total_outstanding > 100000 else None)
        row("Comptes actifs", str(len(credit_accounts)))
        pdf.ln(6)

        # Pied de page
        pdf.set_y(-25)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_text_color(122, 143, 171)
        pdf.cell(0, 5, f"Généré par SOKORA Platform · {datetime.now().strftime('%d/%m/%Y %H:%M')} · sokora.app",
                 align="C", new_x="LMARGIN", new_y="NEXT")

        # Retourner le PDF
        buf = io.BytesIO(pdf.output())
        filename = f"sokora_rapport_{est_name.replace(' ', '_')}_{year}_{mo:02d}.pdf"
        return StreamingResponse(
            buf,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    except ImportError:
        # fpdf2 non installé — retourner JSON à la place
        return {
            "month": f"{month_name} {year}",
            "establishment": est_name,
            "revenue": int(total_revenue),
            "expenses": int(total_expenses),
            "profit": int(profit),
            "orders": len(payments),
            "payment_methods": {k: int(v) for k, v in methods.items()},
            "ardoise_outstanding": int(total_outstanding),
            "top_products": [{"name": p.name, "qty": p.qty, "revenue": int(p.revenue or 0)} for p in top_products],
            "note": "Installez fpdf2 pour la génération PDF : pip install fpdf2",
        }


# ═══════════════════════════════════════════════════════
#  WALLET SOKORA — ENDPOINTS
# ═══════════════════════════════════════════════════════

def _require_client(request: Request, db: Session) -> models.ClientAccount:
    token = request.headers.get("X-Client-Token", "")
    if not token:
        raise HTTPException(401, "Token requis")
    client = crud.get_client_from_token(db, token)
    if not client:
        raise HTTPException(401, "Token invalide")
    return client


@app.get("/wallet/me", tags=["wallet"])
def wallet_get(request: Request, db: Session = Depends(get_db)):
    """Solde et historique du wallet client."""
    client = _require_client(request, db)
    return crud.get_wallet(db, client.id)


@app.post("/wallet/topup", tags=["wallet"])
def wallet_topup(request: Request, data: dict, db: Session = Depends(get_db)):
    """Demande de recharge wallet."""
    client = _require_client(request, db)
    amount = data.get("amount", 0)
    method = data.get("method", "cash")
    phone_used = data.get("phone_used")
    est_id = data.get("establishment_id")
    result = crud.request_topup(db, client.id, float(amount), method, phone_used, est_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/wallet/pay", tags=["wallet"])
def wallet_pay(request: Request, data: dict, db: Session = Depends(get_db)):
    """Payer une commande avec le wallet."""
    client = _require_client(request, db)
    order_id = data.get("order_id")
    est_id   = data.get("establishment_id")
    amount   = data.get("amount", 0)
    result = crud.pay_with_wallet(db, client.id, order_id, est_id, float(amount))
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/wallet/transfer", tags=["wallet"])
def wallet_transfer(request: Request, data: dict, db: Session = Depends(get_db)):
    """Transfert wallet vers un autre client SOKORA."""
    client = _require_client(request, db)
    recipient_phone = data.get("recipient_phone", "").strip()
    amount = data.get("amount", 0)
    if not recipient_phone:
        raise HTTPException(400, "Numéro destinataire requis")
    result = crud.transfer_wallet(db, client.id, recipient_phone, float(amount))
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


# ── CAISSIER / MANAGER ─────────────────────────────────

@app.get("/wallet/topups/pending", tags=["wallet"])
def wallet_pending_topups(
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Liste des recharges en attente (caissier)."""
    return crud.get_pending_topups(db, current_user.establishment_id)


@app.patch("/wallet/topups/{topup_id}/confirm", tags=["wallet"])
def wallet_confirm_topup(
    topup_id: int,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Caissier confirme une recharge."""
    result = crud.confirm_topup(db, topup_id, current_user.id, current_user.establishment_id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.patch("/wallet/topups/{topup_id}/reject", tags=["wallet"])
def wallet_reject_topup(
    topup_id: int,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Caissier rejette une recharge."""
    result = crud.reject_topup(db, topup_id, current_user.id)
    if "error" in result:
        raise HTTPException(400, result["error"])
    return result


@app.post("/wallet/topups/express", tags=["wallet"])
def wallet_express_topup(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Caissier recharge directement un client par numero de telephone."""
    phone  = data.get("phone", "").strip()
    amount = data.get("amount", 0)
    method = data.get("method", "cash")
    if not phone:
        raise HTTPException(400, "Numero requis")

    # Trouver ou creer compte client
    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == phone
    ).first()
    if not client:
        raise HTTPException(404, "Client non trouve dans SOKORA")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    if not wallet:
        wallet = models.WalletAccount(client_id=client.id, balance=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    balance_before = wallet.balance
    wallet.balance      += float(amount)
    wallet.total_loaded += float(amount)
    wallet.updated_at    = datetime.utcnow()

    from app import models as m
    tx = models.WalletTransaction(
        wallet_id        = wallet.id,
        tx_type          = "topup",
        amount           = float(amount),
        balance_before   = balance_before,
        balance_after    = wallet.balance,
        description      = f"Recharge express {method}",
        establishment_id = current_user.establishment_id,
        created_by       = current_user.id,
    )
    db.add(tx)
    db.commit()
    return {"success": True, "new_balance": wallet.balance, "amount": float(amount)}


@app.get("/wallet/client-balance/{phone}", tags=["wallet"])
def wallet_client_balance(
    phone: str,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Verifier le solde wallet d'un client par telephone (usage serveur)."""
    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == phone
    ).first()
    if not client:
        raise HTTPException(404, "Client non trouve")
    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    balance = wallet.balance if wallet else 0.0
    return {
        "phone":   phone,
        "name":    client.name,
        "balance": balance,
    }


@app.post("/wallet/pay-by-phone", tags=["wallet"])
def wallet_pay_by_phone(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Serveur encaisse un paiement wallet via numero telephone client."""
    phone    = data.get("client_phone", "").strip()
    order_id = data.get("order_id")
    amount   = float(data.get("amount", 0))
    est_id   = data.get("establishment_id") or current_user.establishment_id

    if not phone:
        raise HTTPException(400, "Numero client requis")
    if amount <= 0:
        raise HTTPException(400, "Montant invalide")

    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == phone
    ).first()
    if not client:
        raise HTTPException(404, "Client non trouve dans SOKORA")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    if not wallet:
        raise HTTPException(400, "Aucun wallet trouve pour ce client")
    if wallet.balance < amount:
        raise HTTPException(400, f"Solde insuffisant: {wallet.balance} F disponibles")

    # Debiter le wallet
    balance_before  = wallet.balance
    wallet.balance -= amount
    wallet.updated_at = datetime.utcnow()

    # Transaction debit
    tx_debit = models.WalletTransaction(
        wallet_id        = wallet.id,
        tx_type          = "payment",
        amount           = -amount,
        balance_before   = balance_before,
        balance_after    = wallet.balance,
        description      = f"Paiement commande #{order_id}",
        establishment_id = est_id,
        created_by       = current_user.id,
    )
    db.add(tx_debit)

    # Cashback 2%
    cashback = round(amount * 0.02)
    if cashback > 0:
        wallet.balance += cashback
        tx_cb = models.WalletTransaction(
            wallet_id        = wallet.id,
            tx_type          = "cashback",
            amount           = cashback,
            balance_before   = wallet.balance - cashback,
            balance_after    = wallet.balance,
            description      = f"Cashback 2% commande #{order_id}",
            establishment_id = est_id,
        )
        db.add(tx_cb)

    # Enregistrer le paiement
    try:
        payment = models.Payment(
            order_id   = order_id,
            amount     = amount,
            method     = "wallet",
            created_by = current_user.id,
        )
        db.add(payment)
    except: pass

    # Marquer commande payee
    if order_id:
        order = db.query(models.Order).filter(models.Order.id == order_id).first()
        if order:
            order.status = "paid"

    db.commit()

    # Points fidelite (1 point / 100 F)
    try:
        est = db.query(models.Establishment).filter(
            models.Establishment.id == est_id
        ).first()
        pts_rate = getattr(est, 'points_per_100f', 1) or 1
        points = int(amount / 100) * pts_rate
        if points > 0:
            client.total_points = (client.total_points or 0) + points
            client.total_spent  = (client.total_spent  or 0) + amount
            client.visit_count  = (client.visit_count  or 0) + 1
            db.add(models.LoyaltyTransaction(
                client_id        = client.id,
                establishment_id = est_id,
                order_id         = order_id,
                points           = points,
                tx_type          = "earn",
                description      = f"Paiement wallet #{order_id}",
            ))
            db.commit()
    except: pass

    return {
        "success":     True,
        "paid":        amount,
        "cashback":    cashback,
        "new_balance": wallet.balance,
        "client_name": client.name or phone,
    }


# ── WALLET QR CODE DYNAMIQUE (refresh 10s) ───────────────────────────────────

WALLET_QR_SECRET = "sokora_wallet_qr_2025_secret"


def _make_wallet_qr_token(client_id: int, service_type: str = "restaurant") -> dict:
    """Génère un token QR signé, valide 12 secondes (marge refresh 10s)."""
    expires_at = int(time.time()) + 12
    payload = f"{client_id}:{service_type}:{expires_at}"
    sig = hmac.new(WALLET_QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    token = f"{payload}:{sig}"
    return {"qr_token": token, "expires_at": expires_at, "service_type": service_type}


def _verify_wallet_qr_token(token: str) -> Optional[dict]:
    """Vérifie et décode un QR token wallet. Retourne None si invalide/expiré."""
    try:
        parts = token.split(":")
        if len(parts) != 4:
            return None
        client_id_str, service_type, expires_at_str, sig = parts
        expires_at = int(expires_at_str)
        if time.time() > expires_at:
            return None   # expiré
        payload = f"{client_id_str}:{service_type}:{expires_at_str}"
        expected_sig = hmac.new(WALLET_QR_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
        if not hmac.compare_digest(sig, expected_sig):
            return None   # signature invalide
        return {"client_id": int(client_id_str), "service_type": service_type}
    except Exception:
        return None


@app.get("/wallet/qr-token", tags=["wallet"])
def wallet_qr_token(
    service: str = "restaurant",
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Génère un QR token dynamique pour le client (validité 12s).
    Appelé par l'app mobile toutes les 10 secondes.
    """
    client = _require_client(request, db)
    # Vérifier que le wallet existe
    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    balance = wallet.balance if wallet else 0.0
    token_data = _make_wallet_qr_token(client.id, service)
    token_data["balance"] = balance
    token_data["client_name"] = client.name or client.phone
    return token_data


@app.post("/wallet/pay-by-qr", tags=["wallet"])
def wallet_pay_by_qr(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gérant/Serveur scanne le QR client pour encaisser.
    data: { qr_token, amount, order_id?, establishment_id?, service_type? }
    """
    qr_token = data.get("qr_token", "").strip()
    amount   = float(data.get("amount", 0))
    order_id = data.get("order_id")
    est_id   = data.get("establishment_id") or current_user.establishment_id
    service  = data.get("service_type", "restaurant")

    if not qr_token:
        raise HTTPException(400, "QR token requis")
    if amount <= 0:
        raise HTTPException(400, "Montant invalide")

    # Vérifier et décoder le token
    decoded = _verify_wallet_qr_token(qr_token)
    if not decoded:
        raise HTTPException(400, "QR code invalide ou expiré — demandez au client d'en générer un nouveau")

    client_id = decoded["client_id"]
    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.id == client_id
    ).first()
    if not client:
        raise HTTPException(404, "Client introuvable")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client_id
    ).first()
    if not wallet:
        raise HTTPException(400, "Aucun wallet pour ce client")
    if wallet.balance < amount:
        raise HTTPException(400, f"Solde insuffisant : {wallet.balance:.0f} FCFA disponibles")

    # Débiter
    balance_before = wallet.balance
    wallet.balance -= amount
    wallet.updated_at = datetime.now(timezone.utc)

    tx = models.WalletTransaction(
        wallet_id        = wallet.id,
        tx_type          = "payment",
        amount           = -amount,
        balance_before   = balance_before,
        balance_after    = wallet.balance,
        description      = f"Paiement QR — {service}",
        establishment_id = est_id,
        service_type     = service,
        created_by       = current_user.id,
    )
    db.add(tx)

    # Cashback 2%
    cashback = round(amount * 0.02)
    if cashback > 0:
        wallet.balance += cashback
        tx_cb = models.WalletTransaction(
            wallet_id        = wallet.id,
            tx_type          = "cashback",
            amount           = cashback,
            balance_before   = wallet.balance - cashback,
            balance_after    = wallet.balance,
            description      = f"Cashback 2% — {service}",
            establishment_id = est_id,
            service_type     = service,
        )
        db.add(tx_cb)

    db.commit()
    return {
        "success":     True,
        "paid":        amount,
        "cashback":    cashback,
        "new_balance": wallet.balance,
        "client_name": client.name or client.phone,
        "service":     service,
    }


@app.get("/wallet/transactions", tags=["wallet"])
def wallet_all_transactions(
    service: Optional[str] = None,
    request: Request = None,
    db: Session = Depends(get_db)
):
    """
    Historique complet des transactions du client, toutes par service.
    Paramètre optionnel ?service=restaurant|hotel|voyage pour filtrer.
    """
    client = _require_client(request, db)
    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    if not wallet:
        return {"balance": 0, "transactions": []}

    q = db.query(models.WalletTransaction).filter(
        models.WalletTransaction.wallet_id == wallet.id
    )
    if service:
        q = q.filter(models.WalletTransaction.service_type == service)
    txs = q.order_by(models.WalletTransaction.created_at.desc()).limit(100).all()

    return {
        "balance": wallet.balance,
        "transactions": [
            {
                "id":           tx.id,
                "type":         tx.tx_type,
                "amount":       tx.amount,
                "balance_after": tx.balance_after,
                "description":  tx.description,
                "service_type": tx.service_type,
                "created_at":   tx.created_at.isoformat() if tx.created_at else None,
            }
            for tx in txs
        ],
        "by_service": _group_by_service(txs),
    }


def _group_by_service(txs) -> dict:
    """Regroupe les totaux dépensés par service."""
    totals: dict = {}
    for tx in txs:
        svc = tx.service_type or "restaurant"
        if svc not in totals:
            totals[svc] = {"spent": 0.0, "topup": 0.0, "count": 0}
        if tx.tx_type == "payment":
            totals[svc]["spent"] += abs(tx.amount)
            totals[svc]["count"] += 1
        elif tx.tx_type == "topup":
            totals[svc]["topup"] += tx.amount
    return totals


# ── PAYMENT REQUESTS (confirmation paiement côté client) ─────────────────────

@app.post("/wallet/request-payment", tags=["wallet"])
def wallet_request_payment(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Serveur crée une demande de paiement à envoyer au client."""
    client_phone = data.get("client_phone", "").strip()
    order_id     = data.get("order_id")
    amount       = float(data.get("amount", 0))

    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == client_phone
    ).first()
    if not client:
        raise HTTPException(404, "Client non trouvé dans SOKORA")

    req = models.WalletPaymentRequest(
        client_id        = client.id,
        order_id         = order_id,
        establishment_id = current_user.establishment_id,
        amount           = amount,
        status           = "pending",
        created_by       = current_user.id,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return {"success": True, "request_id": req.id}


@app.get("/wallet/payment-requests", tags=["wallet"])
def wallet_get_payment_requests(
    current_client: models.ClientAccount = Depends(security.get_current_client),
    db: Session = Depends(get_db)
):
    """Client récupère ses demandes de paiement en attente."""
    reqs = db.query(models.WalletPaymentRequest).filter(
        models.WalletPaymentRequest.client_id == current_client.id,
        models.WalletPaymentRequest.status    == "pending",
    ).order_by(models.WalletPaymentRequest.created_at.desc()).all()

    result = []
    for r in reqs:
        est = db.query(models.Establishment).filter(
            models.Establishment.id == r.establishment_id
        ).first()
        order = db.query(models.Order).filter(models.Order.id == r.order_id).first()
        result.append({
            "id":               r.id,
            "amount":           r.amount,
            "order_id":         r.order_id,
            "establishment_name": est.name if est else "Restaurant",
            "table_number":     order.table_id if order else None,
            "created_at":       r.created_at.isoformat() if r.created_at else None,
        })
    return {"requests": result}


@app.post("/wallet/payment-requests/{req_id}/confirm", tags=["wallet"])
def wallet_confirm_payment_request(
    req_id: int,
    current_client: models.ClientAccount = Depends(security.get_current_client),
    db: Session = Depends(get_db)
):
    """Client confirme une demande de paiement — débite son wallet."""
    req = db.query(models.WalletPaymentRequest).filter(
        models.WalletPaymentRequest.id        == req_id,
        models.WalletPaymentRequest.client_id == current_client.id,
        models.WalletPaymentRequest.status    == "pending",
    ).first()
    if not req:
        raise HTTPException(404, "Demande introuvable")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == current_client.id
    ).first()
    if not wallet or wallet.balance < req.amount:
        raise HTTPException(400, f"Solde insuffisant: {wallet.balance if wallet else 0} F")

    # Débiter
    balance_before  = wallet.balance
    wallet.balance -= req.amount
    wallet.updated_at = datetime.utcnow()

    db.add(models.WalletTransaction(
        wallet_id        = wallet.id,
        tx_type          = "payment",
        amount           = -req.amount,
        balance_before   = balance_before,
        balance_after    = wallet.balance,
        description      = f"Paiement commande #{req.order_id}",
        establishment_id = req.establishment_id,
    ))

    # Cashback 2%
    cashback = round(req.amount * 0.02)
    if cashback > 0:
        wallet.balance += cashback
        db.add(models.WalletTransaction(
            wallet_id        = wallet.id,
            tx_type          = "cashback",
            amount           = cashback,
            balance_before   = wallet.balance - cashback,
            balance_after    = wallet.balance,
            description      = f"Cashback 2% commande #{req.order_id}",
            establishment_id = req.establishment_id,
        ))

    # Marquer commande payée
    if req.order_id:
        order = db.query(models.Order).filter(models.Order.id == req.order_id).first()
        if order:
            order.status = "paid"
        try:
            db.add(models.Payment(order_id=req.order_id, amount=req.amount, method="wallet"))
        except: pass

    req.status = "confirmed"
    db.commit()
    return {"success": True, "cashback": cashback, "new_balance": wallet.balance}


@app.post("/wallet/payment-requests/{req_id}/reject", tags=["wallet"])
def wallet_reject_payment_request(
    req_id: int,
    current_client: models.ClientAccount = Depends(security.get_current_client),
    db: Session = Depends(get_db)
):
    """Client refuse une demande de paiement."""
    req = db.query(models.WalletPaymentRequest).filter(
        models.WalletPaymentRequest.id        == req_id,
        models.WalletPaymentRequest.client_id == current_client.id,
        models.WalletPaymentRequest.status    == "pending",
    ).first()
    if not req:
        raise HTTPException(404, "Demande introuvable")
    req.status = "rejected"
    db.commit()
    return {"success": True}


# ── REAPPRO ───────────────────────────────────────────────────────────────────
@app.post("/stock/reappro", tags=["stock"])
def create_reappro(data: dict, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.create_reappro(db, current_user.establishment_id, current_user.id, data)

@app.get("/stock/reappro", tags=["stock"])
def get_reappros(status: str = None, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_reappros(db, current_user.establishment_id, status)

@app.patch("/stock/reappro/{reappro_id}/receive", tags=["stock"])
def receive_reappro(reappro_id: int, data: dict, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    qty = data.get("quantity_received")
    if not qty or qty <= 0:
        raise HTTPException(400, "Quantite invalide")
    return crud.receive_reappro(db, reappro_id, current_user.establishment_id, current_user.id, qty)


# ── STOCK DASHBOARD AVANCE ────────────────────────────────────────────────────
@app.get("/stock/dashboard", tags=["stock"])
def get_stock_dashboard(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_stock_dashboard(db, current_user.establishment_id)

@app.get("/stock/movements-period", tags=["stock"])
def get_stock_movements_period(period: str = "today", current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_stock_movements_period(db, current_user.establishment_id, period)

@app.get("/stock/bilan", tags=["stock"])
def get_stock_bilan(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_stock_bilan(db, current_user.establishment_id)

@app.delete("/stock/{product_id}", tags=["stock"])
def delete_product(product_id: int, current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    ok = crud.delete_product(db, product_id, current_user.establishment_id)
    if not ok:
        raise HTTPException(404, "Produit introuvable")
    return {"ok": True}


# ── WALLET MANAGER DASHBOARD ──────────────────────────────────────────────────
@app.get("/wallet/manager", tags=["wallet"])
def wallet_manager(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_wallet_manager(db, current_user.establishment_id)

@app.get("/wallet/liquidity", tags=["wallet"])
def wallet_liquidity(current_user=Depends(security.require_manager), db: Session=Depends(get_db)):
    return crud.get_wallet_liquidity(db, current_user.establishment_id)


@app.patch("/orders/{order_id}/start", tags=["kds"])
def start_order(order_id: int, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != current_user.establishment_id:
        raise HTTPException(404, "Commande introuvable")
    order.status = models.OrderStatus.IN_PROGRESS
    db.commit()
    order_ws.broadcast_sync(current_user.establishment_id, {
        "type": "order_update", "order_id": order_id, "status": "IN_PROGRESS",
    })
    return {"ok": True, "status": "IN_PROGRESS"}

@app.patch("/orders/{order_id}/ready", tags=["kds"])
def ready_order(order_id: int, current_user=Depends(security.get_current_user), db: Session=Depends(get_db)):
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != current_user.establishment_id:
        raise HTTPException(404, "Commande introuvable")
    order.status = models.OrderStatus.READY
    db.commit()
    order_ws.broadcast_sync(current_user.establishment_id, {
        "type": "order_update", "order_id": order_id, "status": "READY",
    })
    return {"ok": True, "status": "READY"}


# ═══════════════════════════════════════════════════════
#  GPS TRACKING — WEBSOCKET TEMPS RÉEL
# ═══════════════════════════════════════════════════════

# Gestionnaire de connexions WebSocket par trip_id
class GPSConnectionManager:
    def __init__(self):
        self.connections: Dict[int, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, trip_id: int):
        await websocket.accept()
        if trip_id not in self.connections:
            self.connections[trip_id] = set()
        self.connections[trip_id].add(websocket)

    def disconnect(self, websocket: WebSocket, trip_id: int):
        if trip_id in self.connections:
            self.connections[trip_id].discard(websocket)

    async def broadcast(self, trip_id: int, data: dict):
        if trip_id not in self.connections:
            return
        dead = set()
        for ws in self.connections[trip_id]:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.connections[trip_id].discard(ws)

gps_manager = GPSConnectionManager()


@app.websocket("/ws/gps/{trip_id}")
async def gps_websocket(websocket: WebSocket, trip_id: int, db: Session = Depends(get_db)):
    """
    WebSocket GPS temps réel.
    - Passagers : se connectent pour recevoir les positions
    - Chauffeurs : envoient leur position toutes les 5s
    """
    await gps_manager.connect(websocket, trip_id)
    # Envoyer la dernière position connue immédiatement
    try:
        from .crud_voyage import get_vehicle_last_location
        last = get_vehicle_last_location(db, trip_id)
        if last:
            await websocket.send_json({"type": "location", **last})
    except Exception:
        pass

    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "location":
                # Chauffeur envoie sa position
                lat = data.get("latitude")
                lng = data.get("longitude")
                spd = data.get("speed_kmh")
                if lat and lng:
                    from .crud_voyage import update_vehicle_location
                    update_vehicle_location(db, trip_id, lat, lng, spd)
                    # Broadcaster à tous les passagers
                    await gps_manager.broadcast(trip_id, {
                        "type":      "location",
                        "trip_id":   trip_id,
                        "latitude":  lat,
                        "longitude": lng,
                        "speed_kmh": spd,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    })
            elif data.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        gps_manager.disconnect(websocket, trip_id)


# ═══════════════════════════════════════════════════════
#  PUSH NOTIFICATIONS — EXPO
# ═══════════════════════════════════════════════════════

@app.post("/notifications/register", tags=["notifications"])
def register_push_token(data: dict, db: Session = Depends(get_db)):
    """Enregistrer un token Expo Push (stocké côté client pour l'instant)."""
    return {"ok": True, "registered": True}


@app.post("/notifications/send", tags=["notifications"])
async def send_push_notification(
    data: dict,
    current_user: models.User = Depends(security.require_manager),
    db: Session = Depends(get_db)
):
    """
    Envoyer une notification push Expo.
    data: { tokens: [...], title, body, extra? }
    """
    import httpx
    tokens = data.get("tokens", [])
    title  = data.get("title", "SOKORA")
    body   = data.get("body", "")
    extra  = data.get("extra", {})

    messages = [
        {"to": t, "title": title, "body": body, "data": extra, "sound": "default"}
        for t in tokens if t.startswith("ExponentPushToken")
    ]
    if not messages:
        return {"sent": 0}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://exp.host/--/api/v2/push/send",
            json=messages,
            headers={"Content-Type": "application/json"},
            timeout=10,
        )
    return {"sent": len(messages), "response": resp.json()}


# ═══════════════════════════════════════════════════════
#  PAYMENT REQUESTS — QR Code encaissement
# ═══════════════════════════════════════════════════════

import uuid as _uuid


@app.post("/payment-requests", tags=["payment-qr"])
def create_payment_request(
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Serveur crée une demande de paiement QR.
    data: { order_ids: [int], table_id?, table_number? }
    Retourne un token unique à encoder en QR.
    """
    order_ids    = data.get("order_ids", [])
    table_id     = data.get("table_id")
    table_number = data.get("table_number")

    if not order_ids:
        raise HTTPException(400, "order_ids requis")

    # Récupérer les commandes et construire le snapshot
    orders = db.query(models.Order).filter(
        models.Order.id.in_(order_ids),
        models.Order.establishment_id == current_user.establishment_id,
    ).all()

    if not orders:
        raise HTTPException(404, "Commandes introuvables")

    items_snapshot = []
    total = 0.0
    for o in orders:
        items = db.query(models.OrderItem).filter(models.OrderItem.order_id == o.id).all()
        for it in items:
            p = db.get(models.Product, it.product_id)
            if not it.is_complimentary:
                line_total = (it.unit_price or 0) * (it.quantity or 1)
                total += line_total
                items_snapshot.append({
                    "order_id":    o.id,
                    "product_name": p.name if p else f"Article #{it.product_id}",
                    "qty":         it.quantity,
                    "unit_price":  it.unit_price,
                    "line_total":  line_total,
                })

    est = db.get(models.Establishment, current_user.establishment_id)

    token = _uuid.uuid4().hex[:12].upper()

    pr = models.PaymentRequest(
        token              = token,
        establishment_id   = current_user.establishment_id,
        establishment_name = est.name if est else "Établissement",
        table_id           = table_id,
        table_number       = table_number,
        order_ids          = order_ids,
        items_snapshot     = items_snapshot,
        total_amount       = total,
        status             = "pending",
        created_by         = current_user.id,
    )
    db.add(pr)
    db.commit()
    db.refresh(pr)

    return {
        "token":             pr.token,
        "qr_data":           f"sokora://pay/{pr.token}",
        "total_amount":      pr.total_amount,
        "establishment_name": pr.establishment_name,
        "table_number":      pr.table_number,
        "items_count":       len(items_snapshot),
        "expires_in":        600,   # 10 minutes
    }


@app.get("/payment-requests/{token}", tags=["payment-qr"])
def get_payment_request(token: str, db: Session = Depends(get_db)):
    """
    CLIENT — obtenir les détails d'une demande de paiement (sans auth).
    """
    pr = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.token == token
    ).first()
    if not pr:
        raise HTTPException(404, "Demande de paiement introuvable")

    # Vérifier expiration (10 min)
    if pr.created_at:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        if pr.created_at.tzinfo is None:
            from datetime import timezone as tz
            created = pr.created_at.replace(tzinfo=timezone.utc)
        else:
            created = pr.created_at
        if (now - created).total_seconds() > 600:
            pr.status = "expired"
            db.commit()

    return {
        "token":             pr.token,
        "status":            pr.status,
        "establishment_name": pr.establishment_name,
        "table_number":      pr.table_number,
        "items":             pr.items_snapshot or [],
        "total_amount":      pr.total_amount,
        "created_at":        pr.created_at.isoformat() if pr.created_at else None,
    }


@app.post("/payment-requests/{token}/pay", tags=["payment-qr"])
def pay_payment_request(token: str, data: dict, request: Request, db: Session = Depends(get_db)):
    """
    CLIENT — payer une demande de paiement.
    data: { method: 'wallet'|'cash'|'orange_money'|'wave'|'mtn_money', client_phone? }
    Header: X-Client-Token (requis pour wallet)
    """
    pr = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.token == token
    ).first()
    if not pr:
        raise HTTPException(404, "Demande introuvable")
    if pr.status != "pending":
        raise HTTPException(400, f"Cette demande est déjà {pr.status}")

    method       = data.get("method", "cash")
    client_phone = data.get("client_phone", "").strip()
    cashback     = 0

    # ── Paiement Wallet SOKORA ────────────────────────────────────────────
    if method == "wallet":
        client_token = request.headers.get("X-Client-Token", "")
        if not client_token:
            raise HTTPException(401, "Token client requis pour paiement wallet")
        client = crud.get_client_from_token(db, client_token)
        if not client:
            raise HTTPException(401, "Token client invalide")

        wallet = db.query(models.WalletAccount).filter(
            models.WalletAccount.client_id == client.id
        ).first()
        if not wallet or wallet.balance < pr.total_amount:
            bal = wallet.balance if wallet else 0
            raise HTTPException(400, f"Solde insuffisant: {bal:.0f} F (besoin: {pr.total_amount:.0f} F)")

        # Débiter wallet
        bal_before = wallet.balance
        wallet.balance -= pr.total_amount
        wallet.updated_at = datetime.utcnow()

        # Cashback 2%
        cashback = round(pr.total_amount * 0.02)
        if cashback > 0:
            wallet.balance += cashback
            db.add(models.WalletTransaction(
                wallet_id=wallet.id, tx_type="cashback",
                amount=cashback, balance_before=wallet.balance - cashback,
                balance_after=wallet.balance,
                description=f"Cashback 2% — {pr.establishment_name}",
                establishment_id=pr.establishment_id,
            ))

        db.add(models.WalletTransaction(
            wallet_id=wallet.id, tx_type="payment",
            amount=-pr.total_amount, balance_before=bal_before,
            balance_after=wallet.balance - cashback if cashback > 0 else wallet.balance,
            description=f"Paiement QR — {pr.establishment_name} Table {pr.table_number}",
            establishment_id=pr.establishment_id,
            service_type="restaurant",
        ))

        pr.client_id    = client.id
        pr.client_phone = client.phone

    # ── Autres méthodes (cash, mobile money) ─────────────────────────────
    else:
        pr.client_phone = client_phone

    # Marquer les commandes comme payées
    if pr.order_ids:
        db.query(models.Order).filter(
            models.Order.id.in_(pr.order_ids)
        ).update({"status": models.OrderStatus.PAID}, synchronize_session=False)

        # Enregistrer les paiements
        for oid in pr.order_ids:
            o = db.get(models.Order, oid)
            if o:
                order_total = sum(
                    (it.unit_price or 0) * (it.quantity or 1)
                    for it in o.items
                    if not it.is_complimentary
                )
                if order_total > 0:
                    db.add(models.Payment(
                        order_id=oid, amount=order_total,
                        method=method, created_by=None,
                    ))

    pr.status         = "paid"
    pr.payment_method = method
    pr.paid_at        = datetime.now(timezone.utc)
    db.commit()

    return {
        "success":      True,
        "status":       "paid",
        "method":       method,
        "amount_paid":  pr.total_amount,
        "cashback":     cashback if method == "wallet" else 0,
        "establishment": pr.establishment_name,
        "reference":    pr.token,
    }


@app.get("/payment-requests/{token}/status", tags=["payment-qr"])
def get_payment_request_status(
    token: str,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """Serveur poll le statut d'une demande de paiement."""
    pr = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.token == token,
        models.PaymentRequest.establishment_id == current_user.establishment_id,
    ).first()
    if not pr:
        raise HTTPException(404, "Demande introuvable")
    return {
        "status":         pr.status,
        "payment_method": pr.payment_method,
        "client_phone":   pr.client_phone,
        "amount":         pr.total_amount,
        "paid_at":        pr.paid_at.isoformat() if pr.paid_at else None,
    }


@app.post("/payment-requests/{token}/send-change", tags=["payment-qr"])
def send_change_to_wallet(
    token: str,
    data: dict,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Gérant/Serveur envoie la monnaie vers le wallet du client après paiement cash.
    data: { change_amount: float, client_phone: str }
    """
    pr = db.query(models.PaymentRequest).filter(
        models.PaymentRequest.token == token,
        models.PaymentRequest.establishment_id == current_user.establishment_id,
    ).first()
    if not pr:
        raise HTTPException(404, "Demande introuvable")

    change_amount = float(data.get("change_amount", 0))
    phone = data.get("client_phone", "").strip() or pr.client_phone

    if change_amount <= 0:
        raise HTTPException(400, "Montant monnaie invalide")
    if not phone:
        raise HTTPException(400, "Numéro client requis")

    client = db.query(models.ClientAccount).filter(
        models.ClientAccount.phone == phone
    ).first()
    if not client:
        raise HTTPException(404, "Client SOKORA introuvable pour ce numéro")

    wallet = db.query(models.WalletAccount).filter(
        models.WalletAccount.client_id == client.id
    ).first()
    if not wallet:
        wallet = models.WalletAccount(client_id=client.id, balance=0.0, total_loaded=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    bal_before = wallet.balance
    wallet.balance += change_amount
    wallet.total_loaded += change_amount
    wallet.updated_at = datetime.utcnow()

    db.add(models.WalletTransaction(
        wallet_id=wallet.id, tx_type="change",
        amount=change_amount, balance_before=bal_before, balance_after=wallet.balance,
        description=f"Monnaie rendue — {pr.establishment_name} Table {pr.table_number} (réf: {token})",
        establishment_id=pr.establishment_id,
        created_by=current_user.id,
    ))

    pr.change_amount = change_amount
    pr.change_sent   = True
    db.commit()

    return {
        "success":     True,
        "change_sent": change_amount,
        "new_balance": wallet.balance,
        "client_name": client.name or phone,
    }


