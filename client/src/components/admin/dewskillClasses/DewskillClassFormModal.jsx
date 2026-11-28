import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  Eye,
  GraduationCap,
  Loader2,
  SlidersHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import { resolveCourseLevel } from '../../../utils/courseCatalogFilter';
import {
  ACCENT_OPTIONS,
  ADMIN_LEVEL_OPTIONS,
  LEVEL_META,
  TIER_META,
} from './dewskillClassConstants';

const INPUT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const LABEL_CLASS = 'mb-1 block text-xs font-bold text-slate-600';

const DEFAULT_FORM = {
  name: '',
  code: '',
  tier: 'cap-2',
  grade: '',
  track: '',
  level: '',
  curriculumSource: 'KNTT_GDPT2018',
  badge: '',
  shortDescription: '',
  description: '',
  accentColor: 'emerald',
  price: 0,
  originalPrice: 0,
  durationMonths: 12,
  includesMeet: true,
  allowTrial: true,
  allowRegistration: true,
  visibilityMode: 'hidden',
  freePreviewTopics: 1,
  dailyXpAllowance: 100,
  sortOrder: 0,
  isActive: true,
  dailyPracticeTopicIds: [],
  certPrepCourseIds: [],
};

function normalizeIdArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => (x && typeof x === 'object' ? String(x._id || x.id) : String(x))).filter(Boolean);
}

