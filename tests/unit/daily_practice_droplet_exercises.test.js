'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pathService = require('../../services/dailyPracticePathService');
const grader = require('../../services/dailyPracticeExerciseGrader');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('MAX_DROPLETS_PER_UNIT = 6: chấp nhận tối đa 6 hạt nước và chặn hạt thứ 7', () => {
  assert.equal(pathService.MAX_DROPLETS_PER_UNIT, 6);

  const sixNodes = Array.from({ length: 6 }, (_, i) => ({
    key: `hat-${i + 1}`,
    label: `Hạt nước ${i + 1}`,
    icon: i === 5 ? 'crown' : i === 3 ? 'clipboard' : 'book',
    sortOrder: i,
    exercises: i === 3 ? [{
      title: 'Bài tập SUM',
      prompt: 'Tính tổng A1:A5',
      gradingMode: 'auto',
      expectedAnswers: ['=SUM(A1:A5)'],
    }] : [],
  }));

  const parsed = pathService.pathNodesInput(sixNodes);
  assert.equal(parsed.length, 6);
  assert.equal(parsed[3].exercises.length, 1);

  const sevenNodes = [...sixNodes, { key: 'hat-7', label: 'Hạt 7', icon: 'book' }];
  assert.throws(
    () => pathService.pathNodesInput(sevenNodes),
    (err) => err?.status === 400 && /6 hạt nước/.test(err.message),
  );
});

test('matchAutoAnswer: khớp công thức Excel, số học, hoa/thường và tùy chọn bỏ dấu', () => {
  // Công thức Excel bỏ khoảng trắng thừa & hoa/thường
  const excelEx = {
    gradingMode: 'auto',
    expectedAnswers: ['=SUMIFS(D2:D20, A2:A20, "Laptop") | =SUMIF(A2:A20,"Laptop",D2:D20)'],
    matchOptions: { ignoreCase: true, trimSpaces: true, ignoreAccents: false, numericTolerance: 0 },
  };
  assert.equal(grader.matchAutoAnswer(excelEx, '  = sumifs( d2 : d20 , a2:a20 , "laptop" ) ').matched, true);
  assert.equal(grader.matchAutoAnswer(excelEx, '=sumif(a2:a20,"Laptop",d2:d20)').matched, true);
  assert.equal(grader.matchAutoAnswer(excelEx, '=COUNTIF(A2:A20,"Laptop")').matched, false);

  // Số học có dấu phân cách và sai số cho phép
  const numEx = {
    gradingMode: 'auto',
    expectedAnswers: ['1250000'],
    matchOptions: { ignoreCase: true, trimSpaces: true, numericTolerance: 5 },
  };
  assert.equal(grader.matchAutoAnswer(numEx, '1.250.000').matched, true);
  assert.equal(grader.matchAutoAnswer(numEx, '1,250,002').matched, true);
  assert.equal(grader.matchAutoAnswer(numEx, '1250100').matched, false);

  // Bỏ dấu tiếng Việt khi bật ignoreAccents
  const textEx = {
    gradingMode: 'auto',
    expectedAnswers: ['Định dạng có điều kiện'],
    matchOptions: { ignoreCase: true, trimSpaces: true, ignoreAccents: true },
  };
  assert.equal(grader.matchAutoAnswer(textEx, 'dinh dang co dieu kien').matched, true);
});

test('gradeExerciseSubmission: hỗ trợ chế độ auto và hybrid fallback an toàn', async () => {
  const autoEx = {
    prompt: 'Phím tắt lưu tài liệu?',
    gradingMode: 'auto',
    expectedAnswers: ['Ctrl + S', 'Ctrl+S'],
    hint: 'Nhấn giữ Ctrl kèm chữ S',
  };
  const pass = await grader.gradeExerciseSubmission(autoEx, 'ctrl + s');
  assert.equal(pass.correct, true);
  assert.equal(pass.matchedBy, 'auto');
  assert.equal(pass.score, 100);

  const fail = await grader.gradeExerciseSubmission(autoEx, 'Ctrl + P');
  assert.equal(fail.correct, false);
  assert.equal(fail.matchedBy, 'auto');
  assert.equal(fail.feedback, 'Nhấn giữ Ctrl kèm chữ S');

  const hybridEx = {
    prompt: 'Hàm tính trung bình cộng?',
    gradingMode: 'hybrid',
    expectedAnswers: ['=AVERAGE(A1:A10)'],
  };
  const hybridInstant = await grader.gradeExerciseSubmission(hybridEx, ' = average(a1:a10) ');
  assert.equal(hybridInstant.correct, true);
  assert.equal(hybridInstant.matchedBy, 'auto');
});

