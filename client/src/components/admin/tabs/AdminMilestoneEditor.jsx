import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clapperboard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  GripVertical,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { useToast } from '../../../utils/useToast';
import { QUESTION_TYPES } from '../../../utils/dailyPractice';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';
const BAI_FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar,.png,.jpg,.jpeg,.webp,.gif';
export const DEFAULT_SECTION_ORDER = ['content', 'file', 'video', 'practice'];

const DIFFICULTY_TABS = [
  { key: 'easy', label: 'Dễ', badge: 'bg-emerald-100 text-emerald-800', active: 'bg-emerald-600 text-white shadow-sm', ring: 'ring-emerald-200' },
  { key: 'medium', label: 'Vừa', badge: 'bg-amber-100 text-amber-800', active: 'bg-amber-500 text-white shadow-sm', ring: 'ring-amber-200' },
  { key: 'hard', label: 'Khó', badge: 'bg-rose-100 text-rose-800', active: 'bg-rose-600 text-white shadow-sm', ring: 'ring-rose-200' },
];

const SECTION_META = {
  content: {
    key: 'content',
    title: 'Nội dung bài học',
    subtitle: 'Văn bản, hướng dẫn và kiến thức',
    studentDesc: 'Đọc và tìm hiểu kiến thức',
    icon: BookOpen,
    iconBox: 'bg-sky-50 text-sky-700 ring-sky-200',
  },
  file: {
    key: 'file',
    title: 'File tài liệu / bài tập',
    subtitle: 'PDF, Word, Excel và tài liệu đính kèm',
    studentDesc: 'Xem, tải tài liệu',
    icon: Paperclip,
    iconBox: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
  video: {
    key: 'video',
    title: 'Video bài giảng',
    subtitle: 'YouTube, video và câu hỏi trong video',
    studentDesc: 'Xem video bài giảng',
    icon: Clapperboard,
    iconBox: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  practice: {
    key: 'practice',
    title: 'Luyện tập',
    subtitle: 'Câu hỏi trắc nghiệm và bài thực hành',
    studentDesc: 'Làm bài tập và kiểm tra',
    icon: Gamepad2,
    iconBox: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

function emptyVideoCheck() {
  return { kind: 'choice', atSec: 30, prompt: '', choices: ['', ''], answer: '0', criteria: '', shortHint: '', paidHint: '', hintCostXp: 5 };
}

/** Mốc dừng video: chọn, nhập chữ, hoặc chụp màn hình cho AI chấm. */
export function VideoChecksEditor({ checks, onChange }) {
  const list = checks || [];
  const patch = (index, next) => onChange(list.map((item, i) => (i === index ? { ...item, ...next } : item)));
  return (
    <div className="space-y-1.5 rounded-lg bg-amber-50/80 p-2.5 ring-1 ring-amber-100 sm:col-span-2">
      <p className="text-[11px] font-black text-amber-900">Mốc câu hỏi trong video ({list.length}/6)</p>
      {list.map((check, index) => (
        <div key={check.id || `check-${index}`} className="space-y-1.5 rounded-lg bg-white p-2.5 ring-1 ring-amber-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <label className="text-[11px] font-bold text-slate-600">
              Giây
              <input
                type="number"
                min={0}
                className={`${INPUT} ml-1 !w-20 !py-1`}
                value={check.atSec}
                onChange={(e) => patch(index, { atSec: e.target.value })}
              />
            </label>
            <select className={`${INPUT} !w-auto !py-1`} value={check.kind} onChange={(e) => patch(index, { kind: e.target.value })}>
              <option value="choice">Chọn đáp án</option>
              <option value="text">Nhập đáp án</option>
              <option value="screen">Chụp màn hình, AI chấm</option>
            </select>
            <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))} className="ml-auto text-[11px] font-bold text-red-600 !shadow-none">Xóa mốc</button>
          </div>
          <input className={`${INPUT} !py-1.5`} maxLength={300} value={check.prompt} placeholder="Câu hỏi hiện lúc dừng video" onChange={(e) => patch(index, { prompt: e.target.value })} />
          {check.kind === 'choice' && (
            <div className="space-y-1">
              {(check.choices || ['', '']).map((choice, choiceIndex) => (
                <label key={choiceIndex} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  <input type="radio" name={`check-${check.id || index}`} checked={String(check.answer) === String(choiceIndex)} onChange={() => patch(index, { answer: String(choiceIndex) })} />
                  <input className={`${INPUT} !py-1`} maxLength={120} value={choice} placeholder={`Đáp án ${choiceIndex + 1}`} onChange={(e) => {
                    const choices = [...(check.choices || [])];
                    choices[choiceIndex] = e.target.value;
                    patch(index, { choices });
                  }} />
                </label>
              ))}
              {(check.choices || []).length < 4 && (
                <button type="button" className="text-[11px] font-bold text-sky-700 !shadow-none" onClick={() => patch(index, { choices: [...(check.choices || []), ''] })}>+ Thêm đáp án</button>
              )}
            </div>
          )}
          {check.kind === 'text' && (
            <input className={`${INPUT} !py-1.5`} maxLength={200} value={check.answer || ''} placeholder="Đáp án đúng (không phân biệt hoa thường)" onChange={(e) => patch(index, { answer: e.target.value })} />
          )}
          {check.kind === 'screen' && (
            <textarea className={`${INPUT} !py-1.5`} rows={2} maxLength={500} value={check.criteria || ''} placeholder="Tiêu chí AI chấm. Học viên không thấy dòng này." onChange={(e) => patch(index, { criteria: e.target.value })} />
          )}
          <input className={`${INPUT} !py-1.5`} maxLength={160} value={check.shortHint || ''} placeholder="Gợi ý ngắn khi sai. Không viết đáp án." onChange={(e) => patch(index, { shortHint: e.target.value })} />
          <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_6rem]">
            <input className={`${INPUT} !py-1.5`} maxLength={300} value={check.paidHint || ''} placeholder="Gợi ý rõ hơn, học viên phải đổi XP" onChange={(e) => patch(index, { paidHint: e.target.value })} />
            <input type="number" min={0} max={50} className={`${INPUT} !py-1.5`} value={check.hintCostXp ?? 5} aria-label="XP gợi ý" onChange={(e) => patch(index, { hintCostXp: e.target.value })} />
          </div>
        </div>
      ))}
      {list.length < 6 && (
        <button type="button" onClick={() => onChange([...list, emptyVideoCheck()])} className="text-[11px] font-black text-amber-800 !shadow-none">+ Thêm mốc câu hỏi</button>
      )}
    </div>
  );
}

