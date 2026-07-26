const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function check() {
  await ssh.connect(getVpsSshConfig());
  const res = await ssh.execCommand('ls -la /www/server/panel/vhost/nginx');
  console.log('Nginx configs:', res.stdout || res.stderr);
  
  const res2 = await ssh.execCommand('pm2 list');
  console.log('PM2 list:', res2.stdout || res2.stderr);
  process.exit(0);
}
check();
