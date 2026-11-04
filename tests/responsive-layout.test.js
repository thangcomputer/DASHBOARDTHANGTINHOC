const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('DashboardLayout header co giãn: tiêu đề tự thu gọn, ẩn trên mobile', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'),
    'utf8'
  );
  assert.ok(src.includes('cms-topbar flex flex-col'), 'Header xếp cột để hàng phụ xuống dòng');
  assert.ok(
    src.includes('<div className="min-w-0 flex-1 flex items-center overflow-hidden">'),
    'Vùng tiêu đề phải co lại được, không đẩy các nút ra ngoài'
  );
  assert.ok(src.includes('cms-topbar__title--mobile-hidden'), 'Tiêu đề ẩn trên mobile để logo giữa không bị đè');
});

test('Mobile footer navigation hides during text entry and nested scrolling', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'),
    'utf8'
  );
  assert.ok(src.includes("document.addEventListener('focusin', handleFocusIn)"));
  assert.ok(src.includes("document.addEventListener('focusout', handleFocusOut)"));
  assert.ok(src.includes("document.addEventListener('pointerdown', handlePointerDown, true)"));
  assert.ok(src.includes("window.addEventListener('cms-chat-message-sent', handleChatMessageSent)"));
  assert.ok(src.includes("window.removeEventListener('cms-chat-message-sent', handleChatMessageSent)"));
  assert.ok(src.includes('const handleChatMessageSent = () => setMobileFooterInputFocused(true)'));
  assert.ok(src.includes("target.closest('.cms-chat-input-bar')"));
  assert.ok(src.includes('activeElement === document.body'));
  assert.ok(src.includes('event.target.closest(\'.cms-chat-input-bar\')'));
  assert.ok(src.includes("document.removeEventListener('pointerdown', handlePointerDown, true)"));
  assert.ok(src.includes('onScrollCapture={handleContentScroll}'));
  assert.ok(src.includes('&& !mobileFooterInputFocused'));
  assert.ok(src.includes("{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }"));
  const sidebar = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/AppSidebar.jsx'),
    'utf8'
  );
  assert.ok(sidebar.includes('const footerShown = mobileFooterVisible && (!isInboxRoute || inboxFooterOpen);'));
  assert.ok(sidebar.includes("visibility: footerShown ? 'visible' : 'hidden'"));
  assert.ok(sidebar.includes('const INBOX_FOOTER_HIDE_MS = 1500;'));
  assert.ok(sidebar.includes("visibility 0s linear ${footerShown ? '0s' : '450ms'}"));
  assert.ok(sidebar.includes('onMouseEnter={revealInboxFooter}'));
  assert.ok(sidebar.includes('onMouseLeave={isInboxRoute ? scheduleInboxFooterHide : undefined}'));
  assert.ok(sidebar.includes("'translateY(calc(100% + 0.5rem))'"));
});

test('Web menu button keeps its visible label at every breakpoint', async () => {
  const [layout, styles, sidebar] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/index.css'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/AppSidebar.jsx'), 'utf8'),
  ]);
  assert.ok(layout.includes('<span className="cms-topbar__menu-label">Menu</span>'));
  assert.ok(styles.includes('.cms-topbar__menu-label'));
  assert.ok(styles.includes('grid-template-columns: auto minmax(0, 1fr) auto;'));
  assert.equal(styles.includes('.cms-topbar__menu-label {\n      display: none;'), false);
  assert.ok(styles.includes('.cms-topbar__menu[aria-expanded="true"]'));
  assert.ok(styles.includes('.cms-topbar__action:active'));
  assert.ok(styles.includes('.cms-topbar__brand:active'));
  assert.ok(styles.includes('.cms-fm-support-button:active'));
  assert.ok(styles.includes('.cms-sidebar-glass__nav-item:not(:disabled):active'));
  assert.match(styles, /\.cms-sidebar-glass__nav-item\s*\{\s*border: 1px solid transparent;\s*box-shadow: none;/);
  assert.ok(styles.includes('.cms-sidebar-glass__nav-item.cms-sidebar-glass__nav-active:not(:disabled):hover'));
  assert.ok(styles.includes("body button:not(:disabled):not([aria-disabled='true']):not(.cms-sidebar-glass__nav-item)"));
  assert.ok(styles.includes('inset 1px 1px 2px rgba(15, 23, 42, 0.16)'));
  assert.ok(sidebar.includes('inset_2px_2px_6px_rgba(220,38,38,0.12)'));
  assert.ok(sidebar.includes('inset_2px_2px_5px_rgba(71,85,105,0.14)'));
});

