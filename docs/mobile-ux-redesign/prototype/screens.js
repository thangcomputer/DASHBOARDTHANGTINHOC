// Clean Lucide-compatible inline SVG icons for razor-sharp 390x844 phone mockups
const ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  learn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>`,
  user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>`,
  spark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1"/><path d="m9 14 2 2 4-4"/></svg>`,
};

window.SCREEN_CATALOG = [
  { id: 'login', title: '1. Đăng nhập & Phân luồng', role: 'chung', tab: 'home', topTitle: 'Thắng Tin Học' },
  { id: 'student-home', title: '2. Trang chủ Học viên', role: 'student', tab: 'home', topTitle: 'Trang chủ' },
  { id: 'student-video', title: '3. Video bài giảng & Mốc Quiz', role: 'student', tab: 'learn', topTitle: 'Bài giảng Video' },
  { id: 'student-practice', title: '4. Luyện tập Lộ trình & XP', role: 'student', tab: 'learn', topTitle: 'Lộ trình Excel' },
  { id: 'student-social', title: '5. BXH, Nhiệm vụ & Chứng nhận', role: 'student', tab: 'profile', topTitle: 'Thành tích & BXH' },
  { id: 'student-packages', title: '6. Gói học, Nâng cấp & VietQR', role: 'student', tab: 'profile', topTitle: 'Gói học & Thanh toán' },
  { id: 'student-inbox', title: '7. Trao đổi, Thông báo & AI', role: 'student', tab: 'chat', topTitle: 'Trao đổi & Hỗ trợ' },
  { id: 'student-profile', title: '8. Hồ sơ, Học phí & Bảo mật', role: 'student', tab: 'profile', topTitle: 'Tài khoản của tôi' },
  { id: 'teacher-home', title: '9. Trang chủ & Lịch dạy GV', role: 'teacher', tab: 'home', topTitle: 'Không gian Giảng viên' },
  { id: 'teacher-grading', title: '10. Chấm bài & Thu nhập GV', role: 'teacher', tab: 'grade', topTitle: 'Chấm bài & Thu nhập' },
];

window.VARIANT_META = {
  A: {
    name: 'Phương án A · Tối giản Chuyên nghiệp',
    tag: 'Minimal Academic EdTech',
    tagBg: '#0f766e',
    summary: 'Ưu tiên mật độ thông tin rõ nét, bảng màu Slate/Teal phẳng, thẻ 12px viền mảnh, loại bỏ hiệu ứng thừa giúp học nhanh và thao tác quản trị siêu tốc.',
  },
  B: {
    name: 'Phương án B · Sinh động Game hóa',
    tag: 'Vibrant DewSkill Gamification',
    tagBg: '#d97706',
    summary: 'Nổi bật linh vật Bé Đậu, nút 3D xúc giác, thanh streak/XP rực rỡ, hiệu ứng rương thưởng và màu ấm tạo động lực tự học hằng ngày mạnh mẽ.',
  },
  C: {
    name: 'Phương án C · Chuyên nghiệp + Game hóa (Khuyên dùng)',
    tag: 'Hybrid Pro Office + DewSkill',
    tagBg: '#059669',
    summary: 'Nghiêm túc & chuẩn mực Office ở Lịch học/Thanh toán/Giảng viên, kết hợp vi-thưởng XP/Streak tinh tế ở Video & Luyện tập — đúng bản sắc Thắng Tin Học.',
  },
};

