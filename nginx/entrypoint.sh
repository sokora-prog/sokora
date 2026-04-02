#!/bin/sh
# Substitue le placeholder SOKORA_DOMAIN par la variable d'environnement $DOMAIN
set -e

DOMAIN=${DOMAIN:-localhost}

sed -i "s/SOKORA_DOMAIN/${DOMAIN}/g" /etc/nginx/conf.d/sokora.conf

exec "$@"
