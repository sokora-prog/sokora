#!/bin/bash
# ══════════════════════════════════════════════════════════════════
#  SOKORA ECOSYSTEM — Script de déploiement VPS
#  VPS : Hetzner 91.98.225.226
#  Usage : ./deploy.sh [all|horeca|hotel|voyage|services|domo|kyrion]
# ══════════════════════════════════════════════════════════════════

set -e

VPS_IP="91.98.225.226"
VPS_USER="root"
WEB_ROOT="/var/www"

echo "🚀 SOKORA Deploy — $(date)"

build_and_push() {
  local name=$1
  local src_dir=$2
  local dest_dir=$3

  echo ""
  echo "━━━ Building $name ━━━"
  (cd "$src_dir" && npm ci && npm run build)
  echo "  ✓ Build OK"

  echo "  → Transfert vers VPS $VPS_IP:$dest_dir"
  rsync -az --delete "$src_dir/dist/" "$VPS_USER@$VPS_IP:$WEB_ROOT/$dest_dir/dist/"
  echo "  ✓ Déployé"
}

TARGET=${1:-all}

case $TARGET in
  horeca|all)
    build_and_push "SOKORA HoReCa" "C:/Users/blais/SOKORA/frontend" "sokora/horeca"
    ;;& # fallthrough only if 'all'
  hotel|all)
    build_and_push "SOKORA Hôtel" "C:/Users/blais/SOKORA/hotel-dashboard" "sokora/hotel"
    ;;&
  voyage|all)
    build_and_push "SOKORA Voyage" "C:/Users/blais/SOKORA/voyage-dashboard" "sokora/voyage"
    ;;&
  services|all)
    build_and_push "SOKORA Services" "C:/Users/blais/SOKORA/service-dashboard" "sokora/services"
    ;;&
  domo|all)
    build_and_push "DOMO" "C:/Users/blais/SOKORA_SYNDIC/frontend-admin" "domo"
    ;;&
  kyrion|all)
    build_and_push "KYRION" "C:/Users/blais/kyrion_pwa" "kyrion"
    ;;&
  backend|all)
    echo ""
    echo "━━━ Déploiement Backend API ━━━"
    rsync -az --exclude='__pycache__' --exclude='.env' \
      "C:/Users/blais/SOKORA/backend/" \
      "$VPS_USER@$VPS_IP:/opt/sokora/backend/"
    ssh "$VPS_USER@$VPS_IP" "cd /opt/sokora && docker-compose restart backend"
    echo "  ✓ Backend redémarré"
    ;;
esac

echo ""
echo "✅ Déploiement terminé — $(date)"
echo ""
echo "Vérifiez :"
echo "  https://app.sokora.ci     — HoReCa"
echo "  https://hotel.sokora.ci   — Hôtel"
echo "  https://voyage.sokora.ci  — Voyage"
echo "  https://services.sokora.ci — Services"
echo "  https://domo.sokora.ci    — DOMO Syndic"
echo "  https://app.kyrion.io     — KYRION Trading"