window.SCREEN_RATIONALE = {
  'login': {
    keep: ['Chọn nhanh vai trò Học viên / Giảng viên ở ngay phía trên', 'Hỗ trợ đăng nhập SĐT hoặc Gmail, hiện/ẩn mật khẩu'],
    redesign: ['Chuyển nền tối nặng khối thành nền sáng tin học hiện đại (PA A/C) hoặc thân thiện linh vật (PA B)', 'Mở rộng trường nhập không bị cắt placeholder "ten@gmail.c"', 'Gộp Quên mật khẩu & Liên hệ kỹ thuật gọn gàng'],
    benefit: 'Tăng tỷ lệ hoàn tất đăng nhập lần đầu, tạo thiện cảm thương hiệu trung tâm Tin học chuyên nghiệp ngay giây đầu tiên.',
  },
  'student-home': {
    keep: ['Block "Học tiếp 1 chạm"', 'Hiển thị tiến độ giờ học hôm nay và lịch học hôm nay'],
    redesign: ['Giảm 7 tab dưới xuống 5 tab chuẩn di động; đưa Trợ lý AI lên góc phải header (xóa nút nổi che nút CTA)', 'Gộp Hero + Giờ học hôm nay thành 1 thẻ trạng thái thông minh', 'Thu gọn Lịch hôm nay khi trống thành 1 dòng nhắc + CTA chọn lịch'],
    benefit: 'Học viên thấy ngay 1 mục tiêu hành động rõ nhất; không còn 4 thẻ trùng đích nhảy sang DailyPractice.',
  },
  'student-video': {
    keep: ['Video tương tác bắt buộc trả lời đúng các mốc câu hỏi', 'Chế độ ôn lại và gợi ý câu hỏi'],
    redesign: ['Tách câu hỏi mốc video ra Bottom-Sheet/Card dưới khung video 16:9 (sửa lỗi bị cắt lựa chọn trên màn dọc)', 'Gom 5 tab lọc khóa học dư thừa thành 2 tab rõ ràng: "Của tôi" & "Khám phá"', 'Hiển thị thanh thời lượng xem + danh sách buổi dễ chạm'],
    benefit: 'Xem video & trả lời trắc nghiệm mượt mà bằng 1 tay trên điện thoại, không còn cuộn/che nút.',
  },
  'student-practice': {
    keep: ['Cây lộ trình chặng kèm rương thưởng', 'Ôn tập ngắt quãng (Spaced Review) & Test-out vượt chặng'],
    redesign: ['Đưa Ôn tập hôm nay & Mục tiêu lên đầu màn Luyện tập (không giấu ở tab phụ)', 'Bỏ hộp đếm ngược 3s cưỡng bức; sửa chữ Rương đúng XP thực (30/50 XP)', 'Bật lại màn Review câu sai ngay sau khi xong bài'],
    benefit: 'Nhịp luyện liên tục không ngắt quãng, tăng ghi nhớ kiến thức Office thực tế.',
  },
  'student-social': {
    keep: ['Bảng xếp hạng tuần toàn trung tâm', 'Nhiệm vụ ngày, Mã giới thiệu, Chứng nhận số có QR'],
    redesign: ['Hợp nhất BXH + Nhiệm vụ + Huy hiệu + Chứng nhận QR trong Hub Thành tích rõ tầng', 'Sửa Podium Top 3 trực quan, thêm bộ lọc "Tuần này / Khóa của tôi"', 'Mở Chứng nhận QR cho cả Học viên trả phí & Free Portal đủ điều kiện'],
    benefit: 'Kích thích thi đua lành mạnh và chia sẻ chứng nhận trung tâm tự nhiên.',
  },
  'student-packages': {
    keep: ['Thanh toán VietQR quét mã tự động kiểm tra giao dịch', 'Nhập mã kích hoạt thẻ học & gia hạn gói 1m-Trọn đời'],
    redesign: ['Thống nhất luồng mở khóa FreePortal (xóa mâu thuẫn "mua gói Meet" vs "nạp XP")', 'Dùng chung 1 màn Gói học & VietQR Sheet (bỏ 3 modal tự code trùng nhau)', 'Bảng quyền lợi so sánh trực quan Free vs Pro vs Khóa Video lẻ'],
    benefit: 'Tăng tỷ lệ chuyển đổi học viên Free -> Pro nhờ bảng giá minh bạch & ít bước cản.',
  },
  'student-inbox': {
    keep: ['Trò chuyện trực tiếp Giảng viên, Học vụ & Nhóm lớp', 'Trợ lý AI Tin học kèm nút chuyển nhân viên hỗ trợ', 'Phân loại thông báo theo tab'],
    redesign: ['Gộp Tin nhắn + Nhóm lớp + Bảng tin vào tab "Trao đổi"', 'Ẩn nhãn "offline" gây hiểu nhầm trên danh bạ; không tự liệt kê chính mình', 'Hiển thị tên ngữ cảnh đúng vai trò ("Lịch học" cho HV thay vì "Lịch dạy")'],
    benefit: 'Giao tiếp liền mạch, phản hồi tức thì, hết tình trạng nút nổi "Hỗ trợ" che mất giờ nhắn & badge chưa đọc.',
  },
  'student-profile': {
    keep: ['Đổi ảnh đại diện, Đổi mật khẩu, Khóa PIN nhanh', 'Xem danh sách khóa đã đăng ký, học phí & lịch sử gia hạn'],
    redesign: ['Sửa lỗi Gói khóa học hiển thị nhầm "1420/150 XP" -> tách thẻ Thời hạn gói & Ví XP', 'Thống nhất Drawer sáng đồng bộ theme và chuyển nút "Đăng xuất" sang màu Đỏ cuối trang', 'Gộp Hồ sơ · Học phí · Điểm số thi vào 3 sub-tab gọn gàng'],
    benefit: 'Minh bạch thông tin tài chính/thời hạn học, không còn nhầm lẫn đăng xuất với nút hành động chính.',
  },
  'teacher-home': {
    keep: ['Cảnh báo "Việc cần xử lý" (Bài chờ chấm, Lịch chờ xác nhận)', 'Danh sách lớp dạy trong ngày & nút vào Meet'],
    redesign: ['Thay thế bảng tuần cuộn ngang 620px (cắt tên & chỉ thấy T2-T4) bằng Timeline/Agenda theo từng ngày trên 390px', 'Ghim "Hàng đợi việc cần làm" trên đỉnh Trang chủ Giảng viên', 'Thao tác 1 chạm: "Điểm danh nhanh" / "Vào Meet" ngay trên thẻ buổi'],
    benefit: 'Giảng viên quản lý lịch dạy & điểm danh ngoài giờ bằng 1 tay không phải phóng to thu nhỏ.',
  },
  'teacher-grading': {
    keep: ['Biểu đồ thu nhập theo tháng & chi tiết hoa hồng từng buổi', 'Bộ lọc bài tập cần chấm / đã chấm & tạo đề AI'],
    redesign: ['Tách giao diện chấm bài thành Sheet chấm điểm trượt lên (thay vì scrollToEnd cuối trang)', 'Gộp Bài tập về nhà & Trắc nghiệm trong tab "Lớp & Chấm" sạch 2 tầng', 'Thu gọn thẻ Tổng thu nhập & Biểu đồ cột so sánh nhiều tháng rõ ràng'],
    benefit: 'Rút ngắn 50% thời gian chấm bài trên điện thoại và tăng độ tin cậy minh bạch thu nhập giảng viên.',
  },
};

function renderBottomNav(role, activeTab, v) {
  const studentTabs = [
    { id: 'home', label: 'Trang chủ', icon: ICONS.home },
    { id: 'learn', label: 'Học tập', icon: ICONS.learn },
    { id: 'schedule', label: 'Lịch học', icon: ICONS.cal, dot: true },
    { id: 'chat', label: 'Trao đổi', icon: ICONS.chat, dot: true },
    { id: 'profile', label: 'Tôi', icon: ICONS.user },
  ];
  const teacherTabs = [
    { id: 'home', label: 'Tổng quan', icon: ICONS.home },
    { id: 'schedule', label: 'Lịch dạy', icon: ICONS.cal },
    { id: 'grade', label: 'Lớp & Chấm', icon: ICONS.clipboard, dot: true },
    { id: 'chat', label: 'Trao đổi', icon: ICONS.chat },
    { id: 'profile', label: 'Thu nhập', icon: ICONS.wallet },
  ];
  const tabs = role === 'teacher' ? teacherTabs : studentTabs;
  return `
    <div class="bottom-nav">
      ${tabs.map((t) => `
        <button class="nav-tab ${t.id === activeTab ? 'active' : ''}" data-nav="${t.id}">
          ${t.dot ? '<span class="nav-dot"></span>' : ''}
          ${t.icon}
          <span>${t.label}</span>
        </button>
      `).join('')}
    </div>
  `;
}

