const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('shareAchievement helpers format Duolingo-style 4-stat payloads for all completion types', async () => {
  const {
    buildPracticeShareData,
    buildChestShareData,
    buildMilestoneShareData,
    buildPlacementShareData,
    buildLessonPracticeShareData,
    buildExamShareData,
    buildCourseOrCertShareData,
    buildPlatformShareUrls,
    resolvePublicShareUrl,
  } = await import('../../shared/dailyPractice/shareAchievement.mjs');

  const practice = buildPracticeShareData({
    total: 10,
    correctCount: 10,
    maxCombo: 10,
    xpEarned: 45,
    durationSeconds: 95,
    stars: 3,
    stats: { streak: 7 },
    path: { passed: true, unitCompleted: true, unitTitle: 'Chặng 1: Windows', scorePercent: 100 },
  });
  assert.equal(practice.stats.length, 4);
  assert.equal(practice.eyebrow, 'CHINH PHỤC CHẶNG');
  assert.match(practice.headline, /Chặng 1: Windows/);
  assert.equal(practice.stats[0].value, '100%');
  assert.equal(practice.stats[1].value, '7 ngày');
  assert.equal(practice.stats[2].value, '+45 XP');
  assert.equal(practice.stats[3].value, '1:35');

  const chest = buildChestShareData({ unitTitle: 'Word Cơ bản', rewardXp: 50 });
  assert.equal(chest.heroLabel, '+50 XP');
  assert.equal(chest.stats.length, 4);
  assert.match(chest.headline, /Word Cơ bản/);

  const milestone = buildMilestoneShareData({
    nodeTitle: 'Màn hình nền Windows',
    difficultyLabel: 'Khó',
    sectionsDone: 4,
    sectionsTotal: 4,
    allThreeDone: true,
  });
  assert.equal(milestone.heroLabel, '3/3 CẤP');
  assert.equal(milestone.stats[0].value, '3/3 mức');

  const placement = buildPlacementShareData({
    score: 8,
    total: 10,
    recommendedLevel: 'Cơ bản',
    recommendedSkill: 'Microsoft Excel',
    matchedTopicName: 'Excel Văn phòng',
  });
  assert.equal(placement.heroLabel, '8/10');
  assert.equal(placement.stats[1].value, '80%');

  const lesson = buildLessonPracticeShareData({
    result: { total: 10, correct: 10, percentage: 100, bestStreak: 10 },
    unitTitle: 'Bài 2: Định dạng bảng',
    courseTitle: 'Word 2019',
  });
  assert.equal(lesson.heroLabel, '100%');
  assert.match(lesson.headline, /Hoàn hảo 100%/);

  const exam = buildExamShareData({
    title: 'MOS Excel 2019 · Đề 01',
    kindLabel: 'LUYỆN THI MOS / IC3',
    score: 860,
    scoreMax: 1000,
    correctCount: 28,
    totalQuestions: 32,
    passed: true,
    durationSeconds: 1420,
  });
  assert.equal(exam.heroLabel, '860/1000');
  assert.equal(exam.stats[1].value, 'Đạt chuẩn');

  const cert = buildCourseOrCertShareData({
    title: 'Tin học văn phòng MOS',
    scope: 'course',
    studentName: 'Nguyễn Minh Anh',
    completionRate: 100,
    avgGrade: 9.2,
    certCode: 'TTH-HV01-ABCD1234',
  });
  assert.equal(cert.heroLabel, 'ĐÃ XÁC THỰC');
  assert.equal(cert.stats[2].value, 'TTH-HV01-ABCD1234');

  const urls = buildPlatformShareUrls({
    title: practice.shareTitle,
    text: practice.shareText,
    url: 'http://localhost:5173/student/daily-practice',
  });
  assert.equal(resolvePublicShareUrl('http://localhost:8081/test'), 'https://thangtinhoc.edu.vn');
  assert.match(urls.facebook, /^https:\/\/www\.facebook\.com\/sharer\/sharer\.php/);
  assert.match(urls.telegram, /^https:\/\/t\.me\/share\/url/);
});

