const { NodeSSH } = require('node-ssh');
const path = require('path');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function runCheck() {
  await ssh.connect(getVpsSshConfig());
  
  // Upload the check script first
  await ssh.putFile(path.join(__dirname, 'check_vps_db.cjs'), '/www/wwwroot/dashboardthangtinhoc/check_vps_db.cjs');
  
  const result = await ssh.execCommand('cd /www/wwwroot/dashboardthangtinhoc && node check_vps_db.cjs');
  console.log(result.stdout);
  
  process.exit(0);
}
runCheck();
