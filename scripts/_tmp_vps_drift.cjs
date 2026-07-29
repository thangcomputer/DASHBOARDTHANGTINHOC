const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');
const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

(async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 25000 });

  // Detect ANY drift from HEAD including ignored? only tracked
  const checks = [
    'git update-index -q --refresh; git diff --name-status HEAD; git diff --cached --name-status',
    'git status --porcelain=v1 -uall | head -n 100',
    'grep -n mongodb package.json | head -n 5; npm ls mongodb --depth=0 2>&1 | tail -n 5',
    'md5sum package.json package-lock.json client/package.json client/package-lock.json client/.env.production 2>/dev/null',
    'git show HEAD:package.json | grep -n mongodb | head -n 5 || true',
    'test -f client/.env.production && cat client/.env.production',
    // important source files hash vs HEAD
    'for f in client/src/components/teacher/TeacherStudentCard.jsx client/src/components/admin/shared/EditStudentModal.jsx routes/studentRoutes.js middleware/apiRateLimit.js; do echo -n "$f "; git hash-object "$f"; git rev-parse "HEAD:$f"; done',
  ];
  for (const cmd of checks) {
    console.log('\n---');
    const r = await ssh.execCommand(cmd, { cwd: APP });
    console.log(`${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim().slice(0, 2500));
  }
  ssh.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
