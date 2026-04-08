# ============================================================
# SOKORA — Démarrage de tous les services locaux
# Double-clic pour lancer, ou : .\start-sokora.ps1
# ============================================================

$UVICORN = "C:\Users\blais\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts\uvicorn.exe"
$ROOT    = "C:\Users\blais\SOKORA"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "   SOKORA — Démarrage des services    " -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# 1. Backend FastAPI
Write-Host "▶ Backend API (port 8001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\backend'; & '$UVICORN' app.main:app --host 0.0.0.0 --port 8001 --reload"

Start-Sleep -Seconds 2

# 2. Frontend Dashboard (port 3000)
Write-Host "▶ Dashboard principal (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\frontend'; npm run dev"

# 3. Hotel Dashboard (port 5173)
Write-Host "▶ Hotel Dashboard (port 5173)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\hotel-dashboard'; npm run dev"

# 4. Voyage Dashboard (port 5175)
Write-Host "▶ Voyage Dashboard (port 5175)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\voyage-dashboard'; npm run dev"

# 5. Service Dashboard (port 5176)
Write-Host "▶ Service Dashboard (port 5176)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\service-dashboard'; npm run dev"

# 6. App Mobile Expo
Write-Host "▶ App Mobile Expo (port 8081)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ROOT\sokora-mobile\sokora-mobile-v2\sokora-mobile-v3'; npx expo start"

Start-Sleep -Seconds 3

Write-Host ""
Write-Host "======================================" -ForegroundColor Green
Write-Host " Tous les services sont lancés !      " -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host " Backend:          http://localhost:8001"     -ForegroundColor White
Write-Host " Dashboard:        http://localhost:3000"     -ForegroundColor White
Write-Host " Hotel:            http://localhost:5173"     -ForegroundColor White
Write-Host " Voyage:           http://localhost:5175"     -ForegroundColor White
Write-Host " Service:          http://localhost:5176"     -ForegroundColor White
Write-Host " App Mobile Web:   http://localhost:8081"     -ForegroundColor White
Write-Host " IP réseau local:  http://192.168.1.2:8001"   -ForegroundColor White
Write-Host ""
Write-Host "📱 Pour le téléphone : scanne le QR dans la fenêtre Expo" -ForegroundColor Cyan
Write-Host ""
pause
