const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect(getVpsSshConfig());
  
  const result = await ssh.execCommand('ls /www/server/panel/vhost/apache/*.conf');
  console.log('Apache Configs:\n', result.stdout);
  
  const siteConfig = await ssh.execCommand('cat /www/server/panel/vhost/apache/dashboard.giasutinhoc24h.com.conf');
  console.log('Site Config:\n', siteConfig.stdout);
  
  process.exit(0);
}
check();
