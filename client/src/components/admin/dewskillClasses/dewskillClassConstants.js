export const TIER_META = {
  'cap-1': {
    label: 'Tiểu học (Lớp 1–5)',
    shortLabel: 'Tiểu học',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  'cap-2': {
    label: 'THCS (Lớp 6–9)',
    shortLabel: 'THCS',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  'cap-3': {
    label: 'THPT (Lớp 10–12)',
    shortLabel: 'THPT',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
  },
  mos: {
    label: 'MOS (Chứng chỉ Office)',
    shortLabel: 'MOS',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  'hs-sv': {
    label: 'Sinh viên',
    shortLabel: 'Sinh viên',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
  'nguoi-di-lam': {
    label: 'Người đi làm',
    shortLabel: 'Người đi làm',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  'chung-chi': {
    label: 'Chứng chỉ khác (IC3 / TT03)',
    shortLabel: 'Chứng chỉ',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const LEVEL_META = {
  basic: {
    label: 'Cơ bản',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    dotClass: 'bg-sky-500',
  },
  intermediate: {
    label: 'Trung cấp',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  advanced: {
    label: 'Nâng cao',
    badgeClass: 'bg-violet-50 text-violet-700 border-violet-200',
    dotClass: 'bg-violet-500',
  },
};

export const ADMIN_LEVEL_OPTIONS = [
  { id: '', label: 'Tự động' },
  { id: 'basic', label: 'Cơ bản' },
  { id: 'intermediate', label: 'Trung cấp' },
  { id: 'advanced', label: 'Nâng cao' },
];

export const VISIBILITY_META = {
  hidden: {
    label: 'Ẩn (Nháp)',
    shortLabel: 'Đang ẩn',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    description: 'Chưa hiển thị cho học viên nào.',
  },
  selected: {
    label: 'Chỉ học viên được cấp quyền',
    shortLabel: 'Theo từng HV',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Chỉ hiển thị với các học viên được bật quyền trong danh sách.',
  },
  free_portal: {
    label: 'Tài khoản miễn phí',
    shortLabel: 'TK Miễn phí',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200',
    description: 'Mở hiển thị cho học viên tự đăng ký miễn phí (và các HV được cấp riêng).',
  },
  all: {
    label: 'Tất cả học viên',
    shortLabel: 'Toàn hệ thống',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Hiển thị cho mọi học viên (trừ HV bị tắt thủ công).',
  },
};

export const ACCENT_OPTIONS = [
  { id: 'emerald', label: 'Xanh ngọc', dotClass: 'bg-emerald-500' },
  { id: 'sky', label: 'Xanh dương', dotClass: 'bg-sky-500' },
  { id: 'violet', label: 'Tím', dotClass: 'bg-violet-500' },
  { id: 'amber', label: 'Vàng cam', dotClass: 'bg-amber-500' },
  { id: 'indigo', label: 'Chàm', dotClass: 'bg-indigo-500' },
  { id: 'rose', label: 'Hồng san hô', dotClass: 'bg-rose-500' },
];

export const TRACK_LABELS = {
  '': 'Không phân nhánh',
  general: 'Chuẩn chung',
  ict: 'Tin học ứng dụng (ICT)',
  cs: 'Khoa học máy tính (CS)',
  word: 'MOS Word',
  excel: 'MOS Excel',
  powerpoint: 'MOS PowerPoint',
  combo: 'Combo 3 môn MOS',
};

export const CURRICULUM_LABELS = {
  KNTT_GDPT2018: 'SGK Kết nối tri thức (GDPT 2018)',
  CERTIPORT: 'Chuẩn Quốc tế Certiport (MOS / IC3)',
  TT03_IC3: 'Chuẩn Thông tư 03 / Đầu ra CNTT',
  DEWSKILL: 'Giáo trình thực chiến DewSkill',
};
