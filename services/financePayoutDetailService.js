'use strict';

const XLSX = require('xlsx');
const Schedule = require('../models/Schedule');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Transaction = require('../models/Transaction');

const TIMEZONE_VN = 'Asia/Ho_Chi_Minh';

const TX_STATUS_LABEL = {
  confirmed: 'Đã thanh toán',
  pending: 'Chờ xử lý',
  cancelled: 'Đã hủy',
};

const LEDGER_TYPE_LABEL = {
  payment: 'Thanh toán',
  refund: 'Hoàn tiền',
  salary: 'Lương GV',
  bonus: 'Thưởng',
  expense: 'Chi phí',
  discount: 'Giảm giá',
  coupon: 'Coupon',
  adjustment: 'Điều chỉnh',
};

function idStr(val) {
  if (!val) return '';
  if (typeof val === 'object') return String(val._id || val.id || '');
  return String(val);
}

function toPlainObject(doc) {
  if (!doc) return {};
  return typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
}

function formatDateVi(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_VN,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatDateTimeVi(raw) {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIMEZONE_VN,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const pick = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${pick('hour')}:${pick('minute')} ${pick('day')}/${pick('month')}/${pick('year')}`;
}

/**
 * Ngăn Excel injection cho ô dạng chữ (=, +, -, @, tab, cr).
 * Không chạm giá trị kiểu Number để cột tiền vẫn là số thực tính SUM được.
 */
function sanitizeExcelText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) return `'${s}`;
  return s;
}

/**
 * Xây map sessionId -> số buổi thứ mấy (1, 2, 3...) cho mỗi học viên/khóa học
 * dựa trên toàn bộ lịch đã hoàn thành sắp theo ngày học tăng dần.
 */
async function buildSessionOrdinalMap(schedules = []) {
  const list = Array.isArray(schedules) ? schedules.filter(Boolean) : [];
  const studentIds = [...new Set(
    list.map((s) => idStr(s.studentId)).filter(Boolean),
  )];
  if (!studentIds.length) return new Map();

  const completed = await Schedule.find({
    studentId: { $in: studentIds },
    status: 'completed',
  })
    .sort({ date: 1, createdAt: 1 })
    .select('_id studentId enrollmentId course date createdAt')
    .lean();

  // Kiểm tra cặp (studentId, course) có bao nhiêu enrollmentId phân biệt
  const enrollmentSetsByCourse = new Map();
  for (const row of completed) {
    const sid = idStr(row.studentId);
    const courseKey = String(row.course || '').trim().toLowerCase();
    const enrId = idStr(row.enrollmentId);
    if (!enrId) continue;
    const ck = `${sid}|${courseKey}`;
    if (!enrollmentSetsByCourse.has(ck)) enrollmentSetsByCourse.set(ck, new Set());
    enrollmentSetsByCourse.get(ck).add(enrId);
  }

  const groups = new Map();
  for (const row of completed) {
    const sid = idStr(row.studentId);
    const courseKey = String(row.course || '').trim().toLowerCase();
    const enrId = idStr(row.enrollmentId);
    const ck = `${sid}|${courseKey}`;
    const enrCount = enrollmentSetsByCourse.get(ck)?.size || 0;
    const groupKey = enrCount > 1
      ? `${sid}|enr:${enrId || `legacy:${courseKey}`}`
      : ck;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(row);
  }

  const sessionNoMap = new Map();
  for (const groupRows of groups.values()) {
    groupRows.forEach((row, idx) => {
      sessionNoMap.set(idStr(row._id), idx + 1);
    });
  }
  return sessionNoMap;
}

function buildPaymentSessionSnapshots(
  sessions = [],
  totalAmount = 0,
  starBonusAmount = 0,
  { sessionNoMap = null, studentCodeMap = null } = {},
) {
  const list = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
  const teachingAmount = Math.max(0, Number(totalAmount || 0) - Number(starBonusAmount || 0));
  const perSession = list.length ? Math.floor(teachingAmount / list.length) : 0;
  const remainder = list.length ? teachingAmount - (perSession * list.length) : 0;

  return list.map((session, index) => {
    const sid = idStr(session.studentId);
    const schedId = idStr(session._id || session.sessionId);
    const mappedNo = sessionNoMap instanceof Map ? sessionNoMap.get(schedId) : null;
    const mappedCode = studentCodeMap instanceof Map ? studentCodeMap.get(sid) : '';
    return {
      sessionId: session._id || session.sessionId || null,
      studentId: session.studentId || null,
      studentCode: session.studentCode || mappedCode || '',
      studentName: String(session.studentName || 'Học viên').trim() || 'Học viên',
      enrollmentId: session.enrollmentId || null,
      courseId: session.courseId || null,
      date: session.date || null,
      startTime: String(session.startTime || ''),
      endTime: String(session.endTime || ''),
      courseName: String(session.courseName || session.course || session.subject || ''),
      sessionNo: mappedNo ?? (session.sessionNo != null ? Number(session.sessionNo) : null),
      allocatedAmount: perSession + (index === 0 ? remainder : 0),
    };
  });
}

function parseVnDateString(dmy) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dmy || '').trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

