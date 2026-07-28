/**
 * Deploy reliability fix: pull + client build + PM2 ecosystem reload.
 * Usage: node scripts/_tmp_deploy_reliability.cjs
 */
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

(async () => {
  const ssh = new NodeSSH();
  console.log('Connecting to VPS...');
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 45000 });

  const run = async (label, cmd, opts = {}) => {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(cmd, { cwd: APP, ...opts });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim();
    console.log(out.slice(0, 8000) || '(empty)');
    if (r.code && r.code !== 0) {
      console.error(`Command failed with code ${r.code}`);
    }
    return r;
  };

  await run('git', 'git fetch origin main && git reset --hard origin/main && git log -1 --oneline && git status -sb');
  await run('build', 'cd client && (test -d node_modules || npm ci) && npm run build');
  // Prefer ecosystem reload (zero/near-zero downtime). Avoid delete+start which causes HTTP 503.
  await run(
    'pm2',
    'pm2 startOrReload ecosystem.config.cjs --env production && pm2 save && pm2 list && sleep 5 && curl -s -o /dev/null -w "healthz:%{http_code} time:%{time_total}\\n" http://127.0.0.1:5000/healthz && curl -s http://127.0.0.1:5000/healthz'
  );

  ssh.dispose();
  console.log('\nDone.');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
