/**
 * Full deploy per student_create_audit plan:
 * 1) Disable CQRS flags on VPS .env + pm2 fresh start
 * 2) Checkout deploy/messaging-phase-824, npm install, client build
 * 3) Smoke healthz + soft students route source
 *
 * Requires VPS_HOST + VPS_PASSWORD or VPS_SSH_KEY_PATH in .env
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');

const CANDIDATE_APPS = [
  process.env.VPS_APP_DIR,
  '/www/wwwroot/dashboard-thangtinhoc-edu-vn',
  '/www/wwwroot/dashboardthangtinhoc',
  '/www/wwwroot/dashboard.thangtinhoc.edu.vn',
].filter(Boolean);

const BRANCH = process.env.DEPLOY_BRANCH || 'deploy/messaging-phase-824';

async function run(ssh, label, cmd, opts = {}) {
  console.log(`\n=== ${label} ===`);
  console.log(`$ ${cmd}`);
  const res = await ssh.execCommand(cmd, {
    cwd: opts.cwd,
    execOptions: { maxBuffer: 30 * 1024 * 1024 },
  });
  if (res.stdout) console.log(String(res.stdout).slice(-8000));
  if (res.stderr) console.log(String(res.stderr).slice(-3000));
  if (typeof res.code === 'number' && res.code !== 0 && !opts.allowFail) {
    throw new Error(`${label} failed (exit ${res.code})`);
  }
  return res;
}

async function resolveAppDir(ssh) {
  for (const d of CANDIDATE_APPS) {
    const r = await ssh.execCommand(`test -f ${d}/server.js && echo OK`);
    if (String(r.stdout || '').includes('OK')) return d;
  }
  const ls = await ssh.execCommand('ls -la /www/wwwroot/');
  console.log(ls.stdout || ls.stderr);
  throw new Error('Cannot find server.js under /www/wwwroot');
}

async function main() {
  const ssh = new NodeSSH();
  const cfg = getVpsSshConfig();
  console.log(`Connecting to ${cfg.host} as ${cfg.username}...`);
  await ssh.connect({ ...cfg, readyTimeout: 20000 });

  try {
    const APP = await resolveAppDir(ssh);
    console.log(`APP=${APP}`);

    // --- Todo 1: CQRS off + PM2 healthy ---
    await run(ssh, 'BACKUP ENV', `cp -a .env ".env.bak.$(date +%Y%m%d%H%M%S)"`, { cwd: APP });
    await run(
      ssh,
      'DISABLE CQRS FLAGS',
      `for key in ENABLE_CQRS ENABLE_CQRS_STUDENT_CREATE ENABLE_CQRS_INVOICE ENABLE_CQRS_TEACHER ENABLE_CQRS_FINANCE; do
  if grep -qE "^\\${key}=" .env; then sed -i "s/^\\${key}=.*/\\${key}=false/" .env;
  else echo "\\${key}=false" >> .env; fi;
done
grep -E '^(ENABLE_CQRS|MONGODB_URI)=' .env || true`,
      { cwd: APP },
    );

    // --- Todo 2: deploy branch ---
    const hasGit = await ssh.execCommand(`test -d ${APP}/.git && echo YES`);
    if (String(hasGit.stdout || '').includes('YES')) {
      await run(ssh, 'GIT FETCH', 'git fetch origin', { cwd: APP, allowFail: true });
      await run(
        ssh,
        'GIT CHECKOUT BRANCH',
        `git checkout ${BRANCH} 2>/dev/null || git checkout -B ${BRANCH} origin/${BRANCH}; git pull origin ${BRANCH} || true`,
        { cwd: APP, allowFail: true },
      );
      await run(ssh, 'GIT HEAD', 'git rev-parse --short HEAD && git status -sb', { cwd: APP, allowFail: true });
    } else {
      console.log('No .git — uploading critical fix files via SFTP');
      const files = [
        'config/validateEnv.js',
        'shared/cqrs/flags.js',
        'shared/cqrs/middleware.js',
        'shared/cqrs/withTransaction.js',
        'routes/studentRoutes.js',
        'client/src/components/admin/shared/AddStudentModal.jsx',
        'client/src/components/admin/hooks/useAdminStudents.jsx',
        'client/src/context/useDataAdminCrud.js',
        'client/vite.config.js',
        'server.js',
      ];
      const root = path.join(__dirname, '..');
      for (const rel of files) {
        const local = path.join(root, rel);
        if (!fs.existsSync(local)) {
          console.warn('skip missing', rel);
          continue;
        }
        const remote = `${APP}/${rel.replace(/\\/g, '/')}`;
        await ssh.execCommand(`mkdir -p $(dirname ${remote})`);
        await ssh.putFile(local, remote);
        console.log('uploaded', rel);
      }
    }

    await run(ssh, 'NPM INSTALL BACKEND', 'npm install --omit=dev', { cwd: APP, allowFail: true });
    await run(ssh, 'NPM INSTALL CLIENT', 'npm install', { cwd: `${APP}/client`, allowFail: true });
    await run(ssh, 'BUILD CLIENT', 'npm run build', { cwd: `${APP}/client` });

    await run(ssh, 'PM2 DELETE', 'pm2 delete dashboardthangtinhoc 2>/dev/null || true', {
      cwd: APP,
      allowFail: true,
    });
    await run(ssh, 'PM2 START', 'pm2 start server.js --name dashboardthangtinhoc --update-env', { cwd: APP });
    await run(ssh, 'PM2 SAVE', 'pm2 save', { cwd: APP, allowFail: true });

    await new Promise((r) => setTimeout(r, 2500));
    await run(ssh, 'PM2 LIST', 'pm2 list', { allowFail: true });
    const hz = await run(
      ssh,
      'LOCAL HEALTHZ',
      'curl -sS -m 8 -w "\\nHTTP %{http_code}\\n" http://127.0.0.1:5000/healthz || true',
      { allowFail: true },
    );

    // Verify student route is soft/legacy (no hard require on POST chain for create)
    await run(
      ssh,
      'VERIFY STUDENT ROUTE',
      `grep -n "requireStudentCreateCqrs\\|isStudentCreateCqrs\\|router.post('/'" routes/studentRoutes.js | head -20`,
      { cwd: APP, allowFail: true },
    );
    await run(ssh, 'PM2 LOGS', 'pm2 logs dashboardthangtinhoc --lines 25 --nostream', { allowFail: true });

    const body = String(hz.stdout || '');
    if (!body.includes('HTTP 200') && !body.includes('"ok":true')) {
      throw new Error('healthz not 200 after deploy');
    }
    console.log('\n✅ DEPLOY PLAN COMPLETE');
  } finally {
    ssh.dispose();
  }
}

main().catch((err) => {
  console.error('❌', err.message || err);
  process.exit(1);
});
