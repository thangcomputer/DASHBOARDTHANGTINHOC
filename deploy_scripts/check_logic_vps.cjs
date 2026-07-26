const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  
  const result = await ssh.execCommand('grep -A 20 "Unified Admin" /www/wwwroot/quanlycms/routes/messageRoutes.js');
  console.log('Unified ID Logic on VPS:\n', result.stdout);
  
  process.exit(0);
}
check();