const DEFAULT_VIDEO_GUIDE_TEMPLATE = {
  customized: true,
  formulas: [
    {
      name: 'VLOOKUP (Tra cứu theo cột)',
      syntax: '=VLOOKUP(gia_tri_tim, bang_du_lieu, cot_lay, 0)',
      note: 'Nhớ cố định bảng dữ liệu bằng F4 ($A$2:$D$20) và truyền số 0 để tìm chính xác.',
    },
    {
      name: 'SUMIFS (Tính tổng nhiều điều kiện)',
      syntax: '=SUMIFS(C2:C50, A2:A50, "Excel", B2:B50, ">=100000")',
      note: 'Tham số đầu tiên là vùng cần cộng tổng; các cặp tiếp theo là (vùng ĐK, ĐK).',
    },
  ],
  focusSummary: 'Hoàn thành video bài giảng (≥ 70% để mở bài tiếp), sau đó áp dụng đúng công thức/định dạng vào file thực hành.',
  shortcuts: [
    'Ctrl + S: Lưu bài liên tục để tránh mất dữ liệu.',
    'F4 (Excel): Cố định địa chỉ tuyệt đối $A$1 · (Word/PPT): Lặp lại thao tác vừa làm.',
    'Alt + = (Excel): Tính SUM tự động cực nhanh cho cột/hàng số.',
  ],
  checklist: [
    'Không còn ô hiển thị lỗi #N/A, #VALUE!, #REF!, #NAME?',
    'Đã dùng tham chiếu tuyệt đối $A$1 trước khi kéo công thức xuống.',
    'Số tiền / ngày tháng đã định dạng chuẩn (không nhập chữ vào ô tính toán).',
  ],
};

function emptyVideoGuide() {
  return {
    customized: false,
    formulas: [],
    focusSummary: '',
    shortcuts: [],
    checklist: [],
  };
}

function normalizeVideoGuide(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const formulas = Array.isArray(src.formulas)
    ? src.formulas.map((f) => ({
      name: String(f?.name || ''),
      syntax: String(f?.syntax || ''),
      note: String(f?.note || ''),
    }))
    : [];
  const shortcuts = Array.isArray(src.shortcuts) ? src.shortcuts.map((s) => String(s || '')) : [];
  const checklist = Array.isArray(src.checklist) ? src.checklist.map((s) => String(s || '')) : [];
  const focusSummary = String(src.focusSummary || '');
  return {
    customized: Boolean(src.customized || formulas.length || focusSummary.trim() || shortcuts.length || checklist.length),
    formulas,
    focusSummary,
    shortcuts,
    checklist,
  };
}

function VideoGuideEditor({ guide, onChange }) {
  const [open, setOpen] = useState(false);
  const g = normalizeVideoGuide(guide);
  const patchGuide = (patch) => onChange({ ...g, customized: true, ...patch });
  const formulas = g.formulas || [];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-black text-slate-700 hover:bg-slate-100/70 !shadow-none"
      >
        <span>
          Trợ lý dưới video: Công thức · Trọng tâm &amp; Phím tắt · Checklist tự chấm
          {g.customized ? (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
              Đã tùy chỉnh riêng
            </span>
          ) : (
            <span className="ml-2 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              Đang dùng mặc định
            </span>
          )}
        </span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </button>

      {open && (
        <div className="space-y-3 border-t border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={g.customized}
                onChange={(e) => onChange({ ...g, customized: e.target.checked })}
              />
              Bật nội dung riêng cho bài video này (tắt = dùng mặc định)
            </label>
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_VIDEO_GUIDE_TEMPLATE })}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-100 !shadow-none"
            >
              Nạp mẫu có sẵn để sửa
            </button>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-600">
                Công thức / Hàm trọng tâm ({formulas.length})
              </span>
              {formulas.length < 20 && (
                <button
                  type="button"
                  onClick={() => patchGuide({ formulas: [...formulas, { name: '', syntax: '', note: '' }] })}
                  className="text-[11px] font-black text-emerald-700 hover:underline !shadow-none"
                >
                  + Thêm công thức
                </button>
              )}
            </div>
            {formulas.length === 0 ? (
              <p className="text-[11px] text-slate-400">Chưa có công thức riêng (có thể để trống nếu là bài Word / Windows / PowerPoint).</p>
            ) : (
              formulas.map((item, idx) => (
                <div key={idx} className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2">
                  <div className="flex items-center justify-between gap-2">
                    <input
                      className={`${INPUT} !py-1 text-xs`}
                      maxLength={160}
                      value={item.name}
                      placeholder="Tên hàm / mục (VD: SUMIFS - Tính tổng nhiều điều kiện)"
                      onChange={(e) => {
                        const next = formulas.map((f, i) => (i === idx ? { ...f, name: e.target.value } : f));
                        patchGuide({ formulas: next });
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => patchGuide({ formulas: formulas.filter((_, i) => i !== idx) })}
                      className="shrink-0 text-[11px] font-bold text-rose-600 !shadow-none"
                    >
                      Xóa
                    </button>
                  </div>
                  <input
                    className={`${INPUT} !py-1 font-mono text-xs`}
                    maxLength={300}
                    value={item.syntax}
                    placeholder="Cú pháp công thức (VD: =SUMIFS(...))"
                    onChange={(e) => {
                      const next = formulas.map((f, i) => (i === idx ? { ...f, syntax: e.target.value } : f));
                      patchGuide({ formulas: next });
                    }}
                  />
                  <input
                    className={`${INPUT} !py-1 text-xs`}
                    maxLength={400}
                    value={item.note}
                    placeholder="Ghi chú ngắn cách dùng"
                    onChange={(e) => {
                      const next = formulas.map((f, i) => (i === idx ? { ...f, note: e.target.value } : f));
                      patchGuide({ formulas: next });
                    }}
                  />
                </div>
              ))
            )}
          </div>

          <label className="block">
            <span className={LABEL}>Trọng tâm bài học</span>
            <textarea
              className={`${INPUT} !py-1.5 text-xs`}
              rows={2}
              maxLength={1500}
              value={g.focusSummary}
              placeholder="Tóm tắt kiến thức chính học viên cần nắm sau khi xem video..."
              onChange={(e) => patchGuide({ focusSummary: e.target.value })}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Phím tắt nên nhớ (mỗi dòng 1 mục)</span>
              <textarea
                className={`${INPUT} !py-1.5 text-xs`}
                rows={4}
                value={(g.shortcuts || []).join('\n')}
                placeholder={'Ctrl + S: Lưu bài liên tục\nF4: Cố định địa chỉ $A$1'}
                onChange={(e) => patchGuide({ shortcuts: e.target.value.split('\n') })}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Checklist rà lỗi / tự chấm (mỗi dòng 1 mục)</span>
              <textarea
                className={`${INPUT} !py-1.5 text-xs`}
                rows={4}
                value={(g.checklist || []).join('\n')}
                placeholder={'Không còn ô lỗi #N/A, #VALUE!\nĐã cố định vùng tra cứu bằng F4'}
                onChange={(e) => patchGuide({ checklist: e.target.value.split('\n') })}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeSectionLocks(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const key of DEFAULT_SECTION_ORDER) {
    const val = String(src[key] || '').trim();
    out[key] = ['auto', 'unlocked', 'locked'].includes(val) ? val : 'auto';
  }
  return out;
}

