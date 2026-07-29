const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');
const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

(async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 30000 });
  const cmds = [
    ['pm2', 'pm2 list; pm2 describe dashboardthangtinhoc | head -n 50'],
    ['logs', 'pm2 logs dashboardthangtinhoc --lines 40 --nostream'],
    ['health', 'sleep 3; curl -s -o /dev/null -w "healthz:%{http_code} time:%{time_total}\\n" http://127.0.0.1:5000/healthz; curl -s http://127.0.0.1:5000/healthz; echo; ss -lptn | grep 5000 || true'],
    ['env', 'grep -E "^PORT|^NODE_ENV|^REDIS_URL" .env | sed "s/:[^@]*@/:***@/"'],
  ];
  for (const [label, cmd] of cmds) {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(cmd, { cwd: APP });
    console.log(`${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim().slice(0, 5000));
  }
  ssh.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
