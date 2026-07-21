const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function buildClient() {
  await ssh.connect(getVpsSshConfig());
  const res = await ssh.execCommand('npm run build', { cwd: '/www/wwwroot/quanlycms/client' });
  console.log('STDOUT:', res.stdout);
  console.log('STDERR:', res.stderr);
  process.exit(0);
}
buildClient();
