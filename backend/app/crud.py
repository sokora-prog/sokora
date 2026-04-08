from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from fastapi import HTTPException

from . import models, schemas, security


# ─────────────────────────────────────────
#  SAAS — INSCRIPTION GÉRANT
# ─────────────────────────────────────────

def register_manager(db: Session, data: schemas.ManagerRegister) -> models.User:
    """Crée un établissement + un compte gérant + un abonnement trial."""
    # Vérifier unicité du numéro
    if db.scalar(select(models.User).where(models.User.phone_number == data.phone_number)):
        raise HTTPException(status_code=409, detail="Ce numéro est déjà utilisé")

    # 1. Créer l'établissement
    establishment = models.Establishment(
        name=data.establishment_name,
        address=data.establishment_address,
        phone=data.establishment_phone,
        type=data.establishment_type or "maquis",
        city=data.establishment_city,
    )
    db.add(establishment)
    db.flush()  # pour obtenir l'id

    # 2. Créer l'abonnement trial (14 jours)
    subscription = models.Subscription(
        establishment_id=establishment.id,
        status=models.SubscriptionStatus.TRIAL,
        trial_ends_at=datetime.now(timezone.utc) + timedelta(days=14),
    )
    db.add(subscription)

    # 3. Créer le compte gérant
    manager = models.User(
        full_name=data.full_name,
        phone_number=data.phone_number,
        password_hash=security.get_password_hash(data.password),
        role=models.UserRole.MANAGER,
        establishment_id=establishment.id,
    )
    db.add(manager)
    db.commit()
    db.refresh(manager)
    return manager


# ─────────────────────────────────────────
#  UTILISATEURS
# ─────────────────────────────────────────

def create_staff(db: Session, data: schemas.UserCreate, establishment_id: int) -> models.User:
    """Gérant crée un compte serveur dans son établissement."""
    if db.scalar(select(models.User).where(models.User.phone_number == data.phone_number)):
        raise HTTPException(status_code=409, detail="Ce numéro est déjà utilisé")

    user = models.User(
        full_name=data.full_name,
        phone_number=data.phone_number,
        password_hash=security.get_password_hash(data.password),
        role=models.UserRole.WAITER,
        establishment_id=establishment_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_staff_list(db: Session, establishment_id: int):
    return db.scalars(
        select(models.User).where(models.User.establishment_id == establishment_id)
    ).all()


def update_staff(db: Session, user_id: int, data: schemas.UserUpdate, establishment_id: int) -> models.User:
    user = db.get(models.User, user_id)
    if not user or user.establishment_id != establishment_id:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


# ─────────────────────────────────────────
#  CATÉGORIES & PRODUITS
# ─────────────────────────────────────────

def create_category(db: Session, data: schemas.CategoryCreate, est_id: int) -> models.Category:
    cat = models.Category(name=data.name, establishment_id=est_id)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def get_categories(db: Session, est_id: int):
    return db.scalars(select(models.Category).where(models.Category.establishment_id == est_id)).all()


def create_product(db: Session, data: schemas.ProductCreate, est_id: int) -> models.Product:
    product = models.Product(**data.model_dump(), establishment_id=est_id)
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def get_products(db: Session, est_id: int):
    return db.scalars(select(models.Product).where(models.Product.establishment_id == est_id)).all()


def update_product(db: Session, product_id: int, data: schemas.ProductUpdate, est_id: int) -> models.Product:
    product = db.get(models.Product, product_id)
    if not product or product.establishment_id != est_id:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return product


# ─────────────────────────────────────────
#  TABLES
# ─────────────────────────────────────────

def create_table(db: Session, data: schemas.TableCreate, est_id: int) -> models.Table:
    table = models.Table(**data.model_dump(), establishment_id=est_id)
    db.add(table)
    db.commit()
    db.refresh(table)
    return table


def get_tables(db: Session, est_id: int):
    return db.scalars(select(models.Table).where(models.Table.establishment_id == est_id)).all()


def update_table_status(db: Session, table_id: int, status: models.TableStatus, est_id: int) -> models.Table:
    table = db.get(models.Table, table_id)
    if not table or table.establishment_id != est_id:
        raise HTTPException(status_code=404, detail="Table introuvable")
    table.status = status
    db.commit()
    db.refresh(table)
    return table


# ─────────────────────────────────────────
#  COMMANDES
# ─────────────────────────────────────────

def create_order(db: Session, data: schemas.OrderCreate, waiter: models.User) -> models.Order:
    # Vérifier que la table appartient bien à l'établissement
    table = db.get(models.Table, data.table_id)
    if not table or table.establishment_id != waiter.establishment_id:
        raise HTTPException(status_code=404, detail="Table introuvable")

    # Construire les items
    order_items = []
    for item in data.items:
        product = db.get(models.Product, item.product_id)
        if not product or product.establishment_id != waiter.establishment_id:
            raise HTTPException(status_code=404, detail=f"Produit {item.product_id} introuvable")
        if not product.is_available:
            raise HTTPException(status_code=400, detail=f"{product.name} n'est pas disponible")
        order_items.append(models.OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
            notes=item.notes,
        ))

    order = models.Order(
        table_id=data.table_id,
        waiter_id=waiter.id,
        establishment_id=waiter.establishment_id,
        notes=data.notes,
        status=models.OrderStatus.OPEN,
        items=order_items,
    )
    db.add(order)

    # Passer la table en OCCUPIED
    table.status = models.TableStatus.OCCUPIED
    db.commit()
    db.refresh(order)
    return order