/**
 * Fallback phân tích chuỗi ghi chú cũ "Buổi 2 - TÊN HV (30/10/2026); ..." khi phiếu
 * không có paymentSessionIds hoặc paymentSessionDetails.
 */
function parseLegacyNoteSessions(noteText) {
  let raw = String(noteText || '').trim();
  if (!raw) return [];
  raw = raw
    .replace(/\s*·\s*tháng\s+\d{1,2}\/\d{4}.*$/i, '')
    .replace(/\s*\+\s*thưởng sao.*$/i, '')
    .trim();

  const segments = raw.split(';').map((p) => p.trim()).filter(Boolean);
  const parsed = [];
  for (const seg of segments) {
    // Bỏ qua đoạn bị cắt cụt kiểu "Bu..." hoặc "Buổi 1 - NGUY..."
    if (/(\.\.\.|…)$/.test(seg) && !/\(\d{1,2}\/\d{1,2}\/\d{4}\)/.test(seg)) continue;
    const match = /^(?:Bu[oổ]i\s*(\d+)?\s*-\s*)([^()]+?)(?:\s*\((\d{1,2}\/\d{1,2}\/\d{4})\))?$/i.exec(seg);
    if (!match) continue;
    const sessionNo = match[1] ? Number(match[1]) : null;
    const studentName = String(match[2] || '').trim();
    const dateStr = match[3] || '';
    if (!studentName || /^Lương\s/i.test(studentName)) continue;
    parsed.push({
      sessionId: '',
      studentId: null,
      studentCode: '',
      studentName,
      enrollmentId: null,
      courseId: null,
      date: dateStr ? parseVnDateString(dateStr) : null,
      startTime: '',
      endTime: '',
      courseName: '',
      sessionNo,
      allocatedAmount: 0,
      fromLegacyText: true,
    });
  }
  return parsed;
}

function summarizeSessionsByStudent(sessionDetails = []) {
  const list = Array.isArray(sessionDetails) ? sessionDetails : [];
  const groups = new Map();

  for (const item of list) {
    const sid = idStr(item.studentId);
    const sName = String(item.studentName || 'Học viên').trim() || 'Học viên';
    const key = sid || `name:${sName.toLowerCase()}`;
    if (!groups.has(key)) {
      groups.set(key, {
        studentId: sid || null,
        studentCode: String(item.studentCode || ''),
        studentName: sName,
        courseName: String(item.courseName || ''),
        sessionCount: 0,
        allocatedAmount: 0,
        earliestMs: Infinity,
        sessions: [],
      });
    }
    const grp = groups.get(key);
    if (!grp.studentCode && item.studentCode) grp.studentCode = String(item.studentCode);
    if (!grp.courseName && item.courseName) grp.courseName = String(item.courseName);
    const dtMs = item.date ? new Date(item.date).getTime() : Infinity;
    if (Number.isFinite(dtMs) && dtMs < grp.earliestMs) grp.earliestMs = dtMs;

    grp.sessionCount += 1;
    grp.allocatedAmount += Number(item.allocatedAmount) || 0;
    grp.sessions.push({
      sessionId: idStr(item.sessionId),
      sessionNo: item.sessionNo != null && Number(item.sessionNo) > 0 ? Number(item.sessionNo) : null,
      date: item.date || null,
      dateLabel: formatDateVi(item.date),
      startTime: String(item.startTime || ''),
      endTime: String(item.endTime || ''),
      courseName: String(item.courseName || ''),
      allocatedAmount: Number(item.allocatedAmount) || 0,
    });
  }

  return [...groups.values()]
    .sort((a, b) => {
      if (a.earliestMs !== b.earliestMs) return a.earliestMs - b.earliestMs;
      return a.studentName.localeCompare(b.studentName, 'vi');
    })
    .map(({ earliestMs: _ignore, ...rest }) => rest);
}