function emptyLevelConfig() {
  return {
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    hiddenSections: [],
    sequentialSections: true,
    sectionLocks: normalizeSectionLocks(),
    content: { title: '', description: '', body: '' },
    files: [],
    video: { title: '', url: '', antiSeek: true, checks: [], guide: emptyVideoGuide() },
    practice: { title: '', description: '', video: { title: '', url: '', antiSeek: true, checks: [], guide: emptyVideoGuide() } },
  };
}

function normalizeSectionOrder(raw) {
  const seen = new Set();
  const list = [];
  for (const key of Array.isArray(raw) ? raw : []) {
    if (DEFAULT_SECTION_ORDER.includes(key) && !seen.has(key)) {
      seen.add(key);
      list.push(key);
    }
  }
  for (const key of DEFAULT_SECTION_ORDER) {
    if (!seen.has(key)) list.push(key);
  }
  return list;
}

export function normalizeLevelConfigs(lesson) {
  const raw = lesson?.levelConfigs || {};
  const mapOne = (cfg, fallbackLegacy = false) => {
    const hasData = cfg && (
      cfg.content?.body || cfg.content?.title || cfg.content?.description
      || (Array.isArray(cfg.files) && cfg.files.length)
      || cfg.video?.url || (Array.isArray(cfg.video?.checks) && cfg.video.checks.length)
      || cfg.video?.guide?.customized
      || cfg.practice?.title || cfg.practice?.description
      || cfg.practice?.video?.url || (Array.isArray(cfg.practice?.video?.checks) && cfg.practice.video.checks.length)
      || cfg.practice?.video?.guide?.customized
      || (Array.isArray(cfg.sectionOrder) && cfg.sectionOrder.length)
      || cfg.sequentialSections === false
      || Object.values(cfg.sectionLocks || {}).some((v) => v && v !== 'auto')
      || cfg.video?.antiSeek === false
    );
    if (hasData) {
      return {
        sectionOrder: normalizeSectionOrder(cfg.sectionOrder),
        hiddenSections: Array.isArray(cfg.hiddenSections) ? [...cfg.hiddenSections] : [],
        sequentialSections: cfg.sequentialSections !== false,
        sectionLocks: normalizeSectionLocks(cfg.sectionLocks),
        content: {
          title: String(cfg.content?.title || ''),
          description: String(cfg.content?.description || ''),
          body: String(cfg.content?.body || ''),
        },
        files: Array.isArray(cfg.files) ? cfg.files.map((f, i) => ({
          id: f.id || `file-${i + 1}`,
          title: f.title || f.name || '',
          url: f.url || '',
          name: f.name || f.title || 'Tài liệu',
          size: Number(f.size) || 0,
        })) : [],
        video: {
          title: String(cfg.video?.title || ''),
          url: String(cfg.video?.url || ''),
          antiSeek: cfg.video?.antiSeek !== false,
          checks: Array.isArray(cfg.video?.checks) ? [...cfg.video.checks] : [],
          guide: normalizeVideoGuide(cfg.video?.guide),
        },
        practice: {
          title: String(cfg.practice?.title || ''),
          description: String(cfg.practice?.description || ''),
          video: {
            title: String(cfg.practice?.video?.title || ''),
            url: String(cfg.practice?.video?.url || ''),
            antiSeek: cfg.practice?.video?.antiSeek !== false,
            checks: Array.isArray(cfg.practice?.video?.checks) ? [...cfg.practice.video.checks] : [],
            guide: normalizeVideoGuide(cfg.practice?.video?.guide),
          },
        },
      };
    }
    if (fallbackLegacy && (lesson?.content || lesson?.fileUrl || lesson?.url)) {
      return {
        sectionOrder: [...DEFAULT_SECTION_ORDER],
        hiddenSections: [],
        sequentialSections: true,
        sectionLocks: normalizeSectionLocks(),
        content: {
          title: String(lesson.title || ''),
          description: '',
          body: String(lesson.content || ''),
        },
        files: lesson.fileUrl ? [{
          id: 'legacy-1',
          title: lesson.fileName || 'Tài liệu bài học',
          url: lesson.fileUrl,
          name: lesson.fileName || 'Tài liệu bài học',
          size: 0,
        }] : [],
        video: {
          title: String(lesson.title || ''),
          url: String(lesson.url || ''),
          antiSeek: true,
          checks: Array.isArray(lesson.checks) ? [...lesson.checks] : [],
        },
        practice: { title: '', description: '', video: { title: '', url: '', antiSeek: true, checks: [] } },
      };
    }
    return emptyLevelConfig();
  };
  return {
    easy: mapOne(raw.easy, true),
    medium: mapOne(raw.medium, false),
    hard: mapOne(raw.hard, false),
  };
}

