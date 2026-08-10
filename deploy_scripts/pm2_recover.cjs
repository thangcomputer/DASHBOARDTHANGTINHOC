/**
 * Emergency: SSH → pm2 status/logs/restart only (no git pull / no rebuild).
 * Needs VPS_HOST + VPS_PASSWORD or VPS_SSH_KEY_PATH in .env
 */
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

async function run(ssh, label, cmd, opts = {}) {
  console.log(`\n=== ${label} ===`);
  const res = await ssh.execCommand(cmd, {
    cwd: opts.cwd || APP,
    execOptions: { maxBuffer: 5 * 1024 * 1024 },
  });
  if (res.stdout) console.log(res.stdout.slice(-6000));
  if (res.stderr) console.log(res.stderr.slice(-2000));
  return res;
}

async function main() {
  const ssh = new NodeSSH();
  console.log('Connecting to VPS...');
  await ssh.connect(getVpsSshConfig());
  try {
    await run(ssh, 'PM2 LIST', 'pm2 list');
    await run(ssh, 'PM2 DESCRIBE', 'pm2 describe dashboardthangtinhoc || pm2 describe all || true', { cwd: undefined });
    await run(ssh, 'CURL LOCAL', 'curl -sS -m 5 -o /tmp/hz.json -w "%{http_code}" http://127.0.0.1:5000/healthz || true');
    await run(ssh, 'CAT HEALTH BODY', 'cat /tmp/hz.json 2>/dev/null || true');
    await run(ssh, 'PM2 LOGS TAIL', 'pm2 logs dashboardthangtinhoc --lines 40 --nostream || pm2 logs --lines 40 --nostream');
    if (process.argv.includes('--restart')) {
      await run(ssh, 'PM2 RESTART', 'pm2 restart dashboardthangtinhoc || pm2 start server.js --name dashboardthangtinhoc');
      await run(ssh, 'PM2 SAVE', 'pm2 save');
      await run(ssh, 'CURL AFTER', 'sleep 2; curl -sS -m 8 -w "\\nHTTP %{http_code}\\n" http://127.0.0.1:5000/healthz || true');
      await run(ssh, 'PM2 LIST AFTER', 'pm2 list');
    }
  } finally {
    ssh.dispose();
  }
}

main().catch((err) => {
  console.error('FAILED:', err.message || err);
  process.exit(1);
});
