const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('sed -n "350,450p" /www/wwwroot/quanlycms/routes/messageRoutes.js');
  console.log('File content (350-450):\n', result.stdout);
  process.exit(0);
}
check();
