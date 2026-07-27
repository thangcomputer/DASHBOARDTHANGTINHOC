const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function check() {
  await ssh.connect(getVpsSshConfig());
  const res = await ssh.execCommand('ls -la /www/wwwroot/dashboardthangtinhoc');
  console.log(res.stdout || res.stderr);
  
  const res2 = await ssh.execCommand('ls -la /tmp/dashboardthangtinhoc_clone_temp');
  console.log(res2.stdout || res2.stderr);
  process.exit(0);
}
check();