function formatFullSessionsText(sessionDetails = []) {
  const list = Array.isArray(sessionDetails) ? sessionDetails : [];
  if (!list.length) return '';
  return list
    .map((s) => {
      const buoi = s.sessionNo != null && Number(s.sessionNo) > 0
        ? `Buổi ${Number(s.sessionNo)}`
        : 'Buổi';
      const name = String(s.studentName || 'Học viên').trim() || 'Học viên';
      const d = formatDateVi(s.date);
      return d ? `${buoi} - ${name} (${d})` : `${buoi} - ${name}`;
    })
    .join('; ');
}

function sortSessionDetailsChrono(list) {
  return [...list].sort((a, b) => {
    const ta = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
    const tb = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    const na = Number(a.sessionNo) || 0;
    const nb = Number(b.sessionNo) || 0;
    if (na !== nb) return na - nb;
    return String(a.studentName || '').localeCompare(String(b.studentName || ''), 'vi');
  });
}

async function fetchSchedulesAndOrdinalsByIds(scheduleIds = []) {
  const uniqueIds = [...new Set(scheduleIds.map(idStr).filter(Boolean))];
  const scheduleMap = new Map();
  let sessionNoMap = new Map();
  if (!uniqueIds.length) return { scheduleMap, sessionNoMap };

  const docs = await Schedule.find({ _id: { $in: uniqueIds } })
    .select('_id studentId studentName enrollmentId courseId date startTime endTime course status createdAt')
    .lean();

  for (const doc of docs) {
    scheduleMap.set(idStr(doc._id), doc);
  }
  if (docs.length) {
    sessionNoMap = await buildSessionOrdinalMap(docs);
  }
  return { scheduleMap, sessionNoMap };
}

async function fetchStudentMetaMap(studentIds = []) {
  const uniqueIds = [...new Set(studentIds.map(idStr).filter(Boolean))];
  const studentMap = new Map();
  if (!uniqueIds.length) return studentMap;

  const docs = await Student.find({ _id: { $in: uniqueIds } })
    .select('_id name studentCode phone')
    .lean();
  for (const doc of docs) {
    studentMap.set(idStr(doc._id), doc);
  }
  return studentMap;
}

async function fetchTeacherMetaMap(teacherIds = []) {
  const uniqueIds = [...new Set(teacherIds.map(idStr).filter(Boolean))];
  const teacherMap = new Map();
  if (!uniqueIds.length) return teacherMap;

  const docs = await Teacher.find({ _id: { $in: uniqueIds } })
    .select('_id name phone specialty bankAccount')
    .lean();
  for (const doc of docs) {
    teacherMap.set(idStr(doc._id), doc);
  }
  return teacherMap;
}

function buildNormalizedSessionsForTx(tx, { scheduleMap, sessionNoMap, studentMap }) {
  const rawDetails = Array.isArray(tx.paymentSessionDetails) ? tx.paymentSessionDetails : [];
  const rawIds = Array.isArray(tx.paymentSessionIds) ? tx.paymentSessionIds : [];

  let normalized = [];
  if (rawDetails.length > 0) {
    normalized = rawDetails.map((d) => {
      const sid = idStr(d.sessionId);
      const sched = sid ? scheduleMap.get(sid) : null;
      const stuId = idStr(d.studentId || sched?.studentId);
      const stu = stuId ? studentMap.get(stuId) : null;
      const computedNo = sid ? sessionNoMap.get(sid) : null;
      return {
        sessionId: sid,
        studentId: stuId || null,
        studentCode: String(d.studentCode || stu?.studentCode || ''),
        studentName: String(d.studentName || sched?.studentName || stu?.name || 'Học viên').trim(),
        enrollmentId: idStr(d.enrollmentId || sched?.enrollmentId) || null,
        courseId: idStr(d.courseId || sched?.courseId) || null,
        date: d.date || sched?.date || null,
        startTime: String(d.startTime || sched?.startTime || ''),
        endTime: String(d.endTime || sched?.endTime || ''),
        courseName: String(d.courseName || sched?.course || ''),
        sessionNo: computedNo ?? (d.sessionNo != null && Number(d.sessionNo) > 0 ? Number(d.sessionNo) : null),
        allocatedAmount: Number(d.allocatedAmount) || 0,
      };
    });
  } else if (rawIds.length > 0) {
    const resolved = rawIds
      .map((rawId) => scheduleMap.get(idStr(rawId)))
      .filter(Boolean);
    const total = Math.max(0, Number(tx.amount || 0) - Number(tx.starBonusAmount || 0));
    const per = resolved.length ? Math.floor(total / resolved.length) : 0;
    const rem = resolved.length ? total - per * resolved.length : 0;
    normalized = resolved.map((sched, idx) => {
      const sid = idStr(sched._id);
      const stuId = idStr(sched.studentId);
      const stu = stuId ? studentMap.get(stuId) : null;
      return {
        sessionId: sid,
        studentId: stuId || null,
        studentCode: String(stu?.studentCode || ''),
        studentName: String(sched.studentName || stu?.name || 'Học viên').trim(),
        enrollmentId: idStr(sched.enrollmentId) || null,
        courseId: idStr(sched.courseId) || null,
        date: sched.date || null,
        startTime: String(sched.startTime || ''),
        endTime: String(sched.endTime || ''),
        courseName: String(sched.course || ''),
        sessionNo: sessionNoMap.get(sid) ?? null,
        allocatedAmount: per + (idx === 0 ? rem : 0),
      };
    });
  } else {
    normalized = parseLegacyNoteSessions(tx.description || tx.note);
  }

  return sortSessionDetailsChrono(normalized);
}