def add_items_to_order(db: Session, order_id: int, data: schemas.OrderAddItems, waiter: models.User) -> models.Order:
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != waiter.establishment_id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.status not in (models.OrderStatus.OPEN, models.OrderStatus.SENT):
        raise HTTPException(status_code=400, detail="Impossible d'ajouter des articles à cette commande")

    for item in data.items:
        product = db.get(models.Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Produit {item.product_id} introuvable")
        order.items.append(models.OrderItem(
            product_id=product.id,
            quantity=item.quantity,
            unit_price=product.price,
            notes=item.notes,
        ))
    db.commit()
    db.refresh(order)
    return order


def get_orders(db: Session, est_id: int, status: models.OrderStatus = None,
               table_id: int = None, waiter_id: int = None):
    query = select(models.Order).where(models.Order.establishment_id == est_id)
    if status:
        query = query.where(models.Order.status == status)
    if table_id:
        query = query.where(models.Order.table_id == table_id)
    if waiter_id:
        query = query.where(models.Order.waiter_id == waiter_id)
    orders = db.scalars(query.order_by(models.Order.created_at.desc())).all()
    for o in orders:
        table = db.get(models.Table, o.table_id)
        if table:
            o.table_number = table.number
        waiter = db.get(models.User, o.waiter_id) if o.waiter_id else None
        if waiter:
            o.waiter_name = waiter.full_name
        for item in o.items:
            p = db.get(models.Product, item.product_id)
            if p:
                item.product_name = p.name
    return orders


def update_order_status(db: Session, order_id: int, status: models.OrderStatus, est_id: int) -> models.Order:
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != est_id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    order.status = status
    db.commit()
    db.refresh(order)
    return order


# ─────────────────────────────────────────
#  PAIEMENTS
# ─────────────────────────────────────────

def process_payment(db: Session, data: schemas.PaymentCreate, current_user: models.User) -> models.Payment:
    order = db.get(models.Order, data.order_id)
    if not order or order.establishment_id != current_user.establishment_id:
        raise HTTPException(status_code=404, detail="Commande introuvable")
    if order.status == models.OrderStatus.PAID:
        raise HTTPException(status_code=400, detail="Commande déjà payée")

    # Calcul du total de la commande
    total = sum(item.unit_price * item.quantity for item in order.items)
    if data.amount < total:
        raise HTTPException(status_code=400, detail=f"Montant insuffisant. Total: {total}")

    payment = models.Payment(
        order_id=order.id,
        establishment_id=order.establishment_id,
        amount=data.amount,
        method=data.method,
        processed_by=current_user.id,
    )
    db.add(payment)

    # Mettre à jour le statut
    order.status = models.OrderStatus.PAID
    if order.table:
        order.table.status = models.TableStatus.FREE
    # Si paiement a credit, creer l ardoise
    if data.method == models.PaymentMethod.CREDIT or str(data.method).upper() in ("CREDIT", "PAYMENTMETHOD.CREDIT"):
        client_phone = getattr(data, "client_phone", None)
        client_name = getattr(data, "client_name", None)
        if client_phone:
            from sqlalchemy import select as sa_select
            credit = db.query(models.CreditAccount).filter(
                models.CreditAccount.establishment_id == order.establishment_id,
                models.CreditAccount.client_phone == client_phone
            ).first()
            if not credit:
                credit = models.CreditAccount(
                    establishment_id=order.establishment_id,
                    client_phone=client_phone,
                    client_name=client_name or client_phone,
                    is_active=True,
                    created_by=current_user.id,
                )
                db.add(credit)
                db.flush()
            tx = models.CreditTransaction(
                credit_account_id=credit.id,
                establishment_id=order.establishment_id,
                amount=data.amount,
                transaction_type="credit",
                description=f"Commande #{order.id}",
                created_by=current_user.id,
                order_id=order.id,
            )
            db.add(tx)
    db.commit()
    db.refresh(payment)
    return payment


# ─────────────────────────────────────────
#  DÉPENSES
# ─────────────────────────────────────────

def create_expense(db: Session, data: schemas.ExpenseCreate, current_user: models.User) -> models.Expense:
    expense = models.Expense(
        **data.model_dump(),
        establishment_id=current_user.establishment_id,
        recorded_by=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


def get_expenses(db: Session, est_id: int):
    return db.scalars(
        select(models.Expense)
        .where(models.Expense.establishment_id == est_id)
        .order_by(models.Expense.created_at.desc())
    ).all()


# ─────────────────────────────────────────
#  DASHBOARD — STATISTIQUES
# ─────────────────────────────────────────

def get_dashboard_stats(db: Session, est_id: int) -> dict:
    now   = datetime.now(timezone.utc)
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # CA aujourd'hui
    revenue_today = db.scalar(
        select(func.sum(models.Payment.amount))
        .where(models.Payment.establishment_id == est_id)
        .where(models.Payment.created_at >= today)
    ) or 0

    # CA du mois
    revenue_month = db.scalar(
        select(func.sum(models.Payment.amount))
        .where(models.Payment.establishment_id == est_id)
        .where(models.Payment.created_at >= month_start)
    ) or 0

    # Commandes ouvertes
    open_orders = db.scalar(
        select(func.count(models.Order.id))
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
    ) or 0

    # Tables occupées
    occupied_tables = db.scalar(
        select(func.count(models.Table.id))
        .where(models.Table.establishment_id == est_id)
        .where(models.Table.status == models.TableStatus.OCCUPIED)
    ) or 0

    # Dépenses du mois
    expenses_month = db.scalar(
        select(func.sum(models.Expense.amount))
        .where(models.Expense.establishment_id == est_id)
        .where(models.Expense.created_at >= month_start)
    ) or 0

    # Produit phare
    top = db.execute(
        select(models.Product.name, func.sum(models.OrderItem.quantity).label("qty"))
        .join(models.OrderItem, models.OrderItem.product_id == models.Product.id)
        .join(models.Order, models.Order.id == models.OrderItem.order_id)
        .where(models.Order.establishment_id == est_id)
        .group_by(models.Product.name)
        .order_by(func.sum(models.OrderItem.quantity).desc())
        .limit(1)
    ).first()

    return {
        "total_revenue_today":    revenue_today,
        "total_revenue_month":    revenue_month,
        "open_orders_count":      open_orders,
        "occupied_tables_count":  occupied_tables,
        "total_expenses_month":   expenses_month,
        "net_profit_month":       revenue_month - expenses_month,
        "top_product":            top[0] if top else None,
    }


def get_waiter_stats(db: Session, est_id: int) -> list:
    rows = db.execute(
        select(
            models.User.id,
            models.User.full_name,
            func.count(models.Order.id).label("orders_count"),
            func.coalesce(func.sum(models.Payment.amount), 0).label("total_revenue"),
        )
        .join(models.Order,   models.Order.waiter_id        == models.User.id)
        .outerjoin(models.Payment, models.Payment.order_id  == models.Order.id)
        .where(models.User.establishment_id == est_id)
        .where(models.User.role == models.UserRole.WAITER)
        .group_by(models.User.id, models.User.full_name)
    ).all()

    return [
        {"waiter_id": r.id, "waiter_name": r.full_name, "orders_count": r.orders_count, "total_revenue": r.total_revenue}
        for r in rows
    ]


# ─────────────────────────────────────────
#  DASHBOARD — PÉRIODE
# ─────────────────────────────────────────

def get_period_bounds(period: str, date_from: str = None, date_to: str = None):
    """Retourne (start, end) datetime UTC pour la période demandée."""
    now = datetime.now(timezone.utc)
    if date_from and date_to:
        start = datetime.fromisoformat(date_from).replace(tzinfo=timezone.utc)
        end   = datetime.fromisoformat(date_to).replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
    elif period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    elif period == "week":
        start = (now - timedelta(days=7)).replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        end   = now
    elif period == "yesterday":
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = yesterday.replace(hour=23, minute=59, second=59, microsecond=0)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end   = now
    return start, end


def get_dashboard_stats_period(db: Session, est_id: int, period: str = "today",
                                date_from: str = None, date_to: str = None) -> dict:
    start, end = get_period_bounds(period, date_from, date_to)

    revenue = db.scalar(
        select(func.sum(models.Payment.amount))
        .where(models.Payment.establishment_id == est_id)
        .where(models.Payment.created_at.between(start, end))
    ) or 0

    orders_count = db.scalar(
        select(func.count(models.Order.id))
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.created_at.between(start, end))
    ) or 0

    paid_count = db.scalar(
        select(func.count(models.Order.id))
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status == models.OrderStatus.PAID)
        .where(models.Order.created_at.between(start, end))
    ) or 0

    expenses = db.scalar(
        select(func.sum(models.Expense.amount))
        .where(models.Expense.establishment_id == est_id)
        .where(models.Expense.created_at.between(start, end))
    ) or 0

    occupied = db.scalar(
        select(func.count(models.Table.id))
        .where(models.Table.establishment_id == est_id)
        .where(models.Table.status == models.TableStatus.OCCUPIED)
    ) or 0

    # Alertes stock
    products = db.scalars(
        select(models.Product).where(models.Product.establishment_id == est_id)
    ).all()
    stock_alerts = [
        {"id": p.id, "name": p.name, "stock_quantity": p.stock_quantity,
         "threshold": p.stock_alert_threshold}
        for p in products
        if (p.stock_quantity or 0) <= (p.stock_alert_threshold or 5)
    ]

    return {
        "total_revenue_period":   revenue,
        "orders_period":          orders_count,
        "orders_paid":            paid_count,
        "total_expenses_period":  expenses,
        "net_profit_period":      revenue - expenses,
        "occupied_tables_count":  occupied,
        "stock_alerts":           stock_alerts,
        "period":                 period,
    }


