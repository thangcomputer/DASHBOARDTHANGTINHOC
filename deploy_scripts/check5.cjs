const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function checkClientDir() {
  await ssh.connect(getVpsSshConfig());
  const res = await ssh.execCommand('ls -la /www/wwwroot/quanlycms/client');
  console.log(res.stdout || res.stderr);
  process.exit(0);
}
checkClientDir();
