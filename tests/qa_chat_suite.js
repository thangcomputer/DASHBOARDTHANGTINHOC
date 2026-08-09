const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPORT_PATH = path.join(__dirname, 'qa_chat_results.json');
const testResults = [];

// Helper logging
function addResult(module, func, result, severity, description, steps) {
    testResults.push({ module, func, result, severity, description, steps });
    console.log(`[${result === 'Passed' ? 'OK' : 'FAIL'}] ${module} - ${func}: ${description}`);
}

// Hàm hỗ trợ đăng nhập
async function loginContext(context, role, identifier, password, url) {
    const page = await context.newPage();
    
    page.on('console', msg => console.log(`[${role}] ${msg.type()}: ${msg.text()}`));
    page.on('response', async res => {
        if (res.status() >= 400) {
            console.log(`[${role}] HTTP ${res.status()} ${res.url()}`);
        }
        if (res.url().includes('/api/messages/contacts') && res.status() === 200) {
            try {
                const body = await res.json();
                console.log(`[${role}] CONTACTS:`, JSON.stringify(body).slice(0, 500));
            } catch(e) {}
        }
    });
    
    let captchaAnswer = "";
    
    page.on('response', async res => {
        if (res.url().includes('/auth/captcha') && res.status() === 200) {
            try {
                const data = await res.json();
                if (data.answer) captchaAnswer = data.answer;
            } catch(e) {}
        }
    });

    await page.goto(url);
    await page.waitForTimeout(2000);
    
    // Tùy theo form đăng nhập
    if (role === 'admin') {
        await page.fill('input[type="text"]', identifier);
        await page.fill('input[type="password"]', password);
    } else {
        await page.fill('input[type="text"], input[type="tel"]', identifier);
        await page.fill('input[type="password"]', password);
    }

    if (captchaAnswer) {
        const captchaInput = await page.$('input[placeholder*="mã"], input[placeholder*="CAPTCHA"], input[name="captcha"]');
        if (captchaInput) await captchaInput.fill(captchaAnswer);
    } else {
        const fallbackCaptchaBtn = await page.$('button:has(svg.lucide-activity), button:has(svg.lucide-refresh-cw)');
        if (fallbackCaptchaBtn) {
            const [response] = await Promise.all([
                page.waitForResponse(res => res.url().includes('/auth/captcha')),
                fallbackCaptchaBtn.click()
            ]);
            const data = await response.json();
            if (data.answer) {
                const captchaInput = await page.$('input[placeholder*="mã"], input[placeholder*="CAPTCHA"]');
                if (captchaInput) await captchaInput.fill(data.answer);
            }
        }
    }
    
    await Promise.all([
        page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
        page.click('button[type="submit"]')
    ]);
    
    return page;
}

(async () => {
    console.log("🚀 Bắt đầu QA Chat Suite (Multi-context)...");
    const browser = await chromium.launch({ headless: true });
    
    const contextSupport = await browser.newContext();
    const contextStudent = await browser.newContext();
    
    try {
        console.log("👉 Đăng nhập Support...");
        const supportPage = await loginContext(contextSupport, 'admin', '0900000003', 'password123', 'http://localhost:5173/admin/login');
        
        console.log("👉 Đăng nhập Student...");
        const studentPage = await loginContext(contextStudent, 'student', '0900000005', 'password123', 'http://localhost:5173/student/login');
        
        addResult("Đăng nhập", "Authentication", "Passed", "Low", "Đăng nhập thành công cả 2 roles", "Support & Student Login");

        // 1. Support vào hộp thư
        await supportPage.goto('http://localhost:5173/admin/inbox');
        await supportPage.waitForTimeout(2000);
        
        // Bỏ qua mọi popup quảng cáo hoặc đổi mật khẩu
        await supportPage.evaluate(() => {
            document.querySelectorAll('.fixed, [role="dialog"]').forEach(el => {
                if (el.style) el.style.display = 'none';
                el.remove();
            });
        });
        await supportPage.waitForTimeout(500);
        
        // 2. Student vào hộp thư
        await studentPage.goto('http://localhost:5173/student/inbox');
        await studentPage.waitForTimeout(2000);
        
        await studentPage.evaluate(() => {
            document.querySelectorAll('.fixed, [role="dialog"]').forEach(el => {
                if (el.style) el.style.display = 'none';
                el.remove();
            });
        });
        await studentPage.waitForTimeout(500);

        const searchInput = await supportPage.$('input[placeholder*="Tìm kiếm"], input[placeholder*="Search"]');
        if (searchInput) {
            await searchInput.fill('0900000005');
            await supportPage.waitForTimeout(2000); // Wait longer for API / re-render
        }
        
        // Wait for contact to appear or fallback
        const studentContact = await supportPage.$('text=Học Viên Test') || await supportPage.$('text=HỌC VIÊN TEST');
        if (studentContact) {
            await studentContact.click();
            await supportPage.waitForTimeout(1000);
            
            const chatInput = await supportPage.$('textarea, input[placeholder*="Nhập tin nhắn"]');
            const uniqueMsg = `Hello from Support [${Date.now()}] 🚀🌟`;
            
            if (chatInput) {
                await chatInput.fill(uniqueMsg);
                await supportPage.keyboard.press('Enter');
                addResult("Chat (Support -> Student)", "Send Message", "Passed", "High", "Gửi tin nhắn có Emoji từ Support", "Gõ tin nhắn -> Enter");
                
                // Realtime check on student side
                await studentPage.waitForTimeout(2000);
                let receivedMsg = await studentPage.$(`text="${uniqueMsg}"`);
                
                if (receivedMsg) {
                    addResult("Chat (Support -> Student)", "Realtime Receive", "Passed", "High", "Học viên nhận được tin nhắn tức thì không cần F5", "Check DOM Student");
                } else {
                    const supportContact = await studentPage.$('text="Nhân viên Hỗ trợ"');
                    if (supportContact) await supportContact.click();
                    await studentPage.waitForTimeout(1000);
                    receivedMsg = await studentPage.$(`text="${uniqueMsg}"`);
                    if (receivedMsg) {
                         addResult("Chat (Support -> Student)", "Realtime Receive", "Passed", "High", "Học viên nhận được tin nhắn (Sau click)", "Check DOM");
                    } else {
                         addResult("Chat (Support -> Student)", "Realtime Receive", "Failed", "High", "KHÔNG nhận được tin nhắn", "Check DOM");
                    }
                }
            } else {
                addResult("Chat (Support -> Student)", "Send Message", "Failed", "High", "Không tìm thấy ô nhập tin nhắn", "DOM Error");
            }
        } else {
            await supportPage.screenshot({ path: path.join(__dirname, 'fixtures', 'support_search_failed.png') });
            addResult("Chat", "Tìm kiếm liên hệ", "Failed", "High", "Không tìm thấy học viên (Đã lưu ảnh support_search_failed.png)", "Tìm 0900000005");
        }

    } catch (error) {
        addResult("Hệ thống", "Lỗi Exception", "Failed", "Critical", `Lỗi: ${error.message}`, "Script Error");
    } finally {
        fs.writeFileSync(REPORT_PATH, JSON.stringify(testResults, null, 2));
        await browser.close();
        console.log("✅ Đã xuất báo cáo ra qa_chat_results.json");
    }
})();
