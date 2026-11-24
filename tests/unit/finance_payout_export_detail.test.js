'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');

function makeChain(rows) {
  let result = Array.isArray(rows) ? [...rows] : rows;
  const chain = {
    sort(sortObj) {
      if (Array.isArray(result) && sortObj && sortObj.date) {
        result = [...result].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      }
      return chain;
    },
    select() { return chain; },
    lean: async () => result,
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
  return chain;
}

function createFinanceDetailHarness({ schedules = [], students = [], teachers = [], transactions = [] } = {}) {
  const schedPath = require.resolve('../../models/Schedule');
  const stuPath = require.resolve('../../models/Student');
  const teacherPath = require.resolve('../../models/Teacher');
  const txPath = require.resolve('../../models/Transaction');
  const svcPath = require.resolve('../../services/financePayoutDetailService');

  const originals = new Map([
    [schedPath, require.cache[schedPath]],
    [stuPath, require.cache[stuPath]],
    [teacherPath, require.cache[teacherPath]],
    [txPath, require.cache[txPath]],
    [svcPath, require.cache[svcPath]],
  ]);

  const toIdSet = (cond) => {
    if (!cond) return null;
    if (cond.$in) return new Set(cond.$in.map(String));
    return new Set([String(cond)]);
  };

  require.cache[schedPath] = {
    id: schedPath,
    filename: schedPath,
    loaded: true,
    exports: {
      find: (query = {}) => {
        let rows = schedules;
        if (query._id) {
          const ids = toIdSet(query._id);
          rows = rows.filter((r) => ids.has(String(r._id)));
        }
        if (query.studentId) {
          const sids = toIdSet(query.studentId);
          rows = rows.filter((r) => sids.has(String(r.studentId)));
        }
        if (query.status) {
          rows = rows.filter((r) => r.status === query.status);
        }
        return makeChain(rows);
      },
    },
  };

  require.cache[stuPath] = {
    id: stuPath,
    filename: stuPath,
    loaded: true,
    exports: {
      find: (query = {}) => {
        let rows = students;
        if (query._id) {
          const ids = toIdSet(query._id);
          rows = rows.filter((r) => ids.has(String(r._id)));
        }
        return makeChain(rows);
      },
    },
  };

  require.cache[teacherPath] = {
    id: teacherPath,
    filename: teacherPath,
    loaded: true,
    exports: {
      find: (query = {}) => {
        let rows = teachers;
        if (query._id) {
          const ids = toIdSet(query._id);
          rows = rows.filter((r) => ids.has(String(r._id)));
        }
        return makeChain(rows);
      },
    },
  };

  require.cache[txPath] = {
    id: txPath,
    filename: txPath,
    loaded: true,
    exports: {
      find: (query = {}) => {
        let rows = transactions;
        if (query._id) {
          const ids = toIdSet(query._id);
          rows = rows.filter((r) => ids.has(String(r._id)));
        }
        return makeChain(rows);
      },
    },
  };

  delete require.cache[svcPath];
  const svc = require('../../services/financePayoutDetailService');

  const restore = () => {
    for (const [p, orig] of originals.entries()) {
      if (orig) require.cache[p] = orig;
      else delete require.cache[p];
    }
  };

  return { svc, restore };
}

test('enrichTransactionsWithSessionDetails exposes ALL students, session ordinals, and dates without 120-char truncation', async (t) => {
  const s1 = 'stu-1';
  const s2 = 'stu-2';
  const s3 = 'stu-3';

  const schedules = [
    // Student 1 completed 3 Word sessions (older without enrollmentId, newer with enrollmentId)
    { _id: 'sch-s1-1', studentId: s1, studentName: 'HOÀNG THỊ KIM TRỌNG', course: 'Word Cơ Bản', status: 'completed', date: '2026-10-20T07:00:00Z', startTime: '19:00', endTime: '20:30' },
    { _id: 'sch-s1-2', studentId: s1, studentName: 'HOÀNG THỊ KIM TRỌNG', enrollmentId: 'enr-1', course: 'Word Cơ Bản', status: 'completed', date: '2026-10-30T07:00:00Z', startTime: '19:00', endTime: '20:30' },
    { _id: 'sch-s1-3', studentId: s1, studentName: 'HOÀNG THỊ KIM TRỌNG', enrollmentId: 'enr-1', course: 'Word Cơ Bản', status: 'completed', date: '2026-11-06T07:00:00Z', startTime: '19:00', endTime: '20:30' },
    // Student 2
    { _id: 'sch-s2-1', studentId: s2, studentName: 'LAI LINH', course: 'Excel Nâng Cao', status: 'completed', date: '2026-11-18T07:00:00Z', startTime: '20:00', endTime: '21:30' },
    // Student 3
    { _id: 'sch-s3-1', studentId: s3, studentName: 'NGUYỄN THỊ TUYẾT NHUNG', course: 'PowerPoint', status: 'completed', date: '2026-11-19T07:00:00Z', startTime: '18:00', endTime: '19:30' },
    { _id: 'sch-s3-2', studentId: s3, studentName: 'NGUYỄN THỊ TUYẾT NHUNG', course: 'PowerPoint', status: 'completed', date: '2026-11-21T07:00:00Z', startTime: '18:00', endTime: '19:30' },
  ];

  const students = [
    { _id: s1, name: 'HOÀNG THỊ KIM TRỌNG', studentCode: 'HV000101' },
    { _id: s2, name: 'LAI LINH', studentCode: 'HV000102' },
    { _id: s3, name: 'NGUYỄN THỊ TUYẾT NHUNG', studentCode: 'HV000103' },
  ];

  const txId = '674000000000000000000001';
  const tx = {
    _id: txId,
    teacherId: { _id: 'tea-1', name: 'PHÍ VĂN THẮNG', phone: '0901234567' },
    teacherName: 'PHÍ VĂN THẮNG',
    amount: 900000,
    starBonusAmount: 150000,
    starBonusMonths: ['2026-11'],
    // Truncated 120-char bank transfer memo just like production DB
    description: 'Buổi 2 - HOÀNG THỊ KIM TRỌNG (30/10/2026); Buổi 3 - HOÀNG THỊ KIM TRỌNG (6/11/2026); Buổi 1 - LAI LINH (18/11/2026); Bu…',
    month: 'Tháng 11/2026',
    status: 'confirmed',
    confirmedBy: 'Admin',
    confirmedAt: '2026-11-24T08:09:00Z',
    // Snapshot missing sessionNo & studentCode (pre-upgrade record)
    paymentSessionIds: ['sch-s1-2', 'sch-s1-3', 'sch-s2-1', 'sch-s3-1', 'sch-s3-2'],
    paymentSessionDetails: [
      { sessionId: 'sch-s1-2', studentId: s1, studentName: 'HOÀNG THỊ KIM TRỌNG', date: '2026-10-30T07:00:00Z', courseName: 'Word Cơ Bản', allocatedAmount: 150000 },
      { sessionId: 'sch-s1-3', studentId: s1, studentName: 'HOÀNG THỊ KIM TRỌNG', date: '2026-11-06T07:00:00Z', courseName: 'Word Cơ Bản', allocatedAmount: 150000 },
      { sessionId: 'sch-s2-1', studentId: s2, studentName: 'LAI LINH', date: '2026-11-18T07:00:00Z', courseName: 'Excel Nâng Cao', allocatedAmount: 150000 },
      { sessionId: 'sch-s3-1', studentId: s3, studentName: 'NGUYỄN THỊ TUYẾT NHUNG', date: '2026-11-19T07:00:00Z', courseName: 'PowerPoint', allocatedAmount: 150000 },
      { sessionId: 'sch-s3-2', studentId: s3, studentName: 'NGUYỄN THỊ TUYẾT NHUNG', date: '2026-11-21T07:00:00Z', courseName: 'PowerPoint', allocatedAmount: 150000 },
    ],
  };

  const legacyTextOnlyTx = {
    _id: '674000000000000000000002',
    teacherName: 'PHÍ VĂN THẮNG',
    amount: 300000,
    description: 'Buổi 1 - TRẦN VĂN C (01/10/2026); Buổi 2 - LÊ THỊ D (05/10/2026)',
    status: 'confirmed',
    createdAt: '2026-10-06T03:00:00Z',
    paymentSessionIds: [],
    paymentSessionDetails: [],
  };

  const harness = createFinanceDetailHarness({
    schedules,
    students,
    teachers: [{ _id: 'tea-1', name: 'PHÍ VĂN THẮNG', phone: '0901234567' }],
    transactions: [tx],
  });
  t.after(harness.restore);

  const enriched = await harness.svc.enrichTransactionsWithSessionDetails([tx, legacyTextOnlyTx]);
  assert.equal(enriched.length, 2);

  const first = enriched[0];
  assert.equal(first.totalSessionsCount, 5);
  assert.equal(first.totalStudentsCount, 3);
  assert.equal(first.sessionDetails.length, 5);
  assert.equal(first.sessionDetails[0].sessionNo, 2);
  assert.equal(first.sessionDetails[0].studentCode, 'HV000101');
  assert.equal(first.sessionDetails[1].sessionNo, 3);
  assert.equal(first.sessionDetails[2].studentName, 'LAI LINH');
  assert.equal(first.sessionDetails[3].studentName, 'NGUYỄN THỊ TUYẾT NHUNG');
  assert.equal(first.sessionDetails[3].sessionNo, 1);
  assert.equal(first.sessionDetails[4].sessionNo, 2);

  // Full untruncated text must include ALL 3 students (unlike the old 120-char memo!)
  assert.match(first.fullSessionsText, /Buổi 2 - HOÀNG THỊ KIM TRỌNG \(30\/10\/2026\)/);
  assert.match(first.fullSessionsText, /Buổi 1 - LAI LINH \(18\/11\/2026\)/);
  assert.match(first.fullSessionsText, /Buổi 2 - NGUYỄN THỊ TUYẾT NHUNG \(21\/11\/2026\)/);
  assert.ok(!first.fullSessionsText.endsWith('…'));

  const second = enriched[1];
  assert.equal(second.totalStudentsCount, 2);
  assert.equal(second.totalSessionsCount, 2);
  assert.equal(second.studentSummary[0].studentName, 'TRẦN VĂN C');
  assert.equal(second.studentSummary[1].studentName, 'LÊ THỊ D');

  // Verify 2-sheet Excel workbook generation for payouts
  const txBuf = harness.svc.buildTransactionsExportWorkbook(enriched);
  const wbTx = XLSX.read(txBuf, { type: 'buffer' });
  assert.deepEqual(wbTx.SheetNames, ['TongHopPhieuChi', 'ChiTietBuoiDay_HocVien']);
  const txSummarySheet = XLSX.utils.sheet_to_json(wbTx.Sheets.TongHopPhieuChi);
  const txDetailSheet = XLSX.utils.sheet_to_json(wbTx.Sheets.ChiTietBuoiDay_HocVien);
  assert.equal(txSummarySheet.length, 2);
  assert.equal(txSummarySheet[0]['Số buổi'], 5);
  assert.equal(txSummarySheet[0]['Số học viên'], 3);
  assert.equal(typeof txSummarySheet[0]['Tổng tiền (VNĐ)'], 'number');
  // 5 sessions + 1 star bonus + 2 legacy fallback sessions = 8 rows
  assert.equal(txDetailSheet.length, 8);
  assert.ok(txDetailSheet.some((r) => r['Tên học viên'] === 'NGUYỄN THỊ TUYẾT NHUNG' && r['Buổi thứ'] === 2 && r['Ngày học'] === '21/11/2026'));
  assert.ok(txDetailSheet.some((r) => r['Tên học viên'] === 'Thưởng sao giảng viên' && r['Thù lao buổi (VNĐ)'] === 150000));
});

test('enrichLedgerEntriesWithDetails and buildLedgerExportWorkbook keep numeric amounts and expose all students', async (t) => {
  const s1 = 'stu-1';
  const s2 = 'stu-2';
  const txId = '674000000000000000000099';

  const schedules = [
    { _id: 'sch-a', studentId: s1, studentName: 'ĐOÀN THỊ NHÀN', course: 'MOS Excel', status: 'completed', date: '2026-11-10T07:00:00Z', startTime: '19:00', endTime: '20:30' },
    { _id: 'sch-b', studentId: s2, studentName: 'LÊ THỊ HOÀI THƯƠNG', course: 'Tin học VP', status: 'completed', date: '2026-11-12T07:00:00Z', startTime: '20:00', endTime: '21:30' },
  ];
  const students = [
    { _id: s1, name: 'ĐOÀN THỊ NHÀN', studentCode: 'HV000138' },
    { _id: s2, name: 'LÊ THỊ HOÀI THƯƠNG', studentCode: 'HV000137' },
  ];
  const teachers = [{ _id: 'tea-1', name: 'PHÍ VĂN THẮNG', phone: '0901234567' }];
  const transactions = [
    {
      _id: txId,
      teacherId: 'tea-1',
      teacherName: 'PHÍ VĂN THẮNG',
      amount: 300000,
      status: 'confirmed',
      paymentSessionIds: ['sch-a', 'sch-b'],
      paymentSessionDetails: [
        { sessionId: 'sch-a', studentId: s1, studentName: 'ĐOÀN THỊ NHÀN', date: '2026-11-10T07:00:00Z', courseName: 'MOS Excel', allocatedAmount: 150000 },
        { sessionId: 'sch-b', studentId: s2, studentName: 'LÊ THỊ HOÀI THƯƠNG', date: '2026-11-12T07:00:00Z', courseName: 'Tin học VP', allocatedAmount: 150000 },
      ],
    },
  ];

  const ledgerEntries = [
    {
      _id: '674000000000000000000101',
      type: 'salary',
      amount: 300000,
      signedAmount: -300000,
      teacherId: 'tea-1',
      sourceRef: `tx:${txId}`,
      note: 'Buổi 1 - ĐOÀN THỊ NHÀN...',
      postedAt: '2026-11-24T08:11:28Z',
    },
    {
      _id: '674000000000000000000102',
      type: 'payment',
      amount: 1899000,
      signedAmount: 1899000,
      studentId: s1,
      courseName: 'TIN HỌC VĂN PHÒNG',
      note: '=SUM(1+1) formula test',
      postedAt: '2026-11-23T09:00:00Z',
    },
  ];

  const harness = createFinanceDetailHarness({ schedules, students, teachers, transactions });
  t.after(harness.restore);

  const enriched = await harness.svc.enrichLedgerEntriesWithDetails(ledgerEntries);
  assert.equal(enriched[0].teacherName, 'PHÍ VĂN THẮNG');
  assert.equal(enriched[0].totalSessionsCount, 2);
  assert.equal(enriched[0].totalStudentsCount, 2);
  assert.match(enriched[0].fullSessionsText, /ĐOÀN THỊ NHÀN \(10\/11\/2026\)/);
  assert.match(enriched[0].fullSessionsText, /LÊ THỊ HOÀI THƯƠNG \(12\/11\/2026\)/);
  assert.equal(enriched[1].studentName, 'ĐOÀN THỊ NHÀN');
  assert.equal(enriched[1].studentCode, 'HV000138');

  const ledgerBuf = harness.svc.buildLedgerExportWorkbook(enriched);
  const wbLedger = XLSX.read(ledgerBuf, { type: 'buffer' });
  assert.deepEqual(wbLedger.SheetNames, ['TongHopSoCai', 'ChiTietHocVien_BuoiHoc']);
  const summaryRows = XLSX.utils.sheet_to_json(wbLedger.Sheets.TongHopSoCai);
  const detailRows = XLSX.utils.sheet_to_json(wbLedger.Sheets.ChiTietHocVien_BuoiHoc);
  assert.equal(summaryRows.length, 2);
  // Negative salary must be real JS number (-300000), NOT "'-300000"
  assert.strictEqual(summaryRows[0]['Số tiền (VNĐ)'], -300000);
  assert.strictEqual(summaryRows[1]['Số tiền (VNĐ)'], 1899000);
  // Formula string in note must be sanitized with leading '
  assert.equal(summaryRows[1]['Ghi chú gốc'], "'=SUM(1+1) formula test");
  // Detail sheet expands salary (2 sessions) + payment (1 student row) = 3 rows
  assert.equal(detailRows.length, 3);
  assert.equal(detailRows[1]['Tên học viên'], 'LÊ THỊ HOÀI THƯƠNG');
  assert.equal(detailRows[1]['Ngày học'], '12/11/2026');
});
