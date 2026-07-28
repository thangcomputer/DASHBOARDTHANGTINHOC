const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');

async function fix() {
  await ssh.connect(getVpsSshConfig());

  // 1. Kill any process on port 5000
  console.log('=== 1. KILL PORT 5000 PROCESSES ===');
  const kill = await ssh.execCommand('pm2 delete dashboardthangtinhoc 2>/dev/null; fuser -k 5000/tcp 2>/dev/null; sleep 1; echo "Done killing port 5000"');
  console.log(kill.stdout || kill.stderr);

  // 2. Fix .env file — KHÔNG ghi secrets cứng vào repo/script.
  // Chỉ tạo stub; secrets thật lấy từ env máy chạy script hoặc .env sẵn có trên VPS.
  console.log('\n=== 2. FIX .ENV FILE (non-secret stubs only) ===');
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefresh = process.env.JWT_REFRESH_SECRET;
  if (!jwtSecret || !jwtRefresh || jwtSecret.length < 32 || jwtRefresh.length < 32) {
    throw new Error('Thiếu JWT_SECRET / JWT_REFRESH_SECRET (>=32 ký tự) trên môi trường chạy script. Không ghi secret mặc định.');
  }
  const envContent = `PORT=5000
MONGODB_URI=${process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc'}
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefresh}
JWT_EXPIRES_IN=8h
NODE_ENV=production

# ── Client URL ──────────────────────────────────────────────────────────────
CLIENT_URL=${process.env.CLIENT_URL || 'https://dashboard.thangtinhoc.edu.vn'}

# ── Google OAuth 2.0 ─
GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID'}
GOOGLE_CLIENT_SECRET=${process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET'}
GOOGLE_CALLBACK_URL=${process.env.GOOGLE_CALLBACK_URL || 'https://dashboard.thangtinhoc.edu.vn/api/auth/google/callback'}

# ── Gemini API ─
GEMINI_API_KEY=${process.env.GEMINI_API_KEY || 'YOUR_GEMINI_API_KEY'}

# ── Zalo OAuth ─
ZALO_APP_ID=${process.env.ZALO_APP_ID || 'YOUR_ZALO_APP_ID'}
ZALO_APP_SECRET=${process.env.ZALO_APP_SECRET || 'YOUR_ZALO_APP_SECRET'}
ZALO_CALLBACK_URL=${process.env.ZALO_CALLBACK_URL || 'https://dashboard.thangtinhoc.edu.vn/api/auth/zalo/callback'}

# ── Thông tin ngân hàng (không hardcode số TK) ─
BANK_ID=${process.env.BANK_ID || 'YOUR_BANK_ID'}
ACCOUNT_NO=${process.env.ACCOUNT_NO || 'YOUR_ACCOUNT_NO'}
ACCOUNT_NAME=${process.env.ACCOUNT_NAME || 'YOUR_ACCOUNT_NAME'}
`;

  const writeEnv = await ssh.execCommand(`cat > /www/wwwroot/dashboardthangtinhoc/.env << 'ENVEOF'
${envContent}
ENVEOF`);
  console.log(writeEnv.stdout || writeEnv.stderr || 'ENV file written successfully');

  // 3. Verify .env
  console.log('\n=== 3. VERIFY .ENV ===');
  const verify = await ssh.execCommand('cat /www/wwwroot/dashboardthangtinhoc/.env');
  console.log(verify.stdout);

  // 4. Check MongoDB is running
  console.log('\n=== 4. CHECK MONGODB ===');
  const mongo = await ssh.execCommand('mongosh --eval "db.adminCommand({ping:1})" 2>/dev/null || mongosh --eval "db.runCommand({ping:1})" 2>/dev/null || echo "Checking mongod..." && systemctl status mongod --no-pager -l 2>/dev/null | head -5');
  console.log(mongo.stdout || mongo.stderr);

  // 5. Start dashboardthangtinhoc with PM2
  console.log('\n=== 5. START dashboardthangtinhoc ===');
  const start = await ssh.execCommand('cd /www/wwwroot/dashboardthangtinhoc && NODE_ENV=production pm2 start server.js --name dashboardthangtinhoc');
  console.log(start.stdout || start.stderr);

  // 6. Wait and check
  await new Promise(r => setTimeout(r, 5000));

  console.log('\n=== 6. PM2 STATUS ===');
  const status = await ssh.execCommand('pm2 list');
  console.log(status.stdout);

  console.log('\n=== 7. PM2 LOGS ===');
  const logs = await ssh.execCommand('pm2 logs dashboardthangtinhoc --lines 15 --nostream');
  console.log(logs.stdout || logs.stderr);

  console.log('\n=== 8. PORT 5000 CHECK ===');
  const port = await ssh.execCommand('ss -tlnp | grep 5000');
  console.log(port.stdout || '(Port 5000 still not listening)');

  // 9. Save PM2 config so it survives reboot
  console.log('\n=== 9. SAVE PM2 ===');
  const save = await ssh.execCommand('pm2 save');
  console.log(save.stdout || save.stderr);

  process.exit(0);
}
fix();