test('all web and mobile completion flows expose SHARE trigger and ShareAchievementModal', () => {
  assert.ok(
    read('client/src/components/student/dailyPractice/AchievementPopup.jsx').includes('PracticeCompletionModal'),
    'AchievementPopup.jsx re-exports PracticeCompletionModal',
  );

  const webScreens = [
    'client/src/components/student/dailyPractice/PracticeCompletionModal.jsx',
    'client/src/components/student/dailyPractice/Celebration.jsx',
    'client/src/components/student/dailyPractice/UnitStageChest.jsx',
    'client/src/components/student/dailyPractice/DailyPracticePage.jsx',
    'client/src/components/student/dailyPractice/PlacementTestModal.jsx',
    'client/src/components/student/dailyPractice/MilestoneHubModal.jsx',
    'client/src/components/student/lessonPractice/LessonPracticePlayerPage.jsx',
    'client/src/components/student/certPrep/CertPrepResultSummary.jsx',
    'client/src/components/student/StudentQuizExamRoom.jsx',
    'client/src/components/WelcomeCelebrationOverlay.jsx',
    'client/src/components/student/DigitalCertificateModal.jsx',
    'client/src/components/StudentTrainingLMS.jsx',
    'client/src/components/student/StudentProfileTab.jsx',
    'client/src/components/student/StudentOverviewTab.jsx',
  ];

  for (const file of webScreens) {
    const src = read(file);
    assert.ok(src.includes('ShareAchievementModal'), `${file} phải gắn ShareAchievementModal`);
    if (file.endsWith('PracticeCompletionModal.jsx')) {
      assert.ok(src.includes('Share2') && /Chia sẻ|SHARE/.test(src), `${file} phải có nút chia sẻ thành tích`);
    } else {
      assert.ok(src.includes('ShareTriggerButton'), `${file} phải dùng ShareTriggerButton`);
      assert.ok(/SHARE|Chia sẻ/.test(src), `${file} phải hiển thị nút chia sẻ`);
    }
  }

  const mobileScreens = [
    'thang-tin-hoc-mobile/src/components/dailyPractice/AchievementPopup.tsx',
    'thang-tin-hoc-mobile/src/components/dailyPractice/Celebration.tsx',
    'thang-tin-hoc-mobile/src/components/dailyPractice/PracticeFinishOverlay.tsx',
    'thang-tin-hoc-mobile/src/components/dailyPractice/UnitStageChest.tsx',
    'thang-tin-hoc-mobile/src/screens/DailyPracticeScreen.tsx',
    'thang-tin-hoc-mobile/src/components/dailyPractice/PlacementTestModal.tsx',
    'thang-tin-hoc-mobile/src/components/dailyPractice/MilestoneHubModal.tsx',
    'thang-tin-hoc-mobile/src/screens/CertPrepScreens.tsx',
    'thang-tin-hoc-mobile/src/screens/StudentExamScreen.tsx',
    'thang-tin-hoc-mobile/src/components/DigitalCertificateModal.tsx',
  ];

  for (const file of mobileScreens) {
    const src = read(file);
    if (!file.endsWith('PracticeFinishOverlay.tsx')) {
      assert.ok(src.includes('ShareTriggerButton'), `${file} phải dùng ShareTriggerButton`);
      assert.ok(/SHARE|Chia sẻ/.test(src), `${file} phải hiển thị nút chia sẻ`);
    } else {
      assert.ok(src.includes('ShareAchievementModal'), `${file} phải render ShareAchievementModal`);
    }
  }

  const webModal = read('client/src/components/student/ShareAchievementModal.jsx');
  assert.ok(webModal.includes('SHARE'), 'Web Share modal phải có nút SHARE');
  assert.ok(webModal.includes('html2canvas'), 'Web Share modal phải hỗ trợ tạo ảnh thẻ PNG');
  assert.ok(webModal.includes('fonts?.ready'), 'Web Share modal phải chờ webfonts tải xong trước khi chụp');
  assert.ok(webModal.includes("node.style.overflow = 'visible'"), 'onclone phải mở overflow=visible cho chữ không bị cắt');
  assert.ok(webModal.includes('display: inline-block !important'), 'onclone phải sửa img preflight của Tailwind để tránh lệch baseline');
  const webCardBlock = webModal.slice(webModal.indexOf('ref={cardRef}'), webModal.indexOf('{data.footerNote}'));
  assert.ok(webCardBlock.length > 0 && !webCardBlock.includes('truncate'), 'Thẻ Share Web không dùng truncate dễ gây cắt nửa chữ khi chụp PNG');
  assert.ok(!webCardBlock.includes('-mt-3'), 'Hero badge không dùng negative margin đẩy lệch chữ');

  const mobileModal = read('thang-tin-hoc-mobile/src/components/ShareAchievementModal.tsx');
  assert.ok(mobileModal.includes('SHARE'), 'Mobile Share modal phải có nút SHARE');
  assert.ok(mobileModal.includes('NativeShare.share'), 'Mobile Share modal phải hỗ trợ native OS Share');
  const mobileCardBlock = mobileModal.slice(mobileModal.indexOf('styles.card'), mobileModal.indexOf('styles.caption'));
  assert.ok(mobileCardBlock.length > 0 && !mobileCardBlock.includes('numberOfLines={1}'), 'Thẻ Share Mobile không dùng numberOfLines=1 cắt chữ');
  assert.ok(mobileModal.includes('lineHeight: 19') && mobileModal.includes('lineHeight: 24'), 'Mobile Share modal có lineHeight đủ rộng tránh cắt dấu tiếng Việt');
});
