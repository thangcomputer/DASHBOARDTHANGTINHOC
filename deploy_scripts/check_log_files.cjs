const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('tail -n 100 /root/.pm2/logs/quanlycms-error.log');
  console.log('Error Logs:\n', result.stdout);
  
  const result2 = await ssh.execCommand('tail -n 100 /root/.pm2/logs/quanlycms-out.log');
  console.log('Out Logs:\n', result2.stdout);
  
  process.exit(0);
}
check();