test('All enabled buttons get a resting and pressed inset effect across responsive layouts', async () => {
  const styles = await fs.readFile(
    path.resolve(__dirname, '../client/src/index.css'),
    'utf8'
  );
  assert.ok(styles.includes("body button:not(:disabled):not([aria-disabled='true']):not(.cms-sidebar-glass__nav-item)"));
  assert.ok(styles.includes("body [role='button']:not([aria-disabled='true']):not(.cms-sidebar-glass__nav-item)"));
  assert.ok(styles.includes('inset 1px 1px 2px rgba(15, 23, 42, 0.16)'));
  assert.ok(styles.includes("body button:not(:disabled):not([aria-disabled='true']):not(.cms-sidebar-glass__nav-item):active"));
  assert.ok(styles.includes("body input[type='submit']:not(:disabled):not([aria-disabled='true']):active"));
  assert.ok(styles.includes('inset 2px 2px 5px rgba(15, 23, 42, 0.2)'));
});

test('Responsive footer navigation spaces items evenly and aligns icons and labels', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/AppSidebar.jsx'),
    'utf8'
  );
  assert.ok(src.includes('items-stretch gap-2 px-1'));
  assert.ok(src.includes('flex-1 basis-0 flex-col items-center justify-center gap-1'));
  assert.ok(src.includes("'h-14 w-14 rounded-full border-[3px] border-white"));
  assert.ok(src.includes('`h-10 w-10 rounded-xl border'));
  assert.ok(src.includes("const isHome = item.key === 'dashboard';"));
  assert.ok(src.includes("['schedule', 'inbox', 'dashboard', 'feed', 'support', 'lesson-practice', 'profile']"));
  assert.ok(src.includes('flex h-6 w-full items-center justify-center text-center leading-3'));
});