function renderTopBar(title, v, drawerOpen = false) {
  return `
    <div class="app-topbar">
      <button class="top-icon-btn" id="btn-drawer" title="Menu tiện ích">${ICONS.menu}</button>
      <div class="top-brand-title">
        <div class="top-logo-dot">T</div>
        <span class="top-title-text">${title}</span>
      </div>
      <button class="top-ai-chip" id="btn-ai" title="Trợ lý AI Tin học">${ICONS.spark}<span>AI</span></button>
      <button class="top-icon-btn" title="Tìm kiếm">${ICONS.search}</button>
      <button class="top-icon-btn" title="Thông báo">${ICONS.bell}<span class="top-badge">2</span></button>
    </div>
    ${drawerOpen ? `
      <div class="drawer-overlay" id="drawer-backdrop">
        <div class="drawer-panel">
          <div class="row gap-10" style="padding-bottom:10px;border-bottom:1px solid var(--line);">
            <div class="avatar" style="background:var(--brand-soft);color:var(--brand-dark);">MA</div>
            <div class="col">
              <span class="bold txt-md">Nguyễn Minh Anh</span>
              <span class="txt-xs muted">HV-02481 · Gói Pro (42 ngày)</span>
            </div>
          </div>
          <span class="txt-xs bold muted" style="margin-top:4px;">TIỆN ÍCH MỞ RỘNG (ĐÃ LỌC TRÙNG TAB)</span>
          <div class="col gap-6">
            <div class="card row between" style="padding:9px 11px;"><span class="txt-sm bold">Ôn thi Chứng chỉ MOS/IC3</span><span class="pill brand">Mới</span></div>
            <div class="card row between" style="padding:9px 11px;"><span class="txt-sm bold">Trung tâm & Phần mềm học</span><span class="muted">›</span></div>
            <div class="card row between" style="padding:9px 11px;"><span class="txt-sm bold">Tin tức & Mẹo văn phòng</span><span class="muted">›</span></div>
            <div class="card row between" style="padding:9px 11px;"><span class="txt-sm bold">Khóa PIN & Âm thanh</span><span class="pill">Bật</span></div>
          </div>
          <div style="margin-top:auto;">
            <button class="btn btn-full" style="background:var(--danger-soft);color:var(--danger);border:1px solid #fecaca;">Đăng xuất tài khoản</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}

