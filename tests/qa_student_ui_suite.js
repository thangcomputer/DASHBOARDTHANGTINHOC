const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const FRONTEND_URL = 'http://localhost:5173';
const dataPath = path.join(__dirname, 'qa_teacher_data.json');
let testData;
try {
  testData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Không tìm thấy qa_teacher_data.json');
  process.exit(1);
}

const testResults = [];

function addResult(moduleName, func, result, severity, desc) {
  testResults.push({ module: moduleName, func, result, severity, description: desc });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${moduleName} - ${func}: ${desc}`);
}

(async () => {
  console.log('🚀 Bắt đầu QA UI Testing cho Student Portal...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Đăng nhập
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Đăng nhập bằng Student A
    // Vai trò mặc định là Học viên, nhưng cứ click để chắc chắn
    await page.click('button[role="tab"]:has-text("Học viên")');
    await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="SĐT"]', testData.studentA.phone);
    await page.fill('input[type="password"]', testData.studentA.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/student**', { timeout: 10000 });
      addResult('Auth', 'Login UI', 'Passed', 'High', 'Đăng nhập UI thành công vào Student Portal');
    } catch (e) {
      await page.screenshot({ path: 'student_login_failed.png' });
      throw new Error(`Timeout waiting for /student. Current URL: ${page.url()}`);
    }

    // 2. Kiểm tra giao diện Lịch học
    await page.goto(`${FRONTEND_URL}/student#schedule`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const scheduleText = (await page.textContent('body')).toLowerCase();
    if (scheduleText.includes('lịch học') || scheduleText.includes('thời khóa biểu')) {
      addResult('Schedule', 'Read UI', 'Passed', 'High', 'Học viên xem được lịch học thành công');
    } else {
      addResult('Schedule', 'Read UI', 'Failed', 'High', 'Không tìm thấy text lịch học/thời khóa biểu trên UI');
    }

    // 3. Kiểm tra bảo mật (Cố truy cập Admin/Teacher)
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForTimeout(2000);
    let currentUrl = page.url();
    if (!currentUrl.includes('/admin') || currentUrl.includes('/login')) {
      addResult('Security', 'Admin Access UI', 'Passed', 'High', 'Student bị chặn khi cố truy cập trang Admin');
    } else {
      addResult('Security', 'Admin Access UI', 'Failed', 'Critical', 'Student truy cập được trang Admin: ' + currentUrl);
    }
    
    await page.goto(`${FRONTEND_URL}/teacher`);
    await page.waitForTimeout(2000);
    currentUrl = page.url();
    if (!currentUrl.includes('/teacher') || currentUrl.includes('/student') || currentUrl.includes('/login')) {
      addResult('Security', 'Teacher Access UI', 'Passed', 'High', 'Student bị chặn khi cố truy cập trang Teacher');
    } else {
      addResult('Security', 'Teacher Access UI', 'Failed', 'Critical', 'Student truy cập được trang Teacher: ' + currentUrl);
    }
    
    // 4. Kiểm tra Tài liệu (Materials)
    await page.goto(`${FRONTEND_URL}/student#materials`);
    await page.reload();
    await page.waitForTimeout(2000);
    const materialText = (await page.textContent('body')).toLowerCase();
    if (materialText.includes('tài liệu') || materialText.includes('bài tập')) {
       addResult('Materials', 'View UI', 'Passed', 'Medium', 'Truy cập tab Tài liệu thành công');
    } else {
       addResult('Materials', 'View UI', 'Failed', 'Medium', 'Không tải được tab Tài liệu');
    }

    // 5. Kiểm tra Hồ sơ
    await page.goto(`${FRONTEND_URL}/student#profile`);
    await page.reload();
    await page.waitForTimeout(2000);
    const profileText = (await page.textContent('body')).toLowerCase();
    if (profileText.includes('học viên của gv chính') || profileText.includes('0777777001')) {
       addResult('Profile', 'View UI', 'Passed', 'Medium', 'Tải hồ sơ Student thành công');
    } else {
       addResult('Profile', 'View UI', 'Failed', 'Medium', 'Lỗi hiển thị hồ sơ');
    }

  } catch (error) {
    console.error('❌ UI Test Exception:', error);
    addResult('System', 'Exception', 'Failed', 'Critical', error.message);
  } finally {
    console.log('\n--- KẾT QUẢ UI TEST (Student Portal) ---');
    console.table(testResults);
    fs.writeFileSync(path.join(__dirname, 'qa_student_ui_results.json'), JSON.stringify(testResults, null, 2));
    await browser.close();
  }
})();
