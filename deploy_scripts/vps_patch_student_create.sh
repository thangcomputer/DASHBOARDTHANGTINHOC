#!/bin/bash
# Paste toàn bộ vào SSH VPS (đang ở bất kỳ đâu). Sửa thêm HV: tắt CQRS + kéo nhánh fix + build + pm2.
set -euo pipefail
RAW=https://raw.githubusercontent.com/thangcomputer/DASHBOARDTHANGTINHOC/deploy/messaging-phase-824
APP=""
for d in /www/wwwroot/dashboard-thangtinhoc-edu-vn /www/wwwroot/dashboardthangtinhoc /www/wwwroot/dashboard.thangtinhoc.edu.vn; do
  [ -f "$d/server.js" ] && APP=$d && break
done
[ -n "$APP" ] || { echo "FAIL: no app dir"; ls /www/wwwroot; exit 1; }
cd "$APP"
echo "APP=$APP"
cp -a .env ".env.bak.$(date +%Y%m%d%H%M%S)" 2>/dev/null || true
for key in ENABLE_CQRS ENABLE_CQRS_STUDENT_CREATE ENABLE_CQRS_INVOICE ENABLE_CQRS_TEACHER ENABLE_CQRS_FINANCE; do
  grep -qE "^${key}=" .env 2>/dev/null && sed -i "s/^${key}=.*/${key}=false/" .env || echo "${key}=false" >> .env
done
mkdir -p config shared/cqrs routes
curl -fsSL "$RAW/config/validateEnv.js" -o config/validateEnv.js
curl -fsSL "$RAW/shared/cqrs/flags.js" -o shared/cqrs/flags.js
curl -fsSL "$RAW/shared/cqrs/middleware.js" -o shared/cqrs/middleware.js
curl -fsSL "$RAW/shared/cqrs/withTransaction.js" -o shared/cqrs/withTransaction.js
# studentRoutes từ nhánh fix (legacy strangler) — file lớn
curl -fsSL "$RAW/routes/studentRoutes.js" -o routes/studentRoutes.js
# FE critical
mkdir -p client/src/components/admin/shared client/src/components/admin/hooks client/src/context
curl -fsSL "$RAW/client/src/components/admin/shared/AddStudentModal.jsx" -o client/src/components/admin/shared/AddStudentModal.jsx
curl -fsSL "$RAW/client/src/components/admin/hooks/useAdminStudents.jsx" -o client/src/components/admin/hooks/useAdminStudents.jsx
curl -fsSL "$RAW/client/src/context/useDataAdminCrud.js" -o client/src/context/useDataAdminCrud.js
curl -fsSL "$RAW/client/vite.config.js" -o client/vite.config.js
(cd client && npm install && npm run build)
pm2 delete dashboardthangtinhoc 2>/dev/null || true
pm2 start server.js --name dashboardthangtinhoc --update-env
pm2 save
sleep 2
curl -sS -m 8 -w "\nHTTP %{http_code}\n" http://127.0.0.1:5000/healthz
grep -n "isStudentCreateCqrs\|requireStudentCreateCqrs\|router.post('/'" routes/studentRoutes.js | head -12
pm2 logs dashboardthangtinhoc --lines 15 --nostream || true
echo "OK — F5 dashboard và thử Thêm học viên / Lưu chưa thanh toán"