function renderScreenBody(screenId, v, state) {
  const isB = v === 'B';
  const isA = v === 'A';
  switch (screenId) {
    case 'login': {
      const heroBg = isB
        ? 'background:linear-gradient(135deg,#10b981,#059669);color:#fff;'
        : isA
          ? 'background:#ffffff;border-bottom:1px solid #e2e8f0;color:#0f172a;'
          : 'background:linear-gradient(135deg,#ecfdf5,#d1fae5);color:#065f46;border-bottom:1px solid #a7f3d0;';
      return `
        <div style="flex:1;display:flex;flex-direction:column;background:var(--bg);overflow-y:auto;">
          <div style="padding:26px 18px 20px;${heroBg}">
            <div class="row gap-10">
              <div style="width:46px;height:46px;border-radius:14px;background:${isB ? '#fff' : '#059669'};color:${isB ? '#059669' : '#fff'};display:grid;place-items:center;font-weight:900;font-size:20px;box-shadow:0 6px 16px rgba(0,0,0,0.08);">T</div>
              <div class="col">
                <span class="xbold" style="font-size:16px;">THẮNG TIN HỌC</span>
                <span class="txt-xs" style="opacity:0.85;">Nền tảng Tin học văn phòng & MOS thực chiến</span>
              </div>
              ${isB ? '<span style="margin-left:auto;font-size:28px;">🥑</span>' : ''}
            </div>
            <h2 style="margin:18px 0 4px;font-size:21px;font-weight:800;">Đăng nhập tài khoản</h2>
            <p style="margin:0;font-size:13px;opacity:0.85;">Đồng bộ lộ trình video, luyện tập XP và lịch kèm 1-1.</p>
          </div>

          <div style="padding:16px 16px 20px;display:flex;flex-direction:column;gap:13px;flex:1;">
            <div class="seg-tabs" data-interactive="login-role">
              <button class="seg-tab ${state.loginRole !== 'teacher' ? 'active' : ''}" data-action="loginRole" data-val="student">🎓 Học viên</button>
              <button class="seg-tab ${state.loginRole === 'teacher' ? 'active' : ''}" data-action="loginRole" data-val="teacher">👨‍🏫 Giảng viên</button>
            </div>

            <div class="card col gap-10" style="padding:15px;">
              <div class="col gap-6">
                <label class="txt-xs bold muted">Số điện thoại hoặc Gmail</label>
                <div style="padding:11px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--bg);font-size:13.5px;color:var(--ink);">
                  ${state.loginRole === 'teacher' ? 'lananh.gv@thangtinhoc.vn' : '0901 234 567'}
                </div>
              </div>
              <div class="col gap-6">
                <div class="row between">
                  <label class="txt-xs bold muted">Mật khẩu</label>
                  <span class="link-txt txt-xs">Quên mật khẩu?</span>
                </div>
                <div class="row between" style="padding:11px 12px;border-radius:10px;border:1.5px solid var(--line);background:var(--bg);font-size:13.5px;">
                  <span>••••••••••</span>
                  <span class="txt-xs muted bold">Hiện</span>
                </div>
              </div>
              <button class="btn btn-primary btn-full" style="padding:12px;margin-top:4px;">Đăng nhập ngay</button>
            </div>

            <div class="card row between" style="padding:11px 13px;border-style:dashed;">
              <div class="col">
                <span class="txt-sm bold">Chưa có tài khoản học?</span>
                <span class="txt-xs muted">Trải nghiệm thử lộ trình Excel/Word miễn phí</span>
              </div>
              <button class="btn btn-soft btn-sm">Dùng thử</button>
            </div>

            <div style="margin-top:auto;text-align:center;padding-top:6px;">
              <span class="txt-xs muted">Đăng ký tin học văn phòng 1 kèm 1</span>
              <span class="link-txt txt-xs">Chat Zalo Admin (093 5758 462)</span>
            </div>
          </div>
        </div>
      `;
    }

    case 'student-home': {
      return `
        <div class="card hero-soft col gap-8" style="padding:14px;">
          <div class="row between">
            <div class="col">
              <span class="txt-xs" style="opacity:0.85;">Chào buổi sáng · Thứ Ba 17/11</span>
              <span class="xbold txt-lg" style="margin-top:2px;">Nguyễn Minh Anh</span>
            </div>
            <div class="row gap-6">
              <span class="pill ${isA ? 'gold' : 'dark'}">🔥 9 ngày</span>
              <span class="pill ${isA ? 'brand' : 'dark'}">⚡ 1.420 XP</span>
            </div>
          </div>
          <div class="col gap-6" style="margin-top:2px;">
            <div class="row between txt-xs" style="opacity:0.95;">
              <span>Mục tiêu hôm nay: <b>28 / 60 phút</b></span>
              <span class="bold">47%</span>
            </div>
            <div class="prog-track" style="${isA ? '' : 'background:rgba(255,255,255,0.24);'}">
              <div class="prog-fill" style="width:47%;${isA ? '' : 'background:#fde68a;'}"></div>
            </div>
          </div>
        </div>

        <div class="card ${isB ? 'accent-green' : ''} col gap-8">
          <div class="row between">
            <span class="pill excel">📊 Microsoft Excel · Chặng 2</span>
            <span class="txt-xs muted bold">Còn 2 câu · +15 XP</span>
          </div>
          <div class="col">
            <span class="bold txt-md">Hàm điều kiện IF & SUMIFS báo cáo</span>
            <span class="txt-xs muted" style="margin-top:2px;">Luyện tập thực chiến · Mức Trung bình</span>
          </div>
          <button class="btn btn-primary btn-full">${isB ? '🎮 ' : ''}Tiếp tục học ngay →</button>
        </div>

        <div class="section-hdr">
          <h3>Việc cần làm hôm nay</h3>
          <span class="pill brand">2 mục ưu tiên</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:9px;">
          <div class="card col gap-6" style="padding:11px;">
            <span class="pill gold" style="width:fit-content;">⏰ Hôm nay 18:30</span>
            <span class="bold txt-sm">Buổi 8: PivotTable</span>
            <span class="txt-xs muted">ThS. Trần Lan Anh</span>
            <button class="btn btn-soft btn-sm btn-full" style="margin-top:auto;">Vào Meet</button>
          </div>
          <div class="card col gap-6" style="padding:11px;">
            <span class="pill blue" style="width:fit-content;">🔁 Ôn tập XP</span>
            <span class="bold txt-sm">4 thẻ đến hạn ôn</span>
            <span class="txt-xs muted">Thưởng +25 XP</span>
            <button class="btn btn-outline btn-sm btn-full" style="margin-top:auto;">Ôn nhanh 2'</button>
          </div>
        </div>

        <div class="section-hdr">
          <h3>Khóa học của bạn</h3>
          <span class="link-txt">Xem tất cả ›</span>
        </div>
        <div class="card row between gap-10">
          <div class="avatar" style="background:#dcfce7;color:#166534;">XLS</div>
          <div class="col" style="flex:1;min-width:0;">
            <span class="bold txt-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Excel Văn phòng Thực chiến (K12)</span>
            <span class="txt-xs muted">Đã xong 8/16 buổi · 50%</span>
            <div class="prog-track" style="height:5px;margin-top:5px;"><div class="prog-fill" style="width:50%;"></div></div>
          </div>
          <button class="btn btn-outline btn-sm">Mở</button>
        </div>
      `;
    }

    case 'student-video': {
      const choiceIdx = state.quizChoice ?? 1;
      return `
        <div class="seg-tabs">
          <button class="seg-tab active">Bài học hiện tại</button>
          <button class="seg-tab">Mục lục (16 buổi)</button>
          <button class="seg-tab">Tài liệu (.xlsx)</button>
        </div>

        <div class="video-player-box">
          <div class="video-stage">
            <div class="row between">
              <span class="pill dark">Buổi 4 · Video HD</span>
              <span class="pill gold">1/2 mốc câu hỏi</span>
            </div>
            <div style="text-align:center;">
              <div style="font-size:13px;font-weight:700;">Hàm VLOOKUP tra cứu bảng giá nhiều điều kiện</div>
              <div style="font-size:11px;opacity:0.75;margin-top:3px;">Tạm dừng tại 03:04 để kiểm tra mức hiểu bài</div>
            </div>
            <div class="col gap-6">
              <div class="prog-track" style="height:5px;background:rgba(255,255,255,0.2);">
                <div class="prog-fill" style="width:42%;background:#34d399;"></div>
              </div>
              <div class="row between txt-xs" style="opacity:0.85;">
                <span>03:04 / 07:15</span>
                <span>Tốc độ 1.25x · Toàn màn hình ⛶</span>
              </div>
            </div>
          </div>
        </div>

        <div class="video-quiz-sheet col gap-8">
          <div class="row between">
            <span class="pill brand">🎯 Câu hỏi tương tác mốc 03:04</span>
            <span class="pill gold">+5 XP · Gợi ý -5 XP</span>
          </div>
          <div class="bold txt-sm" style="line-height:1.4;">
            Trong hàm <code style="background:var(--surface-soft);padding:1px 5px;border-radius:4px;">=VLOOKUP(A2, $D$2:$F$10, 3, 0)</code>, tham số cuối cùng <b>0 (FALSE)</b> có tác dụng gì?
          </div>
          <div class="col gap-6">
            ${[
          'A. Tìm kiếm xấp xỉ theo thứ tự tăng dần',
          'B. Tìm kiếm chính xác tuyệt đối mã tra cứu',
          'C. Trả về tổng giá trị ở cột thứ 3',
        ].map((txt, idx) => `
              <button class="quiz-opt ${choiceIdx === idx ? 'selected' : ''}" data-action="quizChoice" data-val="${idx}">
                <span style="flex:1;text-align:left;">${txt}</span>
                ${choiceIdx === idx ? '<span style="color:var(--brand);font-weight:800;">●</span>' : ''}
              </button>
            `).join('')}
          </div>
          <div class="row gap-8" style="margin-top:2px;">
            <button class="btn btn-outline btn-sm" style="flex:0 0 auto;">💡 Gợi ý</button>
            <button class="btn btn-primary btn-sm" style="flex:1;">Xác nhận & Xem tiếp ▶</button>
          </div>
        </div>
      `;
    }

    case 'student-practice': {
      return `
        <div class="card row between" style="padding:10px 12px;">
          <div class="row gap-8">
            <span class="pill excel">📊 Excel Thực chiến</span>
            <span class="pill gold">🔥 9 ngày</span>
          </div>
          <span class="pill brand">⚡ 1.420 XP</span>
        </div>

        <div class="card ${isB ? 'accent-gold' : ''} row between gap-10">
          <div class="col" style="flex:1;">
            <span class="txt-xs bold" style="color:var(--blue);">🔁 ÔN TẬP NGẮT QUÃNG HÔM NAY</span>
            <span class="bold txt-sm" style="margin-top:2px;">4 câu hàm IF & PivotTable dễ quên</span>
            <span class="txt-xs muted">Hoàn thành ngay để nhận +25 XP (không trừ XP)</span>
          </div>
          <button class="btn btn-primary btn-sm">Ôn ngay</button>
        </div>

        <div class="section-hdr">
          <h3>Lộ trình Chặng 2 · Hàm điều kiện</h3>
          <span class="txt-xs bold muted">2 / 3 bước</span>
        </div>

        <div class="card col gap-10">
          <div class="path-node-row">
            <div class="path-circle done">${ICONS.check}</div>
            <div class="col" style="flex:1;">
              <span class="bold txt-sm">1. Video lý thuyết SUMIF</span>
              <span class="txt-xs muted">Đã hoàn thành · 100% câu hỏi</span>
            </div>
            <span class="pill brand">Ôn lại</span>
          </div>

          <div class="path-node-row">
            <div class="path-circle active">▶</div>
            <div class="col" style="flex:1;">
              <span class="bold txt-sm">2. Luyện tập IF lồng nhiều lớp</span>
              <span class="txt-xs" style="color:var(--brand-dark);">Đạt ≥70% mở khóa · Tối đa +35 XP</span>
            </div>
            <button class="btn btn-primary btn-sm">Vào ngay</button>
          </div>

          <div class="path-node-row">
            <div class="path-circle locked">🔒</div>
            <div class="col" style="flex:1;">
              <span class="bold txt-sm muted">3. Kiểm tra vượt chặng & Mở rương</span>
              <span class="txt-xs muted">Thưởng rương +50 XP khi qua chặng</span>
            </div>
            <span class="pill gold">🎁 +50 XP</span>
          </div>
        </div>

        <div class="card row between" style="padding:10px 13px;">
          <div class="col">
            <span class="bold txt-sm">Đã biết kiến thức chặng này?</span>
            <span class="txt-xs muted">Làm bài Test-out 5 câu để nhảy thẳng Chặng 3</span>
          </div>
          <button class="btn btn-outline btn-sm">Thi vượt</button>
        </div>
      `;
    }

    case 'student-social': {
      return `
        <div class="seg-tabs">
          <button class="seg-tab active">Bảng xếp hạng</button>
          <button class="seg-tab">Nhiệm vụ (3)</button>
          <button class="seg-tab">Chứng nhận QR</button>
        </div>

        <div class="card hero-soft col gap-8" style="padding:13px;">
          <div class="row between">
            <span class="xbold txt-md">🏆 Đua Top Tuần · Toàn Trung Tâm</span>
            <span class="pill ${isA ? 'brand' : 'dark'}">Còn 3 ngày</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1.12fr 1fr;gap:8px;align-items:end;padding-top:6px;">
            <div class="col" style="align-items:center;background:${isA ? '#f8fafc' : 'rgba(255,255,255,0.14)'};border-radius:12px;padding:8px 6px;">
              <span class="pill gold">🥈 #2</span>
              <span class="bold txt-xs" style="margin-top:4px;text-align:center;">Minh Anh (Bạn)</span>
              <span class="xbold txt-sm">1.420 XP</span>
            </div>
            <div class="col" style="align-items:center;background:${isA ? '#ecfdf5' : 'rgba(255,255,255,0.26)'};border:1.5px solid ${isA ? '#059669' : '#fde68a'};border-radius:14px;padding:11px 6px;">
              <span class="pill gold">👑 #1</span>
              <span class="bold txt-sm" style="margin-top:4px;text-align:center;">Phạm Gia Bảo</span>
              <span class="xbold txt-md">2.480 XP</span>
            </div>
            <div class="col" style="align-items:center;background:${isA ? '#f8fafc' : 'rgba(255,255,255,0.14)'};border-radius:12px;padding:8px 6px;">
              <span class="pill">🥉 #3</span>
              <span class="bold txt-xs" style="margin-top:4px;text-align:center;">Võ Thảo Vy</span>
              <span class="xbold txt-sm">1.290 XP</span>
            </div>
          </div>
        </div>

        <div class="section-hdr">
          <h3>Nhiệm vụ nhận thưởng hôm nay</h3>
          <span class="pill gold">Còn 2 nhiệm vụ</span>
        </div>
        <div class="card col gap-8">
          <div class="row between">
            <div class="col" style="flex:1;padding-right:8px;">
              <span class="bold txt-sm">Hoàn thành 10 câu luyện tập</span>
              <div class="prog-track" style="height:6px;margin-top:5px;"><div class="prog-fill" style="width:80%;"></div></div>
              <span class="txt-xs muted" style="margin-top:3px;">8 / 10 câu</span>
            </div>
            <span class="pill brand">+25 XP</span>
          </div>
          <div class="row between" style="padding-top:8px;border-top:1px solid var(--line);">
            <div class="col">
              <span class="bold txt-sm">Xem trọn vẹn 1 video bài giảng</span>
              <span class="txt-xs" style="color:var(--brand);">Đã hoàn thành 1/1</span>
            </div>
            <button class="btn btn-primary btn-sm">Nhận +20 XP</button>
          </div>
        </div>

        <div class="card row between gap-10">
          <div class="col">
            <span class="bold txt-sm">🏅 Chứng nhận Excel Cơ bản (QR)</span>
            <span class="txt-xs muted">Mã xác thực #TTH-2026-841 · Đã sẵn sàng tải</span>
          </div>
          <button class="btn btn-soft btn-sm">Xem QR</button>
        </div>
      `;
    }

    case 'student-packages': {
      const plan = state.selectedPlan || '3m';
      return `
        <div class="card hero-soft row between">
          <div class="col">
            <span class="txt-xs" style="opacity:0.85;">TRẠNG THÁI HIỆN TẠI</span>
            <span class="xbold txt-md" style="margin-top:2px;">Gói Pro 3 tháng · Còn 42 ngày</span>
            <span class="txt-xs" style="opacity:0.9;margin-top:2px;">Mở khóa toàn bộ Video, Lộ trình XP, Hỏi đáp & Meet</span>
          </div>
          <span class="pill ${isA ? 'brand' : 'dark'}">Đã kích hoạt</span>
        </div>

        <div class="seg-tabs">
          <button class="seg-tab active">Gói Hội viên</button>
          <button class="seg-tab">Nạp thêm XP</button>
          <button class="seg-tab">Nhập mã kích hoạt</button>
        </div>

        <div class="col gap-8">
          ${[
          { id: '1m', name: 'Gói 1 tháng', price: '299.000đ', desc: 'Tất cả khóa tự học & luyện tập XP', badge: '' },
          { id: '3m', name: 'Gói 3 tháng (Phổ biến)', price: '699.000đ', desc: 'Tiết kiệm 22% · Tặng +200 XP & Ôn thi MOS', badge: 'Tiết kiệm nhất' },
          { id: 'lifetime', name: 'VIP Trọn đời', price: '3.490.000đ', desc: 'Cập nhật trọn đời tất cả khóa Office mới', badge: 'VIP' },
        ].map((pkg) => `
            <div class="card col gap-6" style="cursor:pointer;${plan === pkg.id ? 'border:2px solid var(--brand);background:var(--brand-soft);' : ''}" data-action="selectedPlan" data-val="${pkg.id}">
              <div class="row between">
                <span class="bold txt-md">${pkg.name}</span>
                ${pkg.badge ? `<span class="pill gold">${pkg.badge}</span>` : ''}
              </div>
              <div class="row between">
                <span class="txt-xs muted">${pkg.desc}</span>
                <span class="xbold txt-md" style="color:var(--brand-dark);">${pkg.price}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="card row gap-10" style="padding:11px 12px;">
          <div style="width:66px;height:66px;border-radius:10px;border:1.5px solid var(--line);background:#fff;display:grid;place-items:center;font-size:10px;font-weight:800;text-align:center;flex-shrink:0;">
            [VIETQR<br/>VCB]
          </div>
          <div class="col" style="flex:1;min-width:0;">
            <span class="bold txt-sm">Thanh toán nhanh qua VietQR</span>
            <span class="txt-xs muted">Kích hoạt tự động sau 5–10 giây chuyển khoản</span>
            <div class="row gap-6" style="margin-top:6px;">
              <button class="btn btn-primary btn-sm" style="flex:1;">Mở mã QR 699.000đ</button>
            </div>
          </div>
        </div>
      `;
    }

    case 'student-inbox': {
      const subTab = state.inboxTab || 'chat';
      return `
        <div class="seg-tabs">
          <button class="seg-tab ${subTab === 'chat' ? 'active' : ''}" data-action="inboxTab" data-val="chat">Tin nhắn (3)</button>
          <button class="seg-tab ${subTab === 'notif' ? 'active' : ''}" data-action="inboxTab" data-val="notif">Thông báo (2)</button>
          <button class="seg-tab ${subTab === 'feed' ? 'active' : ''}" data-action="inboxTab" data-val="feed">Bảng tin</button>
        </div>

        <div class="card row gap-10" style="background:var(--brand-soft);border-color:#a7f3d0;padding:10px 12px;">
          <div class="avatar" style="background:var(--brand);color:#fff;">AI</div>
          <div class="col" style="flex:1;">
            <span class="bold txt-sm" style="color:var(--brand-dark);">Trợ lý AI Tin Học 24/7</span>
            <span class="txt-xs muted">Giải đáp công thức Excel, Word, PowerPoint hoặc kết nối Admin</span>
          </div>
          <button class="btn btn-primary btn-sm">Hỏi AI</button>
        </div>

        ${subTab === 'notif' ? `
          <div class="col gap-8">
            <div class="card col gap-4" style="border-left:4px solid var(--brand);">
              <div class="row between"><span class="pill brand">Lịch học</span><span class="txt-xs muted">30 phút trước</span></div>
              <span class="bold txt-sm">Nhắc lịch học hôm nay 18:30</span>
              <span class="txt-xs muted">Buổi 8: PivotTable & Dashboard KPI cùng ThS. Trần Lan Anh.</span>
            </div>
            <div class="card col gap-4" style="border-left:4px solid var(--blue);">
              <div class="row between"><span class="pill blue">Điểm số</span><span class="txt-xs muted">2 giờ trước</span></div>
              <span class="bold txt-sm">Chấm bài Excel Buổi 7: 9.0/10</span>
              <span class="txt-xs muted">"Công thức sạch, chú ý cố định vùng F4 khi kéo."</span>
            </div>
          </div>
        ` : `
          <div class="col gap-8">
            <div class="card row gap-10">
              <div class="avatar" style="background:#dbeafe;color:#1d4ed8;position:relative;">LA
                <span style="position:absolute;bottom:-2px;right:-2px;width:10px;height:10px;border-radius:99px;background:#10b981;border:2px solid #fff;"></span>
              </div>
              <div class="col" style="flex:1;min-width:0;">
                <div class="row between"><span class="bold txt-sm">ThS. Trần Lan Anh · GV</span><span class="txt-xs muted">10:18</span></div>
                <span class="txt-xs muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Em nhớ tải file Thực hành Buổi 8 trước 18h30 nhé!</span>
              </div>
              <span class="pill brand">1</span>
            </div>
            <div class="card row gap-10">
              <div class="avatar" style="background:#dcfce7;color:#166534;">GR</div>
              <div class="col" style="flex:1;min-width:0;">
                <div class="row between"><span class="bold txt-sm">Nhóm Excel K12 Tối 2-4-6</span><span class="txt-xs muted">10:05</span></div>
                <span class="txt-xs muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Cô Lan Anh đã ghim file tổng hợp PivotTable</span>
              </div>
              <span class="pill brand">2</span>
            </div>
            <div class="card row gap-10">
              <div class="avatar" style="background:#fee2e2;color:#b91c1c;">AD</div>
              <div class="col" style="flex:1;min-width:0;">
                <div class="row between"><span class="bold txt-sm">Học vụ Thắng Tin Học</span><span class="txt-xs muted">Hôm qua</span></div>
                <span class="txt-xs muted">Đã xác nhận gia hạn Gói Pro 3 tháng thành công.</span>
              </div>
            </div>
          </div>
        `}
      `;
    }

    case 'student-profile': {
      return `
        <div class="card row gap-12">
          <div class="avatar" style="width:52px;height:52px;font-size:18px;background:var(--brand-soft);color:var(--brand-dark);">MA</div>
          <div class="col" style="flex:1;">
            <span class="xbold txt-md">Nguyễn Minh Anh</span>
            <span class="txt-xs muted">HV-02481 · 0901 234 567</span>
            <div class="row gap-6" style="margin-top:5px;">
              <span class="pill brand">Gói Pro · Còn 42 ngày</span>
              <span class="pill gold">1.420 XP</span>
            </div>
          </div>
          <button class="btn btn-outline btn-sm">Sửa</button>
        </div>

        <div class="seg-tabs">
          <button class="seg-tab active">Hồ sơ & Cài đặt</button>
          <button class="seg-tab">Khóa & Học phí</button>
          <button class="seg-tab">Điểm thi</button>
        </div>

        <div class="card col gap-8">
          <div class="row between">
            <span class="bold txt-sm">Học phí đã đóng</span>
            <span class="xbold txt-sm" style="color:var(--brand);">2.800.000đ / 2.800.000đ</span>
          </div>
          <span class="txt-xs muted">Tin học văn phòng Toàn diện · Hoàn tất 8/16 buổi (ĐTB 8.8)</span>
        </div>

        <div class="card col gap-10">
          <div class="row between"><span class="txt-sm bold">🔒 Khóa PIN bảo vệ ứng dụng</span><span class="pill brand">Đang bật</span></div>
          <div class="row between" style="padding-top:8px;border-top:1px solid var(--line);"><span class="txt-sm bold">🔊 Hiệu ứng âm thanh luyện tập</span><span class="pill brand">Bật</span></div>
          <div class="row between" style="padding-top:8px;border-top:1px solid var(--line);"><span class="txt-sm bold">🔑 Đổi mật khẩu tài khoản</span><span class="muted">›</span></div>
          <div class="row between" style="padding-top:8px;border-top:1px solid var(--line);"><span class="txt-sm bold">📞 Hotline & Hỗ trợ trung tâm</span><span class="muted">093 5758 462</span></div>
        </div>

        <button class="btn btn-full" style="background:var(--danger-soft);color:var(--danger);border:1px solid #fecaca;">Đăng xuất khỏi thiết bị</button>
      `;
    }

    case 'teacher-home': {
      return `
        <div class="card hero-soft row between">
          <div class="col">
            <span class="txt-xs" style="opacity:0.85;">GIẢNG VIÊN · CƠ SỞ BÌNH THẠNH</span>
            <span class="xbold txt-md" style="margin-top:2px;">ThS. Trần Lan Anh</span>
            <span class="txt-xs" style="opacity:0.9;margin-top:2px;">★ 4.9/5 đánh giá · 42 buổi tháng 11</span>
          </div>
          <span class="pill ${isA ? 'gold' : 'dark'}">2 ca hôm nay</span>
        </div>

        <div class="card row between" style="background:var(--gold-soft);border-color:#fde68a;">
          <div class="col">
            <span class="bold txt-sm" style="color:#92400e;">⚡ Cần xử lý ngay (3)</span>
            <span class="txt-xs" style="color:#b45309;">2 bài tập Excel chờ chấm · 1 lịch cần xác nhận</span>
          </div>
          <button class="btn btn-primary btn-sm">Chấm ngay</button>
        </div>

        <div class="section-hdr">
          <h3>Lịch dạy dạng Agenda (Thay bảng 620px)</h3>
          <span class="link-txt">Cả tuần ›</span>
        </div>
        <div class="row gap-6">
          ${['Hôm nay (2)', 'T4 18/11', 'T5 19/11'].map((d, i) => `
            <span class="pill ${i === 0 ? 'brand' : ''}" style="${i === 0 ? 'border:1.5px solid var(--brand);' : ''}">${d}</span>
          `).join('')}
        </div>

        <div class="col gap-8">
          <div class="timeline-item">
            <div class="timeline-time">18:30<br/><span class="txt-xs muted" style="font-weight:500;">20:00</span></div>
            <div class="card col gap-6" style="border-left:4px solid var(--brand);">
              <div class="row between"><span class="bold txt-sm">Nguyễn Minh Anh</span><span class="pill brand">1-1 Meet</span></div>
              <span class="txt-xs muted">Excel Văn phòng · Buổi 8/16: PivotTable & KPI</span>
              <div class="row gap-6" style="margin-top:2px;">
                <button class="btn btn-primary btn-sm" style="flex:1;">Vào Meet</button>
                <button class="btn btn-outline btn-sm" style="flex:1;">Điểm danh 1 chạm</button>
              </div>
            </div>
          </div>

          <div class="timeline-item">
            <div class="timeline-time">20:15<br/><span class="txt-xs muted" style="font-weight:500;">21:45</span></div>
            <div class="card col gap-6" style="border-left:4px solid var(--blue);">
              <div class="row between"><span class="bold txt-sm">Phạm Gia Bảo</span><span class="pill blue">Tại lớp P.02</span></div>
              <span class="txt-xs muted">Word Hành chính · Buổi 4/12: Mail Merge</span>
            </div>
          </div>
        </div>
      `;
    }

    case 'teacher-grading': {
      const subTab = state.teacherSubTab || 'grade';
      return `
        <div class="seg-tabs">
          <button class="seg-tab ${subTab === 'grade' ? 'active' : ''}" data-action="teacherSubTab" data-val="grade">Bài chờ chấm (2)</button>
          <button class="seg-tab ${subTab === 'finance' ? 'active' : ''}" data-action="teacherSubTab" data-val="finance">Thu nhập & Hoa hồng</button>
        </div>

        <div class="card col gap-8">
          <div class="row between">
            <div class="col">
              <span class="bold txt-sm">Bài 4: Báo cáo SUMIFS + VLOOKUP</span>
              <span class="txt-xs muted">Nguyễn Minh Anh · Nộp file BaoCao_MinhAnh.xlsx</span>
            </div>
            <span class="pill gold">Chờ chấm</span>
          </div>
          <div style="background:var(--surface-soft);border-radius:10px;padding:10px;border:1px solid var(--line);" class="col gap-8">
            <span class="txt-xs bold" style="color:var(--brand-dark);">📋 CHẤM NHANH TRONG SHEET (KHÔNG CUỘN XUỐNG ĐÁY)</span>
            <div class="row between gap-8">
              <div class="row gap-6">
                <span class="txt-xs bold muted">Điểm:</span>
                <span class="pill brand" style="font-size:13px;">9.0 / 10</span>
              </div>
              <div class="row gap-6">
                <button class="btn btn-outline btn-sm">Xem file</button>
                <button class="btn btn-primary btn-sm">Lưu & Gửi HV</button>
              </div>
            </div>
          </div>
        </div>

        <div class="card col gap-8">
          <div class="row between">
            <div class="col">
              <span class="txt-xs muted">THU NHẬP ĐÃ CHỐT THÁNG 10–11</span>
              <span class="xbold txt-lg" style="color:var(--brand);">11.200.000đ</span>
            </div>
            <div class="col" style="text-align:right;">
              <span class="txt-xs muted">Chờ Admin chuyển</span>
              <span class="xbold txt-md" style="color:var(--gold);">3.650.000đ</span>
            </div>
          </div>
          <div class="mini-bar-chart">
            ${[
          { m: 'T7', h: 42, muted: true },
          { m: 'T8', h: 52, muted: true },
          { m: 'T9', h: 46, muted: true },
          { m: 'T10', h: 68, muted: false },
          { m: 'T11*', h: 44, muted: false },
        ].map((b) => `
              <div class="mini-bar-col">
                <div class="mini-bar-fill ${b.muted ? 'muted' : ''}" style="height:${b.h}px;"></div>
                <span class="txt-xs muted">${b.m}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }
  return '';
}

window.renderPhone = function renderPhone({ variant, screenId, state }) {
  const screenMeta = window.SCREEN_CATALOG.find((s) => s.id === screenId) || window.SCREEN_CATALOG[1];
  const isLogin = screenId === 'login';
  const role = screenMeta.role === 'teacher' ? 'teacher' : 'student';

  return `
    <div class="phone-screen var-${variant}">
      <div class="status-bar">
        <span>09:41</span>
        <div class="status-icons"><span>5G</span><span>📶</span><span>🔋 94%</span></div>
      </div>
      ${isLogin ? '' : renderTopBar(screenMeta.topTitle, variant, state.drawerOpen)}
      <div class="app-scroll" style="${isLogin ? 'padding:0;' : ''}">
        ${renderScreenBody(screenId, variant, state)}
      </div>
      ${isLogin ? '' : renderBottomNav(role, screenMeta.tab, variant)}
    </div>
  `;
};
