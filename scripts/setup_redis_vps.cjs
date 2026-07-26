/**
 * Cài Redis trên VPS và ghi REDIS_URL vào .env (nếu chưa có).
 *
 * Biến môi trường (giống sync_vps.cjs):
 *   VPS_HOST, VPS_USER, VPS_PASSWORD hoặc VPS_SSH_KEY_PATH
 *   VPS_APP_DIR (mặc định /www/wwwroot/dashboard.giasutinhoc24h.com)
 *   REDIS_URL (mặc định redis://127.0.0.1:6379)
 */
const { NodeSSH } = require('node-ssh');

const ssh = new NodeSSH();
const VPS_DIR = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard.giasutinhoc24h.com';
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Thiếu biến môi trường: ${name}`);
    process.exit(1);
  }
  return val;
}

async function exec(label, cmd) {
  console.log(`\n→ ${label}`);
  const res = await ssh.execCommand(cmd);
  if (res.stdout) console.log(res.stdout.trim());
  if (res.stderr && !res.stderr.includes('WARNING')) console.warn(res.stderr.trim());
  return res;
}

async function run() {
  const host = requireEnv('VPS_HOST');
  const username = process.env.VPS_USER || 'root';
  const password = process.env.VPS_PASSWORD;
  const privateKeyPath = process.env.VPS_SSH_KEY_PATH;

  if (!password && !privateKeyPath) {
    console.error('❌ Cần VPS_PASSWORD hoặc VPS_SSH_KEY_PATH');
    process.exit(1);
  }

  await ssh.connect({
    host,
    username,
    ...(privateKeyPath ? { privateKeyPath } : { password }),
  });
  console.log('✅ Kết nối VPS thành công');

  await exec('Cài Redis (apt)', `
    if command -v redis-cli >/dev/null 2>&1; then
      echo "Redis đã cài sẵn"
    else
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq && apt-get install -y redis-server
    fi
  `);

  await exec('Bật Redis', `
    systemctl enable redis-server 2>/dev/null || systemctl enable redis 2>/dev/null || true
    systemctl start redis-server 2>/dev/null || systemctl start redis 2>/dev/null || true
    redis-cli ping
  `);

  await exec('Cấu hình bind localhost', `
    for f in /etc/redis/redis.conf /etc/redis.conf; do
      if [ -f "$f" ]; then
        sed -i 's/^bind .*/bind 127.0.0.1 ::1/' "$f" 2>/dev/null || true
        sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1 ::1/' "$f" 2>/dev/null || true
      fi
    done
    systemctl restart redis-server 2>/dev/null || systemctl restart redis 2>/dev/null || true
  `);

  await exec('Ghi REDIS_URL vào .env', `
    ENV_FILE="${VPS_DIR}/.env"
    touch "$ENV_FILE"
    if grep -q '^REDIS_URL=' "$ENV_FILE"; then
      sed -i 's|^REDIS_URL=.*|REDIS_URL=${REDIS_URL}|' "$ENV_FILE"
    else
      echo "REDIS_URL=${REDIS_URL}" >> "$ENV_FILE"
    fi
    grep REDIS_URL "$ENV_FILE" || true
  `);

  await exec('npm install (redis deps)', `cd ${VPS_DIR} && npm install --legacy-peer-deps`);

  await exec('Restart PM2', `cd ${VPS_DIR} && pm2 restart quanlycms --update-env`);

  const logs = await ssh.execCommand('pm2 logs quanlycms --lines 12 --nostream');
  console.log('\n📋 PM2 Logs (last 12 lines):');
  console.log(logs.stdout);

  console.log('\n✅ Redis đã sẵn sàng. REDIS_URL=' + REDIS_URL);
  process.exit(0);
}

run().catch((e) => { console.error('❌', e.message); process.exit(1); });
