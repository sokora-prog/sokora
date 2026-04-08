# ============================================================
# SOKORA — Ajouter Python au PATH (lancer UNE FOIS en admin)
# ============================================================

$pythonScripts = "C:\Users\blais\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts"

$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")

if ($currentPath -notlike "*$pythonScripts*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$pythonScripts", "User")
    Write-Host "✓ Python Scripts ajouté au PATH permanent" -ForegroundColor Green
    Write-Host "  Ferme et rouvre PowerShell pour appliquer." -ForegroundColor Yellow
} else {
    Write-Host "✓ Python Scripts déjà dans le PATH" -ForegroundColor Green
}

Write-Host ""
Write-Host "Après ça, tu pourras taper directement : uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload" -ForegroundColor Cyan
pause
