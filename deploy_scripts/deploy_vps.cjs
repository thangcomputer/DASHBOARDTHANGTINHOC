const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');



async function deploy() {
  try {
    console.log('🔗 Connecting to VPS...');
    await ssh.connect(getVpsSshConfig());
    
    const projectPath = '/www/wwwroot/dashboardthangtinhoc';
    const repoUrl = 'https://github.com/thangcomputer/dashboardthangtinhoc.git';

    console.log('🗑️ Cleaning and Cloning...');
    const tempPath = '/tmp/dashboardthangtinhoc_clone_temp';
    await ssh.execCommand(`rm -rf ${tempPath}`);
    const cloneRes = await ssh.execCommand(`git clone ${repoUrl} ${tempPath}`);
    if (cloneRes.stderr) console.log('Git Clone Log:', cloneRes.stderr);
    
    console.log('🚚 Creating project path and moving files...');
    await ssh.execCommand(`mkdir -p ${projectPath}`);
    // Clear old files
    await ssh.execCommand(`rm -rf ${projectPath}/* ${projectPath}/.[!.]* || true`);
    
    // Move files to project path
    await ssh.execCommand(`cp -r ${tempPath}/* ${projectPath}/`);
    await ssh.execCommand(`cp -r ${tempPath}/.[!.]* ${projectPath}/ || true`);

    console.log('🔑 Setting up .env from process.env (no hardcoded secrets)...');
    const jwtSecret = process.env.JWT_SECRET;
    const jwtRefresh = process.env.JWT_REFRESH_SECRET;
    if (!jwtSecret || !jwtRefresh || jwtSecret.length < 32 || jwtRefresh.length < 32) {
      throw new Error('Thiếu JWT_SECRET / JWT_REFRESH_SECRET (>=32 ký tự). Từ chối ghi secret mặc định.');
    }
    const envContent = `PORT=5000
MONGODB_URI=${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc'}
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefresh}
JWT_EXPIRES_IN=8h
NODE_ENV=production
CLIENT_URL=${process.env.CLIENT_URL || 'https://dashboard.thangtinhoc.edu.vn'}
GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'}
GOOGLE_CLIENT_SECRET=${process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET'}
GOOGLE_CALLBACK_URL=${process.env.GOOGLE_CALLBACK_URL || 'https://dashboard.thangtinhoc.edu.vn/api/auth/google/callback'}
ZALO_APP_ID=${process.env.ZALO_APP_ID || 'YOUR_ZALO_APP_ID'}
ZALO_APP_SECRET=${process.env.ZALO_APP_SECRET || 'YOUR_ZALO_APP_SECRET'}
ZALO_CALLBACK_URL=${process.env.ZALO_CALLBACK_URL || 'https://dashboard.thangtinhoc.edu.vn/api/auth/zalo/callback'}
BANK_ID=${process.env.BANK_ID || 'YOUR_BANK_ID'}
ACCOUNT_NO=${process.env.ACCOUNT_NO || 'YOUR_ACCOUNT_NO'}
ACCOUNT_NAME=${process.env.ACCOUNT_NAME || 'YOUR_ACCOUNT_NAME'}`;

    await ssh.execCommand(`cat > ${projectPath}/.env << 'EOF'
${envContent}
EOF`);

    console.log('⚙️ Installing backend dependencies...');
    const backendRes = await ssh.execCommand('npm install --production', { cwd: projectPath });
    console.log(backendRes.stdout || backendRes.stderr);

    console.log('⚙️ Installing client dependencies and building...');
    const clientRes = await ssh.execCommand('npm install', { cwd: `${projectPath}/client` });
    console.log(clientRes.stdout || clientRes.stderr);
    
    const buildRes = await ssh.execCommand('npm run build', { cwd: `${projectPath}/client` });
    console.log(buildRes.stdout || buildRes.stderr);

    console.log('♻️ Restarting application with PM2...');
    await ssh.execCommand('pm2 stop dashboardthangtinhoc || true', { cwd: projectPath });
    await ssh.execCommand('pm2 delete dashboardthangtinhoc || true', { cwd: projectPath });
    await ssh.execCommand('pm2 start server.js --name "dashboardthangtinhoc"', { cwd: projectPath });
    await ssh.execCommand('pm2 save', { cwd: projectPath });

    console.log('✅ DEPLOYMENT COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Error during deployment:', err);
  } finally {
    process.exit(0);
  }
}

deploy();
