/**
 * Schema cột Excel học viên — khớp form "Thêm học viên mới".
 * Dùng chung Xuất + Nhập + file mẫu. Không đụng question-bank / invoice.
 */

export const STUDENT_EXCEL_HEADERS = [
  'Họ tên',
  'Giới tính',
  'Tuổi',
  'Số điện thoại',
  'Zalo',
  'Chi nhánh',
  'Hình thức',
  'Khóa học',
  'Học phí',
  'Số buổi',
  'Giảng viên',
  'Thanh toán tiền mặt',
];

/** Dòng mẫu — giá trị ví dụ giống form tạo HV */
export const STUDENT_EXCEL_TEMPLATE_ROWS = [
  {
    'Họ tên': 'NGUYỄN VĂN A',
    'Giới tính': 'Nam',
    'Tuổi': 25,
    'Số điện thoại': '0912345678',
    'Zalo': '0912345678',
    'Chi nhánh': 'CNON',
    'Hình thức': 'Tại cơ sở',
    'Khóa học': 'THVP',
    'Học phí': 3000000,
    'Số buổi': 12,
    'Giảng viên': '',
    'Thanh toán tiền mặt': 'x',
  },
  {
    'Họ tên': 'TRẦN THỊ B',
    'Giới tính': 'Nữ',
    'Tuổi': 22,
    'Số điện thoại': '0987654321',
    'Zalo': '0987654321',
    'Chi nhánh': 'online',
    'Hình thức': 'Online',
    'Khóa học': 'MOS EXCEL',
    'Học phí': 1200000,
    'Số buổi': 12,
    'Giảng viên': '',
    'Thanh toán tiền mặt': '',
  },
];

function pick(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
      return row[k];
    }
  }
  return '';
}

function parsePaid(raw) {
  if (raw === true || raw === 1) return true;
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return false;
  if (['x', 'v', '1', 'true', 'yes', 'có', 'co'].includes(s)) return true;
  if (
    s.includes('đã thanh toán')
    || s.includes('da thanh toan')
    || s.includes('đã đóng')
    || s.includes('da dong')
    || s.includes('tiền mặt')
    || s.includes('tien mat')
  ) {
    return true;
  }
  if (['chưa thanh toán', 'chua thanh toan', 'chưa đóng', 'chua dong', '0', 'false', 'no'].includes(s)) {
    return false;
  }
  return false;
}

function parseLearningMode(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'OFFLINE';
  if (
    s === 'online'
    || s.includes('trực tuyến')
    || s.includes('truc tuyen')
  ) {
    return 'ONLINE';
  }
  if (
    s === 'offline'
    || s.includes('tại cơ sở')
    || s.includes('tai co so')
    || s.includes('cơ sở')
  ) {
    return 'OFFLINE';
  }
  const up = s.toUpperCase();
  if (up === 'ONLINE' || up === 'OFFLINE') return up;
  return 'OFFLINE';
}

function parseGender(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'male';
  if (s === 'female' || s === 'nữ' || s === 'nu' || s === 'f') return 'female';
  if (s === 'male' || s === 'nam' || s === 'm') return 'male';
  return 'male';
}

function genderLabel(g) {
  const s = String(g || '').toLowerCase();
  if (s === 'female' || s === 'nữ' || s === 'nu') return 'Nữ';
  return 'Nam';
}

function learningModeLabel(mode) {
  return String(mode || '').toUpperCase() === 'ONLINE' ? 'Online' : 'Tại cơ sở';
}

/**
 * Student list item → một dòng Excel (khớp form tạo HV).
 */
export function studentToExcelRow(s = {}) {
  const paid = s.paid === true || s.paid === 'Đã đóng phí' || s.paid === 'Đã thanh toán';
  const branchHint = s.branchCode || s.branchName || s.branch || '';
  const teacherHint = s.teacherName
    || (Array.isArray(s.teacherNames) && s.teacherNames[0])
    || '';
  return {
    'Họ tên': s.name || '',
    'Giới tính': genderLabel(s.gender),
    'Tuổi': s.age ?? '',
    'Số điện thoại': s.phone || '',
    'Zalo': s.zalo || s.phone || '',
    'Chi nhánh': branchHint,
    'Hình thức': learningModeLabel(s.learningMode),
    'Khóa học': s.course || '',
    'Học phí': s.price ?? '',
    'Số buổi': s.totalSessions ?? '',
    'Giảng viên': teacherHint,
    'Thanh toán tiền mặt': paid ? 'x' : '',
  };
}

/**
 * Dòng sheet_to_json → payload API import (field tiếng Anh như form tạo).
 */
export function excelRowToStudentPayload(item = {}) {
  const phone = String(
    pick(item, ['Số điện thoại', 'SĐT', 'SDT', 'Phone', 'phone']),
  ).trim();
  const zaloRaw = String(pick(item, ['Zalo', 'Zalo Number', 'zalo'])).trim();
  const paidRaw = pick(item, [
    'Thanh toán tiền mặt',
    'Đã đóng',
    'Paid',
    'Trạng thái',
    'trạng thái',
  ]);
  const ageRaw = pick(item, ['Tuổi', 'Age', 'age']);
  const ageNum = Number(ageRaw);
  const sessionsRaw = pick(item, ['Số buổi', 'totalSessions', 'Total Sessions']);
  const sessionsNum = Number(sessionsRaw);
  const branchHint = String(
    pick(item, ['Chi nhánh', 'Cơ sở', 'branchCode', 'branchName', 'Branch']),
  ).trim();
  const teacherHint = String(
    pick(item, ['Giảng viên', 'Giảng viên hướng dẫn', 'Teacher', 'teacherName']),
  ).trim();

  // Alias cũ: Địa chỉ bỏ qua (không có trên form tạo) — giữ nếu có trong file cũ
  const address = String(pick(item, ['Địa chỉ', 'Address', 'address']) || '').trim();

  return {
    name: String(pick(item, ['Họ tên', 'Họ Tên', 'Name', 'Tên', 'name']) || '').trim(),
    gender: parseGender(pick(item, ['Giới tính', 'Gender', 'gender'])),
    phone,
    zalo: zaloRaw || phone,
    course: String(pick(item, ['Khóa học', 'Course', 'course']) || '').trim(),
    price: Number(pick(item, ['Học phí', 'Price', 'price']) || 0) || 0,
    paid: parsePaid(paidRaw),
    learningMode: parseLearningMode(pick(item, ['Hình thức', 'Hình thức học', 'Mode', 'learningMode'])),
    branchHint,
    teacherHint,
    ...(Number.isFinite(ageNum) && ageNum > 0 ? { age: ageNum } : {}),
    ...(Number.isFinite(sessionsNum) && sessionsNum > 0 ? { totalSessions: sessionsNum } : {}),
    ...(address ? { address } : {}),
  };
}