export default function DewskillClassFormModal({
  open,
  initialData,
  meta,
  saving,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [topicFilter, setTopicFilter] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        name: initialData.name || '',
        code: initialData.code || '',
        tier: initialData.tier || 'cap-2',
        grade: initialData.grade != null ? String(initialData.grade) : '',
        track: initialData.track || '',
        level: initialData.level || '',
        curriculumSource: initialData.curriculumSource || 'KNTT_GDPT2018',
        badge: initialData.badge || '',
        shortDescription: initialData.shortDescription || '',
        description: initialData.description || '',
        accentColor: initialData.accentColor || 'emerald',
        price: initialData.price ?? 0,
        originalPrice: initialData.originalPrice ?? 0,
        durationMonths: initialData.durationMonths ?? 12,
        includesMeet: initialData.includesMeet !== false,
        allowTrial: initialData.allowTrial !== false,
        allowRegistration: initialData.allowRegistration !== false,
        visibilityMode: initialData.visibilityMode || 'hidden',
        freePreviewTopics: initialData.freePreviewTopics ?? 1,
        dailyXpAllowance: initialData.dailyXpAllowance ?? 100,
        sortOrder: initialData.sortOrder ?? 0,
        isActive: initialData.isActive !== false,
        dailyPracticeTopicIds: normalizeIdArray(initialData.dailyPracticeTopicIds),
        certPrepCourseIds: normalizeIdArray(initialData.certPrepCourseIds),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
    setTopicFilter('');
    setShowAdvanced(false);
  }, [open, initialData]);

  const showGrade = ['cap-1', 'cap-2', 'cap-3'].includes(form.tier);
  const gradeChoices = useMemo(() => {
    if (form.tier === 'cap-1') return [1, 2, 3, 4, 5];
    if (form.tier === 'cap-2') return [6, 7, 8, 9];
    if (form.tier === 'cap-3') return [10, 11, 12];
    return [];
  }, [form.tier]);

  const filteredTopics = useMemo(() => {
    const list = meta?.dailyPracticeTopics || [];
    const q = topicFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((t) => String(t.name || '').toLowerCase().includes(q));
  }, [meta, topicFilter]);

  const resolvedPreviewLevel = useMemo(() => resolveCourseLevel(form), [form]);

  if (!open) return null;

  const toggleId = (field, id) => {
    setForm((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(id);
      return {
        ...prev,
        [field]: exists ? current.filter((x) => x !== id) : [...current, id],
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name: form.name.trim(),
      code: form.code.trim(),
      tier: form.tier,
      grade: showGrade && form.grade ? Number(form.grade) : null,
      track: form.track || '',
      level: form.level || '',
      curriculumSource: form.curriculumSource,
      badge: form.badge.trim(),
      shortDescription: form.shortDescription.trim(),
      description: form.description.trim(),
      accentColor: form.accentColor,
      price: Math.max(0, Math.round(Number(form.price) || 0)),
      originalPrice: Math.max(0, Math.round(Number(form.originalPrice) || 0)),
      durationMonths: Math.max(1, Math.min(60, Math.round(Number(form.durationMonths) || 12))),
      includesMeet: Boolean(form.includesMeet),
      allowTrial: Boolean(form.allowTrial),
      allowRegistration: Boolean(form.allowRegistration),
      visibilityMode: form.visibilityMode,
      freePreviewTopics: Number(form.freePreviewTopics) || 0,
      dailyXpAllowance: Math.max(0, Math.round(Number(form.dailyXpAllowance) || 0)),
      sortOrder: Number(form.sortOrder) || 0,
      isActive: Boolean(form.isActive),
      dailyPracticeTopicIds: form.dailyPracticeTopicIds,
      certPrepCourseIds: form.certPrepCourseIds,
    });
  };

  const tiers = meta?.tiers || [];
  const visibilityModes = meta?.visibilityModes || [];
  const curriculumSources = meta?.curriculumSources || [];
  const tracks = meta?.tracks || [];
  const certCourses = meta?.certPrepCourses || [];
  const resolvedTierLabel = TIER_META[form.tier]?.shortLabel || form.tier;
  const resolvedLevelInfo = LEVEL_META[resolvedPreviewLevel] || LEVEL_META.intermediate;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-2.5 sm:p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={initialData ? 'Cấu hình khóa học DewSkill' : 'Tạo khóa học DewSkill mới'}
    >
      <div className="flex max-h-[88dvh] w-full max-w-[94vw] md:max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <GraduationCap size={18} />
            </span>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                {initialData ? 'Cấu hình khóa học DewSkill' : 'Tạo khóa học DewSkill mới'}
              </h3>
              <p className="text-xs text-slate-500">
                Thiết lập các thông số khớp trực tiếp với bộ lọc của học viên.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng hộp thoại"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">
          {/* PHẦN 1: Định danh & Khớp bộ lọc học viên */}
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              1. Thông tin &amp; Khớp bộ lọc học viên
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
              <div className={showGrade ? 'sm:col-span-9' : 'sm:col-span-12'}>
                <label className={LABEL_CLASS} htmlFor="dew-class-name">
                  Tên khóa học <span className="text-rose-500">*</span>
                </label>
                <input
                  id="dew-class-name"
                  required
                  className={INPUT_CLASS}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Tin học Lớp 6 – Kết nối tri thức"
                />
              </div>

              {showGrade ? (
                <div className="sm:col-span-3">
                  <span className={LABEL_CLASS}>Khối lớp</span>
                  <CmsSelect
                    value={form.grade}
                    aria-label="Khối lớp"
                    className="!py-2 bg-white"
                    onChange={(e) => setForm((p) => ({ ...p, grade: e.target.value }))}
                  >
                    <option value="">Chung</option>
                    {gradeChoices.map((g) => (
                      <option key={g} value={String(g)}>
                        Lớp {g}
                      </option>
                    ))}
                  </CmsSelect>
                </div>
              ) : null}
            </div>

            {/* Đối tượng pill selector */}
            <div>
              <span className={LABEL_CLASS}>Đối tượng (khớp tab Danh mục học viên) *</span>
              <div className="flex flex-wrap gap-1.5">
                {tiers.map((t) => {
                  const active = form.tier === t.id;
                  const shortName = TIER_META[t.id]?.shortLabel || t.shortLabel || t.label;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, tier: t.id, grade: '' }))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                        active
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300'
                      }`}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trình độ pill selector */}
            <div className="space-y-2">
              <span className={LABEL_CLASS}>Trình độ (khớp bộ lọc Trình độ học viên)</span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {ADMIN_LEVEL_OPTIONS.map((opt) => {
                  const active = form.level === opt.id;
                  return (
                    <button
                      key={opt.id || 'auto'}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, level: opt.id }))}
                      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        active
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {opt.id && LEVEL_META[opt.id] ? (
                        <span className={`h-2 w-2 rounded-full ${LEVEL_META[opt.id].dotClass}`} />
                      ) : null}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-emerald-200/80 bg-white px-3 py-2 text-xs text-slate-600">
                <span>Trang Học viên sẽ xếp khóa này vào:</span>
                <span className="font-extrabold text-emerald-700">{resolvedTierLabel}</span>
                <span className="text-slate-300">·</span>
                <span className="inline-flex items-center gap-1 font-extrabold text-slate-800">
                  <span className={`h-2 w-2 rounded-full ${resolvedLevelInfo.dotClass}`} />
                  {resolvedLevelInfo.label}
                </span>
                {!form.level ? (
                  <span className="text-[11px] text-slate-400">(tự nhận theo tên/đối tượng)</span>
                ) : null}
              </div>
            </div>

            <div>
              <label className={LABEL_CLASS} htmlFor="dew-class-short">
                Mô tả ngắn hiển thị trên thẻ khóa học
              </label>
              <input
                id="dew-class-short"
                className={INPUT_CLASS}
                value={form.shortDescription}
                onChange={(e) => setForm((p) => ({ ...p, shortDescription: e.target.value }))}
                placeholder="VD: Mạng Internet, sơ đồ tư duy, Word & thuật toán cơ bản..."
              />
            </div>
          </div>

          {/* PHẦN 2: Học phí, Thời hạn & Hiển thị */}
          <div className="space-y-3.5 rounded-2xl border border-emerald-200/80 bg-emerald-50/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-emerald-800">
                <Eye size={14} />
                <span>2. Học phí, Thời hạn &amp; Hiển thị</span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Khóa đang hoạt động
              </label>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visibilityModes.map((mode) => {
                const picked = form.visibilityMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, visibilityMode: mode.id }))}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${
                      picked
                        ? 'border-emerald-500 bg-white ring-2 ring-emerald-100'
                        : 'border-slate-200 bg-white/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-slate-900">{mode.label}</span>
                      {picked ? <Check size={14} className="text-emerald-600" /> : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className={LABEL_CLASS} htmlFor="dew-class-price">
                  Học phí (VNĐ)
                </label>
                <input
                  id="dew-class-price"
                  type="number"
                  min={0}
                  step={1000}
                  className={INPUT_CLASS}
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                  placeholder="VD: 1699000"
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="dew-class-original-price">
                  Giá gốc gạch ngang
                </label>
                <input
                  id="dew-class-original-price"
                  type="number"
                  min={0}
                  step={1000}
                  className={INPUT_CLASS}
                  value={form.originalPrice}
                  onChange={(e) => setForm((p) => ({ ...p, originalPrice: e.target.value }))}
                  placeholder="VD: 2499000"
                />
              </div>
              <div>
                <label className={LABEL_CLASS} htmlFor="dew-class-duration">
                  Thời hạn gói (tháng)
                </label>
                <input
                  id="dew-class-duration"
                  type="number"
                  min={1}
                  max={60}
                  className={INPUT_CLASS}
                  value={form.durationMonths}
                  onChange={(e) => setForm((p) => ({ ...p, durationMonths: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 pt-0.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.includesMeet}
                  onChange={(e) => setForm((p) => ({ ...p, includesMeet: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Có kèm học Meet với giáo viên
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.allowTrial}
                  onChange={(e) => setForm((p) => ({ ...p, allowTrial: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Cho phép Học thử
              </label>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={form.allowRegistration}
                  onChange={(e) => setForm((p) => ({ ...p, allowRegistration: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                Bật nút Đăng ký
              </label>
            </div>
          </div>

          {/* PHẦN 3: Gắn nội dung bài học */}
          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              3. Nội dung bài học &amp; Phòng thi gắn vào khóa
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <BookOpen size={14} className="text-emerald-600" />
                    Chủ đề Luyện tập ({form.dailyPracticeTopicIds.length})
                  </span>
                </div>
                <input
                  type="text"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  placeholder="Lọc chủ đề..."
                  className="mb-2 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-400"
                />
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {filteredTopics.length === 0 ? (
                    <p className="py-2 text-center text-xs text-slate-400">Không có chủ đề phù hợp.</p>
                  ) : (
                    filteredTopics.map((t) => {
                      const id = String(t._id || t.id);
                      const checked = form.dailyPracticeTopicIds.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId('dailyPracticeTopicIds', id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                          />
                          <span className="truncate font-semibold text-slate-700">{t.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <Trophy size={14} className="text-amber-600" />
                    Phòng thi MOS / IC3 ({form.certPrepCourseIds.length})
                  </span>
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                  {certCourses.length === 0 ? (
                    <p className="py-2 text-center text-xs text-slate-400">Chưa có khóa phòng thi.</p>
                  ) : (
                    certCourses.map((c) => {
                      const id = String(c._id || c.id);
                      const checked = form.certPrepCourseIds.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleId('certPrepCourseIds', id)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
                          />
                          <span className="truncate font-semibold text-slate-700">{c.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cài đặt nâng cao (thu gọn mặc định) */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-slate-500" />
                <span className="text-xs font-extrabold text-slate-700">
                  Cài đặt nâng cao
                </span>
                <span className="text-[11px] text-slate-400">
                  (Mã khóa, giáo trình, màu thẻ, XP/ngày, đề cương...)
                </span>
              </div>
              <ChevronDown
                size={15}
                className={`text-slate-400 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>

            {showAdvanced ? (
              <div className="grid grid-cols-1 gap-3.5 border-t border-slate-100 bg-slate-50/40 p-4 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className={LABEL_CLASS} htmlFor="dew-class-code">
                    Mã khóa học
                  </label>
                  <input
                    id="dew-class-code"
                    className={INPUT_CLASS}
                    value={form.code}
                    onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                    placeholder="VD: KNTT-L6"
                  />
                </div>

                <div className="sm:col-span-4">
                  <span className={LABEL_CLASS}>Định hướng / Môn</span>
                  <CmsSelect
                    value={form.track}
                    aria-label="Định hướng"
                    className="!py-2 bg-white"
                    onChange={(e) => setForm((p) => ({ ...p, track: e.target.value }))}
                  >
                    {tracks.map((tr) => (
                      <option key={tr.id || 'none'} value={tr.id}>
                        {tr.label}
                      </option>
                    ))}
                  </CmsSelect>
                </div>

                <div className="sm:col-span-4">
                  <span className={LABEL_CLASS}>Nguồn giáo trình</span>
                  <CmsSelect
                    value={form.curriculumSource}
                    aria-label="Nguồn giáo trình"
                    className="!py-2 bg-white"
                    onChange={(e) => setForm((p) => ({ ...p, curriculumSource: e.target.value }))}
                  >
                    {curriculumSources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.label}
                      </option>
                    ))}
                  </CmsSelect>
                </div>

                <div className="sm:col-span-4">
                  <label className={LABEL_CLASS} htmlFor="dew-class-badge">
                    Nhãn nổi bật
                  </label>
                  <input
                    id="dew-class-badge"
                    className={INPUT_CLASS}
                    value={form.badge}
                    onChange={(e) => setForm((p) => ({ ...p, badge: e.target.value }))}
                    placeholder="VD: SGK KNTT"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className={LABEL_CLASS} htmlFor="dew-class-order">
                    Thứ tự sắp xếp
                  </label>
                  <input
                    id="dew-class-order"
                    type="number"
                    className={INPUT_CLASS}
                    value={form.sortOrder}
                    onChange={(e) => setForm((p) => ({ ...p, sortOrder: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className={LABEL_CLASS} htmlFor="dew-class-preview-count">
                    Số chặng học thử miễn phí
                  </label>
                  <input
                    id="dew-class-preview-count"
                    type="number"
                    min={0}
                    max={50}
                    className={INPUT_CLASS}
                    value={form.freePreviewTopics}
                    onChange={(e) => setForm((p) => ({ ...p, freePreviewTopics: e.target.value }))}
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className={LABEL_CLASS} htmlFor="dew-class-daily-xp">
                    XP mặc định mỗi ngày (hỏi AI / làm bài)
                  </label>
                  <input
                    id="dew-class-daily-xp"
                    type="number"
                    min={0}
                    max={100000}
                    step={10}
                    className={INPUT_CLASS}
                    value={form.dailyXpAllowance}
                    onChange={(e) => setForm((p) => ({ ...p, dailyXpAllowance: e.target.value }))}
                    placeholder="100"
                  />
                </div>

                <div className="sm:col-span-6">
                  <span className={LABEL_CLASS}>Màu nhấn thẻ khóa học</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ACCENT_OPTIONS.map((opt) => {
                      const active = form.accentColor === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setForm((p) => ({ ...p, accentColor: opt.id }))}
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                            active
                              ? 'border-slate-800 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full ${opt.dotClass}`} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="sm:col-span-12">
                  <label className={LABEL_CLASS} htmlFor="dew-class-desc">
                    Ghi chú / Đề cương tóm tắt
                  </label>
                  <textarea
                    id="dew-class-desc"
                    rows={2}
                    className={INPUT_CLASS}
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="Mô tả chi tiết mục tiêu cần đạt..."
                  />
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving || !form.name.trim()}
            onClick={handleSubmit}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            <span>{initialData ? 'Lưu thay đổi' : 'Tạo khóa học'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
