
class AuthApplicationService {
  async post_refresh1(data) {
  try {
    const { refreshToken } = data.body;
    if (!refreshToken) return res.status(400).json({ success: false, message: 'Thiếu refreshToken' }
  async post_check_role2(data) {
  try {
    const { identifier } = data.body;
    if (!identifier) return res.json({ success: true, data: null }
  async get_zalo_callback3(data) {
  const clientUrl = process.env.CLIENT_URL || '';
  try {
    if (!data.signedCookies.oauth_z || data.signedCookies.oauth_z !== data.query.state) {
      return res.redirect(`${clientUrl}/login?error=oauth_state`);
    }
    data._res.clearCookie('oauth_z', { path: '/' }
  async post_login4(data) {
  try {
    // Hỗ trợ cả 'identifier' (mới) lẫn 'phone' (cũ) để tương thích ngược
    const { identifier, phone: legacyPhone, password, role = 'teacher' } = data.body;
    const rawId = (identifier || legacyPhone || '').trim();

    if (!rawId || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu' }
  async post_login_public5(data) {
  try {
    const { identifier, password, role } = data.body;
    const rawId = (identifier || '').trim();
    if (!rawId || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tài khoản và mật khẩu' }
  async post_login_internal6(data) {
  try {
    const { identifier, password, captchaId, captchaAnswer, forceTicket } = data.body;
    const rawId = (identifier || '').trim();

    // Vé cấp sau khi đã qua CAPTCHA + mật khẩu ở lần gọi trước, dùng cho thao tác
    // "đăng nhập và đăng xuất máy kia" — CAPTCHA chỉ dùng được 1 lần nên không gửi lại được.
    let forceFromTicket = false;
    if (forceTicket) {
      try {
        const t = jwt.verify(forceTicket, process.env.JWT_SECRET);
        forceFromTicket = t.purpose === 'device_force' && t.identifier === rawId;
      } catch { /* vé hỏng/hết hạn → bắt nhập lại CAPTCHA */ }
    }

    // Bước 1: Xác thực CAPTCHA
    if (!forceFromTicket) {
      if (process.env.NODE_ENV === 'production') {
        const captchaResult = verifyCaptcha(captchaId, captchaAnswer);
        if (!captchaResult.ok) {
          return res.status(400).json({ success: false, message: captchaResult.reason, captchaError: true }
  async post_mfa_verify7(data) {
  try {
    const { mfaToken, code } = data.body || {};
    if (!mfaToken || !code) {
      return res.status(400).json({ success: false, message: 'Thiếu mfaToken hoặc mã OTP' }
  async post_mfa_setup8(data) {
  try {
    if (data.currentUser?.id !== 'admin' && !['admin', 'staff'].includes(data.currentUser?.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản nội bộ mới cấu hình được MFA' }
  async post_mfa_enable9(data) {
  try {
    if (data.currentUser?.id !== 'admin' && !['admin', 'staff'].includes(data.currentUser?.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản nội bộ mới cấu hình được MFA' }
  async post_mfa_disable10(data) {
  try {
    if (data.currentUser?.id !== 'admin' && !['admin', 'staff'].includes(data.currentUser?.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ tài khoản nội bộ mới cấu hình được MFA' }
  async get_mfa_status11(data) {
  if (data.currentUser?.id !== 'admin' && !['admin', 'staff'].includes(data.currentUser?.role)) {
    return res.status(403).json({ success: false, message: 'Chỉ tài khoản nội bộ mới cấu hình được MFA' }
  async post_logout12(data) {
  try {
    let userId = null;
    let role = null;
    let accessToken = null;
    let verifiedIdentity = false;

    const authHeader = data.headers.authorization || '';
    if (authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7);
      try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        if (decoded?.id) {
          userId = decoded.id;
          role = decoded.role;
          verifiedIdentity = true;
        }
      } catch {
        // Access token hết hạn: vẫn blacklist theo decode nhưng KHÔNG xóa session DB theo id giả
        try {
          const decoded = jwt.decode(accessToken);
          if (decoded?.id) {
            userId = decoded.id;
            role = decoded.role;
          }
        } catch { /* ignore */ }
      }
    }

    const bodyRefresh = data.body?.refreshToken;
    if (bodyRefresh) {
      try {
        const dec = jwt.verify(bodyRefresh, process.env.JWT_SECRET);
        if (dec?.id) {
          userId = String(dec.id);
          role = dec.role || role;
          verifiedIdentity = true;
        }
        const ttl = dec?.exp ? Math.max(1, dec.exp - Math.floor(Date.now() / 1000)) : 86400 * 30;
        await blacklist.add(bodyRefresh, ttl);
      } catch {
        // Refresh không hợp lệ: blacklist chuỗi thô, không tin id trong payload
        await blacklist.add(bodyRefresh, 86400);
      }
    }

    if (accessToken) {
      try {
        const decoded = jwt.decode(accessToken);
        if (decoded?.exp) {
          const remainingSeconds = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingSeconds > 0) await blacklist.add(accessToken, remainingSeconds);
        } else {
          await blacklist.add(accessToken, 28800);
        }
      } catch {
        await blacklist.add(accessToken, 28800);
      }
    }

    // Chỉ xóa refreshToken trong DB khi đã verify chữ ký JWT (tránh logout giả mạo)
    if (verifiedIdentity && userId && userId !== 'admin') {
      const unset = { $unset: { refreshToken: 1, deviceFingerprint: 1 } };
      const uid = String(userId);
      if (role === 'student') {
        await Student.findByIdAndUpdate(uid, unset);
      } else {
        await Teacher.findByIdAndUpdate(uid, unset);
      }
    }

    return res.status(200).json({ success: true, message: 'Đăng xuất thành công' }
  async post_register_teacher13(data) {
  try {
    const { name, phone, password, password2, specialty } = data.body;

    if (!name || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đầy đủ: Tên, Số điện thoại, Mật khẩu',
      }
  async post_change_password14(data) {
  try {
    const { oldPassword, newPassword } = data.body;
    const { id: userId, role } = data.currentUser;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mật khẩu mới' }
  async get_me15(data) {
  try {
    const decoded = data.decodedToken || data.currentUser; // Use original decoded JWT payload if available

    // Lấy thông tin mới nhất từ DB
    let user = null;

    if (decoded.id === 'admin') {
      // Hardcoded admin — lấy tên từ DB nếu đã đổi
      const sysSettings = await SystemSettings.findOne({ _key: 'main' }
  async post_avatar16(data) {
  try {
    const { avatar } = data.body || {};
    if (!avatar) return res.status(400).json({ success: false, message: 'Thiếu đường dẫn avatar' }
  async post_forgot_password_request17(data) {
  try {
    const { phone, role } = data.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Vui lòng nhập số điện thoại' }
  async post_forgot_password_verify18(data) {
  try {
    const { phone, otp, role } = data.body;
    if (!phone || !otp) return res.status(400).json({ success: false, message: 'Thiếu thông tin' }
  async post_admin_generate_otp19(data) {
  try {
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Không có quyền' }
  async post_reset_password_request20(data) {
  return res.status(410).json({ success: false, message: 'Phương thức này đã bị gỡ bỏ vì lý do bảo mật. Vui lòng dùng luồng Quên mật khẩu chính thức.' }
  async post_admin_reset_password21(data) {
  try {
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' }
  async put_admin_profile22(data) {
  try {
    if (data.currentUser.role !== 'admin' && data.currentUser.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Chỉ Admin/Nhân viên mới được thay đổi' }
}

module.exports = new AuthApplicationService();