test('mapExercises & computeUnits: ẩn đáp án chuẩn và tiêu chí AI khỏi payload học viên', () => {
  const unit = {
    id: 'u-ex-1',
    title: 'Chặng 1',
    pathNodes: [
      {
        key: 'ex-node',
        label: 'Bài tập tự nhập',
        icon: 'clipboard',
        sortOrder: 0,
        active: true,
        exercises: [
          {
            _id: '507f1f77bcf86cd799439011',
            title: 'Tính tổng',
            prompt: 'Viết công thức tính tổng B2:B10',
            gradingMode: 'hybrid',
            expectedAnswers: ['=SUM(B2:B10)'],
            aiCriteria: 'Đúng hàm SUM là đạt',
            hint: 'Dùng hàm SUM',
            explanation: 'Hàm SUM dùng để cộng tổng vùng ô',
            xpReward: 15,
          },
        ],
      },
    ],
  };

  // Admin xem được đầy đủ đáp án và tiêu chí AI
  const adminNodes = pathService.mapPathNodesRaw(unit, { admin: true });
  assert.deepEqual(adminNodes[0].exercises[0].expectedAnswers, ['=SUM(B2:B10)']);
  assert.equal(adminNodes[0].exercises[0].aiCriteria, 'Đúng hàm SUM là đạt');

  // Học viên KHÔNG bị lộ expectedAnswers / aiCriteria khi chưa qua
  const [studentUnitPending] = pathService.computeUnits([unit], new Map());
  const pendingEx = studentUnitPending.pathNodes[0].exercises[0];
  assert.equal(pendingEx.passed, false);
  assert.equal(pendingEx.expectedAnswers, undefined);
  assert.equal(pendingEx.aiCriteria, undefined);
  assert.equal(pendingEx.explanation, undefined);
  assert.equal(studentUnitPending.pathNodes[0].state, 'active');

  // Học viên hoàn thành đề bài tập -> node chuyển completed và hiện explanation
  const [studentUnitDone] = pathService.computeUnits([unit], new Map([
    ['u-ex-1', { passedExercises: ['ex-node:507f1f77bcf86cd799439011'] }],
  ]));
  assert.equal(studentUnitDone.pathNodes[0].state, 'completed');
  assert.equal(studentUnitDone.pathNodes[0].exercises[0].passed, true);
  assert.equal(studentUnitDone.pathNodes[0].exercises[0].explanation, 'Hàm SUM dùng để cộng tổng vùng ô');
});

test('UI Admin giữ nguyên cô lập theme (không gắn data-theme="dewskill") & cấu trúc gọn theo 3 điểm chốt', () => {
  const adminTab = read('client/src/components/admin/tabs/AdminDailyPracticeTab.jsx');
  const adminEditor = read('client/src/components/admin/tabs/AdminMilestoneEditor.jsx');
  const adminEx = read('client/src/components/admin/tabs/AdminDropletExerciseEditor.jsx');
  for (const code of [adminTab, adminEditor, adminEx]) {
    assert.ok(!code.includes('data-theme="dewskill"'), 'Admin không được gắn data-theme="dewskill"');
  }
  assert.ok(adminTab.includes('MAX_DROPLETS_PER_UNIT = 6'));
  assert.ok(adminTab.includes('<UnitsManager'));
  assert.ok(adminTab.includes('<UnitPathNodesPanel'));
  assert.ok(adminTab.includes('<UnitVideosPanel'));
  assert.ok(adminTab.includes('UnitStepVideosPanel'));
  assert.ok(adminTab.includes('Lưu danh sách video'));
  assert.ok(adminTab.includes('<AdminMilestoneEditor'));
  assert.ok(adminTab.includes('Kho câu hỏi toàn chủ đề'));

  assert.ok(adminEditor.includes('onDragStart') && adminEditor.includes('onDrop'));
  assert.ok(adminEditor.includes('moveSection'));
  assert.ok(adminEditor.includes('StudentPreviewModal'));
  assert.ok(adminEditor.includes('<AdminDropletExerciseEditor'));
  assert.ok(adminEditor.includes('Thành phần bổ trợ tuỳ chọn'));
  assert.ok(!adminEditor.includes('Dữ liệu của 3 mức Dễ, Vừa, Khó độc lập hoàn toàn với nhau'));
});

