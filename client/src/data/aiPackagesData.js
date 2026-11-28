/**
 * Cấu hình 5 mốc giá & 3 nhóm gói Hỏi AI Không Giới Hạn (dễ dàng chỉnh giá về sau).
 * Áp dụng chung cho Học viên DewSkill và Học viên Trung tâm.
 */

export const AI_PACKAGES = {
  '1d': {
    id: '1d',
    code: '1D',
    group: 'day',
    badge: 'Dùng nhanh 24h',
    name: 'Gói 1 Ngày',
    shortLabel: '1 ngày',
    durationLabel: '24 giờ',
    durationHours: 24,
    durationDays: 1,
    price: 15000,
    originalPrice: 25000,
    savingsLabel: '',
    subtitle: 'Hỏi AI không giới hạn trong 24 giờ · Phù hợp ôn thi gấp',
    benefits: [
      'Hỏi văn bản không giới hạn 24h (Model Nhanh)',
      '15 lượt câu khó & đọc ảnh (tối đa 5 ảnh) · Gemini Flash',
      '5 lượt giải file bài tập nhanh (Word, Excel, PDF)',
    ],
    ctaLabel: 'Chọn gói 1 ngày →',
  },
  '1m': {
    id: '1m',
    code: '1M',
    group: 'standard',
    badge: 'Phổ biến nhất',
    name: 'Gói Tiêu Chuẩn · 1 Tháng',
    shortLabel: '1 tháng',
    durationLabel: '30 ngày',
    durationHours: 0,
    durationDays: 30,
    price: 59000,
    originalPrice: 89000,
    savingsLabel: '',
    subtitle: 'Hỏi AI không giới hạn mỗi ngày · Giải bài Word, Excel, MOS, Tin học 1–12',
    benefits: [
      'Hỏi văn bản không giới hạn mỗi ngày (Model Nhanh)',
      '15 lượt câu khó & đọc ảnh/ngày (tối đa 8 ảnh) · Gemini Flash',
      '3 lượt giải file bài tập/ngày · Tự hạ model nhanh khi hết lượt',
    ],
    ctaLabel: 'Đăng ký gói 1 tháng →',
  },
  '3m': {
    id: '3m',
    code: '3M',
    group: 'standard',
    badge: 'Phổ biến nhất',
    name: 'Gói Tiêu Chuẩn · 3 Tháng',
    shortLabel: '3 tháng',
    durationLabel: '90 ngày',
    durationHours: 0,
    durationDays: 90,
    price: 149000,
    originalPrice: 177000,
    savingsLabel: 'Tiết kiệm 16%',
    subtitle: 'Hỏi AI không giới hạn mỗi ngày · Giải bài Word, Excel, MOS, Tin học 1–12',
    benefits: [
      'Hỏi văn bản không giới hạn mỗi ngày (Model Nhanh)',
      '20 lượt câu khó & đọc ảnh/ngày (tối đa 10 ảnh) · Gemini Flash',
      '2 lượt giải file chuyên sâu Gemini Pro + 5 lượt giải file Flash/ngày',
    ],
    ctaLabel: 'Đăng ký gói 3 tháng →',
  },
  '6m': {
    id: '6m',
    code: '6M',
    group: 'longterm',
    badge: 'Tiết kiệm nhất',
    name: 'Gói Dài Hạn · 6 Tháng',
    shortLabel: '6 tháng',
    durationLabel: '180 ngày',
    durationHours: 0,
    durationDays: 180,
    price: 269000,
    originalPrice: 354000,
    savingsLabel: 'Tiết kiệm 24%',
    subtitle: 'Hỏi AI không giới hạn nửa năm · Ưu tiên phản hồi nhanh nhất',
    benefits: [
      'Hỏi văn bản không giới hạn nửa năm · Ưu tiên fallback nâng cao',
      '30 lượt câu khó & đọc ảnh/ngày (tối đa 15 ảnh) · Gemini Flash',
      '4 lượt giải file chuyên sâu Gemini Pro + 8 lượt giải file Flash/ngày',
    ],
    ctaLabel: 'Đăng ký gói 6 tháng →',
  },
  '12m': {
    id: '12m',
    code: '12M',
    group: 'longterm',
    badge: 'Tiết kiệm nhất',
    name: 'Gói Dài Hạn · 12 Tháng',
    shortLabel: '12 tháng',
    durationLabel: '365 ngày',
    durationHours: 0,
    durationDays: 365,
    price: 479000,
    originalPrice: 708000,
    savingsLabel: 'Tiết kiệm 32%',
    subtitle: 'Hỏi AI không giới hạn cả năm · Ưu tiên phản hồi nhanh nhất',
    benefits: [
      'Hỏi văn bản không giới hạn cả năm · Ưu tiên cao nhất',
      '40 lượt câu khó & đọc ảnh/ngày (tối đa 20 ảnh) · Gemini Flash',
      '6 lượt giải file chuyên sâu Gemini Pro (tư duy sâu) + 12 lượt Flash/ngày',
    ],
    ctaLabel: 'Đăng ký gói 12 tháng →',
  },
};

