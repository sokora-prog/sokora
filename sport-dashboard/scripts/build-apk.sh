#!/usr/bin/env bash
# SOKORA Sport — construction de l'APK Android (Linux / macOS).
#
#   ./scripts/build-apk.sh             APK de débogage, installable
#   ./scripts/build-apk.sh --release   APK de release (non signé)
#
# Prérequis : JDK 17+, et le SDK Android désigné par ANDROID_HOME.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -z "${ANDROID_HOME:-}${ANDROID_SDK_ROOT:-}" ]]; then
  echo "SDK Android introuvable : définir ANDROID_HOME." >&2
  exit 1
fi

task=assembleDebug
flavour=debug
if [[ "${1:-}" == "--release" ]]; then
  task=assembleRelease
  flavour=release
fi

# Un seul build sert au web et à l'APK : l'adresse de l'API n'est pas figée
# ici, elle est saisie dans l'application (onglet « Connexion »).
echo "▶ Build du tableau de bord…"
npm run build

echo "▶ Synchronisation Capacitor…"
npx cap sync android

echo "▶ Compilation Android ($task)…"
(cd android && ./gradlew "$task")

echo
echo "APK produit :"
find "android/app/build/outputs/apk/$flavour" -name '*.apk' -exec ls -lh {} \;
