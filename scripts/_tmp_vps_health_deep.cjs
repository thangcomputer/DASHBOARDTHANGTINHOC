const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

(async () => {
  const ssh = new NodeSSH();
  console.log('Connecting...');
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 30000 });

  const cmds = [
    ['uptime', 'uptime; free -m | head -n 2; df -h / | tail -n 1'],
    ['pm2', 'pm2 list; pm2 describe dashboardthangtinhoc 2>/dev/null | head -n 40'],
    ['logs', 'pm2 logs dashboardthangtinhoc --lines 60 --nostream'],
    ['health', 'curl -s -o /dev/null -w "healthz:%{http_code} time:%{time_total}\\n" http://127.0.0.1:5000/healthz; curl -s http://127.0.0.1:5000/healthz; echo'],
    ['public', 'curl -s -o /dev/null -w "public:%{http_code} time:%{time_total}\\n" https://dashboard.thangtinhoc.edu.vn/api/auth/captcha; curl -s -I https://dashboard.thangtinhoc.edu.vn/ | head -n 15'],
    ['redis', 'grep -E "^REDIS_URL|^NODE_ENV|^CLIENT_URL|^PORT" ' + APP + '/.env 2>/dev/null | sed "s/:[^@]*@/:***@/" ; redis-cli ping 2>&1 | head -n 3'],
    ['mongo', 'mongosh --quiet --eval "db.runCommand({ping:1})" quanlycms 2>&1 | head -n 5 || mongo --quiet --eval "db.runCommand({ping:1})" quanlycms 2>&1 | head -n 5'],
    ['ports', 'ss -lptn | grep -E ":5000|:80|:443|:6379" || netstat -lptn 2>/dev/null | grep -E ":5000|:80|:443|:6379"'],
    ['restarts', 'pm2 jlist 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin);\\n[print(p[\\"name\\"], p[\\"pm2_env\\"].get(\\"restart_time\\"), p[\\"pm2_env\\"].get(\\"status\\"), p.get(\\"monit\\",{})) for p in d]"'],
  ];

  for (const [label, cmd] of cmds) {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(cmd, { cwd: APP });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
    console.log(out.slice(0, 5000) || '(empty)');
  }
  ssh.dispose();
})().catch((e) => {
  console.error('SSH/VPS FAIL:', e.message || e);
  process.exit(1);
});
