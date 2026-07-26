const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  
  const result = await ssh.execCommand('grep "admin_admin" /www/wwwroot/quanlycms/routes/messageRoutes.js');
  console.log('admin_admin check on VPS:\n', result.stdout);
  
  process.exit(0);
}
check();
