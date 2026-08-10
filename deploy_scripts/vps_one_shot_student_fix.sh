#!/bin/bash
# ONE-SHOT on VPS (run from anywhere as root):
#   curl -fsSL https://raw.githubusercontent.com/thangcomputer/DASHBOARDTHANGTINHOC/deploy/messaging-phase-824/deploy_scripts/fix_pm2_boot.sh | bash
# Or paste this whole file.
set -euo pipefail

APP=""
for d in \
  /www/wwwroot/dashboard-thangtinhoc-edu-vn \
  /www/wwwroot/dashboardthangtinhoc \
  /www/wwwroot/dashboard.thangtinhoc.edu.vn
do
  [ -f "$d/server.js" ] && APP="$d" && break
done
[ -n "$APP" ] || { echo "ERROR: no server.js"; ls /www/wwwroot/; exit 1; }
cd "$APP"
echo "APP=$APP"

cp -a .env ".env.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
for key in ENABLE_CQRS ENABLE_CQRS_STUDENT_CREATE ENABLE_CQRS_INVOICE ENABLE_CQRS_TEACHER ENABLE_CQRS_FINANCE; do
  if grep -qE "^${key}=" .env 2>/dev/null; then sed -i "s/^${key}=.*/${key}=false/" .env
  else echo "${key}=false" >> .env; fi
done
echo "CQRS flags:"; grep -E '^ENABLE_CQRS' .env || true

BRANCH=deploy/messaging-phase-824
if [ -d .git ]; then
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null || git checkout -B "$BRANCH" "origin/$BRANCH"
  git pull origin "$BRANCH" || true
  git rev-parse --short HEAD
else
  echo "WARN: no .git — pulling tarball of branch"
  TMP=$(mktemp -d)
  curl -fsSL "https://codeload.github.com/thangcomputer/DASHBOARDTHANGTINHOC/tar.gz/refs/heads/${BRANCH}" | tar -xz -C "$TMP"
  SRC=$(echo "$TMP"/DASHBOARDTHANGTINHOC-*)
  rsync -a --exclude node_modules --exclude client/node_modules --exclude client/dist --exclude .env "$SRC"/ "$APP"/
  rm -rf "$TMP"
fi

npm install --omit=dev
(cd client && npm install && npm run build)

pm2 delete dashboardthangtinhoc 2>/dev/null || true
pm2 start server.js --name dashboardthangtinhoc --update-env
pm2 save
sleep 2
pm2 list
echo "--- healthz ---"
curl -sS -m 8 -w "\nHTTP %{http_code}\n" http://127.0.0.1:5000/healthz
echo "--- route check ---"
grep -n "requireStudentCreateCqrs\|isStudentCreateCqrs\|router.post('/'" routes/studentRoutes.js | head -15
pm2 logs dashboardthangtinhoc --lines 20 --nostream || true
echo "DONE"
