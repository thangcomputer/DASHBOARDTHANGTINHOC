/**
 * Deploy script — KHÔNG lưu credentials trong file này.
 * Cấu hình qua biến môi trường trước khi chạy:
 *
 *   VPS_HOST, VPS_USER, VPS_PASSWORD (hoặc VPS_SSH_KEY_PATH)
 *   VPS_APP_DIR, GITHUB_REPO_ZIP_URL (optional)
 */
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const VPS_DIR = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard.giasutinhoc24h.com';
const REPO_ZIP = process.env.GITHUB_REPO_ZIP_URL
  || 'https://github.com/thangcomputer/QUANLYCMS/archive/refs/heads/main.zip';

function requireEnv(name) {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ Thiếu biến môi trường: ${name}`);
    process.exit(1);
  }
  return val;
}

async function run() {
  const host = requireEnv('VPS_HOST');
  const username = process.env.VPS_USER || 'root';
  const password = process.env.VPS_PASSWORD;
  const privateKeyPath = process.env.VPS_SSH_KEY_PATH;

  if (!password && !privateKeyPath) {
    console.error('❌ Cần VPS_PASSWORD hoặc VPS_SSH_KEY_PATH');
    process.exit(1);
  }

  await ssh.connect({
    host,
    username,
    ...(privateKeyPath ? { privateKeyPath } : { password }),
  });
  console.log('✅ Kết nối VPS thành công\n');

  console.log('[1/4] Tải source code từ GitHub...');
  await ssh.execCommand(`rm -rf ${VPS_DIR}/client/src ${VPS_DIR}/models ${VPS_DIR}/routes ${VPS_DIR}/server.js ${VPS_DIR}/package.json ${VPS_DIR}/package-lock.json`);
  await ssh.execCommand(`cd /tmp && rm -f quanlycms.zip && wget -q -O quanlycms.zip "${REPO_ZIP}" && unzip -q -o quanlycms.zip && cp -Rf QUANLYCMS-main/. ${VPS_DIR}/ && rm -rf QUANLYCMS-main quanlycms.zip`);

  console.log('[2/4] Giữ nguyên .env trên server (không ghi đè từ script)...');

  console.log('[3/4] npm install & build...');
  await ssh.execCommand(`cd ${VPS_DIR} && npm install --legacy-peer-deps`);
  await ssh.execCommand(`cd ${VPS_DIR}/client && npm install --legacy-peer-deps && npm run build`);

  console.log('[4/4] Restart PM2...');
  await ssh.execCommand(`cd ${VPS_DIR} && pm2 restart quanlycms --update-env`);

  const logs = await ssh.execCommand('pm2 logs quanlycms --lines 8 --nostream');
  console.log('\n📋 PM2 Logs (last 8 lines):');
  console.log(logs.stdout);

  console.log('\n✅ HOÀN TẤT!');
  process.exit(0);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
