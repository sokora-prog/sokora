# ============================================================
# SOKORA Sport — Construction de l'APK Android
#   .\scripts\build-apk.ps1            → APK de débogage, installable
#   .\scripts\build-apk.ps1 -Release   → APK de release (non signé)
#
# Prérequis, une seule fois :
#   • Android Studio installé, et lancé au moins une fois pour qu'il télécharge
#     le SDK (l'installeur seul ne le fournit pas)
#   • la plateforme Android 34, celle que vise le projet : SDK Manager →
#     onglet « SDK Platforms » → cocher « Android 14 (API 34) »
#   • un JDK 17 : winget install --id Microsoft.OpenJDK.17 -e
#     Le JDK fourni par Android Studio est trop récent pour le Gradle du projet.
#
# ANDROID_HOME n'a pas à être défini : le script le déduit de l'emplacement
# habituel du SDK.
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

# Gradle 8.2.1, la version livrée avec le projet Capacitor, ne sait pas
# s'exécuter au-delà de Java 20. Or Android Studio embarque désormais un JDK 25 :
# le prendre parce qu'il est « 17 ou plus » fait échouer le build sur un message
# de version de classe qui ne dit pas quoi faire. On cherche donc un JDK dans la
# fenêtre réellement supportée, et on le dit clairement s'il manque.
$JDK_MIN, $JDK_MAX = 17, 20

function Get-JavaMajor([string]$racine) {
    $exe = Join-Path $racine 'bin\java.exe'
    if (-not (Test-Path $exe)) { return 0 }
    $sortie = & $exe -version 2>&1 | Out-String
    if ($sortie -match 'version "(\d+)') { return [int]$Matches[1] }
    return 0
}

$candidats = @()
if ($env:JAVA_HOME) { $candidats += $env:JAVA_HOME }
$candidats += Get-ChildItem -Directory -ErrorAction SilentlyContinue -Path @(
    "$env:ProgramFiles\Microsoft",
    "$env:ProgramFiles\Eclipse Adoptium",
    "$env:ProgramFiles\Java",
    "$env:ProgramFiles\Amazon Corretto"
) | Where-Object { $_.Name -match 'jdk-?(1[789]|20)\b' } | ForEach-Object { $_.FullName }
# En dernier recours seulement : le JDK d'Android Studio convient tant qu'il
# reste dans la fenêtre, ce qui n'est plus le cas des versions récentes.
$candidats += "$env:ProgramFiles\Android\Android Studio\jbr"
$candidats += "$env:LOCALAPPDATA\Programs\Android Studio\jbr"

$jdk = $null
foreach ($c in ($candidats | Where-Object { $_ } | Select-Object -Unique)) {
    $major = Get-JavaMajor $c
    if ($major -ge $JDK_MIN -and $major -le $JDK_MAX) { $jdk = $c; $jdkMajor = $major; break }
}

if (-not $jdk) {
    $vus = foreach ($c in ($candidats | Where-Object { $_ } | Select-Object -Unique)) {
        $m = Get-JavaMajor $c
        if ($m -gt 0) { "   Java $m : $c" }
    }
    Write-Host "Aucun JDK utilisable (il faut Java $JDK_MIN a $JDK_MAX)." -ForegroundColor Red
    if ($vus) { Write-Host "JDK trouves mais hors fenetre :" -ForegroundColor DarkYellow; $vus | ForEach-Object { Write-Host $_ } }
    Write-Host ""
    Write-Host "Installer un JDK 17 :" -ForegroundColor Cyan
    Write-Host "   winget install --id Microsoft.OpenJDK.17 -e" -ForegroundColor Cyan
    Write-Error "JDK 17 requis."
}

$env:JAVA_HOME = $jdk
$env:PATH = "$jdk\bin;$env:PATH"
Write-Host "JDK utilise : $jdk (Java $jdkMajor)" -ForegroundColor DarkGray

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