export const AI_PACKAGE_CARDS = [
  {
    key: 'day',
    accent: 'blue',
    badge: 'Dùng nhanh 24h',
    title: 'Gói 1 Ngày',
    defaultPlanId: '1d',
    options: ['1d'],
    subtitle: 'Hỏi AI không giới hạn trong 24 giờ · Phù hợp ôn thi gấp',
    benefits: [
      'Hỏi văn bản không giới hạn 24h (Model Nhanh)',
      '15 lượt câu khó & đọc ảnh (tối đa 5 ảnh) · Gemini Flash',
      '5 lượt giải file bài tập nhanh (Word, Excel, PDF)',
    ],
  },
  {
    key: 'standard',
    accent: 'emerald',
    badge: 'Phổ biến nhất',
    title: 'Gói Tiêu Chuẩn',
    defaultPlanId: '3m',
    options: ['1m', '3m'],
    featured: true,
    subtitle: 'Hỏi AI không giới hạn mỗi ngày · Giải bài Word, Excel, MOS, Tin học 1–12',
    benefits: [
      'Hỏi văn bản không giới hạn mỗi ngày (Model Nhanh)',
      '20 lượt câu khó & đọc ảnh/ngày (tối đa 10 ảnh) · Gemini Flash',
      '2 lượt giải file chuyên sâu Gemini Pro + 5 lượt giải file Flash/ngày',
    ],
  },
  {
    key: 'longterm',
    accent: 'amber',
    badge: 'Tiết kiệm nhất',
    title: 'Gói Dài Hạn',
    defaultPlanId: '12m',
    options: ['6m', '12m'],
    subtitle: 'Hỏi AI không giới hạn cả năm · Ưu tiên phản hồi nhanh nhất',
    benefits: [
      'Hỏi văn bản không giới hạn cả năm · Ưu tiên cao nhất',
      '40 lượt câu khó & đọc ảnh/ngày (tối đa 20 ảnh) · Gemini Flash',
      '6 lượt giải file chuyên sâu Gemini Pro (tư duy sâu) + 12 lượt Flash/ngày',
    ],
  },
];

export const AI_QUICK_CHIPS = [
  { group: 'day', planId: '1d', label: '1 ngày' },
  { group: 'standard', planId: '3m', label: '1–3 tháng' },
  { group: 'longterm', planId: '12m', label: '6–12 tháng' },
];

export function getAiPackageById(planId) {
  const key = String(planId || '').trim().toLowerCase();
  return AI_PACKAGES[key] || null;
}

export function formatAiPackagePrice(value) {
  const amount = Math.round(Number(value) || 0);
  return amount > 0 ? `${amount.toLocaleString('vi-VN')}đ` : '0đ';
}

export function formatAiPlanExpiry(expiresAt) {
  if (!expiresAt) return '';
  const dt = new Date(expiresAt);
  if (Number.isNaN(dt.getTime())) return '';
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function buildAiPackageTransferRef(planCode, user = {}) {
  const cleanCode = String(planCode || '3M').replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || '3M';
  const rawContact = String(user?.phone || user?.zalo || user?.studentCode || '').trim();
  const cleanContact = rawContact.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `DEW AI ${cleanCode}${cleanContact ? ` ${cleanContact}` : ''}`.trim();
}
