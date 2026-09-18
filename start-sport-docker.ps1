# ============================================================
# SOKORA Sport — démarrage local avec Docker
# Clic droit → « Exécuter avec PowerShell », ou : .\start-sport-docker.ps1
#
# Ne demande que Docker Desktop. Ni Python, ni Node.js, ni PostgreSQL : tout
# est construit et exécuté dans des conteneurs.
#
#   .\start-sport-docker.ps1              démarre (construit si nécessaire)
#   .\start-sport-docker.ps1 -Rebuild     reconstruit les images
#   .\start-sport-docker.ps1 -Stop        arrête tout
#   .\start-sport-docker.ps1 -Logs        affiche les journaux
# ============================================================

param(
    [switch]$Rebuild,
    [switch]$Stop,
    [switch]$Logs
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$COMPOSE = 'docker-compose.sport.yml'
$PORT_WEB = 5177
$PORT_API = 8001

# --- Docker est-il lancé ? ---------------------------------------------------
# `docker info` échoue tant que Docker Desktop n'a pas fini de démarrer ; le
# message brut n'est pas parlant, d'où ce contrôle explicite.
try {
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
} catch {
    Write-Host "Docker ne répond pas." -ForegroundColor Red
    Write-Host "Ouvrir Docker Desktop, attendre que la baleine cesse de s'animer, puis relancer."
    exit 1
}

if ($Stop) {
    docker compose -f $COMPOSE down
    Write-Host "Arrêté. Les données sont conservées dans le volume sport_data." -ForegroundColor Green
    exit 0
}

if ($Logs) {
    docker compose -f $COMPOSE logs -f
    exit 0
}

# --- Démarrage ---------------------------------------------------------------
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "   SOKORA Sport — démarrage (Docker)      " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "La première fois, la construction prend quelques minutes" -ForegroundColor DarkGray
Write-Host "(téléchargement de Python et Node). Ensuite, c'est immédiat." -ForegroundColor DarkGray
Write-Host ""

if ($Rebuild) {
    docker compose -f $COMPOSE up -d --build --force-recreate
} else {
    docker compose -f $COMPOSE up -d --build
}
if ($LASTEXITCODE -ne 0) {
    Write-Host "Le démarrage a échoué. Journaux : .\start-sport-docker.ps1 -Logs" -ForegroundColor Red
    exit 1
}

# --- Attendre que l'API réponde ---------------------------------------------
Write-Host ""
Write-Host "Attente de l'API..." -NoNewline
$ready = $false
foreach ($i in 1..40) {
    try {
        Invoke-WebRequest "http://localhost:$PORT_API/sport/competitions" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch {
        Start-Sleep -Seconds 2
        Write-Host "." -NoNewline
    }
}
Write-Host ""

if (-not $ready) {
    Write-Host "L'API n'a pas répondu. Journaux : .\start-sport-docker.ps1 -Logs" -ForegroundColor Red
    exit 1
}

# --- Première fois : proposer le jeu de démonstration ------------------------
$comps = (Invoke-WebRequest "http://localhost:$PORT_API/sport/competitions" -UseBasicParsing).Content
if ($comps -eq '[]') {
    Write-Host "Base vide. Création d'un championnat de démonstration..." -ForegroundColor Yellow
    Invoke-WebRequest -Method POST "http://localhost:$PORT_API/sport/seed-demo?matches_per_team=26" -UseBasicParsing | Out-Null
    Write-Host "Fait — 10 équipes, matchs joués et matchs à venir cotés." -ForegroundColor Green
}

$ip = (Get-NetIPAddress -AddressFamily IPv4 |
       Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
       Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Prêt." -ForegroundColor Green
Write-Host "  Sur cet ordinateur  : http://localhost:$PORT_WEB"
if ($ip) {
    Write-Host "  Depuis le téléphone : http://${ip}:$PORT_WEB"
    Write-Host "  Adresse pour l'APK  : http://${ip}:$PORT_API" -ForegroundColor Cyan
}
Write-Host ""
Write-Host "  Arrêter : .\start-sport-docker.ps1 -Stop"
Write-Host ""

Start-Process "http://localhost:$PORT_WEB"
