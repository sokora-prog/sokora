# SOKORA — Mémo Technique & État de Santé de la Plateforme
**Date de dernière mise à jour : 22 mars 2026**
**Rédigé après une session intensive d'audit, correction et validation complète.**

---

## 1. INFRASTRUCTURE

### Stack technique
- **Backend** : FastAPI + SQLAlchemy 2.0 + PostgreSQL (Python 3.11)
- **Frontend web** : React + Vite (port 3000)
- **Mobile** : React Native / Expo (v3)
- **Docker** : `docker-compose.yml` à la racine de `C:\Users\blais\SOKORA\`
- **DB** : `sokora_db` sur container `sokora_db`, port 5432
- **Backend port** : 8001 (externe) → 8000 (interne Docker)

### Structure des dossiers (propre après nettoyage du 22/03/2026)
```
C:\Users\blais\SOKORA\
├── backend\
│   └── app\
│       ├── main.py       ← endpoints FastAPI
│       ├── crud.py       ← logique métier
│       ├── models.py     ← modèles SQLAlchemy
│       ├── schemas.py    ← schémas Pydantic
│       └── security.py   ← auth JWT
├── frontend\
│   └── src\
│       ├── App.jsx       ← TOUT le frontend web en un fichier
│       └── api.js        ← toutes les fonctions API
├── sokora-mobile\
│   └── sokora-mobile-v2\
│       └── sokora-mobile-v3\   ← VERSION ACTIVE (ne pas toucher v1/v2)
│           └── src\
│               ├── navigation\AppNavigator.js   ← navigation + OrdersListScreen inline
│               ├── screens\waiter\
│               │   ├── HomeScreen.js
│               │   ├── OrderDetailScreen.js
│               │   ├── TableOrdersScreen.js
│               │   ├── NewOrderScreen.js
│               │   ├── ArdoiseScreen.js
│               │   └── ...
│               └── utils\constants.js   ← TableStatus, OrderStatus (clés lowercase ET uppercase)
├── .env
├── backup_sokora_db.sql
└── docker-compose.yml
```

### Commandes Docker essentielles
```powershell
# Rebuild backend après modification Python
docker compose up -d --build backend

# Logs backend en direct
docker logs sokora_backend -f

# Connexion DB
docker exec sokora_db psql -U postgres -d sokora_db -c "VOTRE_SQL"

