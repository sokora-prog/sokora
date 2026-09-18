# ============================================================
# SOKORA Sport — Construction de l'APK Android
#   .\scripts\build-apk.ps1            → APK de débogage, installable
#   .\scripts\build-apk.ps1 -Release   → APK de release (non signé)
#
# Prérequis, une seule fois :
#   • Android Studio installé (il fournit le SDK et Java)
#   • Variable ANDROID_HOME pointant sur le SDK, typiquement
#     C:\Users\<vous>\AppData\Local\Android\Sdk
# ============================================================

param([switch]$Release)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $PSScriptRoot   # …\sport-dashboard
Set-Location $here

if (-not $env:ANDROID_HOME -and -not $env:ANDROID_SDK_ROOT) {
    $guess = "$env:LOCALAPPDATA\Android\Sdk"
    if (Test-Path $guess) {
        $env:ANDROID_HOME = $guess
        Write-Host "ANDROID_HOME déduit : $guess" -ForegroundColor DarkGray
    } else {
        Write-Error "SDK Android introuvable. Installer Android Studio, puis définir ANDROID_HOME."
    }
}

# 1. Construire le site. Le même build sert au web et à l'APK : l'adresse de
#    l'API n'est pas figée ici, elle est saisie dans l'application (onglet
#    « Connexion »), car elle change avec le réseau.
Write-Host "▶ Build du tableau de bord..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Error "Le build a échoué." }

# 2. Recopier ce build dans le projet Android.
Write-Host "▶ Synchronisation Capacitor..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) { Write-Error "La synchronisation a échoué." }

# 3. Compiler.
$task = if ($Release) { 'assembleRelease' } else { 'assembleDebug' }
Write-Host "▶ Compilation Android ($task)..." -ForegroundColor Yellow
Push-Location android
try {
    & .\gradlew.bat $task
    if ($LASTEXITCODE -ne 0) { Write-Error "La compilation Gradle a échoué." }
} finally {
    Pop-Location
}

$flavour = if ($Release) { 'release' } else { 'debug' }
$apk = Join-Path $here "android\app\build\outputs\apk\$flavour"
Write-Host ""
Write-Host "APK produit dans :" -ForegroundColor Green
Get-ChildItem -Path $apk -Filter *.apk | ForEach-Object {
    Write-Host "   $($_.FullName)  ($([math]::Round($_.Length / 1MB, 1)) Mo)" -ForegroundColor Green
}
Write-Host ""
Write-Host "Installation : copier le fichier sur le téléphone et l'ouvrir."
Write-Host "Android demandera d'autoriser l'installation depuis cette source."
if ($Release) {
    Write-Host ""
    Write-Host "Un APK de release n'est pas signé : il ne s'installera pas tel quel." -ForegroundColor DarkYellow
    Write-Host "Pour un usage personnel, l'APK de débogage suffit." -ForegroundColor DarkYellow
}
