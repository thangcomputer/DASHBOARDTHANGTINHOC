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
  console.log('🚀 Bắt đầu QA UI Testing cho Teacher Portal...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Đăng nhập
    await page.goto(`${FRONTEND_URL}/login`);
    
    // Đăng nhập bằng Teacher A (GV Chính)
    await page.click('button[role="tab"]:has-text("Giảng viên")');
    await page.fill('input[type="text"], input[name="identifier"], input[placeholder*="SĐT"]', testData.teacherA.phone);
    await page.fill('input[type="password"]', testData.teacherA.password);
    await page.click('button[type="submit"]');
    
    try {
      await page.waitForURL('**/teacher**', { timeout: 5000 });
    } catch (e) {
      await page.screenshot({ path: 'teacher_login_failed.png' });
      const currentUrl = page.url();
      const bodyText = await page.textContent('body');
      console.log('Current URL:', currentUrl);
      console.log('Body snippet:', bodyText.slice(0, 500));
      throw new Error(`Timeout waiting for /teacher. Current URL: ${currentUrl}`);
    }
    
    if (page.url().includes('/teacher')) {
      addResult('Auth', 'Login UI', 'Passed', 'High', 'Đăng nhập UI thành công vào Teacher Portal');
    } else {
      throw new Error('Không thể chuyển hướng đến /teacher');
    }

    // 2. Kiểm tra Học viên (Students) - UI
    await page.goto(`${FRONTEND_URL}/teacher#students`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const studentText = (await page.textContent('body')).toLowerCase();
    
    if (studentText.includes('học viên của gv chính') && !studentText.includes('học viên của gv khác')) {
      addResult('Students', 'Read UI', 'Passed', 'High', 'Teacher chỉ nhìn thấy Học viên của mình trên UI');
    } else {
      addResult('Students', 'Read UI', 'Failed', 'Critical', 'Teacher nhìn thấy sai dữ liệu học viên (hoặc không thấy ai, hoặc thấy của người khác)');
    }

    // 3. Kiểm tra bảo mật (Cố truy cập Admin)
    await page.goto(`${FRONTEND_URL}/admin`);
    await page.waitForTimeout(2000);
    
    const currentUrl = page.url();
    if (currentUrl.includes('/admin/login') || currentUrl.includes('/login') || currentUrl.includes('/teacher')) {
      addResult('Security', 'Admin Access UI', 'Passed', 'High', 'Teacher bị chặn khi cố truy cập trang Admin');
    } else {
      addResult('Security', 'Admin Access UI', 'Failed', 'Critical', 'Teacher truy cập được trang Admin: ' + currentUrl);
    }
    
    // 4. Kiểm tra Lịch dạy
    await page.goto(`${FRONTEND_URL}/teacher#schedule`);
    await page.reload();
    await page.waitForTimeout(2000);
    const scheduleText = (await page.textContent('body')).toLowerCase();
    if (scheduleText.includes('lịch dạy')) {
       addResult('Schedule', 'View UI', 'Passed', 'Medium', 'Truy cập tab Lịch dạy thành công');
    } else {
       addResult('Schedule', 'View UI', 'Failed', 'Medium', 'Không tải được tab Lịch dạy');
    }

    // 5. Kiểm tra Hồ sơ
    await page.goto(`${FRONTEND_URL}/teacher#profile`);
    await page.reload();
    await page.waitForTimeout(2000);
    const profileText = (await page.textContent('body')).toLowerCase();
    if (profileText.includes('giảng viên qa chính') || profileText.includes('0888888001')) {
       addResult('Profile', 'View UI', 'Passed', 'Medium', 'Tải hồ sơ Teacher thành công');
    } else {
       addResult('Profile', 'View UI', 'Failed', 'Medium', 'Lỗi hiển thị hồ sơ');
    }

  } catch (error) {
    console.error('❌ UI Test Exception:', error);
    addResult('System', 'Exception', 'Failed', 'Critical', error.message);
  } finally {
    console.log('\n--- KẾT QUẢ UI TEST (Teacher Portal) ---');
    console.table(testResults);
    fs.writeFileSync(path.join(__dirname, 'qa_teacher_ui_results.json'), JSON.stringify(testResults, null, 2));
    await browser.close();
  }
})();
