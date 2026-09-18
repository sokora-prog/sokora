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

param(
    [switch]$Release,
    # Construit le site dans un conteneur Node plutôt qu'avec le npm du poste.
    # Évite d'installer Node.js quand Docker est déjà là ; la compilation
    # Android, elle, reste locale (elle a besoin du SDK).
    [switch]$UseDocker
)

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

# Le plugin Android 8.2 exige Java 17 ou plus. Sans ce contrôle, Gradle échoue
# sur un message de compatibilité de classe peu parlant. Android Studio embarque
# le bon JDK : on s'en sert plutôt que d'en faire installer un second.
$needsJdk = $true
try {
    $v = (& java -version 2>&1 | Select-String -Pattern '"(\d+)' ).Matches[0].Groups[1].Value
    if ([int]$v -ge 17) { $needsJdk = $false }
    else { Write-Host "Java $v détecté — trop ancien pour Gradle 8.2." -ForegroundColor DarkYellow }
} catch {
    Write-Host "Java introuvable dans le PATH." -ForegroundColor DarkYellow
}

if ($needsJdk) {
    $jbr = @(
        "$env:ProgramFiles\Android\Android Studio\jbr",
        "$env:LOCALAPPDATA\Programs\Android Studio\jbr"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($jbr) {
        $env:JAVA_HOME = $jbr
        $env:PATH = "$jbr\bin;$env:PATH"
        Write-Host "JDK d'Android Studio utilisé : $jbr" -ForegroundColor DarkGray
    } else {
        Write-Error "Java 17+ requis. Installer Android Studio, ou définir JAVA_HOME sur un JDK 17+."
    }
}

# 1. Construire le site. Le même build sert au web et à l'APK : l'adresse de
#    l'API n'est pas figée ici, elle est saisie dans l'application (onglet
#    « Connexion »), car elle change avec le réseau.
if ($UseDocker) {
    Write-Host "▶ Build et synchronisation dans un conteneur Node..." -ForegroundColor Yellow
    # Le dossier du projet est monté dans le conteneur : dist/ et les fichiers
    # recopiés dans android/ apparaissent donc bien sur le poste.
    docker run --rm -v "${here}:/app" -w /app node:20-alpine `
        sh -c "npm ci && npm run build && npx cap sync android"
    if ($LASTEXITCODE -ne 0) { Write-Error "Le build en conteneur a échoué." }
} else {
    Write-Host "▶ Build du tableau de bord..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Error "Le build a échoué. Node.js est-il installé ? Sinon : -UseDocker" }

    # 2. Recopier ce build dans le projet Android.
    Write-Host "▶ Synchronisation Capacitor..." -ForegroundColor Yellow
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { Write-Error "La synchronisation a échoué." }
}

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
