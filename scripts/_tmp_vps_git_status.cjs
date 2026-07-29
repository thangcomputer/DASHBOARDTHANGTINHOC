const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');
const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';

(async () => {
  const ssh = new NodeSSH();
  await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 25000 });
  const cmds = [
    ['pwd && git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD && git rev-parse --short origin/main 2>/dev/null; git status -sb', 'status'],
    ['git remote -v', 'remote'],
    ['git log --oneline -5', 'log'],
    ['git status --porcelain | head -n 80', 'porcelain'],
    ['git diff --stat HEAD | tail -n 40', 'diff-stat'],
    ['git ls-files -o --exclude-standard | head -n 40', 'untracked'],
  ];
  for (const [cmd, label] of cmds) {
    console.log(`\n=== ${label} ===`);
    const r = await ssh.execCommand(cmd, { cwd: APP });
    const out = `${r.stdout || ''}\n${r.stderr || ''}`.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
    console.log(out.trim().slice(0, 4000));
  }
  ssh.dispose();
})().catch((e) => { console.error(e); process.exit(1); });
