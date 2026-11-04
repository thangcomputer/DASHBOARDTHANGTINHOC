const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('DashboardLayout header dùng bố cục co giãn (wrap / cột)', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'),
    'utf8'
  );
  assert.ok(src.includes('flex-wrap'), 'Header cần flex-wrap để không ép một hàng');
  assert.ok(
    src.includes('flex-col') && src.includes('sm:flex-row'),
    'Header nhỏ: cột, lớn hơn: hàng ngang'
  );
});

test('Mobile footer navigation hides during text entry and nested scrolling', async () => {
  const src = await fs.readFile(
    path.resolve(__dirname, '../client/src/components/DashboardLayout.jsx'),
    'utf8'
  );
  assert.ok(src.includes("document.addEventListener('focusin', handleFocusIn)"));
  assert.ok(src.includes("document.addEventListener('focusout', handleFocusOut)"));
  assert.ok(src.includes('onScrollCapture={handleContentScroll}'));
  assert.ok(src.includes('&& !mobileFooterInputFocused'));
  assert.ok(src.includes("'env(safe-area-inset-bottom, 0px)'"));
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
  assert.ok(src.includes("'h-10 w-10 rounded-full"));
  assert.ok(src.includes('`h-10 w-10 rounded-xl border'));
  assert.ok(src.includes('flex h-6 w-full items-center justify-center text-center leading-3'));
});

test('Support chat composer aligns attachment, emoji, input, and send controls', async () => {
  const [component, styles] = await Promise.all([
    fs.readFile(path.resolve(__dirname, '../client/src/components/FloatingMessenger.jsx'), 'utf8'),
    fs.readFile(path.resolve(__dirname, '../client/src/index.css'), 'utf8'),
  ]);
  assert.ok(component.includes('className="cms-fm-capture-control"'));
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-window__compose\s*\{\s*width: 100%;\s*gap: 8px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-attach\s*\{\s*box-sizing: border-box;\s*width: 40px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-capture-control > button\s*\{\s*width: 14px;/);
  assert.ok(styles.includes('.cms-fm-root.is-page-chat .cms-fm-window__compose > .relative.shrink-0 > button'));
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-send\s*\{\s*box-sizing: border-box;\s*width: 40px;/);
  assert.match(styles, /\.cms-fm-root\.is-page-chat \.cms-fm-input\s*\{[\s\S]*?height: 40px;/);
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
