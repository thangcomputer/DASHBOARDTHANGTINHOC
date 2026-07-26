const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('ls -R /www/wwwroot/dashboard.giasutinhoc24h.com');
  console.log(result.stdout);
  process.exit(0);
}
check();
