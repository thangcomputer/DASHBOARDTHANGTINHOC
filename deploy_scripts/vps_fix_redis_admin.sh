#!/usr/bin/env bash
# One-shot VPS: gắn REDIS_URL đúng password + reset mật khẩu admin.
# Chạy trên VPS (root):
#   bash deploy_scripts/vps_fix_redis_admin.sh 'MatKhauAdminMoi'
# Optional:
#   APP_DIR=/www/wwwroot/dashboard-thangtinhoc-edu-vn bash ... 'MatKhauAdminMoi'
set -euo pipefail

NEW_ADMIN_PASS="${1:-}"
if [[ -z "$NEW_ADMIN_PASS" ]]; then
  echo "Usage: $0 '<new-admin-password>'"
  exit 1
fi
export NEW_ADMIN_PASS

APP_DIR="${APP_DIR:-/www/wwwroot/dashboard-thangtinhoc-edu-vn}"
if [[ ! -f "$APP_DIR/.env" ]]; then
  if [[ -f /www/wwwroot/dashboardthangtinhoc/.env ]]; then
    APP_DIR=/www/wwwroot/dashboardthangtinhoc
  else
    echo "ERROR: .env not found under $APP_DIR"
    exit 1
  fi
fi

echo "== APP_DIR=$APP_DIR =="

REDIS_CONF="${REDIS_CONF:-/etc/redis/redis.conf}"
PASS="$(grep -E '^requirepass[[:space:]]+' "$REDIS_CONF" 2>/dev/null | awk '{print $2}' | tr -d '"' || true)"
if [[ -z "$PASS" ]]; then
  echo "ERROR: requirepass not found in $REDIS_CONF"
  exit 1
fi

echo "== Redis ping =="
if ! redis-cli -a "$PASS" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
  echo "ERROR: redis-cli AUTH failed with requirepass from conf"
  exit 1
fi
echo "PONG ok"

ENV_FILE="$APP_DIR/.env"
cp -a "$ENV_FILE" "$ENV_FILE.bak.$(date +%F-%H%M%S)"

python3 - "$ENV_FILE" "$PASS" <<'PY'
import sys, re, urllib.parse
env_path, password = sys.argv[1], sys.argv[2]
enc = urllib.parse.quote(password, safe="")
new_url = f"redis://:{enc}@127.0.0.1:6379"
with open(env_path, "r", encoding="utf-8", errors="ignore") as f:
    text = f.read()
if re.search(r"^REDIS_URL=", text, flags=re.M):
    text = re.sub(r"^REDIS_URL=.*$", f"REDIS_URL={new_url}", text, count=1, flags=re.M)
else:
    if text and not text.endswith("\n"):
        text += "\n"
    text += f"REDIS_URL={new_url}\n"
with open(env_path, "w", encoding="utf-8") as f:
    f.write(text)
print("REDIS_URL updated")
PY

echo "== REDIS_URL (masked) =="
grep '^REDIS_URL=' "$ENV_FILE" | sed -E 's#(redis://:)[^@]+@#\1***@#'

echo "== Reset adminPasswordHash =="
cd "$APP_DIR"
node <<'NODE'
require('dotenv').config({ path: '.env' });
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGODB_URI;
  const pass = process.env.NEW_ADMIN_PASS;
  if (!uri) throw new Error('MONGODB_URI missing');
  if (!pass) throw new Error('NEW_ADMIN_PASS missing');
  await mongoose.connect(uri);
  const hash = await bcrypt.hash(pass, 10);
  const col = mongoose.connection.db.collection('systemsettings');
  const r = await col.updateOne(
    { _key: 'main' },
    { $set: { adminPasswordHash: hash } },
    { upsert: true }
  );
  console.log('systemsettings update:', JSON.stringify({
    matched: r.matchedCount,
    modified: r.modifiedCount,
    upserted: r.upsertedCount || 0,
  }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE

echo "== Restart PM2 =="
if pm2 describe dashboardthangtinhoc >/dev/null 2>&1; then
  pm2 restart dashboardthangtinhoc --update-env
else
  pm2 restart 36 --update-env 2>/dev/null || pm2 restart all --update-env
fi

sleep 3
echo "== healthz =="
curl -sS -m 8 http://127.0.0.1:5000/healthz || true
echo
echo "Done. Login admin + mat khau vua dat + captcha. Expect redis:up"