/**
 * Làm giàu danh sách Transaction (lương GV) với đầy đủ từng học viên, buổi thứ mấy, ngày học.
 */
async function enrichTransactionsWithSessionDetails(transactions = []) {
  const list = Array.isArray(transactions) ? transactions.map(toPlainObject) : [];
  if (!list.length) return [];

  const allScheduleIds = [];
  const allStudentIds = [];
  for (const tx of list) {
    for (const id of (tx.paymentSessionIds || [])) allScheduleIds.push(id);
    for (const d of (tx.paymentSessionDetails || [])) {
      if (d?.sessionId) allScheduleIds.push(d.sessionId);
      if (d?.studentId) allStudentIds.push(d.studentId);
    }
  }

  const { scheduleMap, sessionNoMap } = await fetchSchedulesAndOrdinalsByIds(allScheduleIds);
  for (const sched of scheduleMap.values()) {
    if (sched.studentId) allStudentIds.push(sched.studentId);
  }
  const studentMap = await fetchStudentMetaMap(allStudentIds);

  return list.map((tx) => {
    const sessionDetails = buildNormalizedSessionsForTx(tx, { scheduleMap, sessionNoMap, studentMap });
    const studentSummary = summarizeSessionsByStudent(sessionDetails);
    const fullSessionsText = formatFullSessionsText(sessionDetails);
    return {
      ...tx,
      sessionDetails,
      studentSummary,
      totalSessionsCount: sessionDetails.length || Number(tx.sessionsCount) || 0,
      totalStudentsCount: studentSummary.length,
      fullSessionsText,
    };
  });
}

function extractTxIdFromLedger(entry) {
  const metaTx = idStr(entry?.metadata?.transactionId);
  if (metaTx) return metaTx;
  const srcRef = String(entry?.sourceRef || '').trim();
  const match = /^tx:([a-f0-9]{24})$/i.exec(srcRef);
  return match ? match[1] : '';
}

/**
 * Làm giàu danh sách LedgerEntry:
 * - Bút toán payment/refund/discount/coupon: bổ sung studentName, studentCode
 * - Bút toán salary: liên kết Transaction / Schedule để lấy đủ học viên, buổi mấy, ngày nào
 */
