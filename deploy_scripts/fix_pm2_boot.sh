#!/bin/bash
# Chạy trên VPS (SSH root):  bash /tmp/fix_pm2_boot.sh
# Hoặc copy-paste từng khối vào terminal.
set -euo pipefail

APP=""
for d in \
  /www/wwwroot/dashboard-thangtinhoc-edu-vn \
  /www/wwwroot/dashboardthangtinhoc \
  /www/wwwroot/dashboard.thangtinhoc.edu.vn
do
  if [ -f "$d/server.js" ]; then APP="$d"; break; fi
done

if [ -z "$APP" ]; then
  echo "ERROR: khong tim thay server.js trong /www/wwwroot/*"
  ls -la /www/wwwroot/ || true
  exit 1
fi

echo "=== APP=$APP ==="
cd "$APP"

echo "=== .env CQRS (truoc) ==="
grep -E '^(ENABLE_CQRS|MONGODB_URI|NODE_ENV)=' .env 2>/dev/null || echo "(khong doc duoc .env)"

# Ep tat CQRS de validateEnv / cutover khong crash boot khi Mongo khong co replica set
if [ -f .env ]; then
  cp -a .env ".env.bak.$(date +%Y%m%d%H%M%S)"
  for key in ENABLE_CQRS ENABLE_CQRS_STUDENT_CREATE ENABLE_CQRS_INVOICE ENABLE_CQRS_TEACHER ENABLE_CQRS_FINANCE; do
    if grep -qE "^${key}=" .env; then
      sed -i "s/^${key}=.*/${key}=false/" .env
    else
      echo "${key}=false" >> .env
    fi
  done
fi

echo "=== .env CQRS (sau) ==="
grep -E '^(ENABLE_CQRS|MONGODB_URI)=' .env || true

# Patch validateEnv tren VPS neu van throw (ban main cu)
if [ -f config/validateEnv.js ] && grep -q "CQRS flags require MongoDB replica set" config/validateEnv.js; then
  if grep -q "if (isProd) throw new Error(msg)" config/validateEnv.js; then
    echo "=== Patch validateEnv: throw -> force disable CQRS ==="
    python3 - <<'PY'
from pathlib import Path
p = Path("config/validateEnv.js")
s = p.read_text(encoding="utf-8")
old = """      if (isProd) throw new Error(msg);
      // eslint-disable-next-line no-console
      console.warn(`[validateEnv] WARNING: ${msg}`);"""
new = """      // Do not brick boot — force legacy for this process
      console.error(`[validateEnv] ${msg} — forcing ENABLE_CQRS_*=false`);
      process.env.ENABLE_CQRS = 'false';
      for (const k of ['ENABLE_CQRS_STUDENT_CREATE','ENABLE_CQRS_INVOICE','ENABLE_CQRS_TEACHER','ENABLE_CQRS_FINANCE']) {
        process.env[k] = 'false';
      }"""
if old in s:
    p.write_text(s.replace(old, new), encoding="utf-8")
    print("patched OK")
else:
    print("pattern not found — skip (maybe already patched)")
PY
  fi
fi

echo "=== PM2: delete stale + start fresh ==="
pm2 delete dashboardthangtinhoc 2>/dev/null || true
pm2 delete dashboardthangtinhoc1 2>/dev/null || true
pm2 start server.js --name dashboardthangtinhoc --update-env
pm2 save

sleep 2
echo "=== PM2 LIST ==="
pm2 list

echo "=== LOCAL healthz ==="
curl -sS -m 8 -w "\nHTTP %{http_code}\n" http://127.0.0.1:5000/healthz || true

echo "=== LOGS (40 dong) ==="
pm2 logs dashboardthangtinhoc --lines 40 --nostream || true

echo "DONE. Neu HTTP 200 o healthz thi F5 https://dashboard.thangtinhoc.edu.vn"
