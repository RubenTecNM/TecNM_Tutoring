@echo off
chcp 65001 >nul
setlocal

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║      TecNM Campus Monclova — Sistema de Tutorías     ║
echo  ║               Panel de Control Docker                ║
echo  ╠══════════════════════════════════════════════════════╣
echo  ║                                                      ║
echo  ║   1 ^| Encender servicios                            ║
echo  ║   2 ^| Reiniciar servicios                           ║
echo  ║   3 ^| Ver estatus                                   ║
echo  ║   4 ^| Apagar servicios                              ║
echo  ║   5 ^| Salir                                         ║
echo  ║                                                      ║
echo  ╚══════════════════════════════════════════════════════╝
echo.
set /p OPT="  Selecciona una opcion [1-5]: "

if "%OPT%"=="1" goto ENCENDER
if "%OPT%"=="2" goto REINICIAR
if "%OPT%"=="3" goto ESTATUS
if "%OPT%"=="4" goto APAGAR
if "%OPT%"=="5" goto SALIR

echo.
echo  [!] Opcion invalida. Intenta de nuevo.
timeout /t 2 >nul
goto MENU

:: ─────────────────────────────────────────────────────────
:ENCENDER
cls
echo.
echo  [*] Verificando archivo .env...
if not exist ".env" (
    echo.
    echo  [!] Archivo .env no encontrado.
    echo      Copia .env.example a .env y configura las variables.
    echo.
    pause
    goto MENU
)
echo  [*] Levantando servicios...
echo.
docker compose up -d
echo.
echo  [*] Estatus actual:
echo.
docker compose ps
echo.
pause
goto MENU

:: ─────────────────────────────────────────────────────────
:REINICIAR
cls
echo.
echo  [*] Reiniciando servicios...
echo.
docker compose restart
echo.
echo  [*] Estatus actual:
echo.
docker compose ps
echo.
pause
goto MENU

:: ─────────────────────────────────────────────────────────
:ESTATUS
cls
echo.
echo  [*] Contenedores activos:
echo.
docker compose ps
echo.
echo  ─────────────────────────────────────────────────────
echo  [*] Healthcheck de la base de datos:
echo.
docker inspect tecnm-db --format "  DB status: {{.State.Health.Status}}" 2>nul || echo   [!] Contenedor tecnm-db no encontrado.
echo.
echo  ─────────────────────────────────────────────────────
echo  [*] Ultimas lineas de log del backend:
echo.
docker compose logs backend --tail 10 2>nul
echo.
pause
goto MENU

:: ─────────────────────────────────────────────────────────
:APAGAR
cls
echo.
echo  [*] Apagando servicios...
echo.
docker compose down
echo.
echo  [*] Servicios detenidos.
echo.
pause
goto MENU

:: ─────────────────────────────────────────────────────────
:SALIR
cls
echo.
echo  Hasta luego.
echo.
timeout /t 1 >nul
exit