async function enrichLedgerEntriesWithDetails(entries = []) {
  const list = Array.isArray(entries) ? entries.map(toPlainObject) : [];
  if (!list.length) return [];

  const txIds = [];
  const directScheduleIds = [];
  const studentIds = [];
  const teacherIds = [];

  for (const entry of list) {
    if (entry.studentId) studentIds.push(entry.studentId);
    if (entry.teacherId) teacherIds.push(entry.teacherId);
    const txId = extractTxIdFromLedger(entry);
    if (txId) txIds.push(txId);
    if (Array.isArray(entry.metadata?.sessionIds)) {
      for (const sid of entry.metadata.sessionIds) directScheduleIds.push(sid);
    }
  }

  const uniqueTxIds = [...new Set(txIds.filter(Boolean))];
  let enrichedTxMap = new Map();
  if (uniqueTxIds.length) {
    const rawTxs = await Transaction.find({ _id: { $in: uniqueTxIds } }).lean();
    const enrichedTxs = await enrichTransactionsWithSessionDetails(rawTxs);
    enrichedTxMap = new Map(enrichedTxs.map((t) => [idStr(t._id), t]));
  }

  // Các dòng salary chỉ có metadata.sessionIds (chưa có Transaction hoặc Transaction trống)
  const fallbackSchedIds = [];
  for (const entry of list) {
    if (entry.type !== 'salary') continue;
    const txId = extractTxIdFromLedger(entry);
    const tx = txId ? enrichedTxMap.get(txId) : null;
    if (!tx || !(tx.sessionDetails || []).length) {
      for (const sid of (entry.metadata?.sessionIds || [])) fallbackSchedIds.push(sid);
    }
  }

  const [{ scheduleMap, sessionNoMap }, studentMap, teacherMap] = await Promise.all([
    fetchSchedulesAndOrdinalsByIds([...new Set([...fallbackSchedIds].map(idStr).filter(Boolean))]),
    fetchStudentMetaMap(studentIds),
    fetchTeacherMetaMap(teacherIds),
  ]);

  // Bổ sung studentMap cho fallback schedules nếu chưa có
  const extraStuIds = [];
  for (const sched of scheduleMap.values()) {
    const sid = idStr(sched.studentId);
    if (sid && !studentMap.has(sid)) extraStuIds.push(sid);
  }
  if (extraStuIds.length) {
    const extraStudents = await fetchStudentMetaMap(extraStuIds);
    for (const [k, v] of extraStudents.entries()) studentMap.set(k, v);
  }

  return list.map((entry) => {
    const stu = entry.studentId ? studentMap.get(idStr(entry.studentId)) : null;
    const teacher = entry.teacherId ? teacherMap.get(idStr(entry.teacherId)) : null;
    const txId = extractTxIdFromLedger(entry);
    const linkedTx = txId ? enrichedTxMap.get(txId) : null;

    let sessionDetails = [];
    let studentSummary = [];
    let fullSessionsText = '';
    if (entry.type === 'salary') {
      if (linkedTx && Array.isArray(linkedTx.sessionDetails) && linkedTx.sessionDetails.length > 0) {
        sessionDetails = linkedTx.sessionDetails;
        studentSummary = linkedTx.studentSummary;
        fullSessionsText = linkedTx.fullSessionsText;
      } else if (Array.isArray(entry.metadata?.sessionIds) && entry.metadata.sessionIds.length > 0) {
        const resolved = entry.metadata.sessionIds
          .map((sid) => scheduleMap.get(idStr(sid)))
          .filter(Boolean);
        const total = Math.max(0, Number(entry.amount || 0) - Number(entry.metadata?.starBonusAmount || 0));
        const per = resolved.length ? Math.floor(total / resolved.length) : 0;
        const rem = resolved.length ? total - per * resolved.length : 0;
        sessionDetails = sortSessionDetailsChrono(resolved.map((sched, idx) => {
          const sid = idStr(sched._id);
          const sStuId = idStr(sched.studentId);
          const sStu = sStuId ? studentMap.get(sStuId) : null;
          return {
            sessionId: sid,
            studentId: sStuId || null,
            studentCode: String(sStu?.studentCode || ''),
            studentName: String(sched.studentName || sStu?.name || 'Học viên').trim(),
            enrollmentId: idStr(sched.enrollmentId) || null,
            courseId: idStr(sched.courseId) || null,
            date: sched.date || null,
            startTime: String(sched.startTime || ''),
            endTime: String(sched.endTime || ''),
            courseName: String(sched.course || ''),
            sessionNo: sessionNoMap.get(sid) ?? null,
            allocatedAmount: per + (idx === 0 ? rem : 0),
          };
        }));
        studentSummary = summarizeSessionsByStudent(sessionDetails);
        fullSessionsText = formatFullSessionsText(sessionDetails);
      } else if (entry.note) {
        sessionDetails = sortSessionDetailsChrono(parseLegacyNoteSessions(entry.note));
        studentSummary = summarizeSessionsByStudent(sessionDetails);
        fullSessionsText = formatFullSessionsText(sessionDetails);
      }
    }

    const totalSessionsCount = entry.type === 'salary'
      ? (sessionDetails.length || Number(linkedTx?.totalSessionsCount) || Number(entry.metadata?.sessionsCount) || 0)
      : 0;

    return {
      ...entry,
      studentName: stu?.name || String(entry.metadata?.studentName || ''),
      studentCode: stu?.studentCode || String(entry.metadata?.studentCode || ''),
      teacherName: teacher?.name || linkedTx?.teacherName || String(entry.metadata?.teacherName || ''),
      teacherPhone: teacher?.phone || linkedTx?.teacherPhone || '',
      transactionId: txId || null,
      sessionDetails,
      studentSummary,
      totalSessionsCount,
      totalStudentsCount: studentSummary.length,
      fullSessionsText,
    };
  });
}

