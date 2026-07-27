const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function checkFiles() {
  await ssh.connect(getVpsSshConfig());
  const result = await ssh.execCommand('ls -l /www/wwwroot/dashboardthangtinhoc/client/dist/assets/index-*.js');
  console.log('VPS Index Files:\n', result.stdout);
  
  const indexHtml = await ssh.execCommand('grep "index-" /www/wwwroot/dashboardthangtinhoc/client/dist/index.html');
  console.log('index.html content:\n', indexHtml.stdout);
  
  process.exit(0);
}
checkFiles();
