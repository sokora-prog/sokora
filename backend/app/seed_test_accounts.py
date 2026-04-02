"""
SOKORA — Seed des comptes de test par module
Exécuter : python -m app.seed_test_accounts (depuis /backend)
"""
import sys
from sqlalchemy.orm import Session
from .database import SessionLocal, engine
from . import models, security

# Mapping role string → UserRole enum (le modèle DB utilise des enums)
_ROLE_MAP = {
    "super_admin": models.UserRole.SUPER_ADMIN,
    "manager":     models.UserRole.MANAGER,
    "waiter":      models.UserRole.WAITER,
    "driver":      models.UserRole.DRIVER,
    "client":      models.UserRole.CLIENT,
}

TEST_ACCOUNTS = [
    # ── SUPER ADMIN ────────────────────────────────────────────────────────
    {
        "phone_number": "0000000000",
        "password":     "sokora360@2025",
        "role":         "super_admin",
        "name":         "SOKORA Admin 360",
        "note":         "Vue complète tous modules, KPI réseau, création comptes"
    },

    # ── MANAGERS PAR MODULE ────────────────────────────────────────────────
    {
        "phone_number": "0700000001",
        "password":     "maquis#BV2025",
        "role":         "manager",
        "name":         "Gérant Maquis La Belle Vie",
        "note":         "Maquis La Belle Vie — Cocody, Abidjan"
    },
    {
        "phone_number": "0700000002",
        "password":     "bar#EtoileVIP25",
        "role":         "manager",
        "name":         "Gérant Bar Étoile VIP",
        "note":         "Bar Étoile VIP — Marcory, Abidjan"
    },
    {
        "phone_number": "0700000003",
        "password":     "resto#Saveurs25",
        "role":         "manager",
        "name":         "Gérant Restaurant Saveurs",
        "note":         "Restaurant Saveurs d'Abidjan — Yopougon"
    },
    {
        "phone_number": "0700000004",
        "password":     "hotel#Diplo25",
        "role":         "manager",
        "name":         "Gérant Hotel Le Diplomate",
        "note":         "Hotel Le Diplomate — Plateau, Abidjan"
    },
    {
        "phone_number": "0700000005",
        "password":     "voyage#UTB2025",
        "role":         "manager",
        "name":         "Gérant Terminal UTB",
        "note":         "Terminal UTB Voyages — Adjamé, Abidjan"
    },

    # ── SERVEURS ───────────────────────────────────────────────────────────
    {
        "phone_number": "0700000011",
        "password":     "serveur#1234",
        "role":         "waiter",
        "name":         "Serveur Maquis (Kofi)",
        "note":         "Serveur Maquis La Belle Vie — commande visuelle activée"
    },
    {
        "phone_number": "0700000012",
        "password":     "serveur#5678",
        "role":         "waiter",
        "name":         "Serveur Bar (Ama)",
        "note":         "Serveur Bar Étoile VIP"
    },
    {
        "phone_number": "0700000013",
        "password":     "serveur#9012",
        "role":         "waiter",
        "name":         "Serveur Restaurant (Yao)",
        "note":         "Serveur Restaurant Saveurs d'Abidjan"
    },

    # ── CHAUFFEURS ──────────────────────────────────────────────────────────
    {
        "phone_number": "0700000088",
        "password":     "driver#UTB25",
        "role":         "driver",
        "name":         "Chauffeur UTB (Diallo)",
        "note":         "Chauffeur Terminal UTB — scan QR embarquement"
    },

    # ── CLIENTS TEST ────────────────────────────────────────────────────────
    {
        "phone_number": "0700000099",
        "password":     "client#test25",
        "role":         "client",
        "name":         "Client Test (Gold)",
        "note":         "Client test avec wallet 50 000 FCFA, tier Gold"
    },
    {
        "phone_number": "0700000098",
        "password":     "client#vip25",
        "role":         "client",
        "name":         "Client VIP (Diamond)",
        "note":         "Client test Diamond avec wallet 200 000 FCFA"
    },
]

def seed_accounts():
    db: Session = SessionLocal()
    created = 0
    updated = 0

    print("\n" + "="*60)
    print("SOKORA — Seed des comptes de test")
    print("="*60)

    for account in TEST_ACCOUNTS:
        existing = db.query(models.User).filter_by(
            phone_number=account["phone_number"]
        ).first()

        hashed    = security.get_password_hash(account["password"])
        role_enum = _ROLE_MAP.get(account["role"], models.UserRole.WAITER)

        if existing:
            existing.role      = role_enum
            existing.full_name = account.get("name", account["phone_number"])
            existing.password_hash = hashed
            updated += 1
            print(f"  MAJ  [{account['role'].upper():<12}] {account['phone_number']} | {account['password']}")
        else:
            user = models.User(
                phone_number  = account["phone_number"],
                password_hash = hashed,
                role          = role_enum,
                full_name     = account.get("name", account["phone_number"]),
                is_active     = True,
            )
            db.add(user)
            created += 1
            print(f"  ✅ CRÉÉ [{account['role'].upper():<12}] {account['phone_number']} | {account['password']}")

        print(f"     └─ {account['note']}")

    db.commit()
    db.close()

    print("\n" + "-"*60)
    print(f"  ✅ {created} compte(s) créé(s)")
    print(f"  ✏️  {updated} compte(s) mis à jour")
    print("="*60)
    print("\n📋 RÉCAPITULATIF DES ACCÈS :")
    print("-"*60)
    print(f"{'RÔLE':<16} {'TÉLÉPHONE':<15} {'MOT DE PASSE':<22} MODULE")
    print("-"*60)
    for a in TEST_ACCOUNTS:
        module = a['note'].split('—')[0].strip() if '—' in a['note'] else a['note']
        print(f"{a['role'].upper():<16} {a['phone_number']:<15} {a['password']:<22} {module[:30]}")
    print("="*60 + "\n")


if __name__ == "__main__":
    seed_accounts()
