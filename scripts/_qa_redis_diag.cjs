/**
 * Diagnose Redis AUTH on staging — masks secrets in output.
 */
require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

function mask(s) {
  return String(s || '')
    .replace(/requirepass\s+\S+/gi, 'requirepass ***')
    .replace(/redis:\/\/:[^@]+@/gi, 'redis://:***@')
    .replace(/REDIS_URL=.*/gi, 'REDIS_URL=***');
}

(async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 45000 });

  const cmds = [
    ['requirepass_set', "grep -E '^requirepass' /etc/redis/redis.conf /etc/redis.conf 2>/dev/null | wc -l"],
    ['redis_url_has_auth', "grep '^REDIS_URL=' " + APP + "/.env | grep -c '@' || true"],
    ['pm2', 'pm2 jlist | python3 -c "import sys,json; d=json.load(sys.stdin);\\n[print(p[\\"name\\"], p[\\"pm2_env\\"].get(\\"status\\"), p[\\"pm2_env\\"].get(\\"restart_time\\"), p.get(\\"monit\\",{})) for p in d if p[\\"name\\"]==\\"dashboardthangtinhoc\\"]"'],
    ['logs', 'pm2 logs dashboardthangtinhoc --lines 30 --nostream'],
    ['health', 'curl -sS --max-time 8 http://127.0.0.1:5000/healthz || echo HEALTH_FAIL'],
  ];

  for (const [label, cmd] of cmds) {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(cmd, { cwd: APP });
    console.log(mask(`${r.stdout || ''}\n${r.stderr || ''}`).trim().slice(0, 5000));
  }
  ssh.dispose();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
