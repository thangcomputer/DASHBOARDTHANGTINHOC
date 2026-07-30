/**
 * Deploy: git pull on VPS → npm install → client build → pm2 restart
 * Credentials from .env (VPS_HOST / VPS_PASSWORD)
 */
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

async function run(ssh, label, cmd, opts = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`$ ${cmd}`);
  const res = await ssh.execCommand(cmd, { cwd: opts.cwd || APP, execOptions: { maxBuffer: 20 * 1024 * 1024 } });
  if (res.stdout) console.log(res.stdout.slice(-4000));
  if (res.stderr) console.log(res.stderr.slice(-2000));
  if (typeof res.code === 'number' && res.code !== 0 && !opts.allowFail) {
    throw new Error(`${label} failed (exit ${res.code})`);
  }
  return res;
}

async function main() {
  const ssh = new NodeSSH();
  console.log('🔗 Connecting to VPS...');
  await ssh.connect(getVpsSshConfig());

  try {
    await run(ssh, 'GIT STATUS', 'git status -sb && git rev-parse --short HEAD');
    await run(ssh, 'GIT PULL', 'git pull origin main');
    await run(ssh, 'NPM INSTALL (backend)', 'npm install --omit=dev');
    await run(ssh, 'NPM INSTALL (client)', 'npm install', { cwd: `${APP}/client` });
    await run(ssh, 'BUILD CLIENT', 'npm run build', { cwd: `${APP}/client` });
    await run(ssh, 'PM2 RESTART', 'pm2 restart dashboardthangtinhoc || pm2 start server.js --name dashboardthangtinhoc');
    await run(ssh, 'PM2 SAVE', 'pm2 save');
    await run(ssh, 'PM2 LIST', 'pm2 list');
    console.log('\n✅ DEPLOY COMPLETED');
  } finally {
    ssh.dispose();
  }
}

main().catch((err) => {
  console.error('❌ DEPLOY FAILED:', err.message || err);
  process.exit(1);
});
