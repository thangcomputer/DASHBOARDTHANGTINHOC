const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function checkDirs() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('ls -ld /www/wwwroot/*');
  console.log(result.stdout);
  process.exit(0);
}
checkDirs();