# Token d'auth pour tests API
$body = '{"phone_number":"0700000000","password":"sokora123"}'
$token = (Invoke-RestMethod -Uri "http://localhost:8001/auth/login" -Method Post -Body $body -ContentType "application/json").access_token
$h = @{Authorization="Bearer $token"}
```

### Règle absolue PowerShell/Docker
- **TOUJOURS** utiliser des scripts `.py` copiés via `docker cp` ou modifiés directement sur le host
- **JAMAIS** de `python3 -c` inline dans PowerShell (corruption d'encodage)
- Pour les fichiers JSX/JS : utiliser `node -e "require('fs').copyFileSync(...)"` pour éviter l'encodage UTF-16

---

## 2. BASE DE DONNÉES

### Credentials
- User: `postgres`, Password: `postgres` (hardcodé dans docker-compose.yml)
- DB: `sokora_db`

### Enums PostgreSQL (TOUS EN MAJUSCULES — critique)
```sql
orderstatus:    OPEN, SENT, IN_PROGRESS, READY, SERVED, PAID, CANCELLED
tablestatus:    FREE, OCCUPIED, RESERVED
paymentmethod:  CASH, CARD, MOBILE_MONEY, WAVE, ORANGE_MONEY, MTN_MONEY, WALLET, CREDIT
expensecategory: STOCK, SALARY, RENT, UTILITY, OTHER
userrole:       SUPER_ADMIN, MANAGER, WAITER
subscriptionstatus: TRIAL, ACTIVE, EXPIRED, SUSPENDED
```

### Trigger DB important (corrigé le 22/03/2026)
```sql
-- auto_free_table : libère la table quand toutes les commandes sont PAID/CANCELLED
-- CRITIQUE : doit inclure SERVED dans les statuts "actifs" pour ne PAS libérer la table
-- Statuts actifs qui gardent la table OCCUPIED : OPEN, SENT, IN_PROGRESS, READY, SERVED
```

### Données de test (établissement 1)
- Manager: `0700000000` / `sokora123`
- Serveurs: `0701000002`, `0701000003`, `0701000004` / `sokora123`
- 10 tables (T1-T10)
- ~25 produits en base

---

## 3. BACKEND — ÉTAT DES ENDPOINTS (22/03/2026)

### Tous validés ✅ (22/22)

| Endpoint | Méthode | Statut | Notes |
|----------|---------|--------|-------|
| `/auth/login` | POST | ✅ | |
| `/dashboard/stats` | GET | ✅ | period=today/week/month |
| `/dashboard/stats-period` | GET | ✅ | |
| `/dashboard/waiters-period` | GET | ✅ | |
| `/dashboard/revenue-chart` | GET | ✅ | |
| `/dashboard/caisse` | GET | ✅ | period=today/week/month |
| `/dashboard/revenue-by-method` | GET | ✅ | |
| `/dashboard/my-stats` | GET | ✅ | pour serveurs |
| `/tables/` | GET | ✅ | |
| `/products/` | GET/POST | ✅ | |
| `/categories/` | GET | ✅ | |
| `/orders/` | GET | ✅ | product_name enrichi dans items |
| `/orders/{id}` | GET | ✅ | product_name, table_number, waiter_name |
| `/orders/{id}/status` | PATCH | ✅ | accepte uppercase |
| `/orders/{id}/start` | PATCH | ✅ | SENT → IN_PROGRESS |
| `/orders/{id}/ready` | PATCH | ✅ | IN_PROGRESS → READY |
| `/kds/orders` | GET | ✅ | filtre SENT+IN_PROGRESS+READY, inclut waiter_name |
| `/payments/` | POST | ✅ | crée ardoise automatiquement si method=CREDIT |
| `/expenses/` | GET/POST | ✅ | |
| `/stock/dashboard` | GET | ✅ | |
| `/stock/movements-period` | GET | ✅ | |
| `/stock/bilan` | GET | ✅ | |
| `/stock/reappro` | GET/POST | ✅ | |
| `/credit/accounts` | GET | ✅ | |
| `/credit/accounts/{id}/transactions` | GET | ✅ | |
| `/credit/accounts/{id}/transactions` | POST | ✅ | enregistre paiement ardoise |
| `/wallet/manager` | GET | ✅ | |
| `/wallet/liquidity` | GET | ✅ | |

### Points critiques backend

#### crud.py — process_payment (CRITIQUE)
```python
# Quand method=CREDIT, crée automatiquement l'ardoise client
# Utilise credit_account_id (PAS account_id) pour CreditTransaction
# transaction_type='credit' (PAS 'debit') pour que le trigger DB calcule correctement
# Le trigger update_credit_balance gère le solde automatiquement
```

#### models.py — OrderStatus (CRITIQUE)
```python
class OrderStatus(str, enum.Enum):
    OPEN        = "OPEN"
    SENT        = "SENT"
    IN_PROGRESS = "IN_PROGRESS"
    READY       = "READY"
    SERVED      = "SERVED"
    PAID        = "PAID"
    CANCELLED   = "CANCELLED"
