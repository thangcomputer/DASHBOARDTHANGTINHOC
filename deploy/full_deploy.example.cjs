/**
 * Deploy local -> VPS. Copy to deploy/full_deploy.cjs + .env.deploy (gitignored).
 * Run: node deploy/full_deploy.cjs
 */
require('dotenv').config({ path: '.env.deploy' });

const { NodeSSH } = require('node-ssh');

const host = process.env.DEPLOY_HOST;
const username = process.env.DEPLOY_USER || 'root';
const remoteRoot = process.env.DEPLOY_REMOTE_PATH || '/www/wwwroot/quanlycms';
const privateKeyPath = process.env.DEPLOY_SSH_KEY_PATH;
const password = process.env.DEPLOY_SSH_PASSWORD;

async function fullDeploy() {
  if (!host) {
    console.error('Thieu DEPLOY_HOST trong .env.deploy');
    process.exit(1);
  }
  if (!privateKeyPath && !password) {
    console.error('Can DEPLOY_SSH_KEY_PATH hoac DEPLOY_SSH_PASSWORD trong .env.deploy');
    process.exit(1);
  }

  const ssh = new NodeSSH();
  try {
    await ssh.connect({
      host,
      username,
      ...(privateKeyPath ? { privateKeyPath } : { password }),
    });

    const pull = await ssh.execCommand(`cd ${remoteRoot} && git pull origin main`);
    console.log(pull.stdout || pull.stderr);

    await ssh.execCommand(`cd ${remoteRoot} && npm install --omit=dev`);

    const build = await ssh.execCommand(
      `cd ${remoteRoot}/client && npm install && chmod +x node_modules/.bin/* 2>/dev/null; npm run build`
    );
    console.log(build.stdout || build.stderr);

    const restart = await ssh.execCommand(`cd ${remoteRoot} && pm2 restart quanlycms --update-env`);
    console.log(restart.stdout || restart.stderr);
    await ssh.execCommand('pm2 save');

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Deploy failed:', err.message);
    process.exit(1);
  }
}

fullDeploy();
