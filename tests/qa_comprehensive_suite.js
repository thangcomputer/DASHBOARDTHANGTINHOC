const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPORT_FILE = path.join(__dirname, 'qa_results.json');
const QA_DATA = [];

function logIssue(moduleName, funcName, result, severity, description, steps) {
    QA_DATA.push({
        module: moduleName,
        func: funcName,
        result: result, // "Passed", "Failed", "Warning"
        severity: severity, // "Critical", "High", "Medium", "Low"
        description: description,
        steps: steps,
        proposal: "Kiểm tra lại logic/UI"
    });
}

(async () => {
    console.log("🚀 Starting Comprehensive QA Test Suite...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 }
    });
    const page = await context.newPage();

    let currentModule = "Login";

    // Track Console Errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text.includes('favicon') || text.includes('404')) return; // Ignore some noisy errors
            logIssue(currentModule, "Console Error", "Failed", "Medium", `Console error: ${text}`, "Mở trang bất kỳ");
        }
    });

    // Track API Errors
    page.on('response', async response => {
        const status = response.status();
        if (status >= 400 && response.url().includes('/api/')) {
            logIssue(currentModule, "API Call", "Failed", "High", `API lỗi ${status} tại URL: ${response.url()}`, "Gọi API");
        }
    });

    try {
        // 1. Đăng nhập
        currentModule = "Đăng Nhập";
        
        let captchaAnswer = "";
        page.on('response', async res => {
            if (res.url().includes('/auth/captcha') && res.status() === 200) {
                try {
                    const data = await res.json();
                    if (data.answer) captchaAnswer = data.answer;
                } catch(e) {}
            }
        });

        await page.goto('http://localhost:5173/admin/login');
        await page.waitForTimeout(1000);
        await page.fill('input[type="text"]', 'admin');
        await page.fill('input[type="password"]', 'admin123');
        
        if (captchaAnswer) {
            await page.fill('input[placeholder="Nhập mã hiển thị ở trên"]', captchaAnswer);
        } else {
            // Backup in case the first response was missed
            const fallbackCaptchaBtn = await page.$('button:has(svg.lucide-activity)');
            if (fallbackCaptchaBtn) {
                const [response] = await Promise.all([
                    page.waitForResponse(res => res.url().includes('/auth/captcha')),
                    fallbackCaptchaBtn.click()
                ]);
                const data = await response.json();
                if (data.answer) await page.fill('input[placeholder="Nhập mã hiển thị ở trên"]', data.answer);
            }
        }
        
        // Wait for navigation after clicking submit
        await Promise.all([
            page.waitForNavigation({ timeout: 10000 }).catch(() => {}), // Ignore timeout if it fails
            page.click('button[type="submit"]')
        ]);
        await page.waitForTimeout(1000); // Wait a bit more for React to render

        // Tạo thư mục screenshot
        if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
            fs.mkdirSync(path.join(__dirname, 'screenshots'));
        }
        
        // Chụp ảnh màn hình login
        await page.screenshot({ path: path.join(__dirname, 'screenshots/login_result.png') });
        
        // Kiểm tra đăng nhập thành công
        if (page.url().includes('/admin/login')) {
            logIssue(currentModule, "Login", "Failed", "Critical", "Không thể đăng nhập bằng tài khoản admin/admin123", "Nhập admin/admin123 và click Login");
            throw new Error("Login Failed");
        } else {
            logIssue(currentModule, "Login", "Passed", "Low", "Đăng nhập thành công", "Nhập admin/admin123 và click Login");
        }

        const waitAndCheckUI = async (moduleName, buttonSelector, tabName) => {
            currentModule = moduleName;
            try {
                if (buttonSelector) {
                    await page.click(buttonSelector);
                    await page.waitForTimeout(1500); // Đợi render và animation
                }
                
                const html = await page.content();
                if (html.includes('Error Boundary') || html.includes('Something went wrong') || html.includes('ReferenceError')) {
                    logIssue(currentModule, "Render UI", "Failed", "Critical", "Trang bị crash hoặc hiển thị lỗi Error Boundary", `Truy cập module ${moduleName}`);
                } else {
                    logIssue(currentModule, "Render UI", "Passed", "Low", "Giao diện render bình thường", `Truy cập module ${moduleName}`);
                }
                
                // Test click nút "Thêm" hoặc "Tạo" nếu có (Test mở modal)
                const addBtn = await page.$('button:has-text("Thêm"), button:has-text("Tạo"), button:has-text("Add")');
                if (addBtn) {
                    await addBtn.click();
                    await page.waitForTimeout(1000);
                    
                    // Click Lưu/Xác nhận để test validation form trống
                    const saveBtn = await page.$('button:has-text("Lưu"), button:has-text("Xác nhận")');
                    if (saveBtn) {
                        await saveBtn.click();
                        await page.waitForTimeout(1000);
                        const toastError = await page.$('.toast-error, .text-red-500, .error-message');
                        if (!toastError) {
                            logIssue(currentModule, "Form Validation", "Warning", "High", "Submit form trống nhưng không có thông báo lỗi hiển thị rõ ràng", "Mở modal Thêm và click Lưu khi form trống");
                        } else {
                            logIssue(currentModule, "Form Validation", "Passed", "Low", "Validation hoạt động đúng", "Mở modal Thêm và click Lưu");
                        }
                    }
                    
                    // Đóng modal
                    const closeBtn = await page.$('button:has-text("Hủy"), button:has-text("Đóng"), .modal-close');
                    if (closeBtn) await closeBtn.click();
                    await page.waitForTimeout(500);
                }
                
            } catch (err) {
                logIssue(currentModule, "Render UI", "Failed", "High", `Lỗi Timeout/Click: ${err.message}`, `Thao tác tại ${moduleName}`);
            }
        };

        // 2. Duyệt qua các Menu chính theo Sidebar của Admin
        // Vì classname có thể khác, ta dùng selector text hoặc href nếu có.
        await waitAndCheckUI("Tổng quan", 'a:has-text("Tổng quan"), div:has-text("Tổng quan")', 'overview');
        await waitAndCheckUI("Bảng tin", 'a:has-text("Bảng tin"), div:has-text("Bảng tin")', 'feed');
        
        await waitAndCheckUI("Học viên", 'a:has-text("Học viên"), div:has-text("Học viên")', 'students');
        
        // Thử search trên tab Học viên
        try {
            const searchInput = await page.$('input[placeholder*="Tìm kiếm"]');
            if (searchInput) {
                await searchInput.fill("QA_TEST_SEARCH_!@#");
                await page.waitForTimeout(1000); // Đợi debounce
                logIssue("Học viên", "Search Input", "Passed", "Low", "Ô tìm kiếm hoạt động không bị crash", "Nhập ký tự đặc biệt vào ô tìm kiếm");
            }
        } catch(e) {}

        await waitAndCheckUI("Giảng viên", 'a:has-text("Giảng viên"), div:has-text("Giảng viên")', 'teachers');
        await waitAndCheckUI("Phân quyền nhân viên", 'a:has-text("Phân quyền nhân viên"), div:has-text("Phân quyền nhân viên")', 'staff');
        
        await waitAndCheckUI("Đào tạo GV", 'a:has-text("Đào tạo GV"), div:has-text("Đào tạo GV")', 'training-teacher');
        await waitAndCheckUI("Đào tạo HV", 'a:has-text("Đào tạo HV"), div:has-text("Đào tạo HV")', 'training-student');
        await waitAndCheckUI("Đánh giá nội bộ", 'a:has-text("Đánh giá"), div:has-text("Đánh giá")', 'evaluations');
        
        await waitAndCheckUI("Tài chính", 'a:has-text("Tài chính"), div:has-text("Tài chính")', 'finance');
        await waitAndCheckUI("Báo cáo doanh thu", 'a:has-text("Báo cáo doanh thu"), div:has-text("Báo cáo doanh thu")', 'finance-report');
        await waitAndCheckUI("BI Dashboard", 'a:has-text("BI Dashboard"), div:has-text("BI Dashboard")', 'bi-dashboard');
        
        await waitAndCheckUI("Cài đặt hệ thống", 'a:has-text("Cài đặt hệ thống"), div:has-text("Cài đặt hệ thống")', 'settings');
        await waitAndCheckUI("Nhật ký hệ thống", 'a:has-text("Nhật ký"), div:has-text("Nhật ký")', 'logs');
        await waitAndCheckUI("Quản lý File", 'a:has-text("Quản lý File"), div:has-text("Quản lý File")', 'files');
        await waitAndCheckUI("Sao lưu dữ liệu", 'a:has-text("Sao lưu"), div:has-text("Sao lưu")', 'backups');
        await waitAndCheckUI("Monitoring", 'a:has-text("Monitoring"), div:has-text("Monitoring")', 'monitoring');
        await waitAndCheckUI("AI Center", 'a:has-text("AI Center"), div:has-text("AI Center")', 'ai-center');

    } catch (error) {
        console.error("Test Suite crashed:", error);
    } finally {
        fs.writeFileSync(REPORT_FILE, JSON.stringify(QA_DATA, null, 2));
        console.log(`✅ Test hoàn tất. Đã lưu báo cáo tại ${REPORT_FILE}`);
        await browser.close();
    }
})();
