# ============================================================
# SOKORA Sport — Démarrage local, sans VPS ni PostgreSQL
# Double-clic pour lancer, ou : .\start-sport-local.ps1
#
# Lance le backend sur SQLite (aucune base à installer) et le tableau de bord,
# tous deux à l'écoute du réseau local pour qu'un téléphone puisse les joindre.
#
# EXIGE Python 3.11+ et Node.js 20+ installés sur le poste.
# Si ce n'est pas le cas, utiliser plutôt `start-sport-docker.ps1`, qui ne
# demande que Docker Desktop et fournit les deux dans des conteneurs.
# ============================================================

$ROOT = $PSScriptRoot
$PORT_API  = 8001    # déjà ouvert par open-firewall.ps1
$PORT_WEB  = 5177    # idem

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   SOKORA Sport — environnement local     " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# --- Adresse de la machine sur le réseau local -------------------------------
# C'est elle qu'il faudra saisir dans l'application du téléphone : le téléphone
# ne sait pas ce que « localhost » désigne sur cet ordinateur.
# Celle de la carte qui porte la passerelle par défaut : les adaptateurs
# virtuels de Docker et WSL (vEthernet, 172.x) n'en ont pas, et les retenir
# enverrait le téléphone vers une adresse injoignable.
$cfg = Get-NetIPConfiguration |
       Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } |
       Select-Object -First 1
$ip = if ($cfg) { ($cfg.IPv4Address | Select-Object -First 1).IPAddress } else { $null }

# --- Backend -----------------------------------------------------------------
# DATABASE_URL en SQLite : un simple fichier sokora_sport.db dans backend/.
# Pour repasser sur PostgreSQL, supprimer cette ligne.
Write-Host "▶ Backend API (port $PORT_API, base SQLite)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$ROOT\backend'
`$env:DATABASE_URL = 'sqlite:///./sokora_sport.db'
python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT_API --reload
"@

Start-Sleep -Seconds 3

# --- Tableau de bord ---------------------------------------------------------
Write-Host "▶ Tableau de bord Sport (port $PORT_WEB)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", @"
cd '$ROOT\sport-dashboard'
`$env:VITE_API_URL = 'http://localhost:$PORT_API'
npm run dev -- --host
"@

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "Prêt." -ForegroundColor Green
Write-Host "  Sur cet ordinateur : http://localhost:$PORT_WEB"
if ($ip) {
    Write-Host "  Depuis le téléphone : http://${ip}:$PORT_WEB"
    Write-Host ""
    Write-Host "  Adresse à saisir dans l'onglet « Connexion » de l'APK :" -ForegroundColor Cyan
    Write-Host "     http://${ip}:$PORT_API" -ForegroundColor Cyan
} else {
    Write-Host "  (adresse réseau non détectée — relever « Adresse IPv4 » via ipconfig)"
}
Write-Host ""
Write-Host "Rappel : le module n'a pas de mot de passe. Tant qu'il écoute sur le" -ForegroundColor DarkYellow
Write-Host "réseau, toute personne sur le même Wi-Fi y a accès. Sur un réseau" -ForegroundColor DarkYellow
Write-Host "partagé, définir SPORT_API_TOKEN avant de lancer le backend." -ForegroundColor DarkYellow
