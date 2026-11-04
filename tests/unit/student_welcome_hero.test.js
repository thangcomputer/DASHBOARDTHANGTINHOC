'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('thẻ chào mừng dùng chung (web): hình theo vai trò, nút vào lớp trên đầu, sáng khi có link, mờ khi chưa', () => {
  const hero = read('client/src/components/WelcomeHero.jsx');
  assert.ok(hero.includes("import studentHero from '../assets/student-hero.png';"));
  assert.ok(hero.includes("import teacherHero from '../assets/teacher-hero.png';"));
  assert.ok(hero.includes("joinLabel: 'Vào học ngay'"));
  assert.ok(hero.includes("joinLabel: 'Vào dạy ngay'"));
  assert.ok(hero.includes('aria-disabled="true"'), 'chưa có link: nút mờ, không bấm được');
  assert.ok(hero.includes('bg-white/35'), 'nút mờ trong suốt nhưng vẫn đọc được chữ');
  assert.ok(hero.includes('absolute bottom-0 right-3 flex flex-col items-center'), 'nút + nhân vật nằm trong thẻ, sát mép phải');
  assert.ok(hero.indexOf('aria-disabled="true"') < hero.indexOf('<img src={variant.image}'), 'nút đặt trên đầu nhân vật');
  assert.ok(hero.includes('overflow-hidden rounded-[28px] bg-gradient-to-br'), 'không tràn viền');
  for (const img of ['student-hero.png', 'teacher-hero.png']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'client/src/assets', img)));
  }
});

test('Tổng quan học viên + giảng viên (web): dùng thẻ chào mừng, bỏ banner ảnh và thẻ lớp đang diễn ra', () => {
  const student = read('client/src/components/student/StudentOverviewTab.jsx');
  assert.ok(student.includes('<WelcomeHero') && student.includes('role="student"'));
  assert.ok(!student.includes('studentBanners'));
  assert.ok(student.includes("joinUrl={isLive ? joinUrl : ''}"));

  const teacher = read('client/src/components/teacher/TeacherOverviewTab.jsx');
  assert.ok(teacher.includes('<WelcomeHero') && teacher.includes('role="teacher"'));
  assert.ok(!teacher.includes('teacherBanners'), 'bỏ banner ảnh giảng viên');
  assert.ok(!teacher.includes('th-dashboard-overview__live-card'), 'thông tin ca đang dạy chuyển vào nhãn trên thẻ chào mừng');
  assert.ok(teacher.includes("joinUrl={ongoingSchedule ? ongoingJoinUrl : ''}"));
});

test('trang chủ mobile: cùng thẻ chào mừng cho học viên và giảng viên, bỏ banner ảnh', () => {
  const home = read('thang-tin-hoc-mobile/src/screens/HomeScreen.tsx');
  assert.ok(home.includes('role="teacher"') && home.includes('role="student"'));
  assert.ok(!home.includes('getDashboardBanners'), 'không còn tải banner ảnh');
  assert.ok(home.includes("joinUrl={firstScheduleIsLive ? studentJoinUrl : ''}"));
  const hero = read('thang-tin-hoc-mobile/src/components/WelcomeHero.tsx');
  assert.ok(hero.includes("require('../assets/student-hero.png')"));
  assert.ok(hero.includes("require('../assets/teacher-hero.png')"));
  assert.ok(hero.indexOf('<View style={styles.joinSlot}>') < hero.indexOf('<View style={styles.heroBox}>'), 'nút đặt trên đầu, trước hình');
  for (const img of ['student-hero.png', 'teacher-hero.png']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/assets', img)));
  }
});
