#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════
#  SOKORA — Script de déploiement Hetzner VPS
#  Usage : bash deploy.sh [--init | --update | --ssl]
#  Prérequis : Docker, Docker Compose v2, git, .env.prod
# ════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env.prod"
DOMAIN=$(grep '^DOMAIN=' .env.prod 2>/dev/null | cut -d= -f2 | tr -d '"' | tr -d "'")

# ── Couleurs ─────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
info() { echo -e "${YELLOW}→ $*${NC}"; }
err()  { echo -e "${RED}✗ $*${NC}"; exit 1; }

# ── Vérifications ────────────────────────────────────────────
[ -f .env.prod ] || err "Fichier .env.prod introuvable. Copier .env.prod.example et remplir."
[ -n "${DOMAIN:-}" ] || err "DOMAIN non défini dans .env.prod"
command -v docker >/dev/null || err "Docker non installé"

# ── Certifier le domaine (première fois) ─────────────────────
cmd_ssl() {
  info "Obtention du certificat SSL pour $DOMAIN…"

  # Démarrer nginx en HTTP seulement pour le challenge
  $COMPOSE up -d nginx certbot
  sleep 3

  docker compose -f docker-compose.prod.yml exec certbot \
    certbot certonly --webroot \
      --webroot-path /var/www/certbot \
      --email contact@sokora.ci \
      --agree-tos --no-eff-email \
      -d "${DOMAIN}" \
      -d "www.${DOMAIN}" \
      --non-interactive

  ok "Certificat obtenu pour ${DOMAIN}"
  $COMPOSE restart nginx
  ok "Nginx rechargé avec SSL"
}

# ── Premier déploiement ──────────────────────────────────────
cmd_init() {
  info "Initialisation du déploiement SOKORA…"

  # Pull images de base
  docker pull postgres:15-alpine
  docker pull nginx:1.25-alpine

  # Build et démarrage
  $COMPOSE build --no-cache
  $COMPOSE up -d db
  sleep 5

  info "Application des migrations SQL…"
  for sql in backend/migrations/*.sql; do
    [ -f "$sql" ] || continue
    info "  → $(basename $sql)"
    cat "$sql" | $COMPOSE exec -T db \
      psql -U "$(grep POSTGRES_USER .env.prod | cut -d= -f2)" \
           -d "$(grep POSTGRES_DB   .env.prod | cut -d= -f2)"
  done

  $COMPOSE up -d

  ok "SOKORA déployé sur http://${DOMAIN}"
  info "Lancer 'bash deploy.sh --ssl' pour activer HTTPS"
}

# ── Mise à jour ───────────────────────────────────────────────
cmd_update() {
  info "Mise à jour SOKORA…"
  git pull origin main
  $COMPOSE build backend frontend
  $COMPOSE up -d --no-deps backend frontend nginx
  ok "Mise à jour terminée"

  # Copier les fichiers statiques du frontend dans le volume nginx
  $COMPOSE run --rm --entrypoint "" frontend \
    sh -c "cp -r /dist/* /usr/share/nginx/html/" 2>/dev/null || true

  $COMPOSE exec nginx nginx -s reload
  ok "Nginx rechargé"
}

# ── Logs ──────────────────────────────────────────────────────
cmd_logs() {
  $COMPOSE logs -f --tail=100 backend
}

# ── Status ────────────────────────────────────────────────────
cmd_status() {
  $COMPOSE ps
}

# ── Backup DB ─────────────────────────────────────────────────
cmd_backup() {
  BACKUP_FILE="backup_sokora_$(date +%Y%m%d_%H%M%S).sql.gz"
  info "Backup → $BACKUP_FILE"
  $COMPOSE exec -T db pg_dump \
    -U "$(grep POSTGRES_USER .env.prod | cut -d= -f2)" \
    "$(grep POSTGRES_DB .env.prod | cut -d= -f2)" \
    | gzip > "$BACKUP_FILE"
  ok "Backup enregistré : $BACKUP_FILE"
}

# ── Dispatch ─────────────────────────────────────────────────
case "${1:-}" in
  --init)   cmd_init ;;
  --update) cmd_update ;;
  --ssl)    cmd_ssl ;;
  --logs)   cmd_logs ;;
  --status) cmd_status ;;
  --backup) cmd_backup ;;
  *)
    echo "SOKORA Deploy Script"
    echo ""
    echo "Usage: bash deploy.sh [commande]"
    echo ""
    echo "  --init    Premier déploiement complet"
    echo "  --update  Mise à jour (git pull + rebuild + reload)"
    echo "  --ssl     Obtenir/renouveler le certificat SSL"
    echo "  --logs    Afficher les logs backend en temps réel"
    echo "  --status  Status des conteneurs"
    echo "  --backup  Sauvegarde PostgreSQL"
    ;;
esac
