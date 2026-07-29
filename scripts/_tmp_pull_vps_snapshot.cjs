const { NodeSSH } = require('node-ssh');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getVpsSshConfig } = require('../deploy_scripts/_vpsConnect.cjs');

const APP = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard-thangtinhoc-edu-vn';
const OUT = path.join(__dirname, '_vps_git_archive.tgz');
const EXTRACT_DIR = path.join(__dirname, '_vps_extract');

(async () => {
  const cfg = getVpsSshConfig();
  const ssh = new NodeSSH();
  await ssh.connect({ ...cfg, readyTimeout: 30000 });

  const remoteTar = '/tmp/dashboard_vps_git.tgz';
  console.log('git archive on VPS...');
  let r = await ssh.execCommand(`cd "${APP}" && git archive --format=tar.gz -o "${remoteTar}" HEAD && ls -la "${remoteTar}"`);
  console.log((r.stdout || r.stderr || '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').trim());
  if (r.code) process.exit(1);

  // Prefer scp CLI (more reliable for larger files than node-ssh getFile)
  const pass = cfg.password;
  const host = cfg.host;
  const user = cfg.username || 'root';
  if (pass) {
    // use ssh + cat base64 chunks to avoid sftp packet limits
    console.log('Downloading via base64 stream...');
    r = await ssh.execCommand(`base64 -w0 "${remoteTar}"`);
    if (r.code || !r.stdout) {
      console.error('base64 failed', r.stderr);
      process.exit(1);
    }
    fs.writeFileSync(OUT, Buffer.from(r.stdout.trim(), 'base64'));
  } else {
    await ssh.getFile(OUT, remoteTar);
  }

  await ssh.execCommand(`rm -f "${remoteTar}"`);

  r = await ssh.execCommand('git rev-parse HEAD && git rev-parse --short HEAD', { cwd: APP });
  const head = (r.stdout || '').trim().split(/\s+/);
  console.log('VPS HEAD', head.join(' '));

  ssh.dispose();

  console.log('Archive size', fs.statSync(OUT).size);
  fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  execSync(`tar -xzf "${OUT}" -C "${EXTRACT_DIR}"`, { stdio: 'inherit' });
  console.log('Extracted to', EXTRACT_DIR);
  fs.writeFileSync(path.join(__dirname, '_vps_head.txt'), head[0] || '');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
