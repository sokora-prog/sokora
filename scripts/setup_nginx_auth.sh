#!/bin/bash
# =============================================================================
# SOKORA — Protection HTTP basic auth pour les sites en pré-lancement
# À exécuter sur VPS (ssh root@91.98.225.226)
# Usage: bash setup_nginx_auth.sh [PASSWORD]
# =============================================================================

set -e

PASSWORD="${1:-Sokora2025!}"
HTPASSWD_FILE="/etc/nginx/.htpasswd_sokora"

echo "=== SOKORA — Configuration basic auth nginx ==="

# 1. Créer le fichier htpasswd
if ! command -v htpasswd &>/dev/null; then
  apt-get install -y apache2-utils -q
fi

htpasswd -cb "$HTPASSWD_FILE" sokora "$PASSWORD"
chmod 644 "$HTPASSWD_FILE"
echo "✅ .htpasswd créé : sokora / $PASSWORD"

# 2. Patcher les configs nginx pour ajouter l'auth sur les sites frontend
for SITE in voyage horeca sokora-client; do
  CONF="/etc/nginx/sites-enabled/${SITE}.conf"
  # Chercher aussi dans sites-available
  [ -f "$CONF" ] || CONF="/etc/nginx/sites-available/${SITE}.conf"
  [ -f "$CONF" ] || CONF="/etc/nginx/sites-enabled/${SITE}"
  [ -f "$CONF" ] || CONF="/etc/nginx/sites-available/${SITE}"
  [ -f "$CONF" ] || { echo "⚠ Config non trouvée pour ${SITE}, ignoré"; continue; }

  # Vérifier si auth déjà en place
  if grep -q "auth_basic" "$CONF"; then
    echo "ℹ Auth déjà configurée dans $CONF"
    continue
  fi

  # Injecter auth_basic dans le premier bloc location /
  sed -i '/location \/ {/a\\t\tauth_basic "SOKORA — Accès restreint";\n\t\tauth_basic_user_file '"$HTPASSWD_FILE"';' "$CONF"
  echo "✅ Auth ajoutée dans $CONF"
done

# 3. Tester + recharger nginx
nginx -t && systemctl reload nginx
echo "✅ Nginx rechargé"

# 4. Ajouter exclusion auth pour l'API (pas de basic auth sur /api)
cat <<'NOTE'

IMPORTANT : L'API (api.sokora.fun) n'a PAS de basic auth — uniquement les frontends.
Sites protégés :
  - voyage.sokora.fun     → sokora / [PASSWORD]
  - horeca.sokora.fun     → sokora / [PASSWORD]
  - app.sokora.fun        → sokora / [PASSWORD]

Pour supprimer la protection plus tard :
  sed -i '/auth_basic/d' /etc/nginx/sites-enabled/*.conf
  systemctl reload nginx
NOTE
