const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function checkPm2() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('pm2 show quanlycms');
  console.log(result.stdout);
  process.exit(0);
}
checkPm2();
