const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const { getVpsSshConfig, getVpsConnection } = require('./_vpsConnect.cjs');



async function run(cmd, label) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🔍 ${label}`);
  console.log('═'.repeat(60));
  const r = await ssh.execCommand(cmd);
  const out = (r.stdout || '') + (r.stderr ? `\n[STDERR]: ${r.stderr}` : '');
  console.log(out.trim() || '(no output)');
  return r.stdout;
}

async function diagnose() {
  console.log('🚀 Kết nối VPS 103.124.92.238 ...');
  await ssh.connect(getVpsSshConfig());
  console.log('✅ Đã kết nối!\n');

  // ── 1. KIỂM TRA GIT ────────────────────────────────────────
  await run(
    'cd /www/wwwroot/quanlycms && git status 2>&1',
    '1. GIT STATUS (working tree có gì không?)'
  );

  await run(
    'cd /www/wwwroot/quanlycms && git log --oneline -5 2>&1',
    '2. GIT LOG - 5 commit gần nhất trên VPS'
  );

  await run(
    'cd /www/wwwroot/quanlycms && git remote -v 2>&1',
    '3. GIT REMOTE (origin trỏ đúng GitHub chưa?)'
  );

  await run(
    'cd /www/wwwroot/quanlycms && git fetch origin 2>&1 && git log --oneline origin/main -5 2>&1',
    '4. GIT FETCH - so sánh với origin/main (có bị behind không?)'
  );

  await run(
    'cd /www/wwwroot/quanlycms && git pull origin main 2>&1',
    '5. GIT PULL origin main'
  );

  // ── 2. KIỂM TRA MONGODB ────────────────────────────────────
  await run(
    'systemctl status mongod 2>&1 | head -30',
    '6. MONGODB STATUS (systemctl)'
  );

  await run(
    'mongod --version 2>&1',
    '7. MONGODB VERSION (đã cài chưa?)'
  );

  await run(
    'mongo --eval "db.adminCommand({ping: 1})" 2>&1 || mongosh --eval "db.adminCommand({ping: 1})" 2>&1',
    '8. MONGODB PING (có kết nối được không?)'
  );

  await run(
    'ss -tlnp | grep 27017 || netstat -tlnp | grep 27017',
    '9. MONGODB PORT 27017 (có lắng nghe không?)'
  );

  // ── 3. KIỂM TRA PM2 ────────────────────────────────────────
  await run(
    'pm2 list 2>&1',
    '10. PM2 LIST (process nào đang chạy?)'
  );

  await run(
    'pm2 logs quanlycms --lines 30 --nostream 2>&1',
    '11. PM2 LOGS quanlycms (30 dòng cuối)'
  );

  // ── 4. KIỂM TRA .ENV TRÊN VPS ─────────────────────────────
  await run(
    'cat /www/wwwroot/quanlycms/.env 2>&1',
    '12. FILE .ENV trên VPS'
  );

  // ── 5. KIỂM TRA APACHE ────────────────────────────────────
  await run(
    '/etc/init.d/httpd status 2>&1 | head -10',
    '13. APACHE STATUS'
  );

  // ── 6. KIỂM TRA PORT 5000 ─────────────────────────────────
  await run(
    'ss -tlnp | grep 5000 || netstat -tlnp | grep 5000',
    '14. PORT 5000 (backend Node.js có chạy không?)'
  );

  // ── 7. CURL TEST ───────────────────────────────────────────
  await run(
    'curl -sk -o /dev/null -w "HTTP code: %{http_code}" https://dashboard.giasutinhoc24h.com/api/health 2>&1 || curl -sk -o /dev/null -w "HTTP code: %{http_code}" http://127.0.0.1:5000/api/health 2>&1',
    '15. TEST API /api/health'
  );

  console.log('\n' + '═'.repeat(60));
  console.log('✅ CHẨN ĐOÁN HOÀN TẤT');
  console.log('═'.repeat(60));

  ssh.dispose();
  process.exit(0);
}

diagnose().catch(err => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
