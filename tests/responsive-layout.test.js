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
    path.resolve(__dirname, '../client/src/components/TeacherDashboard.jsx'),
    'utf8'
  );
  assert.ok(src.includes('min-[440px]:flex-row'), 'Card HV GV: chồng layout rồi ngang >=440px');
});