test('Hạt 1 chỉ soạn 1 bộ (easy) vẫn mở khóa Hạt 2 khi hoàn thành easy', () => {
  const unit = {
    id: 'u-unlock-2',
    title: 'Chặng 1',
    pathNodes: [
      {
        key: 'study',
        label: 'Học bài',
        icon: 'book',
        sortOrder: 0,
        active: true,
        levelConfigs: {
          easy: {
            sectionOrder: ['video', 'content', 'file', 'practice'],
            hiddenSections: [],
            content: { title: 'Bài 1', body: 'Nội dung học bài' },
            files: [{ id: 'f1', title: 'Doc.pdf', url: '/uploads/doc.pdf', name: 'doc.pdf' }],
            video: { title: 'Video 1', url: 'https://www.youtube.com/watch?v=2lbtbJab5Fs', checks: [] },
          },
        },
      },
      {
        key: 'practice-1',
        label: 'Luyện tập',
        icon: 'dumbbell',
        sortOrder: 1,
        active: true,
      },
    ],
  };

  const [beforeDone] = pathService.computeUnits([unit], new Map());
  assert.equal(beforeDone.pathNodes[0].state, 'active');
  assert.equal(beforeDone.pathNodes[1].state, 'locked');

  const [afterEasyDone] = pathService.computeUnits([unit], new Map([
    ['u-unlock-2', {
      completedSections: [
        'study:easy:video',
        'study:easy:content',
        'study:easy:file',
        'study:easy:practice',
      ],
    }],
  ]));
  assert.equal(afterEasyDone.pathNodes[0].state, 'completed');
  assert.equal(afterEasyDone.pathNodes[1].state, 'active');
  assert.equal(afterEasyDone.pathNodes[1].levels[0].state, 'active');
});