test('Support chat composer aligns attachment, emoji, input, and send controls', async () => {
  const [component, inbox, stickerPicker, styles] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../client/src/components/FloatingMessenger.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/Inbox.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/StickerPicker.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/index.css'), 'utf8'),
  ]);
  assert.ok(component.includes('className="cms-fm-capture-control"'));
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-window__compose\s*\{\s*width: 100%;\s*gap: 8px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-attach\s*\{\s*box-sizing: border-box;\s*width: 40px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-capture-control > button\s*\{\s*width: 14px;/);
  assert.ok(styles.includes('.cms-fm-root.is-page-chat .cms-fm-window__compose > .relative.shrink-0 > button'));
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-send\s*\{\s*box-sizing: border-box;\s*width: 40px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-input\s*\{[\s\S]*?height: 40px;/);
  assert.ok(inbox.includes('cms-chat-attachment-tools flex items-center gap-1.5'));
  assert.ok(inbox.includes('className="cms-chat-capture-control"'));
  assert.match(styles, /\.cms-chat-attachment-tools > button\s*\{\s*display: inline-flex;\s*width: 40px;/);
  assert.match(styles, /\.cms-chat-attachment-tools > \.cms-chat-capture-control\s*\{[\s\S]*?overflow: visible;[\s\S]*?border: 1px solid #cbd5e1;/);
  assert.match(styles, /\.cms-chat-capture-control > button\s*\{[\s\S]*?width: 24px;[\s\S]*?border-left: 1px solid #e2e8f0;/);
  assert.ok(styles.includes('@media (max-width: 640px)'));
  assert.ok(inbox.includes('key={activeConv?.id || \'no-conversation\'}'));
  assert.ok(inbox.includes('                        inline'));
  assert.ok(inbox.includes('buttonClassName="border border-slate-200 bg-white"'));
  assert.ok(inbox.includes('buttonClassName="border border-slate-200 bg-white"'));
  assert.ok(stickerPicker.includes('${buttonClassName}'));
});

test('Conversation options menu closes on outside clicks and toggles on its trigger', async () => {
  const inbox = await fs.readFile(path.resolve(__dirname, '../client/src/components/Inbox.jsx'), 'utf8');
  assert.ok(inbox.includes('setShowConvOptions((current) => (current === conv.id ? null : conv.id))'));
  assert.ok(inbox.includes("target.closest('[data-conv-options-root]')"));
  assert.ok(inbox.includes("document.addEventListener('pointerdown', handleOutsidePointerDown)"));
  assert.ok(inbox.includes("document.removeEventListener('pointerdown', handleOutsidePointerDown)"));
  assert.ok(inbox.includes('onClick={(e) => e.stopPropagation()}'));
  assert.ok(inbox.includes('min-w-52 flex-col gap-1 rounded-2xl border border-slate-200/90'));
  assert.ok(inbox.includes('flex min-h-10 items-center gap-2.5 rounded-xl px-2.5'));
});

test('Message options menu flips to stay inside the visible chat area', async () => {
  const inbox = await fs.readFile(path.resolve(__dirname, '../client/src/components/Inbox.jsx'), 'utf8');
  assert.ok(inbox.includes('const spaceRight = clipRight - r.left;'));
  assert.ok(inbox.includes('setAlignMenuRight(spaceRight < menuRect.width && spaceLeft > spaceRight)'));
  assert.ok(inbox.includes("alignMenuRight ? 'right-0' : 'left-0'"));
});

test('Removes duplicated page headings and aligns top spacing on student pages', async () => {
  const [training, schedule, scheduleTab, news, centerInfo, evaluation, exam, support, feed, practice, dashboardLayout, styles] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../client/src/components/StudentTrainingLMS.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/student/StudentScheduleView.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/student/StudentScheduleTab.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/NewsPage.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/centerInfo/CenterInfoPage.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/student/StudentEvaluationView.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/StudentExamRoom.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/SupportEntryPage.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/FeedBoard.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/student/lessonPractice/LessonPracticeCatalogPage.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/index.css'), 'utf8'),
  ]);
  assert.ok(training.includes("hideTabBar && ['courses', 'files', 'software', 'assignments'].includes(mainTab) && !isAdmin && !onBack"));
  assert.ok(training.includes("hideTabBar && ['courses', 'files', 'software', 'assignments'].includes(mainTab) ? 'hidden' : ''"));
  assert.equal(schedule.includes('Quản lý Lịch học &amp; Điểm danh'), false);
  assert.ok(scheduleTab.includes('pt-0 pb-3 sm:pt-0 sm:pb-6'));
  assert.equal(news.includes('<Newspaper className="text-red-600 shrink-0" size={22} /> Tin tức'), false);
  assert.equal(news.includes('RefreshCw'), false);
  assert.equal(news.includes('title="Làm mới"'), false);
  assert.ok(news.includes('inline-flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white p-1'));
  assert.ok(training.includes('inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1'));
  assert.equal(centerInfo.includes('<Building2 className="text-red-600 shrink-0" size={22} />'), false);
  assert.ok(centerInfo.includes('pt-0 pb-2 sm:pt-0 sm:pb-4'));
  assert.ok(evaluation.includes('pt-0 pb-2 sm:pt-0 sm:pb-6'));
  assert.ok(exam.includes('pt-4 pb-1 sm:pt-4 sm:pb-2 text-left space-y-4'));
  assert.ok(scheduleTab.includes("className={enrollments.length > 1 ? 'mb-4' : ''}"));
  assert.ok(news.includes('className="w-full space-y-4 pt-4 pb-8"'));
  assert.ok(support.includes('max-w-5xl pt-4'));
  assert.ok(feed.includes('cms-feed-column pt-4 pb-8 space-y-4'));
  assert.ok(practice.includes('px-1 pb-8 pt-4 md:px-2 md:pt-4'));
  assert.ok(dashboardLayout.includes("isInboxPage ? 'pt-4' : ''"));
  assert.match(styles, /\.cms-sd-page\s*\{[^}]*padding-block: 0 16px;/);
  assert.match(styles, /@media \(min-width: 768px\)\s*\{\s*\.cms-sd-page\s*\{[^}]*padding-block: 0 20px;/);
});

test('Admin tabs: học viên / tài chính / GV có breakpoints linh hoạt', async () => {
  const students = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/admin/tabs/AdminStudentsTab.jsx'),
    'utf8'
  );
  const finance = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/admin/tabs/AdminFinanceTab.jsx'),
    'utf8'
  );
  const teachers = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/admin/tabs/AdminTeachersTab.jsx'),
    'utf8'
  );

  assert.ok(students.includes('touch-pan-x'), 'Bảng HV: cuộn ngang mượt trên touch');
  assert.ok(
    finance.includes('flex-col gap-3 sm:flex-row'),
    'Tài chính: tiêu đề + nút xếp chồng khi hẹp'
  );
  assert.ok(
    teachers.includes('xl:flex-row') && teachers.includes('Duyệt Giảng Viên'),
    'Giảng viên: toolbar xếp cột → hàng xl'
  );
});

test('TeacherDashboard StudentCard: header không ép một flex-row cứng', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/teacher/TeacherStudentCard.jsx'),
    'utf8'
  );
  assert.ok(src.includes('min-[440px]:flex-row'), 'Card HV GV: chồng layout rồi ngang >=440px');
});

test('Text-only and icon-only buttons skip the droplet inset effect', async () => {
  const css = await fs.readFile(path.resolve(__dirname, '../client/src/index.css'), 'utf8');
  assert.ok(css.includes("body button:not([class^='bg-']):not([class*=' bg-']):not([class*='border']):not([class*='btn']):not([class*='cms-']):not([style*='background'])"));
  assert.ok(css.includes("body button[class*='bg-transparent'],"));
});
