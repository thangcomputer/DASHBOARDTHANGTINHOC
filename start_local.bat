@echo off
setlocal
cd /d "%~dp0"

echo [1/3] MongoDB 27018 (rs0)...
netstat -ano | findstr ":27018" | findstr "LISTENING" >nul
if errorlevel 1 (
  if not exist "C:\data\mongo27018" mkdir "C:\data\mongo27018"
  if not exist "C:\data\mongo27018-log" mkdir "C:\data\mongo27018-log"
  if not exist "C:\data\mongo27018\mongod.cfg" (
    (
      echo storage:
      echo   dbPath: C:\data\mongo27018
      echo systemLog:
      echo   destination: file
      echo   logAppend: true
      echo   path: C:\data\mongo27018-log\mongod.log
      echo net:
      echo   port: 27018
      echo   bindIp: 127.0.0.1
      echo replication:
      echo   replSetName: rs0
    ) > "C:\data\mongo27018\mongod.cfg"
  )
  start "MongoDB 27018" /MIN "C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe" --config "C:\data\mongo27018\mongod.cfg"
  timeout /t 3 /nobreak >nul
) else (
  echo MongoDB 27018 already listening.
)

echo [2/3] Backend Server...
start "Backend Server" cmd /k "npm.cmd run dev"

echo [3/3] Frontend Client...
cd client
start "Frontend Client" cmd /k "npm.cmd run dev"
echo Done. Open http://localhost:5173
endlocal