def get_revenue_chart(db: Session, est_id: int, period: str = "7d") -> list:
    days = 30 if period == "30d" else 7
    now = datetime.now(timezone.utc)
    result = []
    for i in range(days - 1, -1, -1):
        d     = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0)
        d_end = d.replace(hour=23, minute=59, second=59)
        rev   = db.scalar(
            select(func.sum(models.Payment.amount))
            .where(models.Payment.establishment_id == est_id)
            .where(models.Payment.created_at.between(d, d_end))
        ) or 0
        result.append({"date": d.strftime("%Y-%m-%d"), "label": d.strftime("%d/%m"), "revenue": float(rev)})
    return result


def _waiter_stats_for(db, waiter_id, period):
    start, end = get_period_bounds(period)
    orders = db.scalars(
        select(models.Order)
        .where(models.Order.waiter_id == waiter_id)
        .where(models.Order.created_at.between(start, end))
    ).all()
    order_ids = [o.id for o in orders]
    revenue = db.scalar(
        select(func.sum(models.Payment.amount))
        .where(models.Payment.order_id.in_(order_ids))
    ) or 0 if order_ids else 0
    return len(orders), float(revenue)

def get_waiter_own_stats(db: Session, waiter_id: int, period: str = "today") -> dict:
    orders_p, revenue_p   = _waiter_stats_for(db, waiter_id, period)
    orders_t, revenue_t   = _waiter_stats_for(db, waiter_id, "today")
    orders_w, revenue_w   = _waiter_stats_for(db, waiter_id, "week")
    orders_m, revenue_m   = _waiter_stats_for(db, waiter_id, "month")
    return {
        "orders_count":   orders_p,
        "total_revenue":  revenue_p,
        "period":         period,
        "revenue_today":  revenue_t,
        "orders_today":   orders_t,
        "revenue_week":   revenue_w,
        "orders_week":    orders_w,
        "revenue_month":  revenue_m,
        "orders_month":   orders_m,
    }


def get_waiter_stats_period(db: Session, est_id: int, period: str = "today",
                             date_from: str = None, date_to: str = None) -> list:
    start, end = get_period_bounds(period, date_from, date_to)
    rows = db.execute(
        select(
            models.User.id,
            models.User.full_name,
            func.count(models.Order.id).label("orders_count"),
            func.coalesce(func.sum(models.Payment.amount), 0).label("total_revenue"),
        )
        .outerjoin(models.Order, (models.Order.waiter_id == models.User.id) & (models.Order.created_at.between(start, end)))
        .outerjoin(models.Payment, models.Payment.order_id == models.Order.id)
        .where(models.User.establishment_id == est_id)
        .where(models.User.role == models.UserRole.WAITER)
        .group_by(models.User.id, models.User.full_name)
    ).all()
    return [
        {"waiter_id": r.id, "waiter_name": r.full_name,
         "orders_count": r.orders_count, "total_revenue": r.total_revenue}
        for r in rows
    ]


# ─────────────────────────────────────────
#  TABLE OPERATIONS
# ─────────────────────────────────────────

def transfer_table(db: Session, from_id: int, to_id: int, est_id: int) -> dict:
    orders = db.scalars(
        select(models.Order)
        .where(models.Order.table_id == from_id)
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
    ).all()
    if not orders:
        raise HTTPException(404, "Aucune commande ouverte sur cette table")
    for o in orders:
        o.table_id = to_id
    from_table = db.get(models.Table, from_id)
    to_table   = db.get(models.Table, to_id)
    if from_table: from_table.status = models.TableStatus.FREE
    if to_table:   to_table.status   = models.TableStatus.OCCUPIED
    db.commit()
    return {"transferred": len(orders), "to_table_id": to_id}


def merge_tables(db: Session, from_id: int, to_id: int, est_id: int) -> dict:
    from_orders = db.scalars(
        select(models.Order)
        .where(models.Order.table_id == from_id)
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
    ).all()
    to_order = db.scalars(
        select(models.Order)
        .where(models.Order.table_id == to_id)
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
        .limit(1)
    ).first()
    if not to_order:
        # No order on target table — just transfer
        return transfer_table(db, from_id, to_id, est_id)
    items_moved = 0
    for o in from_orders:
        for item in o.items:
            item.order_id = to_order.id
            items_moved  += 1
        o.status = models.OrderStatus.CANCELLED
    from_table = db.get(models.Table, from_id)
    if from_table: from_table.status = models.TableStatus.FREE
    db.commit()
    return {"merged_items": items_moved, "target_order_id": to_order.id}


def transfer_waiter(db: Session, table_id: int, new_waiter_id: int, est_id: int) -> dict:
    orders = db.scalars(
        select(models.Order)
        .where(models.Order.table_id == table_id)
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
    ).all()
    for o in orders:
        o.waiter_id = new_waiter_id
    db.commit()
    return {"updated": len(orders), "new_waiter_id": new_waiter_id}


# ─────────────────────────────────────────
#  OFFERTS / COMPLIMENTARY
# ─────────────────────────────────────────

def mark_order_complimentary(db: Session, order_id: int, is_comp: bool, reason: str, est_id: int):
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != est_id:
        return None
    for item in order.items:
        item.is_complimentary      = is_comp
        item.complimentary_reason  = reason
    db.commit()
    db.refresh(order)
    return order


def mark_item_complimentary(db: Session, item_id: int, is_comp: bool, reason: str, est_id: int):
    item = db.get(models.OrderItem, item_id)
    if not item:
        return None
    order = db.get(models.Order, item.order_id)
    if not order or order.establishment_id != est_id:
        return None
    item.is_complimentary     = is_comp
    item.complimentary_reason = reason
    db.commit()
    db.refresh(item)
    return item


