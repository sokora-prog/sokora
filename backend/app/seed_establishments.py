"""
SOKORA — Seed des établissements, tables et menu de test
Exécuter : python -m app.seed_establishments (depuis /backend)
"""
from sqlalchemy.orm import Session
from .database import SessionLocal
from . import models

ESTABLISHMENTS = [
    {
        "name": "Maquis La Belle Vie",
        "address": "Cocody, Abidjan",
        "phone": "0700000001",
        "type": "maquis",
        "city": "Abidjan",
        "manager_phone": "0700000001",
        "waiter_phones": ["0700000011"],
        "tables": [
            {"number": 1, "label": "Salle",     "capacity": 4},
            {"number": 2, "label": "Salle",     "capacity": 4},
            {"number": 3, "label": "Salle",     "capacity": 6},
            {"number": 4, "label": "Terrasse",  "capacity": 2},
            {"number": 5, "label": "Terrasse",  "capacity": 4},
            {"number": 6, "label": "Terrasse",  "capacity": 4},
            {"number": 7, "label": "VIP",       "capacity": 8},
            {"number": 8, "label": "Bar",       "capacity": 2},
        ],
        "categories": [
            {"name": "Grillades",    "is_kitchen": True},
            {"name": "Poissons",     "is_kitchen": True},
            {"name": "Boissons",     "is_kitchen": False},
            {"name": "Accompagnements", "is_kitchen": True},
        ],
        "products": [
            {"name": "Poulet braisé",      "price": 2500, "category": "Grillades"},
            {"name": "Poisson braisé",     "price": 3000, "category": "Poissons"},
            {"name": "Tilapia grillé",     "price": 2500, "category": "Poissons"},
            {"name": "Alloco",             "price":  500, "category": "Accompagnements"},
            {"name": "Attiéké",            "price":  500, "category": "Accompagnements"},
            {"name": "Bière Castel 65cl",  "price":  800, "category": "Boissons"},
            {"name": "Eau minérale 1.5L",  "price":  500, "category": "Boissons"},
            {"name": "Jus de gingembre",   "price":  500, "category": "Boissons"},
        ],
    },
    {
        "name": "Bar Étoile VIP",
        "address": "Marcory, Abidjan",
        "phone": "0700000002",
        "type": "bar",
        "city": "Abidjan",
        "manager_phone": "0700000002",
        "waiter_phones": ["0700000012"],
        "tables": [
            {"number": 1, "label": "Comptoir", "capacity": 2},
            {"number": 2, "label": "Comptoir", "capacity": 2},
            {"number": 3, "label": "Salle",    "capacity": 4},
            {"number": 4, "label": "Salle",    "capacity": 4},
            {"number": 5, "label": "VIP",      "capacity": 6},
            {"number": 6, "label": "Terrasse", "capacity": 4},
        ],
        "categories": [
            {"name": "Bières",       "is_kitchen": False},
            {"name": "Cocktails",    "is_kitchen": False},
            {"name": "Softs",        "is_kitchen": False},
            {"name": "Snacks",       "is_kitchen": True},
        ],
        "products": [
            {"name": "Flag 65cl",         "price":  700, "category": "Bières"},
            {"name": "Castel 65cl",       "price":  800, "category": "Bières"},
            {"name": "Heineken 33cl",     "price":  900, "category": "Bières"},
            {"name": "Mojito",            "price": 1500, "category": "Cocktails"},
            {"name": "Coca-Cola",         "price":  500, "category": "Softs"},
            {"name": "Omelette pain",     "price":  800, "category": "Snacks"},
            {"name": "Sandwich jambon",   "price": 1000, "category": "Snacks"},
        ],
    },
    {
        "name": "Restaurant Saveurs d'Abidjan",
        "address": "Yopougon, Abidjan",
        "phone": "0700000003",
        "type": "restaurant",
        "city": "Abidjan",
        "manager_phone": "0700000003",
        "waiter_phones": ["0700000013"],
        "tables": [
            {"number": 1,  "label": "Salle A",   "capacity": 2},
            {"number": 2,  "label": "Salle A",   "capacity": 4},
            {"number": 3,  "label": "Salle A",   "capacity": 4},
            {"number": 4,  "label": "Salle A",   "capacity": 6},
            {"number": 5,  "label": "Salle B",   "capacity": 4},
            {"number": 6,  "label": "Salle B",   "capacity": 4},
            {"number": 7,  "label": "Salle B",   "capacity": 8},
            {"number": 8,  "label": "Terrasse",  "capacity": 2},
            {"number": 9,  "label": "Terrasse",  "capacity": 4},
            {"number": 10, "label": "Terrasse",  "capacity": 4},
        ],
        "categories": [
            {"name": "Entrées",       "is_kitchen": True},
            {"name": "Plats",         "is_kitchen": True},
            {"name": "Desserts",      "is_kitchen": True},
            {"name": "Boissons",      "is_kitchen": False},
        ],
        "products": [
            {"name": "Soupe de poisson",    "price": 1500, "category": "Entrées"},
            {"name": "Salade maison",       "price": 1200, "category": "Entrées"},
            {"name": "Riz sauce graine",    "price": 2500, "category": "Plats"},
            {"name": "Foutou banane",       "price": 2000, "category": "Plats"},
            {"name": "Kedjenou poulet",     "price": 3500, "category": "Plats"},
            {"name": "Thiéboudienne",       "price": 3000, "category": "Plats"},
            {"name": "Banana split",        "price": 1500, "category": "Desserts"},
            {"name": "Eau minérale",        "price":  500, "category": "Boissons"},
            {"name": "Jus de bissap",       "price":  700, "category": "Boissons"},
        ],
    },
]