test('Nâng cấp gói ở Chặng 2 mở CourseEnrollmentModal (Hình 1), ẩn FreeMeetPlanModal (Hình 3) và mở khóa Chặng 2 khi hasFullPathAccess=true', () => {
  const pathViewCode = read('client/src/components/student/dailyPractice/PathView.jsx');
  const pageCode = read('client/src/components/student/dailyPractice/DailyPracticePage.jsx');
  const modalCode = read('client/src/components/student/courses/CourseEnrollmentModal.jsx');

  assert.ok(pathViewCode.includes('<CourseEnrollmentModal'));
  assert.ok(!pathViewCode.includes('<FreeMeetPlanModal'));
  assert.ok(pageCode.includes('<CourseEnrollmentModal'));
  assert.ok(!pageCode.includes('<FreeMeetPlanModal'));
  assert.ok(modalCode.includes('z-[9700]'));

  const unit1 = {
    id: 'u-sub-1',
    title: 'Chặng 1',
    pathNodes: [
      { key: 'study', label: 'Học bài', icon: 'book', sortOrder: 0, active: true },
      { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell', sortOrder: 1, active: true },
    ],
  };
  const unit2 = {
    id: 'u-sub-2',
    title: 'Chặng 2',
    pathNodes: [
      { key: 'study', label: 'Học bài', icon: 'book', sortOrder: 0, active: true },
      { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell', sortOrder: 1, active: true },
    ],
  };

  const lockedList = pathService.computeUnits([unit1, unit2], new Map(), {
    hasFullPathAccess: false,
    requireSubscription: false,
  });
  assert.equal(lockedList[0].requiresSubscription, false);
  assert.equal(lockedList[1].state, 'locked');
  assert.equal(lockedList[1].requiresSubscription, true);

  const unlockedList = pathService.computeUnits([unit1, unit2], new Map(), {
    hasFullPathAccess: true,
    requireSubscription: false,
  });
  assert.equal(unlockedList[1].requiresSubscription, false);
});

test('Không cho vượt chặng khi chưa xong đủ các phần trước và hiển thị giọt Vượt chặng bị mờ khóa như các giọt khóa khác', () => {
  const mkUnitNodes = (completeLockMode = 'unlocked') => [
    {
      key: 'study',
      label: 'Học bài',
      icon: 'book',
      sortOrder: 0,
      active: true,
      levelConfigs: {
        easy: {
          sectionOrder: ['video', 'content'],
          hiddenSections: ['file', 'practice'],
          content: { title: 'Bài 1', body: 'Nội dung' },
          video: { title: 'Video 1', url: 'https://www.youtube.com/watch?v=2lbtbJab5Fs', checks: [] },
        },
      },
    },
    { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell', sortOrder: 1, active: true },
    { key: 'challenge', label: 'Thử thách', icon: 'flame', sortOrder: 2, active: true },
    {
      key: 'exercise-1',
      label: 'Bài tập tự nhập',
      icon: 'clipboard',
      sortOrder: 3,
      active: true,
      exercises: [
        { _id: '507f1f77bcf86cd799439021', title: 'BT1', prompt: 'P1', gradingMode: 'auto', expectedAnswers: ['A'] },
        { _id: '507f1f77bcf86cd799439022', title: 'BT2', prompt: 'P2', gradingMode: 'auto', expectedAnswers: ['B'] },
        { _id: '507f1f77bcf86cd799439023', title: 'BT3', prompt: 'P3', gradingMode: 'auto', expectedAnswers: ['C'] },
      ],
    },
    { key: 'complete', label: 'Vượt chặng', icon: 'crown', sortOrder: 4, active: true, lockMode: completeLockMode },
  ];

  const unit1 = { id: 'u-lock-1', title: 'Chặng 1', pathNodes: mkUnitNodes('unlocked') };
  const unit2 = { id: 'u-lock-2', title: 'Chặng 2', pathNodes: mkUnitNodes('unlocked') };

  // Chưa xong Hạt 4 (0/3 bài tập) -> Hạt 5 phải locked và unit.canTestOut = false dù lockMode='unlocked'
  const partialProgress = new Map([
    ['u-lock-1', {
      completedSections: ['study:easy:video', 'study:easy:content'],
      completedSteps: [
        'practice-1:learn', 'practice-1:practice', 'practice-1:challenge',
        'challenge:learn', 'challenge:practice', 'challenge:challenge',
      ],
      passedExercises: [],
    }],
  ]);
  const [beforeExDone, lockedUnit2] = pathService.computeUnits([unit1, unit2], partialProgress);
  assert.equal(beforeExDone.pathNodes[3].state, 'active');
  assert.equal(beforeExDone.pathNodes[4].state, 'locked');
  assert.equal(beforeExDone.canTestOut, false);
  assert.equal(lockedUnit2.state, 'locked');
  assert.equal(lockedUnit2.canTestOut, false);

  // Xong đủ cả 3 bài tập ở Hạt 4 -> Hạt 5 mở sang active và unit.canTestOut = true
  const doneProgress = new Map([
    ['u-lock-1', {
      completedSections: ['study:easy:video', 'study:easy:content'],
      completedSteps: [
        'practice-1:learn', 'practice-1:practice', 'practice-1:challenge',
        'challenge:learn', 'challenge:practice', 'challenge:challenge',
      ],
      passedExercises: [
        'exercise-1:507f1f77bcf86cd799439021',
        'exercise-1:507f1f77bcf86cd799439022',
        'exercise-1:507f1f77bcf86cd799439023',
      ],
    }],
  ]);
  const [afterExDone] = pathService.computeUnits([unit1, unit2], doneProgress);
  assert.equal(afterExDone.pathNodes[3].state, 'completed');
  assert.equal(afterExDone.pathNodes[4].state, 'active');
  assert.equal(afterExDone.canTestOut, true);

  // Kiểm tra UI hiển thị mờ khóa & bỏ nút nhảy cóc Kiểm tra vượt
  const journeyCode = read('client/src/components/student/dailyPractice/DewdropHorizontalJourney.jsx');
  const popoverCode = read('client/src/components/student/dailyPractice/StageNodePopover.jsx');
  const headerCode = read('client/src/components/student/dailyPractice/PathUnitStageHeader.jsx');

  const statusBlock = journeyCode.slice(journeyCode.indexOf('const status ='), journeyCode.indexOf('const icon ='));
  assert.ok(statusBlock.indexOf('isLocked') < statusBlock.indexOf('isGoalTrophy'), 'status phải ưu tiên isLocked trước isGoalTrophy');
  const iconBlock = journeyCode.slice(journeyCode.indexOf('const icon ='), journeyCode.indexOf('return {'));
  assert.ok(iconBlock.indexOf('isLocked') < iconBlock.indexOf('isGoalTrophy'), 'icon phải ưu tiên isLocked trước isGoalTrophy');

  const borderFn = popoverCode.slice(popoverCode.indexOf('function resolvePopoverBorder'), popoverCode.indexOf('export default function StageNodePopover'));
  assert.ok(borderFn.indexOf("stage.status === 'locked'") < borderFn.indexOf("stage.type === 'milestone'"));
  assert.ok(!headerCode.includes('Kiểm tra vượt'), 'Header chặng khóa không còn nút Kiểm tra vượt nhảy cóc');
});

test('CoursePreviewModal nâng cấp Giọt Nước 3D cô lập [data-theme="dewskill"] và gắn vào danh mục khóa học', () => {
  const modalCode = read('client/src/components/student/courses/CoursePreviewModal.jsx');
  const catalogCode = read('client/src/components/student/courses/StudentCoursesCatalogPage.jsx');

  assert.ok(modalCode.includes('data-theme={getDewSkillThemeAttr(effectiveUser)}'));
  assert.ok(modalCode.includes('dew-modal'));
  assert.ok(modalCode.includes('dew-btn-orange'));
  assert.ok(modalCode.includes('dew-btn-primary'));
  assert.ok(modalCode.includes('dew-btn-white'));
  assert.ok(modalCode.includes("topics.length === 1 ? 'w-full space-y-3'"));
  assert.ok(!modalCode.includes('Sparkles'));
  assert.ok(catalogCode.includes('<CoursePreviewModal'));
  assert.ok(!catalogCode.includes('<ClassDetailModal'));
});

test('StudentCoursesCatalogPage sắp xếp 3 tầng Banner -> Bộ lọc -> KHÓA HỌC PHÙ HỢP và lọc chuẩn 3 điều kiện', async () => {
  const {
    CATALOG_CATEGORY_FILTERS,
    CATALOG_LEVEL_FILTERS,
    resolveCourseLevel,
    filterCatalogCourses,
  } = await import('../../client/src/utils/courseCatalogFilter.js');

  assert.deepEqual(
    CATALOG_CATEGORY_FILTERS.map((c) => c.id),
    ['all', 'my-courses', 'cap-1', 'cap-2', 'cap-3', 'mos', 'hs-sv', 'nguoi-di-lam'],
  );
  assert.deepEqual(
    CATALOG_LEVEL_FILTERS.map((l) => l.id),
    ['all', 'basic', 'intermediate', 'advanced'],
  );

  const sampleCourses = [
    { _id: '1', name: 'Tin học Lớp 1–2 (Khởi động)', tier: 'cap-1', grade: 1, shortDescription: 'Làm quen máy tính' },
    { _id: '2', name: 'Tin học Văn phòng cho HS – Sinh viên', tier: 'hs-sv', shortDescription: 'Word Excel' },
    { _id: '3', name: 'Excel Thực chiến cho Kế toán & Nhân sự', tier: 'nguoi-di-lam', shortDescription: 'XLOOKUP SUMIFS' },
    { _id: '4', name: 'Luyện thi MOS Excel Expert', tier: 'mos', curriculumSource: 'CERTIPORT', shortDescription: 'Chứng chỉ MOS' },
  ];

  assert.equal(resolveCourseLevel(sampleCourses[0]), 'basic');
  assert.equal(resolveCourseLevel(sampleCourses[1]), 'intermediate');
  assert.equal(resolveCourseLevel(sampleCourses[3]), 'advanced');

  // Lọc kết hợp category + level + search không dấu
  const myOnly = filterCatalogCourses(sampleCourses, {
    selectedCategory: 'my-courses',
    myCourseIds: new Set(['1', '2']),
  });
  assert.deepEqual(myOnly.map((c) => c._id), ['1', '2']);

  const combo = filterCatalogCourses(sampleCourses, {
    selectedCategory: 'nguoi-di-lam',
    selectedLevel: 'intermediate',
    searchQuery: 'ke toan',
  });
  assert.deepEqual(combo.map((c) => c._id), ['3']);

  const catalogCode = read('client/src/components/student/courses/StudentCoursesCatalogPage.jsx');
  assert.ok(catalogCode.includes('getDewSkillThemeAttr'));
  assert.equal(catalogCode.includes('data-theme="dewskill"'), false);
  assert.equal(catalogCode.includes('KHÓA HỌC CỦA TÔI ('), false);

  const idxBanner = catalogCode.indexOf('TẦNG 1 — CỤM BANNER QUẢNG CÁO TRÊN CÙNG');
  const idxFilter = catalogCode.indexOf('TẦNG 2 — BỘ LỌC CHỌN TRÌNH ĐỘ, CẤP HỌC & TÌM KIẾM');
  const idxGrid = catalogCode.indexOf('KHÓA HỌC PHÙ HỢP');
  assert.ok(idxBanner > 0 && idxFilter > idxBanner && idxGrid > idxFilter, 'Đúng thứ tự 3 tầng Banner -> Bộ lọc -> Lưới');
});
