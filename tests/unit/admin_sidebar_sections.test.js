'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sidebar = fs.readFileSync(path.join(__dirname, '../../client/src/components/AppSidebar.jsx'), 'utf8');

test('sidebar admin chia theo phần có tiêu đề, không lồng 3 cấp', () => {
  for (const section of ['KHÔNG GIAN LÀM VIỆC', 'HỌC VIÊN', 'GIẢNG VIÊN', 'NHÂN SỰ', 'TÀI CHÍNH', 'HỆ THỐNG']) {
    assert.ok(sidebar.includes(`section: '${section}'`), `có phần ${section}`);
  }
  for (const removed of ["key: 'manage-train-group'", "key: 'students-hub'", "key: 'teachers-hub'", "key: 'staff-hub'", "key: 'finance-group'"]) {
    assert.ok(!sidebar.includes(removed), `bỏ nhóm lồng ${removed}`);
  }
  assert.ok(
    sidebar.includes('item.section !== visibleItems[index - 1]?.section'),
    'tiêu đề hiện ở mục đầu đang hiển thị của mỗi phần (theo quyền)',
  );
});
