const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function checkNginx() {
  await ssh.connect(getVpsSshConfig());
  
  // Try to find the site config
  const result = await ssh.execCommand('ls /www/server/panel/vhost/nginx/*.conf');
  console.log('Configs:\n', result.stdout);
  
  const siteConfig = await ssh.execCommand('cat /www/server/panel/vhost/nginx/dashboard.giasutinhoc24h.com.conf');
  console.log('Site Config:\n', siteConfig.stdout);
  
  process.exit(0);
}
checkNginx();
