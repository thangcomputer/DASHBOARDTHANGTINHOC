const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  
  // Check what's listening on all ports
  const result = await ssh.execCommand('netstat -tpln');
  console.log('Netstat:\n', result.stdout);
  
  // Check nginx status
  const result2 = await ssh.execCommand('nginx -T | grep "proxy_pass"');
  console.log('Nginx Active proxy_pass:\n', result2.stdout);
  
  process.exit(0);
}
check();
