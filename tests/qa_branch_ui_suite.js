const { chromium } = require('playwright');
const axios = require('axios');
require('dotenv').config();

const API_URL = 'http://localhost:5000';
const FRONTEND_URL = 'http://localhost:5173';

const testData = {
  adminStaffA: { phone: '0999999001', password: '123456' },
};

let testResults = [];

function addResult(moduleName, func, result, severity, desc) {
  testResults.push({ module: moduleName, func, result, severity, description: desc });
  console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${moduleName} - ${func}: ${desc}`);
}

(async () => {
  console.log('🚀 Bắt đầu QA UI Testing cho Branch Admin...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Đăng nhập
    await page.goto(`${FRONTEND_URL}/admin/login`);
    
    // Lấy CAPTCHA
    const captchaRes = await axios.get(`${API_URL}/api/auth/captcha`);
    const { answer } = captchaRes.data;

    await page.fill('#admin-username', testData.adminStaffA.phone);
    await page.fill('#admin-password', testData.adminStaffA.password);
    await page.fill('input[placeholder="Nhập mã hiển thị ở trên"]', answer);
    
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin', { timeout: 10000 });
    
    const url = page.url();
    if (url.includes('/admin')) {
      addResult('Auth', 'Login UI', 'Passed', 'High', 'Đăng nhập UI thành công');
    } else {
      throw new Error('Không thể chuyển hướng đến /admin');
    }

    // 2. Kiểm tra Học viên (Students) - UI
    await page.goto(`${FRONTEND_URL}/admin#students`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // give it more time
    
    const studentText = await page.textContent('body');
    // Bỏ qua lỗi hoa/thường bằng cách chuyển về lowercase
    const lowerStudentText = studentText.toLowerCase();
    if (lowerStudentText.includes('student branch a') && !lowerStudentText.includes('student branch b')) {
      addResult('Students', 'Read UI', 'Passed', 'High', 'UI chỉ hiển thị học viên nhánh A');
    } else {
      addResult('Students', 'Read UI', 'Failed', 'Critical', 'UI hiển thị sai dữ liệu học viên (thấy Branch B hoặc không thấy Branch A)');
    }

    // 3. Kiểm tra Nhân viên (Teachers) - UI
    await page.goto(`${FRONTEND_URL}/admin#teachers`);
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const teacherText = await page.textContent('body');
    const lowerTeacherText = teacherText.toLowerCase();
    if (lowerTeacherText.includes('teacher branch a') && !lowerTeacherText.includes('teacher branch b')) {
      addResult('Employees', 'Read UI', 'Passed', 'High', 'UI chỉ hiển thị nhân viên nhánh A');
    } else {
      addResult('Employees', 'Read UI', 'Failed', 'Critical', 'UI hiển thị sai dữ liệu nhân viên (thấy Branch B hoặc không thấy Branch A)');
    }
    
    // 4. Thử truy cập Config (Cài đặt) - Phải bị chặn hoặc không hiển thị
    await page.goto(`${FRONTEND_URL}/admin#settings`);
    await page.waitForTimeout(2000); // Wait for redirect or error
    const settingsUrl = page.url();
    if (settingsUrl.includes('#settings')) {
       const hasError = await page.locator('text=Không có quyền truy cập').isVisible() || await page.locator('text=Từ chối').isVisible();
       if (hasError) {
         addResult('Settings', 'Access UI', 'Passed', 'Medium', 'Bị chặn quyền truy cập Cài đặt hệ thống');
       } else {
         addResult('Settings', 'Access UI', 'Failed', 'High', 'Vẫn vào được trang cài đặt mà không bị chặn lỗi UI');
       }
    } else {
       addResult('Settings', 'Access UI', 'Passed', 'Medium', 'Đã bị chuyển hướng khỏi Cài đặt hệ thống');
    }

  } catch (err) {
    addResult('System', 'UI Test Execution', 'Failed', 'Critical', err.message);
  } finally {
    await browser.close();
    console.log('\n--- KẾT QUẢ UI TEST ---');
    console.table(testResults);
  }
})();