def set_order_client_phone(db: Session, order_id: int, phone: str, est_id: int):
    order = db.get(models.Order, order_id)
    if not order or order.establishment_id != est_id:
        return None
    order.client_phone = phone
    db.commit()
    db.refresh(order)
    return order


def get_complimentary_stats(db: Session, est_id: int, start, end) -> dict:
    items = db.scalars(
        select(models.OrderItem)
        .join(models.Order)
        .where(models.Order.establishment_id == est_id)
        .where(models.Order.created_at.between(start, end))
        .where(models.OrderItem.is_complimentary == True)  # noqa
    ).all() if hasattr(models.OrderItem, 'is_complimentary') else []
    total_value = sum(i.unit_price * i.quantity for i in items)
    return {"count": len(items), "total_value": total_value}


# ─────────────────────────────────────────
#  STOCK
# ─────────────────────────────────────────

def get_stock_list(db: Session, est_id: int) -> list:
    products = db.scalars(
        select(models.Product).where(models.Product.establishment_id == est_id)
    ).all()
    result = []
    for p in products:
        threshold = p.stock_alert_threshold or 5
        qty = p.stock_quantity or 0
        if qty == 0:
            status = "out"
        elif qty <= threshold:
            status = "low"
        else:
            status = "ok"
        result.append({
            "id":                    p.id,
            "name":                  p.name,
            "stock_quantity":        p.stock_quantity,
            "stock_alert_threshold": threshold,
            "stock_unit":            p.stock_unit,
            "reorder_threshold":     p.reorder_threshold,
            "status":                status,
        })
    return result


def update_stock(db: Session, product_id: int, quantity: int, movement_type: str,
                 reason: str, est_id: int):
    product = db.get(models.Product, product_id)
    if not product or product.establishment_id != est_id:
        return None
    if movement_type == "in":
        product.stock_quantity += quantity
    elif movement_type == "out":
        product.stock_quantity = max(0, product.stock_quantity - quantity)
    else:  # adjustment
        product.stock_quantity = quantity
    movement = models.StockMovement(
        product_id=product_id, establishment_id=est_id,
        movement_type=movement_type, quantity=quantity, reason=reason,
    )
    db.add(movement)
    db.commit()
    db.refresh(product)
    return {"id": product.id, "name": product.name, "stock_quantity": product.stock_quantity}


def update_stock_threshold(db: Session, product_id: int, threshold: int, unit: str, est_id: int):
    product = db.get(models.Product, product_id)
    if not product or product.establishment_id != est_id:
        return None
    product.stock_alert_threshold = threshold
    product.stock_unit = unit
    db.commit()
    db.refresh(product)
    return {"id": product.id, "stock_alert_threshold": threshold, "stock_unit": unit}


def update_reorder_threshold(db: Session, product_id: int, est_id: int, threshold: int):
    product = db.get(models.Product, product_id)
    if not product or product.establishment_id != est_id:
        return None
    product.reorder_threshold = threshold
    db.commit()
    return {"id": product.id, "reorder_threshold": threshold}


def get_stock_movements(db: Session, est_id: int, product_id: int) -> list:
    movements = db.scalars(
        select(models.StockMovement)
        .where(models.StockMovement.establishment_id == est_id)
        .where(models.StockMovement.product_id == product_id)
        .order_by(models.StockMovement.created_at.desc())
    ).all()
    return [
        {"id": m.id, "movement_type": m.movement_type, "quantity": m.quantity,
         "reason": m.reason, "created_at": m.created_at}
        for m in movements
    ]


def bulk_update_stock(db: Session, items: list, est_id: int) -> int:
    updated = 0
    for item in items:
        result = update_stock(
            db, item.get("product_id"), item.get("quantity", 0),
            item.get("movement_type", "adjustment"), item.get("reason", ""), est_id
        )
        if result:
            updated += 1
    return updated


def submit_inventory(db: Session, est_id: int, user_id: int, items: list) -> dict:
    snapshot = models.InventorySnapshot(establishment_id=est_id, created_by=user_id)
    db.add(snapshot)
    db.flush()
    for item in items:
        product = db.get(models.Product, item.get("product_id"))
        if not product or product.establishment_id != est_id:
            continue
        counted    = item.get("counted", 0)
        expected   = product.stock_quantity
        difference = counted - expected
        snap_item  = models.InventorySnapshotItem(
            snapshot_id=snapshot.id, product_id=product.id,
            counted=counted, expected=expected, difference=difference,
        )
        db.add(snap_item)
        product.stock_quantity = counted
    db.commit()
    return {"snapshot_id": snapshot.id, "items_processed": len(items)}


def get_inventory_history(db: Session, est_id: int) -> list:
    snapshots = db.scalars(
        select(models.InventorySnapshot)
        .where(models.InventorySnapshot.establishment_id == est_id)
        .order_by(models.InventorySnapshot.created_at.desc())
        .limit(20)
    ).all()
    return [{"id": s.id, "created_at": s.created_at, "items_count": len(s.items)}
            for s in snapshots]


def get_supplier_order_list(db: Session, est_id: int) -> list:
    products = db.scalars(
        select(models.Product)
        .where(models.Product.establishment_id == est_id)
        .where(models.Product.stock_quantity <= models.Product.reorder_threshold)
    ).all()
    return [
        {"id": p.id, "name": p.name, "current_stock": p.stock_quantity,
         "reorder_threshold": p.reorder_threshold,
         "order_quantity": max(0, p.reorder_threshold * 2 - p.stock_quantity)}
        for p in products
    ]


# ─────────────────────────────────────────
#  ARDOISE / CRÉDIT
# ─────────────────────────────────────────

def _credit_totals(db, account_id):
    """Compute total_credit and total_paid from transactions."""
    from sqlalchemy import func as sqlfunc
    res = db.execute(
        select(
            models.CreditTransaction.transaction_type,
            sqlfunc.sum(models.CreditTransaction.amount).label("total")
        )
        .where(models.CreditTransaction.credit_account_id == account_id)
        .group_by(models.CreditTransaction.transaction_type)
    ).all()
    totals = {r[0]: r[1] for r in res}
    return totals.get("credit", 0.0), totals.get("debit", 0.0)


def get_credit_accounts(db: Session, est_id: int, active_only: bool = False) -> list:
    query = select(models.CreditAccount).where(models.CreditAccount.establishment_id == est_id)
    if active_only:
        query = query.where(models.CreditAccount.is_active == True)  # noqa
    accounts = db.scalars(query.order_by(models.CreditAccount.client_name)).all()
    result = []
    for a in accounts:
        total_credit, total_paid = _credit_totals(db, a.id)
        result.append({
            "id": a.id, "client_name": a.client_name, "client_phone": a.client_phone,
            "balance": a.balance, "is_active": a.is_active, "notes": a.notes,
            "total_credit": total_credit, "total_paid": total_paid,
            "credit_limit": getattr(a, "credit_limit", None),
        })
    return result