function applyColumnWidths(ws, widths) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function buildTransactionsExportWorkbook(enrichedTransactions = []) {
  const txs = Array.isArray(enrichedTransactions) ? enrichedTransactions : [];

  const summaryRows = txs.map((tx, idx) => {
    const teacherName = tx.teacherId?.name || tx.teacherName || 'N/A';
    const teacherPhone = tx.teacherId?.phone || tx.teacherPhone || '';
    const bankName = tx.bankName || tx.teacherId?.bankAccount?.bankName || '';
    const bankAccount = tx.bankAccount || tx.teacherId?.bankAccount?.accountNumber || '';
    const detailText = tx.fullSessionsText || tx.description || tx.note || '';
    return {
      'STT': idx + 1,
      'Mã phiếu': idStr(tx._id).slice(-8) || 'N/A',
      'Ngày chi': formatDateTimeVi(tx.confirmedAt || tx.createdAt),
      'Giảng viên': sanitizeExcelText(teacherName),
      'SĐT': sanitizeExcelText(teacherPhone),
      'Ngân hàng': sanitizeExcelText(bankName),
      'Số TK': sanitizeExcelText(bankAccount),
      'Tháng': sanitizeExcelText(tx.month || ''),
      'Số buổi': Number(tx.totalSessionsCount) || 0,
      'Số học viên': Number(tx.totalStudentsCount) || 0,
      'Thưởng sao (VNĐ)': Number(tx.starBonusAmount) || 0,
      'Tổng tiền (VNĐ)': Number(tx.amount) || 0,
      'Trạng thái': TX_STATUS_LABEL[tx.status] || tx.status || '',
      'Người xác nhận': sanitizeExcelText(tx.confirmedBy || ''),
      'Chi tiết học viên & buổi dạy (Đầy đủ)': sanitizeExcelText(detailText),
      'Ghi chú gốc': sanitizeExcelText(tx.description || tx.note || ''),
    };
  });

  const detailRows = [];
  let detailIdx = 0;
  for (const tx of txs) {
    const code = idStr(tx._id).slice(-8) || 'N/A';
    const payDate = formatDateTimeVi(tx.confirmedAt || tx.createdAt);
    const teacherName = tx.teacherId?.name || tx.teacherName || 'N/A';
    const statusLabel = TX_STATUS_LABEL[tx.status] || tx.status || '';
    const txAmount = Number(tx.amount) || 0;
    const starBonus = Number(tx.starBonusAmount) || 0;
    const sessions = Array.isArray(tx.sessionDetails) ? tx.sessionDetails : [];

    if (sessions.length > 0) {
      for (const s of sessions) {
        detailIdx += 1;
        const timeRange = s.startTime
          ? (s.endTime ? `${s.startTime}-${s.endTime}` : s.startTime)
          : '';
        detailRows.push({
          'STT': detailIdx,
          'Mã phiếu': code,
          'Ngày chi': payDate,
          'Giảng viên': sanitizeExcelText(teacherName),
          'Mã HV': sanitizeExcelText(s.studentCode || ''),
          'Tên học viên': sanitizeExcelText(s.studentName || 'Học viên'),
          'Khóa học': sanitizeExcelText(s.courseName || ''),
          'Buổi thứ': s.sessionNo != null && Number(s.sessionNo) > 0 ? Number(s.sessionNo) : '-',
          'Ngày học': formatDateVi(s.date) || '-',
          'Khung giờ': sanitizeExcelText(timeRange || '-'),
          'Thù lao buổi (VNĐ)': Number(s.allocatedAmount) || 0,
          'Tổng phiếu (VNĐ)': txAmount,
          'Trạng thái': statusLabel,
          'Ghi chú': sanitizeExcelText(tx.description || tx.note || ''),
        });
      }
      if (starBonus > 0) {
        detailIdx += 1;
        detailRows.push({
          'STT': detailIdx,
          'Mã phiếu': code,
          'Ngày chi': payDate,
          'Giảng viên': sanitizeExcelText(teacherName),
          'Mã HV': '',
          'Tên học viên': 'Thưởng sao giảng viên',
          'Khóa học': sanitizeExcelText((tx.starBonusMonths || []).join(', ')),
          'Buổi thứ': '-',
          'Ngày học': '-',
          'Khung giờ': '-',
          'Thù lao buổi (VNĐ)': starBonus,
          'Tổng phiếu (VNĐ)': txAmount,
          'Trạng thái': statusLabel,
          'Ghi chú': 'Thưởng sao cộng kèm phiếu chi',
        });
      }
    } else {
      detailIdx += 1;
      detailRows.push({
        'STT': detailIdx,
        'Mã phiếu': code,
        'Ngày chi': payDate,
        'Giảng viên': sanitizeExcelText(teacherName),
        'Mã HV': '',
        'Tên học viên': '(Không gắn lịch buổi cụ thể)',
        'Khóa học': sanitizeExcelText(tx.month || ''),
        'Buổi thứ': '-',
        'Ngày học': '-',
        'Khung giờ': '-',
        'Thù lao buổi (VNĐ)': txAmount,
        'Tổng phiếu (VNĐ)': txAmount,
        'Trạng thái': statusLabel,
        'Ghi chú': sanitizeExcelText(tx.description || tx.note || ''),
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length ? summaryRows : [{ 'Thông báo': 'Chưa có dữ liệu phiếu chi' }],
  );
  applyColumnWidths(wsSummary, [6, 12, 18, 22, 14, 16, 18, 14, 10, 12, 16, 16, 16, 16, 60, 40]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHopPhieuChi');

  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length ? detailRows : [{ 'Thông báo': 'Chưa có chi tiết buổi dạy' }],
  );
  applyColumnWidths(wsDetail, [6, 12, 18, 22, 12, 26, 26, 10, 14, 14, 18, 18, 16, 40]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'ChiTietBuoiDay_HocVien');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function buildLedgerExportWorkbook(enrichedEntries = []) {
  const entries = Array.isArray(enrichedEntries) ? enrichedEntries : [];

  const summaryRows = entries.map((line, idx) => {
    const signed = Number(line.signedAmount != null ? line.signedAmount : line.amount) || 0;
    const isSalary = line.type === 'salary';
    const subjectName = isSalary
      ? (line.teacherName || '')
      : (line.studentName || '');
    const detailText = isSalary
      ? (line.fullSessionsText || line.note || '')
      : (line.note || line.courseName || '');
    return {
      'STT': idx + 1,
      'Ngày giờ': formatDateTimeVi(line.postedAt || line.createdAt),
      'Mã dòng': idStr(line._id).slice(-8) || 'N/A',
      'Loại': LEDGER_TYPE_LABEL[line.type] || line.type || '',
      'Đối tượng (HV / GV)': sanitizeExcelText(subjectName),
      'Mã HV': sanitizeExcelText(line.studentCode || ''),
      'Khóa học': sanitizeExcelText(line.courseName || ''),
      'Số buổi': isSalary ? (Number(line.totalSessionsCount) || 0) : 0,
      'Số học viên': isSalary ? (Number(line.totalStudentsCount) || 0) : (line.studentName ? 1 : 0),
      'Số tiền (VNĐ)': signed,
      'Chi tiết học viên & buổi học (Đầy đủ)': sanitizeExcelText(detailText),
      'Ghi chú gốc': sanitizeExcelText(line.note || ''),
    };
  });

  const detailRows = [];
  let detailIdx = 0;
  for (const line of entries) {
    const code = idStr(line._id).slice(-8) || 'N/A';
    const postedLabel = formatDateTimeVi(line.postedAt || line.createdAt);
    const typeLabel = LEDGER_TYPE_LABEL[line.type] || line.type || '';
    const signed = Number(line.signedAmount != null ? line.signedAmount : line.amount) || 0;
    const sessions = Array.isArray(line.sessionDetails) ? line.sessionDetails : [];

    if (line.type === 'salary' && sessions.length > 0) {
      const sign = signed < 0 ? -1 : 1;
      for (const s of sessions) {
        detailIdx += 1;
        const timeRange = s.startTime
          ? (s.endTime ? `${s.startTime}-${s.endTime}` : s.startTime)
          : '';
        detailRows.push({
          'STT': detailIdx,
          'Ngày ghi sổ': postedLabel,
          'Mã dòng': code,
          'Loại': typeLabel,
          'Giảng viên / Đối tượng': sanitizeExcelText(line.teacherName || ''),
          'Mã HV': sanitizeExcelText(s.studentCode || ''),
          'Tên học viên': sanitizeExcelText(s.studentName || 'Học viên'),
          'Khóa học': sanitizeExcelText(s.courseName || ''),
          'Buổi thứ': s.sessionNo != null && Number(s.sessionNo) > 0 ? Number(s.sessionNo) : '-',
          'Ngày học': formatDateVi(s.date) || '-',
          'Khung giờ': sanitizeExcelText(timeRange || '-'),
          'Số tiền phân bổ (VNĐ)': sign * Math.abs(Number(s.allocatedAmount) || 0),
          'Tổng bút toán (VNĐ)': signed,
          'Ghi chú': sanitizeExcelText(line.note || ''),
        });
      }
      const bonusAmt = Number(line.metadata?.starBonusAmount) || 0;
      if (bonusAmt > 0) {
        detailIdx += 1;
        detailRows.push({
          'STT': detailIdx,
          'Ngày ghi sổ': postedLabel,
          'Mã dòng': code,
          'Loại': typeLabel,
          'Giảng viên / Đối tượng': sanitizeExcelText(line.teacherName || ''),
          'Mã HV': '',
          'Tên học viên': 'Thưởng sao giảng viên',
          'Khóa học': sanitizeExcelText((line.metadata?.starBonusMonths || []).join(', ')),
          'Buổi thứ': '-',
          'Ngày học': '-',
          'Khung giờ': '-',
          'Số tiền phân bổ (VNĐ)': -Math.abs(bonusAmt),
          'Tổng bút toán (VNĐ)': signed,
          'Ghi chú': 'Thưởng sao cộng kèm chi lương',
        });
      }
    } else {
      detailIdx += 1;
      detailRows.push({
        'STT': detailIdx,
        'Ngày ghi sổ': postedLabel,
        'Mã dòng': code,
        'Loại': typeLabel,
        'Giảng viên / Đối tượng': sanitizeExcelText(
          line.type === 'salary' ? (line.teacherName || '') : (line.studentName || ''),
        ),
        'Mã HV': sanitizeExcelText(line.studentCode || ''),
        'Tên học viên': sanitizeExcelText(
          line.type === 'salary'
            ? '(Không gắn lịch buổi cụ thể)'
            : (line.studentName || line.courseName || ''),
        ),
        'Khóa học': sanitizeExcelText(line.courseName || ''),
        'Buổi thứ': '-',
        'Ngày học': '-',
        'Khung giờ': '-',
        'Số tiền phân bổ (VNĐ)': signed,
        'Tổng bút toán (VNĐ)': signed,
        'Ghi chú': sanitizeExcelText(line.note || ''),
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length ? summaryRows : [{ 'Thông báo': 'Chưa có dữ liệu sổ cái' }],
  );
  applyColumnWidths(wsSummary, [6, 18, 12, 14, 24, 12, 26, 10, 12, 16, 60, 40]);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'TongHopSoCai');

  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length ? detailRows : [{ 'Thông báo': 'Chưa có chi tiết học viên / buổi học' }],
  );
  applyColumnWidths(wsDetail, [6, 18, 12, 14, 24, 12, 26, 26, 10, 14, 14, 18, 18, 40]);
  XLSX.utils.book_append_sheet(wb, wsDetail, 'ChiTietHocVien_BuoiHoc');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  TX_STATUS_LABEL,
  LEDGER_TYPE_LABEL,
  formatDateVi,
  formatDateTimeVi,
  sanitizeExcelText,
  buildSessionOrdinalMap,
  buildPaymentSessionSnapshots,
  parseLegacyNoteSessions,
  summarizeSessionsByStudent,
  formatFullSessionsText,
  enrichTransactionsWithSessionDetails,
  enrichLedgerEntriesWithDetails,
  buildTransactionsExportWorkbook,
  buildLedgerExportWorkbook,
};
