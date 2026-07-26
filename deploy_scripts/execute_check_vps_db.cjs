const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./_vpsConnect.cjs');
const ssh = new NodeSSH();

async function runCheck() {
  await ssh.connect(getVpsSshConfig());
  
  // Upload the check script first
  await ssh.putFile('c:/Users/thang/Desktop/QUANLYCMS/QUANLYCMS/deploy_scripts/check_vps_db.cjs', '/www/wwwroot/quanlycms/check_vps_db.cjs');
  
  const result = await ssh.execCommand('cd /www/wwwroot/quanlycms && node check_vps_db.cjs');
  console.log(result.stdout);
  
  process.exit(0);
}
runCheck();