function extractYouTubeId(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  const m = raw.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
  if (m) return m[1];
  try {
    const parsed = new URL(raw);
    return parsed.searchParams.get('v') || '';
  } catch {
    return '';
  }
}

/** Xem trước giao diện học viên giống hệt layout bài học theo 3 mức độ. */
function StudentPreviewModal({ title, index, levelConfigs, questionCounts, onClose }) {
  const [diff, setDiff] = useState('easy');
  const cfg = levelConfigs[diff] || emptyLevelConfig();
  const visibleSections = cfg.sectionOrder.filter((key) => !(cfg.hiddenSections || []).includes(key));

  return createPortal(
    <div className="fixed inset-0 z-[9400] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" role="presentation">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200" role="dialog" aria-modal="true">
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <BookOpen size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Bài học {String(index + 1).padStart(2, '0')} · Xem trước</p>
            <h3 className="truncate text-lg font-black text-slate-900">{title || `Bài ${index + 1}`}</h3>
            <p className="text-xs font-medium text-slate-500">Học theo từng mức độ</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
            {DIFFICULTY_TABS.map((tab) => {
              const active = diff === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDiff(tab.key)}
                  className={`rounded-xl py-2 text-xs font-black transition !shadow-none ${active ? tab.active : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-2.5">
            {visibleSections.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs font-semibold text-slate-400">
                Tất cả các phần ở mức độ này đang được ẩn.
              </p>
            ) : visibleSections.map((secKey) => {
              const meta = SECTION_META[secKey];
              const Icon = meta.icon;
              let sub = meta.studentDesc;
              if (secKey === 'content' && cfg.content.description) sub = cfg.content.description;
              if (secKey === 'file') sub = cfg.files.length ? `${cfg.files.length} tài liệu đính kèm` : 'Chưa có tài liệu';
              if (secKey === 'video') sub = cfg.video.url ? 'Xem video bài giảng' : 'Chưa gắn video';
              if (secKey === 'practice') {
                const count = questionCounts[diff] || 0;
                sub = count ? `${count} câu hỏi trắc nghiệm` : 'Chưa có câu hỏi';
              }
              return (
                <div key={secKey} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-xs">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconBox}`}>
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-900">{meta.title}</p>
                    <p className="truncate text-xs font-medium text-slate-500">{sub}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${
                    cfg.sectionLocks?.[secKey] === 'locked'
                      ? 'border-rose-200 bg-rose-50 text-rose-600'
                      : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}>
                    {cfg.sectionLocks?.[secKey] === 'locked' ? 'Đang đóng' : 'Mở'}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Tiến độ học tập</span>
              <span>0/{visibleSections.length} phần</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-0 rounded-full bg-emerald-500" />
            </div>
            <button type="button" onClick={onClose} className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3 text-sm font-black text-white !shadow-none">
              Đóng xem trước <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Trang quản lý chi tiết một mốc bài học:
 * - Header: MỐC XX · QUẢN LÝ BÀI HỌC, Tên bài, Trạng thái, Xem trước HV, Lưu thay đổi
 * - 3 Tab Dễ / Vừa / Khó hoàn toàn độc lập
 * - 4 Card (Nội dung, File, Video, Luyện tập) hỗ trợ kéo thả + nút lên/xuống + ẩn/hiện
 */
export default function AdminMilestoneEditor({
  unit,
  lesson,
  lessonIndex,
  onSaveLesson,
  onClose,
  onComposeQuestion,
  onAiDraft,
  onEditQuestion,
  questionsVersion = 0,
}) {
  const toast = useToast();
  const [title, setTitle] = useState(lesson.title || `Bài ${lessonIndex + 1}`);
  const [active, setActive] = useState(lesson.active !== false);
  const [lockMode, setLockMode] = useState(lesson.lockMode || 'sequential');
  const [levelConfigs, setLevelConfigs] = useState(() => normalizeLevelConfigs(lesson));
  const [activeDiff, setActiveDiff] = useState('easy');
  const [expandedSection, setExpandedSection] = useState('content');
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Câu hỏi luyện tập theo unit để thống kê & quản lý ngay trong Card Luyện tập
  const [unitQuestions, setUnitQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);

  const initialSnapshot = useMemo(
    () => JSON.stringify({
      title: lesson.title || `Bài ${lessonIndex + 1}`,
      active: lesson.active !== false,
      lockMode: lesson.lockMode || 'sequential',
      levelConfigs: normalizeLevelConfigs(lesson),
    }),
    [lesson, lessonIndex],
  );

  const currentSnapshot = JSON.stringify({ title, active, lockMode, levelConfigs });
  const dirty = currentSnapshot !== initialSnapshot;

  // Cảnh báo khi đóng trình duyệt nếu có thay đổi chưa lưu
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Tải danh sách câu hỏi thuộc chặng
  useEffect(() => {
    let alive = true;
    setLoadingQ(true);
    dailyPracticeApi.admin.questions({ topicId: unit.topicId, unitId: unit.id })
      .then((rows) => {
        if (alive) setUnitQuestions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingQ(false);
      });
    return () => { alive = false; };
  }, [unit.topicId, unit.id, questionsVersion]);

  const questionCounts = useMemo(() => {
    const out = { easy: 0, medium: 0, hard: 0 };
    for (const q of unitQuestions) {
      if (out[q.difficulty] !== undefined) out[q.difficulty] += 1;
    }
    return out;
  }, [unitQuestions]);

  const diffQuestions = useMemo(
    () => unitQuestions.filter((q) => q.difficulty === activeDiff),
    [unitQuestions, activeDiff],
  );

  const currentCfg = levelConfigs[activeDiff] || emptyLevelConfig();

  const patchCurrentLevel = (updater) => {
    setLevelConfigs((prev) => {
      const base = prev[activeDiff] || emptyLevelConfig();
      const next = typeof updater === 'function' ? updater(base) : { ...base, ...updater };
      return { ...prev, [activeDiff]: next };
    });
  };

  const moveSection = (sectionKey, delta) => {
    patchCurrentLevel((cfg) => {
      const order = [...cfg.sectionOrder];
      const idx = order.indexOf(sectionKey);
      const target = idx + delta;
      if (idx < 0 || target < 0 || target >= order.length) return cfg;
      [order[idx], order[target]] = [order[target], order[idx]];
      return { ...cfg, sectionOrder: order };
    });
  };

  const handleDropSection = (targetKey) => {
    if (!dragKey || dragKey === targetKey) {
      setDragKey(null);
      setDragOverKey(null);
      return;
    }
    patchCurrentLevel((cfg) => {
      const order = [...cfg.sectionOrder];
      const from = order.indexOf(dragKey);
      const to = order.indexOf(targetKey);
      if (from < 0 || to < 0) return cfg;
      order.splice(from, 1);
      order.splice(to, 0, dragKey);
      return { ...cfg, sectionOrder: order };
    });
    setDragKey(null);
    setDragOverKey(null);
  };

  const toggleHideSection = (sectionKey) => {
    patchCurrentLevel((cfg) => {
      const hidden = new Set(cfg.hiddenSections || []);
      if (hidden.has(sectionKey)) hidden.delete(sectionKey);
      else hidden.add(sectionKey);
      return { ...cfg, hiddenSections: Array.from(hidden) };
    });
  };

  const setSectionLock = (sectionKey, mode) => {
    patchCurrentLevel((cfg) => ({
      ...cfg,
      sectionLocks: {
        ...normalizeSectionLocks(cfg.sectionLocks),
        [sectionKey]: ['auto', 'unlocked', 'locked'].includes(mode) ? mode : 'auto',
      },
    }));
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error('File vượt quá 25MB');
      return;
    }
    setUploadingFile(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data?.success || !data.fileUrl) throw new Error(data?.message || 'Upload thất bại');
      const nextFile = {
        id: `file-${Date.now()}`,
        title: data.fileOriginalName || file.name,
        url: data.fileUrl,
        name: data.fileOriginalName || file.name,
        size: file.size || 0,
      };
      patchCurrentLevel((cfg) => ({ ...cfg, files: [...(cfg.files || []), nextFile] }));
      toast.success('Đã tải file lên');
    } catch (err) {
      toast.error(err.message || 'Không tải được file');
    } finally {
      setUploadingFile(false);
    }
  };

  const removeQuestion = async (q) => {
    if (!window.confirm(`Xóa câu hỏi "${q.prompt}"?`)) return;
    try {
      await dailyPracticeApi.admin.deleteQuestion(q.id);
      setUnitQuestions((prev) => prev.filter((item) => item.id !== q.id));
      toast.success('Đã xóa câu hỏi');
    } catch (err) {
      toast.error(err.message || 'Không xóa được câu hỏi');
    }
  };

  const handleClose = () => {
    if (dirty && !window.confirm('Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất các thay đổi đó?')) return;
    onClose();
  };

  const handleSave = async () => {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      toast.error('Tên bài học không được để trống');
      return;
    }
    setSaving(true);
    try {
      await onSaveLesson({
        ...lesson,
        title: cleanTitle,
        active,
        lockMode,
        levelConfigs,
        // Đồng bộ các trường phẳng để tương thích ngược
        content: levelConfigs.easy.content.body || '',
        fileUrl: levelConfigs.easy.files[0]?.url || '',
        fileName: levelConfigs.easy.files[0]?.name || '',
        url: levelConfigs.easy.video.url || '',
        checks: levelConfigs.easy.video.checks || [],
      });
    } finally {
      setSaving(false);
    }
  };

  const sectionSummary = (secKey) => {
    if (secKey === 'content') {
      const len = String(currentCfg.content?.body || '').trim().length;
      return len ? `Đã có ${len} ký tự nội dung` : 'Chưa có văn bản hướng dẫn';
    }
    if (secKey === 'file') {
      const n = currentCfg.files?.length || 0;
      return n ? `${n} tài liệu đính kèm` : 'Chưa có file đính kèm';
    }
    if (secKey === 'video') {
      const hasUrl = Boolean(String(currentCfg.video?.url || '').trim());
      const c = currentCfg.video?.checks?.length || 0;
      if (!hasUrl) return 'Chưa gắn đường dẫn video';
      return c ? `Đã gắn video · ${c} câu hỏi trong video` : 'Đã gắn video bài giảng';
    }
    const qCount = questionCounts[activeDiff] || 0;
    return qCount ? `${qCount} câu hỏi mức ${DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label}` : 'Chưa có câu hỏi ở mức này';
  };

  const ytPreviewId = extractYouTubeId(currentCfg.video?.url);

  return createPortal(
    <div className="fixed inset-0 z-[9200] flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-label="Quản lý bài học theo mốc">
      {/* Top Bar */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 !shadow-none"
          >
            <ArrowLeft size={15} /> Quay lại
          </button>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">
              MỐC {String(lessonIndex + 1).padStart(2, '0')} · QUẢN LÝ BÀI HỌC · {unit.title}
            </p>
            <input
              value={title}
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên bài học..."
              className="mt-0.5 w-full border-0 bg-transparent p-0 text-lg font-black text-slate-900 outline-none focus:ring-0 sm:text-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={lockMode}
              onChange={(e) => setLockMode(e.target.value)}
              aria-label="Chế độ mở khóa bài học"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 outline-none focus:border-emerald-500"
            >
              <option value="sequential">🔒 Xong bài trước mới mở</option>
              <option value="unlocked">🔓 Mở khóa sẵn</option>
              <option value="locked">⛔ Đang khóa bài này</option>
            </select>

            <button
              type="button"
              onClick={() => setActive((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition !shadow-none ${
                active ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {active ? <Eye size={13} /> : <EyeOff size={13} />}
              {active ? 'Đang hiển thị' : 'Đang ẩn'}
            </button>

            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 !shadow-none"
            >
              <Eye size={14} /> Xem trước HV
            </button>

            <button
              type="button"
              disabled={saving || !dirty}
              onClick={handleSave}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-black text-white transition !shadow-none ${
                dirty ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 cursor-not-allowed'
              }`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Đang lưu...' : dirty ? 'Lưu thay đổi' : 'Đã lưu'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Chọn mức độ */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-black text-slate-900">Chọn mức độ để chỉnh sửa</h2>
                <p className="text-xs text-slate-500">Dữ liệu của 3 mức Dễ, Vừa, Khó độc lập hoàn toàn với nhau.</p>
              </div>
              {dirty && (
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                  Có thay đổi chưa lưu
                </span>
              )}
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
              {DIFFICULTY_TABS.map((tab) => {
                const isSelected = activeDiff === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveDiff(tab.key)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-black transition !shadow-none ${
                      isSelected ? tab.active : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                    }`}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Thứ tự hiển thị 4 card */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <p className="text-sm font-black text-slate-900">Thứ tự hiển thị ({DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label})</p>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-emerald-600"
                    checked={currentCfg.sequentialSections !== false}
                    onChange={(e) => patchCurrentLevel({ sequentialSections: e.target.checked })}
                  />
                  Khóa tuần tự 4 phần (xong phần trước mới mở phần sau)
                </label>
                <p className="text-xs font-medium text-slate-500">Kéo thả tay nắm hoặc chọn mũi tên để sắp xếp</p>
              </div>
            </div>

            <div className="space-y-3">
              {currentCfg.sectionOrder.map((secKey, idx) => {
                const meta = SECTION_META[secKey];
                const Icon = meta.icon;
                const isOpen = expandedSection === secKey;
                const isHidden = (currentCfg.hiddenSections || []).includes(secKey);
                const isDragTarget = dragOverKey === secKey && dragKey !== secKey;

                return (
                  <div
                    key={secKey}
                    draggable
                    onDragStart={(e) => {
                      setDragKey(secKey);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (dragOverKey !== secKey) setDragOverKey(secKey);
                    }}
                    onDragLeave={() => {
                      if (dragOverKey === secKey) setDragOverKey(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      handleDropSection(secKey);
                    }}
                    onDragEnd={() => {
                      setDragKey(null);
                      setDragOverKey(null);
                    }}
                    className={`rounded-2xl border bg-white transition ${
                      isDragTarget ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
                    } ${isHidden ? 'opacity-65' : ''}`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center gap-3 p-3.5 sm:px-4">
                      <span
                        className="cursor-grab rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing"
                        title="Kéo thả để đổi vị trí"
                      >
                        <GripVertical size={18} />
                      </span>

                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${meta.iconBox}`}>
                        <Icon size={18} />
                      </span>

                      <button
                        type="button"
                        onClick={() => setExpandedSection(isOpen ? null : secKey)}
                        className="min-w-0 flex-1 text-left !shadow-none"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-slate-900">
                            {idx + 1}. {meta.title}
                          </p>
                          {(currentCfg.sectionLocks?.[secKey] || 'auto') === 'unlocked' && (
                            <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">Mở sẵn</span>
                          )}
                          {(currentCfg.sectionLocks?.[secKey] || 'auto') === 'locked' && (
                            <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">Đang đóng</span>
                          )}
                          {isHidden && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">Đang ẩn</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-slate-500">{sectionSummary(secKey)}</p>
                      </button>

                      {/* Trạng thái mở / đóng phần này */}
                      <select
                        value={currentCfg.sectionLocks?.[secKey] || 'auto'}
                        onChange={(e) => setSectionLock(secKey, e.target.value)}
                        aria-label={`Trạng thái mở khóa ${meta.title}`}
                        title="Tùy chỉnh mở khóa hoặc đóng phần này"
                        className={`rounded-lg border px-2 py-1 text-[11px] font-bold outline-none transition ${
                          (currentCfg.sectionLocks?.[secKey] || 'auto') === 'locked'
                            ? 'border-rose-200 bg-rose-50 text-rose-700'
                            : (currentCfg.sectionLocks?.[secKey] || 'auto') === 'unlocked'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-600'
                        }`}
                      >
                        <option value="auto">🔒 Theo tuần tự</option>
                        <option value="unlocked">🔓 Mở khóa</option>
                        <option value="locked">⛔ Đang đóng</option>
                      </select>

                      {/* Nút ẩn/hiện */}
                      <button
                        type="button"
                        onClick={() => toggleHideSection(secKey)}
                        title={isHidden ? 'Hiện phần này với học viên' : 'Ẩn phần này với học viên'}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 !shadow-none"
                      >
                        {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>

                      {/* Nút lên / xuống cho bàn phím & cảm ứng */}
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(secKey, -1)}
                          aria-label={`Đưa ${meta.title} lên`}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 !shadow-none"
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === currentCfg.sectionOrder.length - 1}
                          onClick={() => moveSection(secKey, 1)}
                          aria-label={`Đưa ${meta.title} xuống`}
                          className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-25 !shadow-none"
                        >
                          <ChevronDown size={15} />
                        </button>
                      </div>

                      {/* Nút mở rộng / thu gọn */}
                      <button
                        type="button"
                        onClick={() => setExpandedSection(isOpen ? null : secKey)}
                        className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black transition !shadow-none ${
                          isOpen ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Pencil size={12} /> {isOpen ? 'Thu gọn' : 'Chỉnh sửa'}
                      </button>
                    </div>

                    {/* Card Body */}
                    {isOpen && (
                      <div className="border-t border-slate-100 p-4 sm:p-5">
                        {secKey === 'content' && (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className={LABEL}>Tiêu đề phần nội dung (tuỳ chọn)</span>
                                <input
                                  className={INPUT}
                                  maxLength={160}
                                  value={currentCfg.content?.title || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, content: { ...c.content, title: e.target.value } }))}
                                  placeholder={`Mặc định: ${title}`}
                                />
                              </label>
                              <label className="block">
                                <span className={LABEL}>Mô tả ngắn</span>
                                <input
                                  className={INPUT}
                                  maxLength={320}
                                  value={currentCfg.content?.description || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, content: { ...c.content, description: e.target.value } }))}
                                  placeholder="Tóm tắt kiến thức trọng tâm..."
                                />
                              </label>
                            </div>
                            <label className="block">
                              <span className={LABEL}>Nội dung văn bản, hướng dẫn học tập</span>
                              <textarea
                                className={`${INPUT} !min-h-[160px]`}
                                maxLength={15000}
                                value={currentCfg.content?.body || ''}
                                onChange={(e) => patchCurrentLevel((c) => ({ ...c, content: { ...c.content, body: e.target.value } }))}
                                placeholder="Nhập nội dung kiến thức, hướng dẫn chi tiết cho mức độ này..."
                              />
                            </label>
                          </div>
                        )}

                        {secKey === 'file' && (
                          <div className="space-y-3">
                            {(currentCfg.files || []).length === 0 ? (
                              <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-4 text-center text-xs font-semibold text-amber-800">
                                Chưa có tài liệu nào ở mức độ này.
                              </p>
                            ) : (
                              <ul className="space-y-2">
                                {currentCfg.files.map((file, fileIdx) => (
                                  <li key={file.id || fileIdx} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                                      <FileText size={18} />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <input
                                        className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-bold text-slate-900 focus:border-amber-300 focus:bg-white focus:outline-none"
                                        value={file.title || file.name}
                                        maxLength={180}
                                        onChange={(e) => patchCurrentLevel((c) => ({
                                          ...c,
                                          files: c.files.map((f, i) => (i === fileIdx ? { ...f, title: e.target.value, name: e.target.value } : f)),
                                        }))}
                                      />
                                      <p className="truncate px-1.5 text-[11px] text-slate-500">{file.url}</p>
                                    </div>
                                    <a
                                      href={resolveMediaUrl(file.url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                                    >
                                      <ExternalLink size={13} /> Xem
                                    </a>
                                    <a
                                      href={buildMediaDownloadUrl(file.url, file.name)}
                                      download={file.name}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-amber-700"
                                    >
                                      <Download size={13} /> Tải
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => patchCurrentLevel((c) => ({
                                        ...c,
                                        files: c.files.filter((_, i) => i !== fileIdx),
                                      }))}
                                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 !shadow-none"
                                      title="Xóa file"
                                    >
                                      <Trash2 size={15} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}

                            <div className="flex flex-wrap items-center gap-3">
                              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-black text-amber-900 hover:bg-amber-100 ${uploadingFile ? 'pointer-events-none opacity-60' : ''}`}>
                                {uploadingFile ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {uploadingFile ? 'Đang tải lên...' : 'Tải thêm tài liệu'}
                                <input type="file" className="hidden" accept={BAI_FILE_ACCEPT} disabled={uploadingFile} onChange={handleUploadFile} />
                              </label>
                              <span className="text-[11px] text-slate-500">Hỗ trợ PDF, Word, Excel, PowerPoint, ZIP, ảnh (tối đa 25MB/file).</span>
                            </div>
                          </div>
                        )}

                        {secKey === 'video' && (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className={LABEL}>Tiêu đề video (tuỳ chọn)</span>
                                <input
                                  className={INPUT}
                                  maxLength={160}
                                  value={currentCfg.video?.title || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, video: { ...c.video, title: e.target.value } }))}
                                  placeholder={`Video: ${title}`}
                                />
                              </label>
                              <label className="block">
                                <span className={LABEL}>Đường dẫn Video (YouTube, Vimeo hoặc .mp4)</span>
                                <input
                                  className={INPUT}
                                  maxLength={500}
                                  value={currentCfg.video?.url || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, video: { ...c.video, url: e.target.value } }))}
                                  placeholder="https://www.youtube.com/watch?v=..."
                                />
                              </label>
                            </div>

                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-emerald-600"
                                checked={currentCfg.video?.antiSeek !== false}
                                onChange={(e) => patchCurrentLevel((c) => ({
                                  ...c,
                                  video: { ...c.video, antiSeek: e.target.checked },
                                }))}
                              />
                              Chống tua video (không cho học viên tua nhanh khi chưa xem xong)
                            </label>

                            {String(currentCfg.video?.url || '').trim() ? (
                              <div className="space-y-3">
                                {ytPreviewId ? (
                                  <div className="aspect-video w-full max-w-lg overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200">
                                    <iframe
                                      title="Xem trước video"
                                      src={`https://www.youtube.com/embed/${ytPreviewId}`}
                                      className="h-full w-full"
                                      allowFullScreen
                                    />
                                  </div>
                                ) : (
                                  <p className="text-xs font-semibold text-slate-500">
                                    Đã gắn URL video: <a href={resolveMediaUrl(currentCfg.video.url)} target="_blank" rel="noreferrer" className="text-sky-700 underline">{currentCfg.video.url}</a>
                                  </p>
                                )}

                                <VideoChecksEditor
                                  checks={currentCfg.video?.checks || []}
                                  onChange={(checks) => patchCurrentLevel((c) => ({ ...c, video: { ...c.video, checks } }))}
                                />

                                <VideoGuideEditor
                                  guide={currentCfg.video?.guide}
                                  onChange={(guide) => patchCurrentLevel((c) => ({ ...c, video: { ...c.video, guide } }))}
                                />
                              </div>
                            ) : (
                              <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs font-semibold text-slate-500">
                                Nhập đường dẫn video để xem trước và thiết lập mốc câu hỏi trong video.
                              </p>
                            )}
                          </div>
                        )}

                        {secKey === 'practice' && (
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="block">
                                <span className={LABEL}>Tiêu đề phần luyện tập</span>
                                <input
                                  className={INPUT}
                                  maxLength={160}
                                  value={currentCfg.practice?.title || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, practice: { ...c.practice, title: e.target.value } }))}
                                  placeholder={`Luyện tập mức ${DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label}`}
                                />
                              </label>
                              <label className="block">
                                <span className={LABEL}>Ghi chú / hướng dẫn luyện tập</span>
                                <input
                                  className={INPUT}
                                  maxLength={320}
                                  value={currentCfg.practice?.description || ''}
                                  onChange={(e) => patchCurrentLevel((c) => ({ ...c, practice: { ...c.practice, description: e.target.value } }))}
                                  placeholder="Làm tối thiểu 60% để vượt qua..."
                                />
                              </label>
                            </div>

                            {/* Video hướng dẫn & mốc trắc nghiệm trong phần Luyện tập */}
                            <div className="space-y-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/35 p-3.5">
                              <p className="text-xs font-black uppercase tracking-wider text-emerald-800">
                                Video hướng dẫn luyện tập &amp; mốc trắc nghiệm (tuỳ chọn)
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="block">
                                  <span className={LABEL}>Tiêu đề video luyện tập</span>
                                  <input
                                    className={INPUT}
                                    maxLength={160}
                                    value={currentCfg.practice?.video?.title || ''}
                                    onChange={(e) => patchCurrentLevel((c) => ({
                                      ...c,
                                      practice: {
                                        ...c.practice,
                                        video: { ...(c.practice?.video || {}), title: e.target.value },
                                      },
                                    }))}
                                    placeholder={`Video hướng dẫn: ${title}`}
                                  />
                                </label>
                                <label className="block">
                                  <span className={LABEL}>Đường dẫn Video (YouTube, Vimeo hoặc .mp4)</span>
                                  <input
                                    className={INPUT}
                                    maxLength={500}
                                    value={currentCfg.practice?.video?.url || ''}
                                    onChange={(e) => patchCurrentLevel((c) => ({
                                      ...c,
                                      practice: {
                                        ...c.practice,
                                        video: { ...(c.practice?.video || {}), url: e.target.value },
                                      },
                                    }))}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                  />
                                </label>
                              </div>
                              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-emerald-600"
                                  checked={currentCfg.practice?.video?.antiSeek !== false}
                                  onChange={(e) => patchCurrentLevel((c) => ({
                                    ...c,
                                    practice: {
                                      ...c.practice,
                                      video: { ...(c.practice?.video || {}), antiSeek: e.target.checked },
                                    },
                                  }))}
                                />
                                Chống tua video (không cho học viên tua nhanh khi chưa xem xong)
                              </label>
                              {String(currentCfg.practice?.video?.url || '').trim() ? (
                                <div className="space-y-3">
                                  {extractYouTubeId(currentCfg.practice.video.url) ? (
                                    <div className="aspect-video w-full max-w-lg overflow-hidden rounded-xl bg-slate-900 ring-1 ring-slate-200">
                                      <iframe
                                        title="Xem trước video luyện tập"
                                        src={`https://www.youtube.com/embed/${extractYouTubeId(currentCfg.practice.video.url)}`}
                                        className="h-full w-full"
                                        allowFullScreen
                                      />
                                    </div>
                                  ) : (
                                    <p className="text-xs font-semibold text-slate-500">
                                      Đã gắn URL video: <a href={resolveMediaUrl(currentCfg.practice.video.url)} target="_blank" rel="noreferrer" className="text-sky-700 underline">{currentCfg.practice.video.url}</a>
                                    </p>
                                  )}
                                  <VideoChecksEditor
                                    checks={currentCfg.practice?.video?.checks || []}
                                    onChange={(checks) => patchCurrentLevel((c) => ({
                                      ...c,
                                      practice: {
                                        ...c.practice,
                                        video: { ...(c.practice?.video || {}), checks },
                                      },
                                    }))}
                                  />
                                  <VideoGuideEditor
                                    guide={currentCfg.practice?.video?.guide}
                                    onChange={(guide) => patchCurrentLevel((c) => ({
                                      ...c,
                                      practice: {
                                        ...c.practice,
                                        video: { ...(c.practice?.video || {}), guide },
                                      },
                                    }))}
                                  />
                                </div>
                              ) : (
                                <p className="rounded-xl border border-dashed border-emerald-200 bg-white/70 p-2.5 text-xs font-semibold text-slate-500">
                                  Nhập đường dẫn video để xem trước và thêm mốc trắc nghiệm trong video luyện tập.
                                </p>
                              )}
                            </div>

                            {/* Thống kê 3 mức câu hỏi */}
                            <div className="grid grid-cols-3 gap-2">
                              {DIFFICULTY_TABS.map((tab) => (
                                <div
                                  key={tab.key}
                                  className={`rounded-xl border px-3 py-2 text-center ${
                                    activeDiff === tab.key ? `border-slate-300 bg-slate-50 ring-1 ${tab.ring}` : 'border-slate-100 bg-white'
                                  }`}
                                >
                                  <p className="text-[11px] font-black uppercase text-slate-500">{tab.label}</p>
                                  <p className="text-base font-black text-slate-900">{questionCounts[tab.key]} câu</p>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => onAiDraft?.(unit.id, activeDiff)}
                                className="cms-btn cms-btn-outline !py-1.5 text-xs"
                              >
                                <Bot size={14} /> AI tạo nháp ({DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label})
                              </button>
                              <button
                                type="button"
                                onClick={() => onComposeQuestion?.(unit.id, activeDiff)}
                                className="cms-btn cms-btn-primary !py-1.5 text-xs"
                              >
                                <Plus size={14} /> Soạn câu hỏi ({DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label})
                              </button>
                            </div>

                            {loadingQ ? (
                              <p className="flex items-center gap-2 text-xs font-semibold text-slate-500"><Loader2 size={14} className="animate-spin" /> Đang tải câu hỏi...</p>
                            ) : diffQuestions.length === 0 ? (
                              <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4 text-center text-xs font-semibold text-emerald-800">
                                Chưa có câu hỏi mức {DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label} trong chặng này.
                              </p>
                            ) : (
                              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                                {diffQuestions.map((q, qIdx) => (
                                  <li key={q.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs">
                                    <span className="font-black text-slate-400">#{qIdx + 1}</span>
                                    <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-600 ring-1 ring-slate-200">
                                      {QUESTION_TYPES[q.type]?.label || q.type}
                                    </span>
                                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{q.prompt}</span>
                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${q.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                      {q.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                                    </span>
                                    <button type="button" onClick={() => onEditQuestion?.(q)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800 !shadow-none" title="Sửa câu hỏi">
                                      <Pencil size={13} />
                                    </button>
                                    <button type="button" onClick={() => removeQuestion(q)} className="rounded p-1 text-red-500 hover:bg-red-50 !shadow-none" title="Xóa câu hỏi">
                                      <Trash2 size={13} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      {previewOpen && (
        <StudentPreviewModal
          title={title}
          index={lessonIndex}
          levelConfigs={levelConfigs}
          questionCounts={questionCounts}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>,
    document.body,
  );
}

