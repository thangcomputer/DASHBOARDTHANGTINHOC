const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('find /www/wwwroot/quanlycms -name messageRoutes.js');
  console.log('File locations:\n', result.stdout);
  process.exit(0);
}
check();
