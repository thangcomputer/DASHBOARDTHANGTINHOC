const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const path = require('path');
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function runFix() {
  await ssh.connect(getVpsSshConfig());

  const projectPath = '/www/wwwroot/quanlycms';
  
  await ssh.execCommand('git pull origin main 2>&1', { cwd: projectPath });

  console.log('🔄 Running check_betho.js on VPS...');
  const runScript = await ssh.execCommand('node check_betho.js 2>&1', { cwd: projectPath });
  console.log(runScript.stdout || runScript.stderr);

  process.exit(0);
}
runFix();
