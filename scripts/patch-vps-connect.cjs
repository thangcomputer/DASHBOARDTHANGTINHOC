const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEPLOY = path.join(ROOT, 'deploy_scripts');

const INLINE_CONNECT = /await\s+ssh\.connect\(\s*\{\s*host:\s*['"]103\.124\.92\.238['"]\s*,\s*username:\s*['"]root['"]\s*,\s*password:\s*['"]YOUR_VPS_PASSWORD['"]\s*\}\s*\)/g;
const INLINE_CONNECT_ANY_PW = /await\s+ssh\.connect\(\s*\{\s*host:\s*['"]103\.124\.92\.238['"]\s*,\s*username:\s*['"]root['"]\s*,\s*password:\s*['"][^'"]+['"]\s*\}\s*\)/g;

const LOCAL_GET_VPS_FN = /function\s+getVpsConnection\s*\(\s*\)\s*\{[\s\S]*?return\s*\{[\s\S]*?\};\s*\}/g;

function ensureRequire(src, fromDeployDir) {
  if (src.includes('_vpsConnect')) return src;
  const reqLine = fromDeployDir
    ? "const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');\n"
    : "const { getVpsSshConfig, getVpsConnection } = require('./deploy_scripts/_vpsConnect.cjs');\n";
  const m = src.match(/^(?:(?:const|let|var|require)[^\n]*\n)+/);
  if (m) {
    return src.slice(0, m[0].length) + reqLine + src.slice(m[0].length);
  }
  return reqLine + src;
}

function patchFile(filePath, fromDeployDir) {
  let src = fs.readFileSync(filePath, 'utf8');
  const before = src;

  if (LOCAL_GET_VPS_FN.test(src) && /103\.124\.92\.238|YOUR_VPS_PASSWORD|VPS_PASSWORD/.test(src)) {
    LOCAL_GET_VPS_FN.lastIndex = 0;
    src = src.replace(LOCAL_GET_VPS_FN, '');
    src = ensureRequire(src, fromDeployDir);
    src = src.replace(/getVpsConnection\(\)/g, 'getVpsSshConfig()');
  }

  INLINE_CONNECT.lastIndex = 0;
  INLINE_CONNECT_ANY_PW.lastIndex = 0;
  if (INLINE_CONNECT.test(src) || INLINE_CONNECT_ANY_PW.test(src)) {
    INLINE_CONNECT.lastIndex = 0;
    INLINE_CONNECT_ANY_PW.lastIndex = 0;
    src = src.replace(INLINE_CONNECT, 'await ssh.connect(getVpsSshConfig())');
    src = src.replace(INLINE_CONNECT_ANY_PW, 'await ssh.connect(getVpsSshConfig())');
    src = ensureRequire(src, fromDeployDir);
  }

  src = src.replace(
    /host:\s*['"]103\.124\.92\.238['"]/g,
    "host: (process.env.VPS_HOST || process.env.DEPLOY_SSH_HOST || '')"
  );

  if (src !== before) {
    fs.writeFileSync(filePath, src, 'utf8');
    return true;
  }
  return false;
}

let n = 0;
for (const name of fs.readdirSync(DEPLOY)) {
  if (!name.endsWith('.cjs') || name === '_vpsConnect.cjs') continue;
  const fp = path.join(DEPLOY, name);
  if (patchFile(fp, true)) {
    console.log('patched', name);
    n++;
  }
}

for (const name of ['run_on_vps.cjs', 'sync_vps.cjs']) {
  const fp = path.join(ROOT, name);
  if (!fs.existsSync(fp)) continue;
  if (patchFile(fp, false)) {
    console.log('patched root', name);
    n++;
  }
}

const rebuild = path.join(ROOT, 'rebuild_frontend.cjs');
if (fs.existsSync(rebuild)) {
  let src = fs.readFileSync(rebuild, 'utf8');
  if (!src.includes('_vpsConnect')) {
    const simple = [
      "const { getVpsSshConfig } = require('./deploy_scripts/_vpsConnect.cjs');",
      "const { NodeSSH } = require('node-ssh');",
      "const ssh = new NodeSSH();",
      "",
      "const VPS_DIR = process.env.VPS_APP_DIR || '/www/wwwroot/dashboard.giasutinhoc24h.com';",
      "",
      "async function run() {",
      "  await ssh.connect(getVpsSshConfig());",
      "",
      "  console.log('[1/3] Pulling latest vite.config.js...');",
      "  const pull = await ssh.execCommand(",
      "    `cd ${VPS_DIR} && wget -q -O /tmp/vite_config.js https://raw.githubusercontent.com/thangcomputer/QUANLYCMS/main/client/vite.config.js && cp /tmp/vite_config.js ${VPS_DIR}/client/vite.config.js`",
      "  );",
      "  if (pull.stderr) console.log('Pull stderr:', pull.stderr);",
      "  console.log('  vite.config.js updated');",
      "",
      "  console.log('[2/3] Building React frontend...');",
      "  const build = await ssh.execCommand(`cd ${VPS_DIR}/client && npm run build 2>&1`);",
      "  console.log((build.stdout + build.stderr).slice(-2000));",
      "",
      "  console.log('[3/3] Checking build result...');",
      "  const ls = await ssh.execCommand(`ls -la ${VPS_DIR}/client/dist/`);",
      "  console.log(ls.stdout);",
      "",
      "  process.exit(0);",
      "}",
      "",
      "run().catch((e) => {",
      "  console.error(e);",
      "  process.exit(1);",
      "});",
      "",
    ].join('\n');
    fs.writeFileSync(rebuild, simple, 'utf8');
    console.log('patched rebuild_frontend.cjs');
    n++;
  }
}

console.log('Total patched:', n);

const bad = [];
function scan(dir) {
  for (const name of fs.readdirSync(dir)) {
    const fp = path.join(dir, name);
    if (!fs.statSync(fp).isFile()) continue;
    if (!/\.(cjs|js)$/.test(name)) continue;
    const t = fs.readFileSync(fp, 'utf8');
    if (/password:\s*['"]YOUR_VPS_PASSWORD['"]/.test(t)) bad.push(fp + ' YOUR_VPS_PASSWORD');
    if (/password:\s*['"]O6iogp8j/.test(t)) bad.push(fp + ' leaked pw');
  }
}
scan(DEPLOY);
scan(ROOT);
if (bad.length) {
  console.log('REMAINING ISSUES:');
  bad.forEach((b) => console.log(' ', b));
  process.exit(1);
}
console.log('No hardcoded VPS passwords in connect configs.');