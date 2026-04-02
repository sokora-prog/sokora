#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
#  SOKORA — Script de déploiement Hetzner VPS (Ubuntu 24.04)
#  Usage   : sudo bash deploy_hetzner.sh
#  Options : DOMAIN=api.sokora.app CERTBOT_EMAIL=admin@sokora.ci RUN_SEEDS=true
#  Prérequis : DNS A records configurés avant exécution
#    api.sokora.app     → IP du VPS
#    hotel.sokora.app   → IP du VPS
#    voyage.sokora.app  → IP du VPS
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Couleurs ──────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
err()  { echo -e "${RED}  ✗ ERREUR :${NC} $1"; exit 1; }
step() { echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━${NC}"; }

# ── Variables configurables ───────────────────────────────────────────────
DOMAIN="${DOMAIN:-api.sokora.app}"
HOTEL_DOMAIN="hotel.sokora.app"
VOYAGE_DOMAIN="voyage.sokora.app"
EMAIL="${CERTBOT_EMAIL:-admin@sokora.ci}"
REPO_URL="${REPO_URL:-git@github.com:SOKORA-CI/sokora.git}"   # Ajuste selon ton repo
APP_DIR="/opt/sokora"
RUN_SEEDS="${RUN_SEEDS:-false}"

# ── Vérifications préliminaires ───────────────────────────────────────────
[[ $EUID -ne 0 ]] && err "Ce script doit être exécuté en root (sudo bash deploy_hetzner.sh)"
[[ -z "$DOMAIN" ]] && err "DOMAIN non défini"

echo -e "\n${BOLD}SOKORA — Déploiement Hetzner VPS${NC}"
echo -e "  Domaine principal : ${BLUE}https://${DOMAIN}${NC}"
echo -e "  Hotel dashboard  : ${BLUE}https://${HOTEL_DOMAIN}${NC}"
echo -e "  Voyage dashboard : ${BLUE}https://${VOYAGE_DOMAIN}${NC}"
echo -e "  Répertoire       : ${APP_DIR}"
echo -e "  Seeds de test    : ${RUN_SEEDS}\n"
read -rp "Confirmer le déploiement ? [y/N] " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Annulé."; exit 0; }

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 1 — Mise à jour système"
# ══════════════════════════════════════════════════════════════════════════
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    curl wget git unzip htop \
    ufw fail2ban \
    ca-certificates gnupg lsb-release \
    openssl
ok "Système Ubuntu $(lsb_release -rs) mis à jour"

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 2 — Installation Docker"
# ══════════════════════════════════════════════════════════════════════════
if ! command -v docker &>/dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
        | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable --now docker
    ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') installé"
else
    ok "Docker déjà présent : $(docker --version | cut -d' ' -f3 | tr -d ',')"
fi

# Node.js 20 (pour le build des dashboards)
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y -qq nodejs
    ok "Node.js $(node --version) installé"
else
    ok "Node.js déjà présent : $(node --version)"
fi

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 3 — Pare-feu (ufw)"
# ══════════════════════════════════════════════════════════════════════════
ufw --force reset > /dev/null
ufw default deny incoming > /dev/null
ufw default allow outgoing > /dev/null
ufw allow ssh > /dev/null
ufw allow 80/tcp > /dev/null
ufw allow 443/tcp > /dev/null
ufw --force enable > /dev/null
ok "Pare-feu actif : SSH (22) + HTTP (80) + HTTPS (443)"

# Fail2ban
systemctl enable --now fail2ban > /dev/null 2>&1 || true
ok "Fail2ban actif"

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 4 — Clone du repository"
# ══════════════════════════════════════════════════════════════════════════
if [ -d "$APP_DIR/.git" ]; then
    warn "$APP_DIR existe — git pull sur la branche courante"
    git -C "$APP_DIR" pull
else
    git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
ok "Repository dans $APP_DIR ($(git rev-parse --short HEAD))"

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 5 — Variables d'environnement production"
# ══════════════════════════════════════════════════════════════════════════
if [ ! -f "$APP_DIR/.env" ]; then
    SECRET_KEY=$(openssl rand -hex 32)
    DB_PASS=$(openssl rand -hex 16)

    cat > "$APP_DIR/.env" << EOF
# SOKORA Production — Généré le $(date '+%Y-%m-%d %H:%M:%S')
# ⚠️  CONFIDENTIEL — Ne jamais committer ce fichier

# Domaines
DOMAIN=${DOMAIN}
HOTEL_DOMAIN=${HOTEL_DOMAIN}
VOYAGE_DOMAIN=${VOYAGE_DOMAIN}

# Base de données
POSTGRES_USER=sokora
POSTGRES_PASSWORD=${DB_PASS}
POSTGRES_DB=sokora_db

# Sécurité
SECRET_KEY=${SECRET_KEY}

# CORS (domaines autorisés)
ALLOWED_ORIGINS=https://${DOMAIN},https://${HOTEL_DOMAIN},https://${VOYAGE_DOMAIN}

# Email certbot
CERTBOT_EMAIL=${EMAIL}
EOF
    chmod 600 "$APP_DIR/.env"
    ok ".env créé avec secrets aléatoires"
    warn "IMPORTANT : sauvegardez ce fichier → cat $APP_DIR/.env"
else
    ok ".env existant conservé (non écrasé)"
fi

# Charger les variables
set -a; source "$APP_DIR/.env"; set +a

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 6 — Bootstrap SSL Let's Encrypt"
# ══════════════════════════════════════════════════════════════════════════
CERT_PATH="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"

if [ ! -f "$CERT_PATH" ]; then
    log "Démarrage nginx HTTP temporaire pour le challenge ACME..."

    # Stopper tout container sur le port 80
    docker stop sokora_nginx sokora_bootstrap 2>/dev/null || true
    docker rm  sokora_nginx sokora_bootstrap 2>/dev/null || true

    mkdir -p /var/www/certbot

    # Nginx bootstrap minimal (HTTP only)
    docker run -d --name sokora_bootstrap \
        -p 80:80 \
        -v /var/www/certbot:/var/www/certbot \
        nginx:1.25-alpine \
        sh -c 'echo "server { listen 80; location /.well-known/acme-challenge/ { root /var/www/certbot; } location / { return 200 \"SOKORA OK\"; } }" > /etc/nginx/conf.d/default.conf && nginx -g "daemon off;"'

    sleep 3
    log "Obtention du certificat pour ${DOMAIN}, ${HOTEL_DOMAIN}, ${VOYAGE_DOMAIN}..."

    docker run --rm \
        -v /etc/letsencrypt:/etc/letsencrypt \
        -v /var/www/certbot:/var/www/certbot \
        certbot/certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email "${EMAIL}" \
            --agree-tos \
            --no-eff-email \
            --non-interactive \
            -d "${DOMAIN}" \
            -d "${HOTEL_DOMAIN}" \
            -d "${VOYAGE_DOMAIN}"

    docker stop sokora_bootstrap && docker rm sokora_bootstrap
    ok "Certificat SSL obtenu pour les 3 domaines"
else
    ok "Certificat SSL existant (expire : $(openssl x509 -noout -enddate -in "$CERT_PATH" | cut -d= -f2))"
fi

# Volumes certbot
mkdir -p /var/www/certbot
mkdir -p /etc/letsencrypt

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 7 — Build des dashboards statiques"
# ══════════════════════════════════════════════════════════════════════════
mkdir -p /var/www/sokora/hotel /var/www/sokora/voyage

# Hotel dashboard
log "Build hotel-dashboard..."
cd "$APP_DIR/hotel-dashboard"
npm ci --silent --no-progress
VITE_API_URL="https://${DOMAIN}/api" npm run build -- --outDir dist 2>&1 | tail -3
cp -r dist/. /var/www/sokora/hotel/
ok "hotel-dashboard buildé → /var/www/sokora/hotel/"

# Voyage dashboard
log "Build voyage-dashboard..."
cd "$APP_DIR/voyage-dashboard"
npm ci --silent --no-progress
VITE_API_URL="https://${DOMAIN}/api" npm run build -- --outDir dist 2>&1 | tail -3
cp -r dist/. /var/www/sokora/voyage/
ok "voyage-dashboard buildé → /var/www/sokora/voyage/"

cd "$APP_DIR"

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 8 — Configuration nginx (3 vhosts)"
# ══════════════════════════════════════════════════════════════════════════

# Écrire le sokora.conf avec les 3 vhosts
cat > "$APP_DIR/nginx/conf.d/sokora.conf" << NGINX_CONF
upstream sokora_api {
    server backend:8000;
    keepalive 32;
}

# ── HTTP → HTTPS + ACME challenge ──────────────────────────────
server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# ── api.sokora.app — API REST + Frontend HoReCa ────────────────
server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";

    client_max_body_size 20M;

    # API REST
    location /api/ {
        rewrite ^/api/(.*)$ /\$1 break;
        proxy_pass         http://sokora_api;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 10s;
    }

    # WebSocket
    location /ws/ {
        proxy_pass         http://sokora_api;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade    \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host       \$host;
        proxy_set_header   X-Real-IP  \$remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Frontend HoReCa (SPA React)
    location / {
        root  /usr/share/nginx/html;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}

# ── hotel.sokora.app — Dashboard Hôtelier ──────────────────────
server {
    listen 443 ssl http2;
    server_name ${HOTEL_DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;

    location / {
        root  /var/www/sokora/hotel;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}

# ── voyage.sokora.app — Dashboard Compagnies ───────────────────
server {
    listen 443 ssl http2;
    server_name ${VOYAGE_DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_session_cache   shared:SSL:10m;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;

    location / {
        root  /var/www/sokora/voyage;
        index index.html;
        try_files \$uri \$uri/ /index.html;
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
NGINX_CONF

ok "nginx/conf.d/sokora.conf réécrit (3 vhosts)"

# Override docker-compose pour monter /var/www/sokora et certbot
cat > "$APP_DIR/docker-compose.prod.local.yml" << 'COMPOSE_OVERRIDE'
version: '3.8'
services:
  nginx:
    volumes:
      - certbot_www:/var/www/certbot:ro
      - certbot_conf:/etc/letsencrypt:ro
      - /var/www/sokora:/var/www/sokora:ro

volumes:
  certbot_www:
  certbot_conf:
COMPOSE_OVERRIDE

ok "docker-compose.prod.local.yml créé"

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 9 — Démarrage de la stack production"
# ══════════════════════════════════════════════════════════════════════════
log "Build et démarrage des containers..."

docker compose \
    -f "$APP_DIR/docker-compose.prod.yml" \
    -f "$APP_DIR/docker-compose.prod.local.yml" \
    up -d --build \
    --remove-orphans

ok "Containers démarrés"
docker compose -f "$APP_DIR/docker-compose.prod.yml" ps

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 10 — Migration et initialisation de la base de données"
# ══════════════════════════════════════════════════════════════════════════
log "Attente de PostgreSQL (max 90s)..."
for i in $(seq 1 18); do
    if docker exec sokora_db pg_isready -U "${POSTGRES_USER:-sokora}" -d "${POSTGRES_DB:-sokora_db}" -q 2>/dev/null; then
        ok "PostgreSQL prêt"
        break
    fi
    sleep 5
    [[ $i -eq 18 ]] && err "PostgreSQL non disponible après 90s — vérifier : docker logs sokora_db"
done

# Attendre que le backend soit prêt
log "Attente du backend (max 30s)..."
sleep 10

# Migrations / create_all
log "Initialisation des tables..."
if docker exec sokora_backend test -f /app/alembic.ini 2>/dev/null; then
    docker exec sokora_backend alembic upgrade head
    ok "Migrations Alembic appliquées"
else
    docker exec sokora_backend python -c "
from app.database import engine, Base
import app.models
import app.models_hotel
import app.models_voyage
import app.models_promo
import app.models_bar
Base.metadata.create_all(bind=engine)
print('  Toutes les tables créées')
"
    ok "Tables créées via SQLAlchemy"
fi

# Seeds optionnels
if [ "$RUN_SEEDS" = "true" ]; then
    log "Exécution des seeds de données de test..."
    for seed in seed_test_accounts.py seed_establishments.py seed_hotels_voyages.py; do
        SEED_FILE="$APP_DIR/backend/app/$seed"
        if [ -f "$SEED_FILE" ]; then
            docker cp "$SEED_FILE" sokora_backend:/tmp/
            docker exec sokora_backend python "/tmp/$seed" && ok "  $seed ✓" || warn "  $seed échoué (peut-être déjà exécuté)"
        fi
    done
fi

# ══════════════════════════════════════════════════════════════════════════
step "ÉTAPE 11 — Vérifications finales"
# ══════════════════════════════════════════════════════════════════════════
sleep 5

echo ""
# API health
if curl -sf "https://${DOMAIN}/api/health" -o /dev/null 2>/dev/null; then
    ok "API HTTPS     : https://${DOMAIN}/api/health"
elif curl -sf "http://localhost/api/health" -o /dev/null 2>/dev/null; then
    ok "API HTTP local : http://localhost/api/health"
else
    warn "API non accessible via HTTPS (vérifier : docker logs sokora_backend)"
fi

# Dashboards statiques
[ -f "/var/www/sokora/hotel/index.html" ]  && ok "Hotel dashboard  : https://${HOTEL_DOMAIN}/" \
    || warn "Hotel dashboard  : index.html manquant dans /var/www/sokora/hotel/"
[ -f "/var/www/sokora/voyage/index.html" ] && ok "Voyage dashboard : https://${VOYAGE_DOMAIN}/" \
    || warn "Voyage dashboard : index.html manquant dans /var/www/sokora/voyage/"

# ══════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  SOKORA — Déploiement terminé ✓${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}🌐  API REST      ${NC}https://${DOMAIN}/api/"
echo -e "  ${GREEN}📊  Dashboard     ${NC}https://${DOMAIN}/"
echo -e "  ${GREEN}🏨  Hôtel         ${NC}https://${HOTEL_DOMAIN}/"
echo -e "  ${GREEN}🚌  Voyages       ${NC}https://${VOYAGE_DOMAIN}/"
echo ""
echo -e "  ${YELLOW}Commandes utiles :${NC}"
echo "  docker compose -f /opt/sokora/docker-compose.prod.yml logs -f backend"
echo "  docker compose -f /opt/sokora/docker-compose.prod.yml ps"
echo "  docker exec sokora_db psql -U sokora -d sokora_db"
echo "  docker exec sokora_backend python -c \"from app.database import engine; print('DB OK')\""
echo ""
echo -e "  ${YELLOW}Rebuild backend seul :${NC}"
echo "  docker compose -f /opt/sokora/docker-compose.prod.yml up --build backend -d"
echo ""
echo -e "  ${YELLOW}Renouvellement SSL manuel :${NC}"
echo "  docker exec sokora_certbot certbot renew"
echo -e "${BOLD}═══════════════════════════════════════════════════════════${NC}"