```

#### schemas.py — OrderItemResponse et OrderResponse
```python
# OrderItemResponse a : product_name: Optional[str] = None
# OrderResponse a : table_number, waiter_name, client_phone (tous Optional)
# PaymentCreate a : client_phone, client_name (pour ardoise crédit)
```

#### main.py — orders list endpoint
```python
# status.upper() appliqué avant conversion enum
# order_status = models.OrderStatus(status.upper()) if status else None
```

---

## 4. FRONTEND WEB — ÉTAT (22/03/2026)

### Fichier unique : `frontend/src/App.jsx`
Toutes les fonctionnalités sont dans ce fichier. Ne jamais scinder sans accord.

### Pages validées ✅
| Page | Fonctionnalités validées |
|------|--------------------------|
| Vue globale (Dashboard) | CA aujourd'hui/mois, alertes stock, tables, graphe 7j, performance serveurs |
| Suivi Caisse | Aujourd'hui/Semaine/Mois, CA par méthode, graphe stacked |
| Wallet Manager | Demandes topup en attente, approbation/rejet, liquidité |
| Cuisine KDS | Workflow SENT→IN_PROGRESS→READY, auto-refresh 15s, waiter_name |
| Menu & Produits | CRUD produits, catégories, stock initial |
| Stock | Dashboard, Mouvements, Bilan mensuel, Réapprovisionnements |
| Serveurs | Liste équipe, stats individuelles |
| Dépenses | Liste + création |
| Commandes | Liste avec filtres statuts |
| **Ardoise / Crédit** | Liste clients, historique transactions, enregistrement paiement ✅ (nouveau 22/03) |

### KDS Frontend — Points critiques
```javascript
// Les statuts backend sont UPPERCASE (SENT, IN_PROGRESS, READY)
// Bouton "Prendre en charge" : status === "SENT"
// Bouton "Marquer Prête" : status === "IN_PROGRESS"  
// Bandeau "Prête" : status === "READY"
// Helper: const st = s => (s||"").toUpperCase()
```

### Icônes disponibles dans Ic component
`grid, menu, users, dollar, check, plus, warn, logout, refresh, table, chart, box, cal, trend, wallet, chef, minus, card`

---

## 5. MOBILE — ÉTAT (22/03/2026)

### Fichier de navigation : `AppNavigator.js`
Contient aussi `OrdersListScreen` défini inline (pas dans un fichier séparé).

### Constants critiques : `utils/constants.js`
```javascript
// TableStatus a les clés LOWERCASE ET UPPERCASE (les deux depuis 22/03)
// OrderStatus a les clés LOWERCASE ET UPPERCASE (les deux depuis 22/03)
// TOUJOURS utiliser : TableStatus[status] || TableStatus[status.toLowerCase()] || TableStatus.free
```

### Workflow serveur validé ✅
```
1. HomeScreen → clic table libre → NewOrderScreen
2. NewOrderScreen → ajouter articles → "Envoyer en cuisine" → OrderDetailScreen
3. OrderDetailScreen → "En cuisine" → status SENT
4. KDS web → "Prendre en charge" → IN_PROGRESS
5. KDS web → "Marquer Prête" → READY
6. Mobile HomeScreen → notification "Commande prête" + badge vert sur table
7. OrderDetailScreen → "Servir le client" → SERVED (table reste OCCUPIED)
8. TableOrdersScreen → "Encaisser" → PAID (table passe FREE)
```

### Paiement crédit (Ardoise) — validé ✅
```javascript
// OrderDetailScreen : quand payMethod === 'credit'
// Affiche champs creditName + creditPhone obligatoires
// Envoie client_phone + client_name dans la requête payment
// Backend crée automatiquement l'ardoise en DB
// ArdoiseScreen mobile se met à jour au retour
```

### Commandes — OrdersListScreen (dans AppNavigator.js)
```javascript
// Filtres : En cours(OPEN), Cuisine(SENT), En prep(IN_PROGRESS), Pretes(READY), Payees(PAID), Toutes
// status envoyé en UPPERCASE via filter.toUpperCase()
// Status display : OrderStatus[item.status] || OrderStatus[item.status.toLowerCase()] || OrderStatus.open
```

### TableOrdersScreen — Points critiques
```javascript
// Charge : OPEN, SENT, IN_PROGRESS, READY, SERVED (TOUS les statuts non payés)
// NE PAS enlever SERVED sinon les commandes servies n'apparaissent plus dans la vue table
// Filter actif : !['PAID','CANCELLED','paid','cancelled'].includes(o.status)
```

### HomeScreen — Points critiques
```javascript
// Table navigation filter : !['PAID','CANCELLED','paid','cancelled'].includes(o.status)
// Table status check : table.status === 'FREE' || table.status === 'free'
// Table OCCUPIED count : inclut 'OCCUPIED' et 'occupied'
// readyTableIds : IDs des tables avec commandes READY (pour badge vert)
```

---

## 6. FONCTIONNALITÉS VALIDÉES — LISTE COMPLÈTE

### ✅ Authentification
- Login manager et serveur
- JWT token, rôles MANAGER/WAITER/SUPER_ADMIN

### ✅ Gestion des tables
- Plan des tables temps réel
- Statuts FREE/OCCUPIED avec couleurs correctes
- Badge "Prête" (vert pulsant) quand commande READY
- Trigger DB libère table uniquement au PAID/CANCELLED

### ✅ Workflow commande complet
- Création → KDS → Service → Paiement
- Statuts : OPEN → SENT → IN_PROGRESS → READY → SERVED → PAID

### ✅ KDS (Cuisine)
- Affiche SENT (nouveau), IN_PROGRESS (en cours), READY (prêt)
- Boutons contextuels selon statut
- Auto-refresh 15s
- Nom du serveur affiché

### ✅ Paiements
- Espèces, Wave, Orange Money, MTN Money, Carte, Wallet, À crédit
- Méthodes envoyées en UPPERCASE au backend
- Paiement crédit → ardoise créée automatiquement

### ✅ Ardoise / Crédit
- Création automatique à la commande crédit
- Liste côté serveur mobile (ArdoiseScreen)
- Page gérant web avec historique et enregistrement paiement
- Trigger DB calcule solde automatiquement

### ✅ Stock
- Dashboard avec alertes stock faible
- Mouvements filtrables
- Bilan mensuel
- Réapprovisionnements

### ✅ Wallet
- Manager web : approbation topups
- Paiement client via wallet (mobile)

### ✅ Statistiques
- Dashboard gérant : CA, bénéfice, tables, plat phare
- Stats serveur : CA today/week/month

---

## 7. PROBLÈMES RÉSOLUS (ne pas réintroduire)

| Problème | Cause | Fix appliqué |
|----------|-------|--------------|
| Login échoue | Enum lowercase vs uppercase en DB | Tous enums convertis UPPERCASE |
| "Article #12" dans commandes | get_orders ne joinait pas products | crud.get_orders enrichit product_name |
| KDS boutons n'apparaissent pas | Comparaison `==="sent"` au lieu de `==="SENT"` | Helper `st()` + comparaisons uppercase |
| Table libérée après "Servir" | Trigger DB ne connaissait pas SERVED | Trigger mis à jour pour inclure SERVED |
| Paiement crédit erreur | `credit_account_id` vs `account_id` dans modèle | Colonne DB = credit_account_id |
| Ardoise balance négative | `transaction_type='debit'` au lieu de `'credit'` | Changé en 'credit' (logique du trigger) |
| Mobile "Impossible de charger" | status filtre en minuscule, backend attend majuscule | `.toUpperCase()` ajouté partout |
| TableOrders vide après Servir | SERVED non inclus dans le filtre de chargement | Filtre changé en exclusion PAID/CANCELLED |
| Tables toutes "Libre" sur mobile | TableStatus clés lowercase, backend retourne UPPERCASE | Ajout clés UPPERCASE dans constants.js |
| `order.table.status` crash | table peut être None | `if order.table:` ajouté dans process_payment |

---

## 8. POINTS D'ATTENTION POUR LES PROCHAINES SESSIONS

### ⚠️ NE JAMAIS FAIRE
1. Changer les noms de colonnes DB sans mettre à jour models.py ET crud.py
2. Utiliser des statuts en minuscule côté mobile sans `.toUpperCase()`
3. Modifier le trigger `auto_free_table` sans tester le workflow complet
4. Ajouter un statut d'enum sans l'ajouter PARTOUT (DB, models.py, constants.js mobile)
5. Modifier `App.jsx` sans d'abord copier la version actuelle en backup

### ⚠️ AVANT TOUTE MODIFICATION
1. Sauvegarder le fichier concerné dans Downloads
2. Tester sur un endpoint isolé avant rebuild
3. Vérifier les logs docker après rebuild
4. Tester le workflow complet (pas juste la feature modifiée)

### 🔜 PROCHAINES ÉTAPES PLANIFIÉES
1. **Déploiement Hetzner VPS** (CX33, €5.49/mois, Nuremberg)
   - Ubuntu 24.04, Docker, nginx
   - Domaine : api.sokora.app
2. **Hotel module** (à concevoir)
3. **Petits services informels module** (à concevoir)
4. **PWA generation** pour clients
5. **SOKORA Black** (programme fidélité)

---

## 9. RÉSUMÉ DE L'API.JS FRONTEND

```javascript
// Toutes les fonctions API sont dans frontend/src/api.js
dashboardApi: stats, statsPeriod, waitersPeriod, revenueChart, caisse, revByMethod, myStats
tablesApi: list, updateStatus
menuApi: categories, products, createProduct, updateProduct
ordersApi: list, getById, create, addItems, updateStatus
expensesApi: list, create
staffApi: list, getStats
stockApi: dashboard, movementsPeriod, bilan, deleteProduct, reapproList, reapproCreate, reapproReceive
creditApi: accounts, search, create, get, addTransaction, transactions, close, stats
walletApi: manager, liquidity, confirmTopup, rejectTopup, checkClientBalance, payWithWallet
kdsApi: orders, startOrder, markReady
```

---

*Ce mémo doit être mis à jour après chaque session de développement majeure.*
*Il sert de référence pour éviter les régressions et gagner du temps en cas de bug.*