def search_credit_account(db: Session, est_id: int, q: str) -> list:
    accounts = db.scalars(
        select(models.CreditAccount)
        .where(models.CreditAccount.establishment_id == est_id)
        .where(
            models.CreditAccount.client_name.ilike(f"%{q}%") |
            models.CreditAccount.client_phone.ilike(f"%{q}%")
        )
    ).all()
    return [
        {"id": a.id, "client_name": a.client_name, "client_phone": a.client_phone,
         "balance": a.balance, "is_active": a.is_active}
        for a in accounts
    ]


def create_credit_account(db: Session, est_id: int, client_name: str,
                           client_phone: str, notes: str, created_by: int,
                           credit_limit: float = None):
    if not client_name:
        raise HTTPException(400, "Nom du client requis")
    account = models.CreditAccount(
        establishment_id=est_id, client_name=client_name,
        client_phone=client_phone, notes=notes, created_by=created_by,
        credit_limit=credit_limit,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return {"id": account.id, "client_name": account.client_name,
            "client_phone": account.client_phone, "balance": account.balance,
            "credit_limit": account.credit_limit, "total_credit": 0.0, "total_paid": 0.0}


def get_credit_account(db: Session, account_id: int, est_id: int):
    account = db.get(models.CreditAccount, account_id)
    if not account or account.establishment_id != est_id:
        return None
    txs = db.scalars(
        select(models.CreditTransaction)
        .where(models.CreditTransaction.credit_account_id == account_id)
        .order_by(models.CreditTransaction.created_at.desc())
    ).all()
    return {
        "id": account.id, "client_name": account.client_name,
        "client_phone": account.client_phone, "balance": account.balance,
        "is_active": account.is_active, "notes": account.notes,
        "transactions": [
            {"id": t.id, "type": t.transaction_type, "amount": t.amount,
             "description": t.description, "created_at": t.created_at}
            for t in txs
        ],
    }


def add_credit_transaction(db: Session, account_id: int, est_id: int,
                            transaction_type: str, amount: float,
                            description: str, order_id: int, created_by: int,
                            payment_method: str = None):
    account = db.get(models.CreditAccount, account_id)
    if not account or account.establishment_id != est_id:
        return None
    # Normalize: 'payment' is an alias for 'debit'
    normalized_type = "debit" if transaction_type == "payment" else transaction_type
    tx = models.CreditTransaction(
        credit_account_id=account_id, establishment_id=est_id,
        transaction_type=normalized_type, amount=amount,
        description=description, order_id=order_id, created_by=created_by,
        payment_method=payment_method,
    )
    db.add(tx)
    if normalized_type == "credit":   # client prend à crédit → solde augmente
        account.balance += amount
    elif normalized_type == "debit":  # client rembourse → solde baisse
        account.balance -= amount
    db.commit()
    db.refresh(account)
    return {
        "id": account.id, "client_name": account.client_name,
        "client_phone": account.client_phone, "balance": account.balance,
        "credit_limit": getattr(account, "credit_limit", None),
        "is_active": account.is_active,
    }


def get_credit_transactions(db: Session, account_id: int, est_id: int) -> list:
    account = db.get(models.CreditAccount, account_id)
    if not account or account.establishment_id != est_id:
        return []
    txs = db.scalars(
        select(models.CreditTransaction)
        .where(models.CreditTransaction.credit_account_id == account_id)
        .order_by(models.CreditTransaction.created_at.desc())
    ).all()
    return [
        {"id": t.id, "type": t.transaction_type, "amount": t.amount,
         "description": t.description, "order_id": t.order_id, "created_at": t.created_at}
        for t in txs
    ]


def close_credit_account(db: Session, account_id: int, est_id: int):
    account = db.get(models.CreditAccount, account_id)
    if not account or account.establishment_id != est_id:
        return None
    account.is_active = False
    db.commit()
    return {"id": account.id, "is_active": False}


def get_credit_stats(db: Session, est_id: int) -> dict:
    accounts = db.scalars(
        select(models.CreditAccount)
        .where(models.CreditAccount.establishment_id == est_id)
        .where(models.CreditAccount.is_active == True)  # noqa
    ).all()
    total_owed = sum(a.balance for a in accounts if a.balance > 0)
    return {"active_accounts": len(accounts), "total_owed": total_owed}


# ─────────────────────────────────────────
#  CAISSE / CLOSING REPORT
# ─────────────────────────────────────────

def get_closing_report(db: Session, est_id: int, date: str = None) -> dict:
    now = datetime.now(timezone.utc)
    if date:
        try:
            target = datetime.fromisoformat(date).replace(tzinfo=timezone.utc)
        except ValueError:
            target = now
    else:
        target = now
    start = target.replace(hour=0, minute=0, second=0, microsecond=0)
    end   = target.replace(hour=23, minute=59, second=59, microsecond=999999)

    payments = db.scalars(
        select(models.Payment)
        .where(models.Payment.establishment_id == est_id)
        .where(models.Payment.created_at.between(start, end))
    ).all()
    expenses = db.scalars(
        select(models.Expense)
        .where(models.Expense.establishment_id == est_id)
        .where(models.Expense.created_at.between(start, end))
    ).all()

    by_method = {}
    for p in payments:
        method = p.method.value if hasattr(p.method, 'value') else str(p.method)
        by_method[method] = by_method.get(method, 0) + p.amount

    total_revenue  = sum(p.amount for p in payments)
    total_expenses = sum(e.amount for e in expenses)

    return {
        "date":            target.strftime("%Y-%m-%d"),
        "total_revenue":   total_revenue,
        "total_expenses":  total_expenses,
        "net":             total_revenue - total_expenses,
        "by_method":       by_method,
        "payments_count":  len(payments),
        "expenses_count":  len(expenses),
    }


# ─────────────────────────────────────────
#  CLIENT PWA — OTP & PROFIL
# ─────────────────────────────────────────

import secrets
import string

def _generate_token(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def request_otp(db: Session, phone: str) -> dict:
    code = "".join(secrets.choice(string.digits) for _ in range(6))
    expires = datetime.now(timezone.utc) + timedelta(minutes=10)

    client = db.scalars(
        select(models.ClientAccount).where(models.ClientAccount.phone == phone)
    ).first()
    if not client:
        client = models.ClientAccount(phone=phone)
        db.add(client)
        db.flush()

    client.otp_code    = code
    client.otp_expires = expires
    db.commit()

    # In production: send via WhatsApp/SMS — for now just return it
    return {"success": True, "message": "OTP envoyé", "debug_code": code}


def verify_otp(db: Session, phone: str, code: str) -> dict:
    client = db.scalars(
        select(models.ClientAccount).where(models.ClientAccount.phone == phone)
    ).first()
    if not client or not client.otp_code:
        return {"success": False, "error": "Compte introuvable"}
    if client.otp_expires and datetime.now(timezone.utc) > client.otp_expires:
        return {"success": False, "error": "Code expiré"}
    if client.otp_code != code:
        return {"success": False, "error": "Code invalide"}

    # Issue client token
    token = _generate_token()
    client.client_token = token
    client.otp_code     = None
    client.otp_expires  = None
    db.commit()
    return {"success": True, "client_token": token, "client_id": client.id}


def get_client_from_token(db: Session, token: str):
    return db.scalars(
        select(models.ClientAccount).where(models.ClientAccount.client_token == token)
    ).first()


def get_client_loyalty(db: Session, client_id: int) -> dict:
    client = db.get(models.ClientAccount, client_id)
    if not client:
        return {}
    return {
        "total_points": client.total_points,
        "total_spent":  client.total_spent,
        "visit_count":  client.visit_count,
    }


def update_client_name(db: Session, client_id: int, name: str):
    client = db.get(models.ClientAccount, client_id)
    if client:
        client.name = name
        db.commit()


# ─────────────────────────────────────────
#  CLIENT PWA — MENU & COMMANDES PUBLICS
# ─────────────────────────────────────────

def get_establishments_nearby(db: Session, lat: float, lng: float, radius: float) -> list:
    establishments = db.scalars(
        select(models.Establishment).where(models.Establishment.is_active == True)  # noqa
    ).all()
    return [
        {"id": e.id, "name": e.name, "address": e.address,
         "phone": e.phone, "description": e.description,
         "logo_url": e.logo_url, "latitude": e.latitude, "longitude": e.longitude}
        for e in establishments
    ]


def get_public_menu(db: Session, establishment_id: int) -> dict:
    est = db.get(models.Establishment, establishment_id)
    if not est or not est.is_active:
        raise HTTPException(404, "Établissement introuvable")
    categories = db.scalars(
        select(models.Category).where(models.Category.establishment_id == establishment_id)
    ).all()
    result = []
    for cat in categories:
        products = db.scalars(
            select(models.Product)
            .where(models.Product.category_id == cat.id)
            .where(models.Product.is_available == True)  # noqa
        ).all()
        result.append({
            "id": cat.id, "name": cat.name,
            "products": [
                {"id": p.id, "name": p.name, "price": p.price,
                 "description": p.description}
                for p in products
            ],
        })
    return {"establishment": {"id": est.id, "name": est.name}, "menu": result}


def get_table_order(db: Session, establishment_id: int, table_id: int) -> dict:
    order = db.scalars(
        select(models.Order)
        .where(models.Order.establishment_id == establishment_id)
        .where(models.Order.table_id == table_id)
        .where(models.Order.status.in_([models.OrderStatus.OPEN, models.OrderStatus.SENT]))
        .order_by(models.Order.created_at.desc())
        .limit(1)
    ).first()
    if not order:
        return {"order": None}
    items = [
        {"id": i.id, "product_id": i.product_id, "quantity": i.quantity,
         "unit_price": i.unit_price, "notes": i.notes}
        for i in order.items
    ]
    return {
        "order": {
            "id": order.id, "status": order.status,
            "created_at": order.created_at, "items": items,
            "total": sum(i["unit_price"] * i["quantity"] for i in items),
        }
    }


def get_client_receipt(db: Session, order_id: int) -> dict:
    order = db.get(models.Order, order_id)
    if not order:
        raise HTTPException(404, "Commande introuvable")
    items = [
        {"product_id": i.product_id, "quantity": i.quantity,
         "unit_price": i.unit_price, "subtotal": i.unit_price * i.quantity}
        for i in order.items
    ]
    total = sum(i["subtotal"] for i in items)
    return {
        "order_id":   order.id,
        "table_id":   order.table_id,
        "status":     order.status,
        "items":      items,
        "total":      total,
        "created_at": order.created_at,
    }


# ─────────────────────────────────────────
#  WALLET
# ─────────────────────────────────────────

def get_wallet(db: Session, client_id: int) -> dict:
    wallet = db.scalars(
        select(models.WalletAccount).where(models.WalletAccount.client_id == client_id)
    ).first()
    if not wallet:
        wallet = models.WalletAccount(client_id=client_id, balance=0.0, total_loaded=0.0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    txs = db.scalars(
        select(models.WalletTransaction)
        .where(models.WalletTransaction.wallet_id == wallet.id)
        .order_by(models.WalletTransaction.created_at.desc())
        .limit(50)
    ).all()
    # Calculer total cashback à partir des transactions de type cashback
    total_cashback = sum(
        t.amount for t in txs
        if t.tx_type in ("cashback", "earn") and t.amount > 0
    )
    # Compter les recharges en attente
    from sqlalchemy import func as sqlfunc
    pending_count = db.query(models.WalletTopup).filter(
        models.WalletTopup.client_id == client_id,
        models.WalletTopup.status == "pending",
    ).count()
    return {
        "balance":        wallet.balance,
        "total_loaded":   wallet.total_loaded,
        "total_cashback": total_cashback,
        "pending_topups": pending_count,
        "transactions": [
            {"id": t.id, "type": t.tx_type, "amount": t.amount,
             "balance_after": t.balance_after, "description": t.description,
             "service_type": t.service_type,
             "created_at": t.created_at}
            for t in txs
        ],
    }


def request_topup(db: Session, client_id: int, amount: float, method: str,
                  phone_used: str, est_id: int) -> dict:
    if amount <= 0:
        return {"error": "Montant invalide"}
    topup = models.WalletTopup(
        client_id=client_id, amount=amount, method=method,
        phone_used=phone_used, establishment_id=est_id, status="pending",
    )
    db.add(topup)
    db.commit()
    db.refresh(topup)
    return {"topup_id": topup.id, "status": "pending", "amount": amount}


def confirm_topup(db: Session, topup_id: int, confirmed_by: int, est_id: int) -> dict:
    topup = db.get(models.WalletTopup, topup_id, with_for_update=True)
    if not topup or topup.establishment_id != est_id:
        return {"error": "Recharge introuvable"}
    if topup.status != "pending":
        return {"error": "Recharge déjà traitée"}
    wallet = db.scalars(
        select(models.WalletAccount)
        .where(models.WalletAccount.client_id == topup.client_id)
        .with_for_update()
    ).first()
    if not wallet:
        wallet = models.WalletAccount(client_id=topup.client_id, balance=0.0, total_loaded=0.0)
        db.add(wallet)
        db.flush()
    balance_before       = wallet.balance
    wallet.balance      += topup.amount
    wallet.total_loaded += topup.amount
    topup.status       = "confirmed"
    topup.confirmed_by = confirmed_by
    tx = models.WalletTransaction(
        wallet_id=wallet.id, tx_type="topup", amount=topup.amount,
        balance_before=balance_before, balance_after=wallet.balance,
        description=f"Recharge {topup.method}", establishment_id=est_id,
        created_by=confirmed_by,
    )
    db.add(tx)
    db.commit()
    return {"success": True, "new_balance": wallet.balance}


def reject_topup(db: Session, topup_id: int, rejected_by: int) -> dict:
    topup = db.get(models.WalletTopup, topup_id)
    if not topup:
        return {"error": "Recharge introuvable"}
    topup.status = "rejected"
    db.commit()
    return {"success": True}


def get_pending_topups(db: Session, est_id: int) -> list:
    topups = db.scalars(
        select(models.WalletTopup)
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "pending")
        .order_by(models.WalletTopup.created_at.desc())
    ).all()
    return [
        {"id": t.id, "client_id": t.client_id, "amount": t.amount,
         "method": t.method, "phone_used": t.phone_used, "created_at": t.created_at}
        for t in topups
    ]


def pay_with_wallet(db: Session, client_id: int, order_id: int,
                    est_id: int, amount: float) -> dict:
    # Verrouillage ligne wallet pour éviter les doubles débits concurrents
    wallet = db.scalars(
        select(models.WalletAccount)
        .where(models.WalletAccount.client_id == client_id)
        .with_for_update()
    ).first()
    if not wallet:
        return {"error": "Wallet introuvable"}
    if wallet.balance < amount:
        return {"error": f"Solde insuffisant. Solde: {wallet.balance}"}
    order = db.get(models.Order, order_id, with_for_update=True)
    if not order or order.establishment_id != est_id:
        return {"error": "Commande introuvable"}
    # Idempotence : si commande déjà payée, retourner succès sans redébiter
    if order.status == models.OrderStatus.PAID:
        return {"success": True, "new_balance": wallet.balance, "already_paid": True}
    balance_before   = wallet.balance
    wallet.balance  -= amount
    order.status     = models.OrderStatus.PAID
    if order.table:
        order.table.status = models.TableStatus.FREE
    payment = models.Payment(
        order_id=order_id, establishment_id=est_id,
        amount=amount, method=models.PaymentMethod.WALLET,
    )
    db.add(payment)
    tx = models.WalletTransaction(
        wallet_id=wallet.id, tx_type="payment", amount=amount,
        balance_before=balance_before, balance_after=wallet.balance,
        description=f"Paiement commande #{order_id}", establishment_id=est_id,
    )
    db.add(tx)
    db.commit()
    return {"success": True, "new_balance": wallet.balance}


def transfer_wallet(db: Session, from_client_id: int, recipient_phone: str,
                    amount: float) -> dict:
    if amount <= 0:
        return {"error": "Montant invalide"}
    # Verrouillage du wallet émetteur avant tout calcul
    from_wallet = db.scalars(
        select(models.WalletAccount)
        .where(models.WalletAccount.client_id == from_client_id)
        .with_for_update()
    ).first()
    if not from_wallet or from_wallet.balance < amount:
        return {"error": "Solde insuffisant"}
    recipient = db.scalars(
        select(models.ClientAccount).where(models.ClientAccount.phone == recipient_phone)
    ).first()
    if not recipient:
        return {"error": "Destinataire introuvable"}
    to_wallet = db.scalars(
        select(models.WalletAccount)
        .where(models.WalletAccount.client_id == recipient.id)
        .with_for_update()
    ).first()
    if not to_wallet:
        to_wallet = models.WalletAccount(client_id=recipient.id, balance=0.0, total_loaded=0.0)
        db.add(to_wallet)
        db.flush()
    fb = from_wallet.balance
    tb = to_wallet.balance
    from_wallet.balance -= amount
    to_wallet.balance   += amount
    db.add(models.WalletTransaction(
        wallet_id=from_wallet.id, tx_type="transfer_out", amount=amount,
        balance_before=fb, balance_after=from_wallet.balance,
        description=f"Transfert vers {recipient_phone}",
    ))
    db.add(models.WalletTransaction(
        wallet_id=to_wallet.id, tx_type="transfer_in", amount=amount,
        balance_before=tb, balance_after=to_wallet.balance,
        description=f"Transfert reçu",
    ))
    db.commit()
    return {"success": True, "new_balance": from_wallet.balance}


# ─────────────────────────────────────────
#  REAPPRO ORDERS
# ─────────────────────────────────────────
from sqlalchemy import text as sa_text

def create_reappro(db: Session, est_id: int, user_id: int, data: dict) -> dict:
    row = db.execute(sa_text("""
        INSERT INTO reappro_orders
            (establishment_id, product_id, quantity_ordered, unit_cost, supplier, notes, created_by, status)
        VALUES
            (:est_id, :product_id, :quantity_ordered, :unit_cost, :supplier, :notes, :user_id, 'pending')
        RETURNING id, product_id, quantity_ordered, unit_cost, supplier, notes, status, created_at
    """), {
        "est_id": est_id,
        "product_id": data["product_id"],
        "quantity_ordered": data["quantity_ordered"],
        "unit_cost": data.get("unit_cost", 0),
        "supplier": data.get("supplier", ""),
        "notes": data.get("notes", ""),
        "user_id": user_id,
    }).mappings().first()
    db.commit()
    return dict(row)

def get_reappros(db: Session, est_id: int, status: str = None) -> list:
    query = """
        SELECT r.id, r.product_id, p.name as product_name, p.stock_unit,
               r.quantity_ordered, r.quantity_received, r.unit_cost,
               r.supplier, r.status, r.notes,
               r.created_at, r.received_at,
               u.full_name as created_by_name
        FROM reappro_orders r
        JOIN products p ON p.id = r.product_id
        LEFT JOIN users u ON u.id = r.created_by
        WHERE r.establishment_id = :est_id
    """
    params = {"est_id": est_id}
    if status:
        query += " AND r.status = :status"
        params["status"] = status
    query += " ORDER BY r.created_at DESC"
    rows = db.execute(sa_text(query), params).mappings().all()
    return [dict(r) for r in rows]

def receive_reappro(db: Session, reappro_id: int, est_id: int, user_id: int, quantity_received: int) -> dict:
    reappro = db.execute(sa_text(
        "SELECT * FROM reappro_orders WHERE id=:id AND establishment_id=:est_id"
    ), {"id": reappro_id, "est_id": est_id}).mappings().first()
    if not reappro:
        raise Exception("Reappro introuvable")
    # Mettre a jour le stock produit
    db.execute(sa_text(
        "UPDATE products SET stock_quantity = stock_quantity + :qty WHERE id = :pid AND establishment_id = :est_id"
    ), {"qty": quantity_received, "pid": reappro["product_id"], "est_id": est_id})
    # Enregistrer le mouvement de stock
    db.execute(sa_text("""
        INSERT INTO stock_movements (product_id, establishment_id, movement_type, quantity, reason)
        VALUES (:pid, :est_id, 'in', :qty, 'Reappro #' || :rid)
    """), {"pid": reappro["product_id"], "est_id": est_id, "qty": quantity_received, "rid": reappro_id})
    # Mettre a jour le reappro
    db.execute(sa_text("""
        UPDATE reappro_orders
        SET status='received', quantity_received=:qty, received_by=:uid, received_at=now()
        WHERE id=:id
    """), {"qty": quantity_received, "uid": user_id, "id": reappro_id})
    db.commit()
    return {"ok": True, "quantity_received": quantity_received}


# ─────────────────────────────────────────
#  STOCK DASHBOARD
# ─────────────────────────────────────────
def get_stock_dashboard(db: Session, est_id: int) -> list:
    """Stock ouverture jour, entrees, sorties, stock actuel par produit."""
    from datetime import datetime, timezone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    products = db.scalars(select(models.Product).where(models.Product.establishment_id == est_id)).all()
    result = []
    for p in products:
        # Mouvements du jour
        mvts = db.execute(sa_text("""
            SELECT quantity FROM stock_movements
            WHERE product_id = :pid AND created_at >= :start
        """), {"pid": p.id, "start": today_start}).mappings().all()
        entrees_jour = sum(m["quantity"] for m in mvts if m["quantity"] > 0)
        sorties_jour = abs(sum(m["quantity"] for m in mvts if m["quantity"] < 0))
        stock_ouverture = p.stock_quantity - entrees_jour + sorties_jour
        if p.stock_quantity <= 0:
            status = "out"
        elif p.stock_quantity <= (p.stock_alert_threshold or 5):
            status = "low"
        else:
            status = "ok"
        result.append({
            "id": p.id,
            "name": p.name,
            "stock_unit": p.stock_unit or "pcs",
            "purchase_price": float(p.purchase_price or 0),
            "stock_alert_threshold": p.stock_alert_threshold or 5,
            "stock_ouverture": stock_ouverture,
            "entrees_jour": entrees_jour,
            "sorties_jour": sorties_jour,
            "stock_actuel": p.stock_quantity,
            "valeur_stock": float((p.purchase_price or 0) * p.stock_quantity),
            "status": status,
        })
    result.sort(key=lambda x: (0 if x["status"]=="out" else 1 if x["status"]=="low" else 2, x["name"]))
    return result

def get_stock_movements_period(db: Session, est_id: int, period: str = "today") -> list:
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    else:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rows = db.execute(sa_text("""
        SELECT sm.id, sm.product_id, p.name as product_name, sm.movement_type,
               sm.quantity, sm.reason, sm.created_at
        FROM stock_movements sm
        JOIN products p ON p.id = sm.product_id
        WHERE sm.establishment_id = :est_id AND sm.created_at >= :start
        ORDER BY sm.created_at DESC
    """), {"est_id": est_id, "start": start}).mappings().all()
    return [dict(r) for r in rows]

def get_stock_bilan(db: Session, est_id: int) -> list:
    """Bilan mensuel par produit : entrees, sorties, stock debut, stock actuel."""
    from datetime import datetime, timezone
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    products = db.scalars(select(models.Product).where(models.Product.establishment_id == est_id)).all()
    result = []
    for p in products:
        mvts = db.execute(sa_text("""
            SELECT quantity FROM stock_movements
            WHERE product_id = :pid AND created_at >= :start
        """), {"pid": p.id, "start": month_start}).mappings().all()
        entrees = sum(m["quantity"] for m in mvts if m["quantity"] > 0)
        sorties = abs(sum(m["quantity"] for m in mvts if m["quantity"] < 0))
        stock_debut = p.stock_quantity - entrees + sorties
        result.append({
            "id": p.id,
            "name": p.name,
            "stock_unit": p.stock_unit or "pcs",
            "purchase_price": float(p.purchase_price or 0),
            "stock_debut_mois": stock_debut,
            "entrees_mois": entrees,
            "sorties_mois": sorties,
            "stock_actuel": p.stock_quantity,
            "valeur_consommee": float((p.purchase_price or 0) * sorties),
            "valeur_restante": float((p.purchase_price or 0) * max(p.stock_quantity, 0)),
            "taux_rotation": round(sorties / max(stock_debut + entrees, 1) * 100, 1),
        })
    result.sort(key=lambda x: x["sorties_mois"], reverse=True)
    return result

def delete_product(db: Session, product_id: int, est_id: int) -> bool:
    product = db.get(models.Product, product_id)
    if not product or product.establishment_id != est_id:
        return False
    db.delete(product)
    db.commit()
    return True


# ─────────────────────────────────────────
#  WALLET MANAGER DASHBOARD
# ─────────────────────────────────────────
def get_wallet_manager(db: Session, est_id: int) -> dict:
    from datetime import datetime, timezone
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    # Demandes de recharge en attente
    pending_rows = db.scalars(
        select(models.WalletTopup)
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "pending")
        .order_by(models.WalletTopup.created_at.desc())
    ).all()
    pending_topups = []
    for t in pending_rows:
        client = db.get(models.ClientAccount, t.client_id)
        pending_topups.append({
            "id": t.id, "amount": t.amount, "method": t.method,
            "status": t.status, "created_at": t.created_at.isoformat() if t.created_at else None,
            "phone_number": client.phone if client else None,
            "full_name": client.name if client else "—",
        })

    # Stats du jour
    today_topups = db.scalar(
        select(func.coalesce(func.sum(models.WalletTopup.amount), 0))
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "confirmed")
        .where(models.WalletTopup.created_at >= today)
    ) or 0.0

    today_payments = db.scalar(
        select(func.coalesce(func.sum(models.WalletTransaction.amount), 0))
        .where(models.WalletTransaction.tx_type == "payment")
        .where(models.WalletTransaction.establishment_id == est_id)
        .where(models.WalletTransaction.created_at >= today)
    ) or 0.0

    active_clients = db.scalar(
        select(func.count(func.distinct(models.WalletTopup.client_id)))
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "confirmed")
    ) or 0

    # Transactions récentes
    recent_rows = db.scalars(
        select(models.WalletTransaction)
        .where(models.WalletTransaction.establishment_id == est_id)
        .order_by(models.WalletTransaction.created_at.desc())
        .limit(30)
    ).all()
    recent_txs = []
    for tx in recent_rows:
        wa = db.get(models.WalletAccount, tx.wallet_id)
        client = db.get(models.ClientAccount, wa.client_id) if wa else None
        recent_txs.append({
            "id": tx.id, "tx_type": tx.tx_type, "amount": tx.amount,
            "description": tx.description,
            "created_at": tx.created_at.isoformat() if tx.created_at else None,
            "phone_number": client.phone if client else None,
            "client_name": client.name if client else "—",
        })

    return {
        "pending_count": len(pending_topups),
        "pending_topups": pending_topups,
        "today_topups": float(today_topups),
        "today_wallet_payments": float(today_payments),
        "active_clients": int(active_clients),
        "recent_transactions": recent_txs,
    }

def get_wallet_liquidity(db: Session, est_id: int) -> dict:
    total_loaded = db.scalar(
        select(func.coalesce(func.sum(models.WalletTopup.amount), 0))
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "confirmed")
    ) or 0.0

    wallet_received = db.scalar(
        select(func.coalesce(func.sum(models.WalletTransaction.amount), 0))
        .where(models.WalletTransaction.establishment_id == est_id)
        .where(models.WalletTransaction.tx_type == "payment")
    ) or 0.0

    pending_amount = db.scalar(
        select(func.coalesce(func.sum(models.WalletTopup.amount), 0))
        .where(models.WalletTopup.establishment_id == est_id)
        .where(models.WalletTopup.status == "pending")
    ) or 0.0

    return {
        "total_loaded":    float(total_loaded),
        "wallet_received": float(wallet_received),
        "pending_amount":  float(pending_amount),
        "liquidity":       float(total_loaded) - float(wallet_received),
    }


