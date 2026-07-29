/**
 * Find Redis auth source on staging (masks secrets) + restore REDIS_URL.
 */
require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

function mask(s) {
  return String(s || '')
    .replace(/redis:\/\/:[^@\s]+@/gi, 'redis://:***@')
    .replace(/requirepass\s+\S+/gi, 'requirepass ***')
    .replace(/(REDIS_URL|PASSWORD|pass|secret)=[^\s]+/gi, '$1=***');
}

(async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 45000 });

  const wrap = (cmd) => `bash --noprofile --norc -c ${JSON.stringify(cmd)}`;

  const probes = [
    ['conf_files', 'ls -la /etc/redis/ /etc/redis.conf 2>/dev/null; ls /etc/redis/*.conf 2>/dev/null'],
    ['grep_requirepass_files', 'grep -Rns "requirepass" /etc/redis/ /etc/redis.conf 2>/dev/null | head -n 20'],
    ['acl_files', 'grep -Rns "user " /etc/redis/ 2>/dev/null | head -n 20'],
    ['other_env_redis', 'grep -Rhs "^REDIS_URL=" /www/wwwroot/*/.env 2>/dev/null | sed -E "s#(redis://)([^@/]*@)?#\\1***@" | sort -u'],
    ['app_env_redis', `grep "^REDIS_URL=" ${APP}/.env | sed -E "s#(redis://)([^@/]*@)?#\\\\1***@"`],
    ['pm2_env', 'pm2 env 31 2>/dev/null | grep -i redis | sed -E "s/(=).*/\\1***/" || true'],
    ['health', 'curl -sS --max-time 5 http://127.0.0.1:5000/healthz || echo DOWN'],
  ];

  for (const [label, cmd] of probes) {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(wrap(cmd));
    console.log(mask(`${r.stdout || ''}\n${r.stderr || ''}`).trim().slice(0, 4000) || '(empty)');
  }

  ssh.dispose();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
