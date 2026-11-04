'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../..', file), 'utf8');

test('bài tập về nhà GV (web) lọc Tất cả / Cần chấm / Đã chấm như mobile', () => {
  const web = read('client/src/components/TeacherAssignmentsView.jsx');
  for (const label of ["label: 'Tất cả'", "label: 'Cần chấm'", "label: 'Đã chấm'"]) {
    assert.ok(web.includes(label), label);
  }
  assert.ok(web.includes("if (subs.some((s) => s.status !== 'graded')) return 'pending';"), 'còn bài chưa chấm → Cần chấm');
  assert.ok(web.includes("'Không có bài tập'") && web.includes("'Thử chọn bộ lọc khác nhé.'"), 'trạng thái trống giống mobile');

  const mobile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  assert.ok(mobile.includes("? ['Tất cả', 'Cần chấm', 'Đã chấm']"));
});

test('bài tập về nhà GV (mobile) giống web: chọn khóa + Tạo bài tập mới cùng hàng, tab có số đếm', () => {
  const mobile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  assert.ok(mobile.includes('<Text style={styles.assignCourseCaption}>Bài tập của</Text>'));
  assert.ok(mobile.includes('onPress={openCreateAssignment} style={styles.assignCreateButton}'));
  assert.ok(mobile.includes('counts={teacherFilterCounts}'));
  assert.ok(!mobile.includes('styles.assignmentCreateAction'), 'bỏ nút tròn nổi trùng chức năng');
});
