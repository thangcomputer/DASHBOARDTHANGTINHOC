const { getVpsSshConfig } = require('./deploy_scripts/_vpsConnect.cjs');
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

const VPS_DIR = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard.giasutinhoc24h.com';

async function run() {
  await ssh.connect(getVpsSshConfig());

  console.log('[1/3] Pulling latest vite.config.js...');
  const pull = await ssh.execCommand(
    `cd ${VPS_DIR} && wget -q -O /tmp/vite_config.js https://raw.githubusercontent.com/thangcomputer/QUANLYCMS/main/client/vite.config.js && cp /tmp/vite_config.js ${VPS_DIR}/client/vite.config.js`
  );
  if (pull.stderr) console.log('Pull stderr:', pull.stderr);
  console.log('  vite.config.js updated');

  console.log('[2/3] Building React frontend...');
  const build = await ssh.execCommand(`cd ${VPS_DIR}/client && npm run build 2>&1`);
  console.log((build.stdout + build.stderr).slice(-2000));

  console.log('[3/3] Checking build result...');
  const ls = await ssh.execCommand(`ls -la ${VPS_DIR}/client/dist/`);
  console.log(ls.stdout);

  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
