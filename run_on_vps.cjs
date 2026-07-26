/**
 * run_on_vps.cjs — git pull + pm2 restart on VPS.
 * Credentials: VPS_HOST / VPS_PASSWORD (or VPS_SSH_KEY_PATH) in .env
 */
const { NodeSSH } = require('node-ssh');
const { getVpsSshConfig } = require('./deploy_scripts/_vpsConnect.cjs');

const ssh = new NodeSSH();
const APP_DIR = process.env.VPS_APP_DIR || '/www/wwwroot/quanlycms';

async function run() {
  console.log('Connecting to VPS...');
  try {
    await ssh.connect({ ...getVpsSshConfig(), readyTimeout: 10000 });
    console.log('Connected\n');
  } catch (err) {
    console.error('Connect failed:', err.message);
    printManualInstructions();
    process.exit(1);
  }

  const commands = [
    `cd ${APP_DIR} && git pull origin main`,
    'pm2 restart quanlycms',
    'pm2 list',
  ];

  for (const cmd of commands) {
    console.log(`\n> ${cmd}`);
    const result = await ssh.execCommand(cmd);
    if (result.stdout) console.log(result.stdout);
    if (result.stderr && !result.stderr.includes('Warning')) console.error('STDERR:', result.stderr);
  }

  ssh.dispose();
  console.log('\nDone.');
}

function printManualInstructions() {
  console.log(`
Manual steps on VPS:
  cd ${APP_DIR}
  git pull origin main
  pm2 restart quanlycms
  pm2 list
`);
}

run().catch((err) => {
  console.error('Error:', err.message);
  printManualInstructions();
});