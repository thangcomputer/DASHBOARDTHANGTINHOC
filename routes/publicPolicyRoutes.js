'use strict';

const crypto = require('crypto');
const express = require('express');
const NotificationService = require('../services/NotificationService');
const SystemLog = require('../models/SystemLog');
const logger = require('../config/logger');
const { issueCsrfToken, COOKIE_NAME } = require('../middleware/csrf');
const { sensitiveFlowLimiter } = require('../middleware/authRateLimit');

const router = express.Router();

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setHtmlCsp(res, nonce) {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `style-src 'nonce-${nonce}'`,
      `script-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src 'self' data:",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
}

function renderPolicyPage({ title, updatedAt = '19/11/2026', bodyHtml, scriptHtml = '' }) {
  const nonce = crypto.randomBytes(16).toString('base64');
  return {
    nonce,
    html: `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} - Thắng Tin Học</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F8FAFC; color: #0F172A; line-height: 1.65; }
    .wrap { max-width: 820px; margin: 0 auto; padding: 32px 18px 64px; }
    .card { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 18px; padding: 28px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05); }
    .brand { display: inline-block; font-size: 13px; font-weight: 800; color: #059669; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
    h1 { margin: 0 0 8px; font-size: 26px; line-height: 1.25; }
    .meta { color: #64748B; font-size: 13px; margin-bottom: 24px; }
    h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; color: #0F172A; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; }
    .nav { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 14px; }
    .nav a { color: #059669; font-weight: 700; text-decoration: none; }
    .field { margin-bottom: 14px; }
    label { display: block; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
    input, select, textarea { width: 100%; border: 1px solid #CBD5E1; border-radius: 10px; padding: 10px 12px; font: inherit; background: #F8FAFC; }
    button { border: 0; border-radius: 10px; background: #DC2626; color: #FFFFFF; font: inherit; font-weight: 800; padding: 12px 18px; cursor: pointer; }
    .status { margin-top: 14px; font-size: 14px; font-weight: 700; }
    .warn { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 12px 14px; border-radius: 12px; font-size: 14px; margin: 16px 0; }
  </style>
</head>
<body>
  <main class="wrap">
    <article class="card">
      <div class="brand">Thắng Tin Học LMS</div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">Cập nhật lần cuối: ${escapeHtml(updatedAt)}</div>
      ${bodyHtml}
      <nav class="nav" aria-label="Tài liệu pháp lý">
        <a href="/privacy-policy">Chính sách quyền riêng tư</a>
        <a href="/terms-of-service">Điều khoản sử dụng</a>
        <a href="/delete-account">Xóa tài khoản</a>
      </nav>
    </article>
  </main>
  ${scriptHtml ? `<script nonce="${nonce}">${scriptHtml}</script>` : ''}
</body>
</html>`,
  };
}

router.get('/privacy-policy', (req, res) => {
  const { nonce, html } = renderPolicyPage({
    title: 'Chính sách quyền riêng tư',
    bodyHtml: `
      <p>Ứng dụng <strong>Thắng Tin Học</strong> thu thập và xử lý dữ liệu cần thiết để cung cấp dịch vụ đào tạo trực tuyến và quản lý học tập.</p>
      <h2>1. Dữ liệu chúng tôi thu thập</h2>
      <ul>
        <li><strong>Thông tin tài khoản:</strong> họ tên, số điện thoại, email (nếu có), ảnh đại diện, vai trò (Học viên hoặc Giảng viên).</li>
        <li><strong>Dữ liệu học tập:</strong> lịch học, trạng thái điểm danh, bài tập, điểm số, tiến độ khóa học và điểm XP luyện tập.</li>
        <li><strong>Liên lạc & tệp đính kèm:</strong> tin nhắn trao đổi 1-1/nhóm, hình ảnh và tài liệu bài tập do bạn chủ động tải lên.</li>
        <li><strong>Thiết bị & thông báo:</strong> mã phiên đăng nhập an toàn, định danh thiết bị nhận thông báo đẩy (APNs/FCM thông qua Expo Push) khi bạn đồng ý bật thông báo.</li>
      </ul>
      <h2>2. Quyền thiết bị sử dụng</h2>
      <ul>
        <li><strong>Micro:</strong> chỉ dùng khi bạn chủ động tham gia gọi thoại WebRTC trong ứng dụng.</li>
        <li><strong>Ảnh & Camera:</strong> chỉ dùng khi bạn chọn đổi ảnh đại diện, gửi ảnh trong chat hoặc nộp bài tập.</li>
        <li><strong>Face ID / Sinh trắc học:</strong> tùy chọn đăng nhập nhanh lưu cục bộ trong vùng bảo mật Keychain/Keystore của thiết bị.</li>
        <li><strong>Thông báo đẩy:</strong> chỉ yêu cầu khi bạn bấm bật thông báo hoặc quản lý thông báo.</li>
      </ul>
      <h2>3. Lưu giữ và xóa dữ liệu</h2>
      <p>Bạn có thể xóa tài khoản ngay trong ứng dụng tại mục <strong>Hồ sơ → Xóa tài khoản vĩnh viễn</strong> hoặc gửi yêu cầu tại <a href="/delete-account">/delete-account</a>. Khi tài khoản bị xóa, hồ sơ cá nhân, tin nhắn trực tiếp, lịch học liên kết và token thiết bị sẽ bị xóa/vô hiệu hóa; chứng từ hóa đơn tài chính hợp pháp được lưu giữ tách biệt theo quy định kế toán hiện hành.</p>
      <h2>4. Liên hệ hỗ trợ bảo mật</h2>
      <p>Mọi thắc mắc về quyền riêng tư vui lòng liên hệ quản trị viên trung tâm Thắng Tin Học.</p>
    `,
  });
  setHtmlCsp(res, nonce);
  res.type('html').send(html);
});

router.get('/terms-of-service', (req, res) => {
  const { nonce, html } = renderPolicyPage({
    title: 'Điều khoản sử dụng',
    bodyHtml: `
      <p>Khi sử dụng ứng dụng web và di động <strong>Thắng Tin Học</strong>, bạn đồng ý tuân thủ các quy định sau:</p>
      <h2>1. Tài khoản và bảo mật</h2>
      <ul>
        <li>Người dùng chịu trách nhiệm bảo mật mật khẩu và mã PIN cá nhân.</li>
        <li>Không chia sẻ tài khoản cho bên thứ ba ngoài phạm vi chính sách thiết bị của trung tâm.</li>
      </ul>
      <h2>2. Nội dung người dùng & quy tắc ứng xử</h2>
      <ul>
        <li>Nghiêm cấm gửi nội dung quấy rối, lừa đảo, vi phạm pháp luật hoặc phản cảm trong tin nhắn và bảng tin.</li>
        <li>Người dùng có thể báo cáo tin nhắn/bài đăng vi phạm hoặc chặn người dùng ngay trong ứng dụng; quản trị viên có quyền xử lý và khóa tài khoản vi phạm.</li>
      </ul>
      <h2>3. Thanh toán và hoàn tiền</h2>
      <p>Các khóa học số, gói thuê bao hoặc dịch vụ đào tạo tuân thủ quy định thanh toán của Apple App Store, Google Play và quy chế học phí công khai của Trung tâm Thắng Tin Học.</p>
    `,
  });
  setHtmlCsp(res, nonce);
  res.type('html').send(html);
});

router.get('/delete-account', (req, res) => {
  const csrfToken = issueCsrfToken(res, req.cookies?.[COOKIE_NAME]);
  const { nonce, html } = renderPolicyPage({
    title: 'Xóa tài khoản Thắng Tin Học',
    bodyHtml: `
      <p>Bạn có hai cách để xóa tài khoản vĩnh viễn:</p>
      <ul>
        <li><strong>Cách 1 (Xóa tức thì trong ứng dụng):</strong> Mở ứng dụng Thắng Tin Học → đăng nhập → vào tab <strong>Hồ sơ</strong> → chọn <strong>Xóa tài khoản vĩnh viễn</strong> → nhập mật khẩu xác nhận.</li>
        <li><strong>Cách 2 (Gửi yêu cầu trên web khi đã gỡ ứng dụng):</strong> Điền biểu mẫu bên dưới để bộ phận hỗ trợ xác minh và hoàn tất xóa tài khoản trong vòng 7 ngày làm việc.</li>
      </ul>
      <div class="warn">
        <strong>Phạm vi dữ liệu được xóa vs lưu giữ:</strong> Hồ sơ cá nhân, ảnh đại diện, phiên đăng nhập, token thông báo đẩy, tin nhắn 1-1 và lịch dạy/học gắn với tài khoản sẽ bị xóa. Hóa đơn/sổ cái thanh toán được giữ lại tối thiểu theo quy định pháp luật về kế toán và được tách khỏi định danh đăng nhập.
      </div>
      <form id="del-form">
        <div class="field">
          <label for="role">Loại tài khoản</label>
          <select id="role" name="role">
            <option value="student">Học viên</option>
            <option value="teacher">Giảng viên</option>
          </select>
        </div>
        <div class="field">
          <label for="contact">Số điện thoại hoặc Email đăng ký</label>
          <input id="contact" name="contact" type="text" required placeholder="Ví dụ: 09xxxxxxxx hoặc email@domain.com" />
        </div>
        <div class="field">
          <label for="reason">Lý do (tùy chọn)</label>
          <textarea id="reason" name="reason" rows="3" placeholder="Ghi chú hỗ trợ xóa tài khoản..."></textarea>
        </div>
        <button type="submit">Gửi yêu cầu xóa tài khoản</button>
        <div id="status" class="status" role="status" aria-live="polite"></div>
      </form>
    `,
    scriptHtml: `
      (function () {
        var form = document.getElementById('del-form');
        var status = document.getElementById('status');
        var csrfToken = ${JSON.stringify(csrfToken)};
        if (!form) return;
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          status.textContent = 'Đang gửi yêu cầu...';
          status.style.color = '#0F172A';
          fetch('/api/public/account-deletion-request', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify({
              role: document.getElementById('role').value,
              contact: document.getElementById('contact').value,
              reason: document.getElementById('reason').value
            })
          })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            status.textContent = data.message || 'Đã ghi nhận yêu cầu.';
            status.style.color = data.success ? '#047857' : '#DC2626';
            if (data.success) form.reset();
          })
          .catch(function () {
            status.textContent = 'Không gửi được yêu cầu. Vui lòng thử lại sau.';
            status.style.color = '#DC2626';
          });
        });
      })();
    `,
  });
  setHtmlCsp(res, nonce);
  res.type('html').send(html);
});

router.post('/api/public/account-deletion-request', sensitiveFlowLimiter, async (req, res) => {
  try {
    const role = String(req.body?.role || 'student').trim().toLowerCase();
    const contact = String(req.body?.contact || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 500);
    if (!['student', 'teacher'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Loại tài khoản không hợp lệ.' });
    }
    if (!contact || contact.length < 5 || contact.length > 160) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại hoặc email hợp lệ.' });
    }

    const requestId = crypto.randomUUID();
    const maskedContact = contact.length > 4 ? `${contact.slice(0, 2)}***${contact.slice(-2)}` : '***';

    await SystemLog.create({
      user_id: 'public_deletion_form',
      name: maskedContact,
      role,
      action: 'ACCOUNT_DELETION_WEB_REQUEST',
      category: 'security',
      target: role,
      message: `Yêu cầu xóa tài khoản từ web (${requestId})`,
      method: 'POST',
      ip: req.ip || 'unknown',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    }).catch(() => {});

    const io = req.app?.get?.('io');
    await NotificationService.notifyAdmins(
      io,
      'Yêu cầu xóa tài khoản qua Web',
      `Có yêu cầu xóa tài khoản (${role === 'teacher' ? 'Giảng viên' : 'Học viên'}) cho liên hệ ${maskedContact}. Mã yêu cầu: ${requestId}${reason ? `. Ghi chú: ${reason}` : ''}`,
      { kind: 'account_deletion_request', requestId, role },
      '/admin',
    ).catch((err) => {
      logger.warn('[PUBLIC_POLICY] notifyAdmins failed:', err.message);
    });

    return res.status(202).json({
      success: true,
      requestId,
      message: 'Nếu thông tin liên hệ khớp với tài khoản đã đăng ký, quản trị viên sẽ xử lý xóa dữ liệu trong vòng 7 ngày làm việc.',
    });
  } catch (error) {
    logger.error('[PUBLIC_POLICY] account-deletion-request error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tiếp nhận yêu cầu lúc này.' });
  }
});

module.exports = router;
