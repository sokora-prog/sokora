# ============================================================
# SOKORA — Ouverture pare-feu (à lancer UNE FOIS en admin)
# Clic droit sur ce fichier → Exécuter avec PowerShell (admin)
# ============================================================

$ports = @(8001, 8081, 3000, 5173, 5174, 5175, 5176, 5177, 19006, 4000)
$rules = @{
    8001  = "SOKORA Backend API"
    8081  = "SOKORA Expo Metro"
    3000  = "SOKORA Frontend Dashboard"
    5173  = "SOKORA Hotel Dashboard"
    5174  = "SOKORA Dashboard 5174"
    5175  = "SOKORA Voyage Dashboard"
    5176  = "SOKORA Service Dashboard"
    5177  = "SOKORA Dashboard 5177"
    19006 = "SOKORA Expo Web"
    4000  = "SOKORA Website"
}

foreach ($port in $ports) {
    $name = $rules[$port]
    # Supprime l'ancienne règle si elle existe
    netsh advfirewall firewall delete rule name="$name" | Out-Null
    # Crée la nouvelle règle
    netsh advfirewall firewall add rule name="$name" dir=in action=allow protocol=TCP localport=$port
    Write-Host "✓ Port $port ouvert — $name" -ForegroundColor Green
}

Write-Host ""
Write-Host "Tous les ports SOKORA sont ouverts !" -ForegroundColor Cyan
Write-Host "Tu peux fermer cette fenêtre." -ForegroundColor Cyan
pause