def seed_establishments():
    db: Session = SessionLocal()

    print("\n" + "="*60)
    print("SOKORA - Seed etablissements, tables & menu")
    print("="*60)

    for estab_data in ESTABLISHMENTS:
        # 1. Create or retrieve establishment
        existing = db.query(models.Establishment).filter_by(name=estab_data["name"]).first()
        if existing:
            estab = existing
            print(f"\n  [EXISTS] {estab.name} (id={estab.id})")
        else:
            estab = models.Establishment(
                name=estab_data["name"],
                address=estab_data.get("address"),
                phone=estab_data.get("phone"),
                type=estab_data.get("type"),
                city=estab_data.get("city"),
                is_active=True,
            )
            db.add(estab)
            db.flush()  # get id
            print(f"\n  [CREATED] {estab.name} (id={estab.id})")

        # 2. Assign manager
        manager = db.query(models.User).filter_by(phone_number=estab_data["manager_phone"]).first()
        if manager:
            manager.establishment_id = estab.id
            print(f"     Manager: {manager.full_name}")

        # 3. Assign waiters
        for phone in estab_data.get("waiter_phones", []):
            waiter = db.query(models.User).filter_by(phone_number=phone).first()
            if waiter:
                waiter.establishment_id = estab.id
                print(f"     Waiter:  {waiter.full_name}")

        # 4. Create tables (skip if already exist for this establishment)
        existing_tables = db.query(models.Table).filter_by(establishment_id=estab.id).count()
        if existing_tables == 0:
            for t in estab_data["tables"]:
                table = models.Table(
                    number=t["number"],
                    label=t.get("label"),
                    capacity=t.get("capacity", 4),
                    status=models.TableStatus.FREE,
                    establishment_id=estab.id,
                )
                db.add(table)
            print(f"     Tables:  {len(estab_data['tables'])} created")
        else:
            print(f"     Tables:  {existing_tables} already exist, skipped")

        # 5. Create categories and products (skip if already exist)
        existing_cats = db.query(models.Category).filter_by(establishment_id=estab.id).count()
        if existing_cats == 0:
            cat_map = {}
            for c in estab_data.get("categories", []):
                cat = models.Category(
                    name=c["name"],
                    is_kitchen=c.get("is_kitchen", False),
                    establishment_id=estab.id,
                )
                db.add(cat)
                db.flush()
                cat_map[c["name"]] = cat.id

            for p in estab_data.get("products", []):
                cat_id = cat_map.get(p.get("category"))
                product = models.Product(
                    name=p["name"],
                    price=p["price"],
                    is_available=True,
                    establishment_id=estab.id,
                    category_id=cat_id,
                    stock_quantity=100,
                )
                db.add(product)
            print(f"     Menu:    {len(estab_data.get('categories', []))} categories, {len(estab_data.get('products', []))} products")
        else:
            print(f"     Menu:    {existing_cats} categories already exist, skipped")

    db.commit()
    db.close()
    print("\n" + "="*60)
    print("  Seed complete.")
    print("="*60 + "\n")


if __name__ == "__main__":
    seed_establishments()
