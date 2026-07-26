const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function restartServer() {
  await ssh.connect(getVpsSshConfig());
  const pm2res = await ssh.execCommand('pm2 restart quanlycms');
  console.log('PM2 RESTART:', pm2res.stdout);
  process.exit(0);
}
restartServer();
