const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function checkLogs() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('pm2 logs quanlycms --lines 100 --no-colors');
  console.log(result.stdout);
  process.exit(0);
}
checkLogs();
