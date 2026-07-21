const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('netstat -tpln | grep 5001');
  console.log('Port 5001:\n', result.stdout);
  
  const result2 = await ssh.execCommand('netstat -tpln | grep 5000');
  console.log('Port 5000:\n', result2.stdout);
  
  process.exit(0);
}
check();
