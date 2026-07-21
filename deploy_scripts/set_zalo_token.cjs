/**
 * Cập nhật ZALO_APP_ID / ZALO_APP_SECRET trên VPS .env
 *
 * KHÔNG hardcode secret trong source. Cấu hình local .env:
 *   ZALO_APP_ID=...
 *   ZALO_APP_SECRET=...
 *   DEPLOY_SSH_HOST=...
 *   DEPLOY_SSH_USER=root
 *   DEPLOY_SSH_PASSWORD=...   (hoặc dùng SSH key)
 *   DEPLOY_ENV_FILE=/www/wwwroot/quanlycms/.env
 *
 * Usage: node deploy_scripts/set_zalo_token.cjs
 */
require('dotenv').config();
const { NodeSSH } = require('node-ssh');

const APP_ID = (process.env.ZALO_APP_ID || '').trim();
const APP_SECRET = (process.env.ZALO_APP_SECRET || '').trim();
const SSH_HOST = (process.env.DEPLOY_SSH_HOST || '').trim();
const SSH_USER = (process.env.DEPLOY_SSH_USER || 'root').trim();
const SSH_PASSWORD = (process.env.DEPLOY_SSH_PASSWORD || '').trim();
const ENV_FILE = (process.env.DEPLOY_ENV_FILE || '/www/wwwroot/quanlycms/.env').trim();

function requireEnv(name, value) {
  if (!value) {
    console.error(`Thiếu biến môi trường: ${name}`);
    process.exit(1);
  }
}

requireEnv('ZALO_APP_ID', APP_ID);
requireEnv('ZALO_APP_SECRET', APP_SECRET);
requireEnv('DEPLOY_SSH_HOST', SSH_HOST);
requireEnv('DEPLOY_SSH_PASSWORD', SSH_PASSWORD);

const ssh = new NodeSSH();

ssh.connect({ host: SSH_HOST, username: SSH_USER, password: SSH_PASSWORD }).then(async () => {
  const read = await ssh.execCommand(`cat ${ENV_FILE}`);
  let content = read.stdout || '';

  if (content.includes('ZALO_APP_ID=')) {
    content = content.replace(/^ZALO_APP_ID=.*/m, `ZALO_APP_ID=${APP_ID}`);
  } else {
    content = content.trimEnd() + `\nZALO_APP_ID=${APP_ID}\n`;
  }

  if (content.includes('ZALO_APP_SECRET=')) {
    content = content.replace(/^ZALO_APP_SECRET=.*/m, `ZALO_APP_SECRET=${APP_SECRET}`);
  } else {
    content = content.trimEnd() + `\nZALO_APP_SECRET=${APP_SECRET}\n`;
  }

  await ssh.execCommand(`cat > ${ENV_FILE} << 'ENVEOF'\n${content}\nENVEOF`);

  const v = await ssh.execCommand(`grep -E "ZALO_APP_ID|ZALO_APP_SECRET" ${ENV_FILE}`);
  console.log('Verify (masked):');
  console.log((v.stdout || '').replace(/(ZALO_APP_SECRET=).+/g, '$1***'));

  await ssh.execCommand('pm2 restart quanlycms --update-env && pm2 save');
  console.log('PM2 restarted.');
  process.exit(0);
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
