/**
 * Enable Redis for dashboard app on staging (base64 remote script — no $ expansion).
 * Usage: node scripts/qa_fix_redis_url_staging.cjs
 */
require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

function mask(s) {
  return String(s || '')
    .replace(/redis:\/\/:[^@\s]+@/gi, 'redis://:***@')
    .replace(/requirepass\s+\S+/gi, 'requirepass ***')
    .replace(/(REDIS_URL=).*/gi, '$1***');
}

const remoteBash = `#!/bin/bash
set -euo pipefail
APP=${JSON.stringify(APP)}
ENV_FILE="$APP/.env"

echo "=== discover ==="
PID=$(pgrep -n redis-server || true)
echo "redis_pid=$PID"
CMDLINE=""
if [ -n "$PID" ]; then
  CMDLINE=$(tr '\\0' ' ' < /proc/$PID/cmdline || true)
  echo "cmdline=$CMDLINE"
fi

CONFS=""
if echo "$CMDLINE" | grep -qoE '/[^ ]+redis[^ ]*\\.conf'; then
  CONFS=$(echo "$CMDLINE" | grep -oE '/[^ ]+redis[^ ]*\\.conf' | head -n1)
fi
CONFS="$CONFS /www/server/redis/redis.conf /etc/redis/redis.conf"
echo "conf_candidates=$CONFS"

PASS=""
SRC=""
for f in $CONFS; do
  [ -f "$f" ] || continue
  echo "scan=$f"
  P=$(grep -E '^requirepass ' "$f" 2>/dev/null | awk '{print $2}' | tr -d '"' | head -n1 || true)
  if [ -n "$P" ]; then PASS="$P"; SRC="$f:requirepass"; break; fi
  P=$(grep -E '^user default ' "$f" 2>/dev/null | grep -oE '>[^ ]+' | head -n1 | sed 's/^>//' || true)
  if [ -n "$P" ]; then PASS="$P"; SRC="$f:acl"; break; fi
done
echo "pass_found=$([ -n "$PASS" ] && echo yes || echo no)"
echo "src=$SRC"

if [ -z "$PASS" ]; then
  for envf in /www/wwwroot/*/.env; do
    [ -f "$envf" ] || continue
    U=$(grep -E '^REDIS_URL=redis://' "$envf" 2>/dev/null | head -n1 | cut -d= -f2- || true)
    if echo "$U" | grep -q '@'; then
      PASS=$(printf '%s' "$U" | python3 -c 'import sys,re; u=sys.stdin.read().strip(); m=re.match(r"redis://(?:([^:/]*):)?([^@]+)@", u); print(m.group(2) if m else "")')
      if [ -n "$PASS" ]; then SRC="$envf:REDIS_URL"; break; fi
    fi
  done
fi
echo "pass_found_after_env=$([ -n "$PASS" ] && echo yes || echo no)"
echo "src=$SRC"

if [ -z "$PASS" ]; then
  if redis-cli ping 2>/dev/null | grep -q PONG; then
    echo "redis_noauth=1"
    URL="redis://127.0.0.1:6379"
  else
    echo "FAIL: Redis requires auth but password not found. Abort (no password rotation)."
    exit 4
  fi
else
  if ! redis-cli -a "$PASS" --no-auth-warning ping 2>/dev/null | grep -q PONG; then
    echo "FAIL: discovered password does not auth"
    exit 5
  fi
  echo "REDIS_AUTH_OK=1"
  URL="redis://:$PASS@127.0.0.1:6379"
fi

export ENV_FILE URL
python3 - <<'PY'
import os, re
from pathlib import Path
env_path = Path(os.environ["ENV_FILE"])
url = os.environ["URL"]
text = env_path.read_text(encoding="utf-8", errors="ignore") if env_path.exists() else ""
line = f"REDIS_URL={url}"
if re.search(r"^REDIS_URL=", text, re.M):
    text = re.sub(r"^REDIS_URL=.*$", line, text, count=1, flags=re.M)
else:
    text = (text.rstrip() + "\\n" if text.strip() else "") + line + "\\n"
env_path.write_text(text, encoding="utf-8")
print("ENV_UPDATED=1")
print("URL_HAS_AUTH", "@" in url)
PY

cd "$APP"
pm2 restart dashboardthangtinhoc --update-env
sleep 7
echo "=== healthz ==="
curl -sS --max-time 10 http://127.0.0.1:5000/healthz
echo
`;

(async () => {
  const ssh = new NodeSSH();
  console.log('Connecting...');
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 45000 });

  const b64 = Buffer.from(remoteBash, 'utf8').toString('base64');
  const runner = `echo '${b64}' | base64 -d > /tmp/qa_redis_fix.sh && chmod +x /tmp/qa_redis_fix.sh && bash /tmp/qa_redis_fix.sh; EC=$?; rm -f /tmp/qa_redis_fix.sh; exit $EC`;

  console.log('Running remote fix script...');
  const r = await ssh.execCommand(runner);
  console.log(mask(`${r.stdout || ''}\n${r.stderr || ''}`).trim().slice(0, 8000));

  const healthLine = (r.stdout || '').split('\n').filter((l) => l.trim().startsWith('{')).pop();
  let ok = false;
  try {
    const j = JSON.parse(healthLine || '{}');
    ok = j.ok === true && j.redis === 'up';
    console.log(`\nRESULT ok=${j.ok} redis=${j.redis} queue=${j.queue}`);
  } catch {
    console.log('\nRESULT: healthz parse failed');
  }

  ssh.dispose();
  process.exit(ok ? 0 : 1);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
