import { useEffect, useMemo, useState } from 'react';
import { cmsConfirmAction } from '../../../utils/cmsDialog';
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
  ClipboardCheck,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  GripVertical,
  Link2,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Save,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';
import api, { buildMediaDownloadUrl, resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { useToast } from '../../../utils/useToast';
import { QUESTION_TYPES } from '../../../utils/dailyPractice';
import AdminDropletExerciseEditor, { normalizeExercises } from './AdminDropletExerciseEditor';
import {
  PRACTICE_VIDEO_TOKEN,
  buildPracticeSequence,
  movePracticeOrderToken,
} from '../../../../../shared/dailyPractice/practiceSequence.mjs';

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
    practice: { title: '', description: '', itemOrder: [], video: { title: '', url: '', antiSeek: true, checks: [], guide: emptyVideoGuide() } },
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
      || (Array.isArray(cfg.practice?.itemOrder) && cfg.practice.itemOrder.length)
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
          itemOrder: Array.isArray(cfg.practice?.itemOrder) ? [...cfg.practice.itemOrder] : [],
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
        practice: { title: '', description: '', itemOrder: [], video: { title: '', url: '', antiSeek: true, checks: [] } },
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

/** Xem trước giao diện học viên giống hệt layout bài học. */
function StudentPreviewModal({ title, index, levelConfigs, questionCounts, exerciseCount = 0, onClose }) {
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Hạt nước {String(index + 1).padStart(2, '0')} · Xem trước</p>
            <h3 className="truncate text-lg font-black text-slate-900">{title || `Hạt nước ${index + 1}`}</h3>
            <p className="text-xs font-medium text-slate-500">Giao diện học viên</p>
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
            {exerciseCount > 0 && (
              <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50/70 px-3.5 py-3 shadow-xs">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 ring-1 ring-violet-200">
                  <ClipboardCheck size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">Đề bài tập tự nhập đáp án</p>
                  <p className="truncate text-xs font-medium text-slate-500">{exerciseCount} bài tập (Tự khớp / AI chấm)</p>
                </div>
                <span className="shrink-0 rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-bold text-violet-700">
                  Mở
                </span>
              </div>
            )}
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

const DROPLET_ROLES = [
  { value: 'book', label: '📖 Học bài (Video / Nội dung / File)', defaultTitle: 'Học bài' },
  { value: 'dumbbell', label: '🎮 Luyện tập (Trắc nghiệm 3 cấp)', defaultTitle: 'Luyện tập' },
  { value: 'clipboard', label: '✍️ Bài tập tự nhập (Tự khớp / AI)', defaultTitle: 'Bài tập tự nhập' },
  { value: 'flame', label: '🔥 Thử thách (Trắc nghiệm nâng cao)', defaultTitle: 'Thử thách' },
  { value: 'crown', label: '🏆 Vượt chặng (Kiểm tra tổng hợp)', defaultTitle: 'Vượt chặng' },
];

const DEFAULT_DROPLET_TITLE_SET = new Set([
  'Học bài',
  'Luyện tập',
  'Bài tập tự nhập',
  'Bài tập thực hành',
  'Thử thách',
  'Vượt chặng',
  'Nội dung & File',
  'Hoàn thành',
]);

function isDefaultDropletTitle(rawTitle) {
  const clean = String(rawTitle || '').trim();
  if (!clean || DEFAULT_DROPLET_TITLE_SET.has(clean)) return true;
  if (/^Hạt nước \d+$/i.test(clean)) return true;
  return /^(Học bài|Luyện tập|Bài tập thực hành|Bài tập tự nhập|Thử thách|Vượt chặng|Nội dung & File)\s+\d+$/i.test(clean);
}

function primaryModuleForIcon(icon) {
  if (icon === 'clipboard') return 'exercises';
  if (icon === 'crown') return 'testout';
  if (icon === 'dumbbell' || icon === 'flame') return 'quiz';
  return 'materials';
}

function hasMaterialsContent(cfg) {
  if (!cfg) return false;
  return Boolean(
    String(cfg.video?.url || '').trim()
    || String(cfg.content?.body || '').trim()
    || String(cfg.content?.description || '').trim()
    || (cfg.files || []).length > 0
    || (cfg.video?.checks || []).length > 0
    || cfg.video?.guide?.customized,
  );
}

/**
 * Studio soạn một Hạt nước theo đúng loại hạt:
 * - Học bài -> Video (có mốc trả lời) · Nội dung · File (soạn 1 bộ chung, không nhân 3 Dễ/Vừa/Khó)
 * - Luyện tập / Thử thách -> Trắc nghiệm 3 cấp (Dễ / Vừa / Khó)
 * - Bài tập tự nhập -> Đề bài tập (Tự khớp / AI chấm)
 * - Vượt chặng -> Bộ đề Kiểm tra vượt chặng (hoặc tự lấy 10 câu trong chặng)
 * Ngoài ra luôn có dải "Thành phần bổ trợ tuỳ chọn" để ghép thêm module bất kỳ vào hạt nước.
 */
export default function AdminMilestoneEditor({
  unit,
  lesson,
  lessonIndex,
  totalDroplets = 1,
  initialTab = '',
  initialSection = '',
  onSaveLesson,
  onClose,
  onComposeQuestion,
  onAiDraft,
  onEditQuestion,
  onComposeTestOut,
  onAiTestOut,
  onToggleStatus,
  onDeleteQuestion,
  questionsVersion = 0,
}) {
  const toast = useToast();
  const [title, setTitle] = useState(lesson.title || `Hạt nước ${lessonIndex + 1}`);
  const [icon, setIcon] = useState(lesson.icon || 'book');
  const [active, setActive] = useState(lesson.active !== false);
  const [lockMode, setLockMode] = useState(lesson.lockMode || 'sequential');
  const [levelConfigs, setLevelConfigs] = useState(() => normalizeLevelConfigs(lesson));
  const [exercises, setExercises] = useState(() => normalizeExercises(lesson.exercises));
  const [activeDiff, setActiveDiff] = useState('easy');
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const primaryModule = primaryModuleForIcon(icon);
  const materialsCfg = levelConfigs.easy || emptyLevelConfig();
  const hasMaterialsData = hasMaterialsContent(materialsCfg);

  const [extraModules, setExtraModules] = useState(() => {
    const startPrimary = primaryModuleForIcon(lesson.icon || 'book');
    const startHasMaterials = hasMaterialsContent(normalizeLevelConfigs(lesson).easy);
    const startHasExercises = normalizeExercises(lesson.exercises).length > 0;
    return {
      materials: (startPrimary !== 'materials' && startHasMaterials) || (initialTab === 'materials' && startPrimary !== 'materials'),
      quiz: initialTab === 'quiz' && startPrimary !== 'quiz',
      exercises: (startPrimary !== 'exercises' && startHasExercises) || (initialTab === 'exercises' && startPrimary !== 'exercises'),
    };
  });
  const [quizAutoChecked, setQuizAutoChecked] = useState(false);

  // Câu hỏi luyện tập theo chặng (gồm cả theo nodeKey)
  const [unitQuestions, setUnitQuestions] = useState([]);
  const [loadingQ, setLoadingQ] = useState(false);
  const [quizScope, setQuizScope] = useState('node'); // 'node' | 'all'

  // Câu hỏi Kiểm tra vượt chặng (chỉ tải khi hạt là Vượt chặng)
  const [testOutQuestions, setTestOutQuestions] = useState([]);
  const [loadingTestOut, setLoadingTestOut] = useState(false);

  const initialSnapshot = useMemo(
    () => JSON.stringify({
      title: lesson.title || `Hạt nước ${lessonIndex + 1}`,
      icon: lesson.icon || 'book',
      active: lesson.active !== false,
      lockMode: lesson.lockMode || 'sequential',
      levelConfigs: normalizeLevelConfigs(lesson),
      exercises: normalizeExercises(lesson.exercises),
    }),
    [lesson, lessonIndex],
  );

  const currentSnapshot = JSON.stringify({ title, icon, active, lockMode, levelConfigs, exercises });
  const dirty = currentSnapshot !== initialSnapshot;

  useEffect(() => {
    let alive = true;
    setLoadingQ(true);
    dailyPracticeApi.admin.questions({ topicId: unit.topicId, unitId: unit.id, forTestOut: 'false' })
      .then((rows) => {
        if (alive) setUnitQuestions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (alive) setUnitQuestions([]);
      })
      .finally(() => {
        if (alive) setLoadingQ(false);
      });
    return () => { alive = false; };
  }, [unit.topicId, unit.id, questionsVersion]);

  useEffect(() => {
    if (icon !== 'crown') return undefined;
    let alive = true;
    setLoadingTestOut(true);
    dailyPracticeApi.admin.questions({ topicId: unit.topicId, unitId: unit.id, forTestOut: 'true' })
      .then((rows) => {
        if (alive) setTestOutQuestions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (alive) setTestOutQuestions([]);
      })
      .finally(() => {
        if (alive) setLoadingTestOut(false);
      });
    return () => { alive = false; };
  }, [unit.topicId, unit.id, questionsVersion, icon]);

  const nodeKey = String(lesson.nodeKey || '').trim();
  const nodeOwnQuestions = useMemo(
    () => (nodeKey ? unitQuestions.filter((q) => String(q.nodeKey || '') === nodeKey) : []),
    [unitQuestions, nodeKey],
  );

  useEffect(() => {
    if (loadingQ || quizAutoChecked) return;
    setQuizAutoChecked(true);
    if (primaryModule !== 'quiz' && nodeOwnQuestions.length > 0) {
      setExtraModules((prev) => (prev.quiz ? prev : { ...prev, quiz: true }));
    }
  }, [loadingQ, quizAutoChecked, primaryModule, nodeOwnQuestions.length]);

  const effectiveQuizPool = useMemo(() => {
    if (quizScope === 'node' && nodeKey) return nodeOwnQuestions;
    return unitQuestions;
  }, [quizScope, nodeKey, nodeOwnQuestions, unitQuestions]);

  const questionCounts = useMemo(() => {
    const src = nodeOwnQuestions.length > 0 ? nodeOwnQuestions : unitQuestions;
    const out = { easy: 0, medium: 0, hard: 0 };
    for (const q of src) {
      if (out[q.difficulty] !== undefined) out[q.difficulty] += 1;
    }
    return out;
  }, [nodeOwnQuestions, unitQuestions]);

  const diffQuestions = useMemo(
    () => effectiveQuizPool.filter((q) => q.difficulty === activeDiff),
    [effectiveQuizPool, activeDiff],
  );

  const patchLevelByKey = (diffKey, updater) => {
    setLevelConfigs((prev) => {
      const base = prev[diffKey] || emptyLevelConfig();
      const next = typeof updater === 'function' ? updater(base) : { ...base, ...updater };
      return { ...prev, [diffKey]: next };
    });
  };

  // Video · Nội dung · File dùng 1 bộ duy nhất lưu tại levelConfigs.easy (tương thích hoàn toàn giao diện học viên hiện tại)
  const patchMaterials = (updater) => patchLevelByKey('easy', updater);
  const patchQuizDifficulty = (updater) => patchLevelByKey(activeDiff, updater);

  const quizDiffCfg = levelConfigs[activeDiff] || emptyLevelConfig();
  const hasPracticeVideo = Boolean(String(quizDiffCfg.practice?.video?.url || '').trim());
  const orderedPracticeItems = useMemo(
    () => buildPracticeSequence({
      hasVideo: hasPracticeVideo,
      itemOrder: quizDiffCfg.practice?.itemOrder || [],
      questions: diffQuestions,
    }),
    [hasPracticeVideo, quizDiffCfg.practice?.itemOrder, diffQuestions],
  );
  const practiceVideoSeqIdx = orderedPracticeItems.findIndex((item) => item.key === PRACTICE_VIDEO_TOKEN);

  const movePracticeItem = (fromIndex, toIndex) => {
    const keys = orderedPracticeItems.map((item) => item.key);
    const nextOrder = movePracticeOrderToken(keys, fromIndex, toIndex);
    patchQuizDifficulty((cfg) => ({
      ...cfg,
      practice: { ...cfg.practice, itemOrder: nextOrder },
    }));
  };

  const moveSection = (sectionKey, delta) => {
    patchMaterials((cfg) => {
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
    patchMaterials((cfg) => {
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
    patchMaterials((cfg) => {
      const hidden = new Set(cfg.hiddenSections || []);
      if (hidden.has(sectionKey)) hidden.delete(sectionKey);
      else hidden.add(sectionKey);
      return { ...cfg, hiddenSections: Array.from(hidden) };
    });
  };

  const setSectionLock = (sectionKey, mode) => {
    patchMaterials((cfg) => ({
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
      patchMaterials((cfg) => ({ ...cfg, files: [...(cfg.files || []), nextFile] }));
      toast.success('Đã tải file lên');
    } catch (err) {
      toast.error(err.message || 'Không tải được file');
    } finally {
      setUploadingFile(false);
    }
  };

  const assignQuestionToNode = async (q, assign) => {
    if (!nodeKey) return;
    try {
      const updated = await dailyPracticeApi.admin.updateQuestion(q.id, { nodeKey: assign ? nodeKey : '' });
      setUnitQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)));
      toast.success(assign ? `Đã gắn câu hỏi vào "${title}"` : 'Đã chuyển câu hỏi về dùng chung cả chặng');
    } catch (err) {
      toast.error(err.message || 'Không cập nhật được phạm vi câu hỏi');
    }
  };

  const toggleQuestionStatusLocal = async (q) => {
    if (onToggleStatus) {
      await onToggleStatus(q);
      return;
    }
    try {
      const nextStatus = q.status === 'published' ? 'draft' : 'published';
      const updated = await dailyPracticeApi.admin.updateQuestion(q.id, { status: nextStatus });
      setUnitQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)));
      setTestOutQuestions((prev) => prev.map((item) => (item.id === q.id ? updated : item)));
    } catch (err) {
      toast.error(err.message || 'Không đổi được trạng thái câu hỏi');
    }
  };

  const removeQuestion = async (q) => {
    if (onDeleteQuestion) {
      await onDeleteQuestion(q);
      return;
    }
    if (!(await cmsConfirmAction(`Xóa câu hỏi "${q.prompt}"?`))) return;
    try {
      await dailyPracticeApi.admin.deleteQuestion(q.id);
      setUnitQuestions((prev) => prev.filter((item) => item.id !== q.id));
      setTestOutQuestions((prev) => prev.filter((item) => item.id !== q.id));
      toast.success('Đã xóa câu hỏi');
    } catch (err) {
      toast.error(err.message || 'Không xóa được câu hỏi');
    }
  };

  const handleChangeRole = (nextIcon) => {
    setIcon(nextIcon);
    const meta = DROPLET_ROLES.find((r) => r.value === nextIcon);
    if (meta && isDefaultDropletTitle(title)) {
      setTitle(meta.defaultTitle);
    }
  };

  const handleClose = async () => {
    if (dirty && !(await cmsConfirmAction('Bạn có thay đổi chưa lưu. Rời khỏi trang này sẽ mất các thay đổi đó?'))) return;
    onClose();
  };

  const handleSave = async () => {
    const cleanTitle = String(title || '').trim();
    if (!cleanTitle) {
      toast.error('Tên hạt nước không được để trống');
      return;
    }
    for (let i = 0; i < exercises.length; i += 1) {
      const ex = exercises[i];
      if (!String(ex.prompt || '').trim()) {
        toast.error(`Bài tập ${i + 1}: chưa nhập đề bài`);
        if (primaryModule !== 'exercises') setExtraModules((p) => ({ ...p, exercises: true }));
        return;
      }
      const answers = (ex.expectedAnswers || []).map((a) => String(a || '').trim()).filter(Boolean);
      if (ex.gradingMode === 'auto' && !answers.length) {
        toast.error(`Bài tập ${i + 1}: chế độ Tự khớp cần ít nhất 1 đáp án chuẩn`);
        if (primaryModule !== 'exercises') setExtraModules((p) => ({ ...p, exercises: true }));
        return;
      }
      if (ex.gradingMode === 'ai' && !answers.length && !String(ex.aiCriteria || '').trim()) {
        toast.error(`Bài tập ${i + 1}: chế độ AI chấm cần đáp án tham khảo hoặc tiêu chí`);
        if (primaryModule !== 'exercises') setExtraModules((p) => ({ ...p, exercises: true }));
        return;
      }
    }
    setSaving(true);
    try {
      await onSaveLesson({
        ...lesson,
        title: cleanTitle,
        icon,
        active,
        lockMode,
        levelConfigs,
        exercises,
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
      const len = String(materialsCfg.content?.body || '').trim().length;
      return len ? `Đã có ${len} ký tự nội dung` : 'Chưa có văn bản hướng dẫn';
    }
    if (secKey === 'file') {
      const n = materialsCfg.files?.length || 0;
      return n ? `${n} tài liệu đính kèm` : 'Chưa có file đính kèm';
    }
    if (secKey === 'video') {
      const hasUrl = Boolean(String(materialsCfg.video?.url || '').trim());
      const c = materialsCfg.video?.checks?.length || 0;
      if (!hasUrl) return 'Chưa gắn đường dẫn video';
      return c ? `Đã gắn video · ${c} mốc câu hỏi` : 'Đã gắn video bài giảng';
    }
    const total = nodeOwnQuestions.length > 0 ? nodeOwnQuestions.length : unitQuestions.length;
    return total ? `${total} câu trắc nghiệm (Dễ / Vừa / Khó)` : 'Chưa có câu hỏi trắc nghiệm';
  };

  const ytPreviewId = extractYouTubeId(materialsCfg.video?.url);
  const showMaterials = primaryModule === 'materials' || extraModules.materials;
  const showQuiz = primaryModule === 'quiz' || extraModules.quiz;
  const showExercises = primaryModule === 'exercises' || extraModules.exercises;

  const renderMaterialsBlock = (isExtra = false) => (
    <div className="space-y-4">
      {isExtra && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black uppercase tracking-wider text-sky-700">
            Thành phần bổ trợ · Video, Nội dung &amp; File
          </p>
          <button
            type="button"
            onClick={() => setExtraModules((p) => ({ ...p, materials: false }))}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 !shadow-none"
          >
            Thu gọn
          </button>
        </div>
      )}

      {/* 1. Video bài giảng + Mốc câu hỏi trong video */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
            <Clapperboard size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">1. Video bài giảng &amp; Mốc câu hỏi trong video</h2>
            <p className="text-xs text-slate-500">Soạn 1 lần duy nhất cho hạt nước này (học viên xem video và trả lời ngay tại các mốc dừng).</p>
          </div>
          {String(materialsCfg.video?.url || '').trim() ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
              Đã gắn video{(materialsCfg.video?.checks?.length || 0) > 0 ? ` · ${materialsCfg.video.checks.length} mốc` : ''}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={LABEL}>Tiêu đề video (tuỳ chọn)</span>
            <input
              className={INPUT}
              maxLength={160}
              value={materialsCfg.video?.title || ''}
              onChange={(e) => patchMaterials((c) => ({ ...c, video: { ...c.video, title: e.target.value } }))}
              placeholder={`Video: ${title}`}
            />
          </label>
          <label className="block">
            <span className={LABEL}>Đường dẫn Video (YouTube, Vimeo hoặc .mp4)</span>
            <input
              className={INPUT}
              maxLength={500}
              value={materialsCfg.video?.url || ''}
              onChange={(e) => patchMaterials((c) => ({ ...c, video: { ...c.video, url: e.target.value } }))}
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </label>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            className="h-4 w-4 accent-emerald-600"
            checked={materialsCfg.video?.antiSeek !== false}
            onChange={(e) => patchMaterials((c) => ({ ...c, video: { ...c.video, antiSeek: e.target.checked } }))}
          />
          Chống tua video (không cho học viên tua nhanh khi chưa xem xong)
        </label>

        {String(materialsCfg.video?.url || '').trim() ? (
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
                Đã gắn URL video:{' '}
                <a href={resolveMediaUrl(materialsCfg.video.url)} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  {materialsCfg.video.url}
                </a>
              </p>
            )}

            <VideoChecksEditor
              checks={materialsCfg.video?.checks || []}
              onChange={(checks) => patchMaterials((c) => ({ ...c, video: { ...c.video, checks } }))}
            />

            <VideoGuideEditor
              guide={materialsCfg.video?.guide}
              onChange={(guide) => patchMaterials((c) => ({ ...c, video: { ...c.video, guide } }))}
            />
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-3 text-xs font-semibold text-slate-500">
            Dán link video ở trên để xem trước và thêm các mốc dừng câu hỏi tương tác (tuỳ chọn).
          </p>
        )}
      </section>

      {/* 2. Nội dung bài học */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200">
            <BookOpen size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">2. Nội dung tóm tắt bài học</h2>
            <p className="text-xs text-slate-500">Kiến thức trọng tâm, phím tắt hoặc hướng dẫn thực hành cho học viên.</p>
          </div>
          {String(materialsCfg.content?.body || '').trim() ? (
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-black text-sky-800">
              {String(materialsCfg.content.body).trim().length} ký tự
            </span>
          ) : null}
        </div>

        <label className="block">
          <span className={LABEL}>Nội dung văn bản / hướng dẫn</span>
          <textarea
            className={`${INPUT} !min-h-[140px]`}
            maxLength={15000}
            value={materialsCfg.content?.body || ''}
            onChange={(e) => patchMaterials((c) => ({ ...c, content: { ...c.content, body: e.target.value } }))}
            placeholder="Nhập tóm tắt kiến thức, công thức, các bước thực hành cho học viên..."
          />
        </label>

        <details className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs" open={initialSection === 'content'}>
          <summary className="cursor-pointer font-bold text-slate-600">Tiêu đề &amp; mô tả phụ (tuỳ chọn)</summary>
          <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Tiêu đề mục nội dung</span>
              <input
                className={INPUT}
                maxLength={160}
                value={materialsCfg.content?.title || ''}
                onChange={(e) => patchMaterials((c) => ({ ...c, content: { ...c.content, title: e.target.value } }))}
                placeholder={`Mặc định: ${title}`}
              />
            </label>
            <label className="block">
              <span className={LABEL}>Mô tả ngắn</span>
              <input
                className={INPUT}
                maxLength={320}
                value={materialsCfg.content?.description || ''}
                onChange={(e) => patchMaterials((c) => ({ ...c, content: { ...c.content, description: e.target.value } }))}
                placeholder="Ghi chú ngắn gọn..."
              />
            </label>
          </div>
        </details>
      </section>

      {/* 3. File tài liệu đính kèm */}
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
            <Paperclip size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black text-slate-900">3. File tài liệu / bài tập đính kèm</h2>
            <p className="text-xs text-slate-500">PDF, Word, Excel, PowerPoint, ZIP hoặc ảnh mẫu để học viên tải về.</p>
          </div>
          {(materialsCfg.files?.length || 0) > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
              {materialsCfg.files.length} file
            </span>
          )}
        </div>

        {(materialsCfg.files || []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-amber-200 bg-amber-50/40 p-4 text-center text-xs font-semibold text-amber-800">
            Chưa có tài liệu đính kèm nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {materialsCfg.files.map((file, fileIdx) => (
              <li key={file.id || fileIdx} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                  <FileText size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-0.5 text-sm font-bold text-slate-900 focus:border-amber-300 focus:bg-white focus:outline-none"
                    value={file.title || file.name}
                    maxLength={180}
                    onChange={(e) => patchMaterials((c) => ({
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
                  onClick={() => patchMaterials((c) => ({ ...c, files: c.files.filter((_, i) => i !== fileIdx) }))}
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
      </section>
    </div>
  );

  const renderQuizBlock = (isExtra = false) => {
    const diffLabel = DIFFICULTY_TABS.find((t) => t.key === activeDiff)?.label;
    return (
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <Gamepad2 size={18} />
            </span>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                {isExtra ? 'Thành phần bổ trợ · Trắc nghiệm 3 cấp (Dễ · Vừa · Khó)' : 'Trắc nghiệm luyện tập 3 cấp (Dễ · Vừa · Khó)'}
              </h2>
              <p className="text-xs text-slate-500">
                {nodeOwnQuestions.length > 0
                  ? `Hạt nước "${title}" đang dùng ${nodeOwnQuestions.length} câu hỏi riêng.`
                  : `Chưa có câu riêng — học viên sẽ luyện theo bộ câu hỏi chung của chặng (${unitQuestions.length} câu).`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setQuizScope('node')}
                className={`rounded-lg px-2.5 py-1 transition !shadow-none ${quizScope === 'node' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
              >
                Riêng hạt này ({nodeOwnQuestions.length})
              </button>
              <button
                type="button"
                onClick={() => setQuizScope('all')}
                className={`rounded-lg px-2.5 py-1 transition !shadow-none ${quizScope === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
              >
                Kho chặng ({unitQuestions.length})
              </button>
            </div>
            {isExtra && (
              <button
                type="button"
                onClick={() => setExtraModules((p) => ({ ...p, quiz: false }))}
                className="text-xs font-bold text-slate-400 hover:text-slate-700 !shadow-none"
              >
                Thu gọn
              </button>
            )}
          </div>
        </div>

        {/* Chọn mức độ Dễ / Vừa / Khó chỉ dành cho Trắc nghiệm */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1.5">
          {DIFFICULTY_TABS.map((tab) => {
            const isSelected = activeDiff === tab.key;
            const count = effectiveQuizPool.filter((q) => q.difficulty === tab.key).length;
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
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-white text-slate-700'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onComposeQuestion?.(unit.id, activeDiff, nodeKey)}
            className="cms-btn cms-btn-primary !py-2 text-xs"
          >
            <Plus size={14} /> Thêm câu hỏi ({diffLabel})
          </button>
          <button
            type="button"
            onClick={() => onAiDraft?.(unit.id, activeDiff, nodeKey)}
            className="cms-btn cms-btn-outline !py-2 text-xs"
          >
            <Bot size={14} /> AI tạo nháp ({diffLabel})
          </button>
        </div>

        {loadingQ ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Loader2 size={14} className="animate-spin" /> Đang tải câu hỏi...
          </p>
        ) : diffQuestions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-xs font-semibold text-emerald-900">
            {quizScope === 'node' && nodeKey ? (
              <>
                Chưa có câu hỏi riêng ở mức <b>{diffLabel}</b>. Bấm <b>Thêm câu hỏi ({diffLabel})</b>, <b>AI tạo nháp</b>, hoặc chuyển sang tab{' '}
                <button
                  type="button"
                  onClick={() => setQuizScope('all')}
                  className="font-black text-emerald-700 underline !shadow-none"
                >
                  Kho chặng ({unitQuestions.length})
                </button>{' '}
                để gắn nhanh câu có sẵn vào hạt này.
              </>
            ) : (
              <>Chưa có câu hỏi mức <b>{diffLabel}</b> nào trong chặng.</>
            )}
          </div>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {diffQuestions.map((q, idx) => {
              const isMine = nodeKey && String(q.nodeKey || '') === nodeKey;
              const otherNode = !isMine && q.nodeKey ? String(q.nodeKey) : '';
              return (
                <li key={q.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${isMine ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                  <span className="font-black text-slate-400">#{idx + 1}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                    {QUESTION_TYPES[q.type]?.label || q.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{q.prompt}</span>
                  {nodeKey ? (
                    isMine ? (
                      <button
                        type="button"
                        onClick={() => assignQuestionToNode(q, false)}
                        title="Gỡ khỏi hạt nước (chuyển về dùng chung chặng)"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 !shadow-none"
                      >
                        <Unlink size={11} /> Riêng hạt này
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => assignQuestionToNode(q, true)}
                        title="Gắn câu hỏi này riêng cho hạt nước hiện tại"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-emerald-300 hover:text-emerald-700 !shadow-none"
                      >
                        <Link2 size={11} /> {otherNode ? `Hạt ${otherNode}` : 'Dùng chung'} → Gắn vào đây
                      </button>
                    )
                  ) : null}
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${q.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {q.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleQuestionStatusLocal(q)}
                    title={q.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'}
                    className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 !shadow-none"
                  >
                    {q.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button type="button" onClick={() => onEditQuestion?.(q)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800 !shadow-none" title="Sửa câu hỏi">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => removeQuestion(q)} className="rounded p-1 text-red-500 hover:bg-red-50 !shadow-none" title="Xóa câu hỏi">
                    <Trash2 size={13} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Video tương tác xen trong lượt luyện tập (tuỳ chọn, thu gọn mặc định) */}
        <details className="rounded-xl border border-emerald-200/80 bg-emerald-50/35 p-3 text-xs" open={hasPracticeVideo}>
          <summary className="cursor-pointer font-black text-emerald-900">
            Video tương tác xen trong lượt luyện tập mức {diffLabel} (tuỳ chọn)
            {hasPracticeVideo ? ` · Đã gắn (${quizDiffCfg.practice?.video?.checks?.length || 0} mốc)` : ''}
          </summary>
          <div className="mt-3 space-y-3">
            {hasPracticeVideo && practiceVideoSeqIdx >= 0 && (
              <label className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                <span>Vị trí trong bài:</span>
                <select
                  aria-label="Vị trí câu video luyện tập"
                  value={practiceVideoSeqIdx}
                  onChange={(e) => movePracticeItem(practiceVideoSeqIdx, Number(e.target.value))}
                  className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-black text-emerald-900 outline-none"
                >
                  {orderedPracticeItems.map((_, posIdx) => (
                    <option key={posIdx} value={posIdx}>
                      Câu {posIdx + 1} / {orderedPracticeItems.length}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={LABEL}>Tiêu đề video luyện tập</span>
                <input
                  className={INPUT}
                  maxLength={160}
                  value={quizDiffCfg.practice?.video?.title || ''}
                  onChange={(e) => patchQuizDifficulty((c) => ({
                    ...c,
                    practice: { ...c.practice, video: { ...(c.practice?.video || {}), title: e.target.value } },
                  }))}
                  placeholder={`Video hướng dẫn: ${title}`}
                />
              </label>
              <label className="block">
                <span className={LABEL}>Đường dẫn Video (YouTube, Vimeo hoặc .mp4)</span>
                <input
                  className={INPUT}
                  maxLength={500}
                  value={quizDiffCfg.practice?.video?.url || ''}
                  onChange={(e) => patchQuizDifficulty((c) => ({
                    ...c,
                    practice: { ...c.practice, video: { ...(c.practice?.video || {}), url: e.target.value } },
                  }))}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </label>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-emerald-600"
                checked={quizDiffCfg.practice?.video?.antiSeek !== false}
                onChange={(e) => patchQuizDifficulty((c) => ({
                  ...c,
                  practice: { ...c.practice, video: { ...(c.practice?.video || {}), antiSeek: e.target.checked } },
                }))}
              />
              Chống tua video (không cho học viên tua nhanh khi chưa xem xong)
            </label>
            {String(quizDiffCfg.practice?.video?.url || '').trim() && (
              <div className="space-y-3">
                <VideoChecksEditor
                  checks={quizDiffCfg.practice?.video?.checks || []}
                  onChange={(checks) => patchQuizDifficulty((c) => ({
                    ...c,
                    practice: { ...c.practice, video: { ...(c.practice?.video || {}), checks } },
                  }))}
                />
                <VideoGuideEditor
                  guide={quizDiffCfg.practice?.video?.guide}
                  onChange={(guide) => patchQuizDifficulty((c) => ({
                    ...c,
                    practice: { ...c.practice, video: { ...(c.practice?.video || {}), guide } },
                  }))}
                />
              </div>
            )}
          </div>
        </details>
      </section>
    );
  };

  const renderExercisesBlock = (isExtra = false) => (
    <div className="space-y-2">
      {isExtra && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-black uppercase tracking-wider text-violet-700">
            Thành phần bổ trợ · Đề bài tập tự nhập đáp án (Tự khớp / AI)
          </p>
          <button
            type="button"
            onClick={() => setExtraModules((p) => ({ ...p, exercises: false }))}
            className="text-xs font-bold text-slate-400 hover:text-slate-700 !shadow-none"
          >
            Thu gọn
          </button>
        </div>
      )}
      <AdminDropletExerciseEditor exercises={exercises} onChange={setExercises} />
    </div>
  );

  const renderTestOutBlock = () => {
    const publishedCount = testOutQuestions.filter((q) => q.status === 'published').length;
    const draftCount = testOutQuestions.length - publishedCount;
    return (
      <section className="space-y-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-xs sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-amber-950">Bộ câu hỏi Kiểm tra vượt chặng</h2>
            <p className="text-xs text-slate-600">
              Dành cho nút cuối của chặng (thi nhảy cóc toàn chặng, học viên cần đạt ≥ 80%).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onAiTestOut?.(unit.id)}
              className="cms-btn cms-btn-outline !py-2 text-xs"
            >
              <Bot size={14} /> AI tạo vượt chặng
            </button>
            <button
              type="button"
              onClick={() => onComposeTestOut?.(unit.id)}
              className="cms-btn cms-btn-primary !py-2 text-xs"
            >
              <Plus size={14} /> Thêm câu hỏi vượt chặng
            </button>
          </div>
        </div>

        {loadingTestOut ? (
          <p className="flex items-center gap-2 text-xs font-semibold text-amber-800">
            <Loader2 size={14} className="animate-spin" /> Đang tải câu hỏi vượt chặng...
          </p>
        ) : testOutQuestions.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs font-medium text-amber-950">
            <p className="font-black">✦ Đang dùng chế độ tự động (khuyên dùng cho chặng nhanh)</p>
            <p className="mt-1 text-amber-900/85">
              Chưa có câu vượt chặng riêng — hệ thống sẽ tự lấy ngẫu nhiên tối đa <b>10 câu đã xuất bản</b> từ các hạt trước trong chặng. Nếu muốn ra đề riêng, bấm <b>Thêm câu hỏi vượt chặng</b> hoặc <b>AI tạo vượt chặng</b> ở trên.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-black text-emerald-800">
                {publishedCount} câu đã xuất bản
              </span>
              {draftCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-black text-amber-800">
                  {draftCount} nháp
                </span>
              )}
            </div>
            <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {testOutQuestions.map((q, idx) => (
                <li key={q.id} className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-xs ${q.status === 'draft' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-slate-50/60'}`}>
                  <span className="font-black text-amber-700">#{idx + 1}</span>
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                    {QUESTION_TYPES[q.type]?.label || q.type}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{q.prompt}</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${q.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {q.status === 'published' ? 'Đã xuất bản' : 'Nháp'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleQuestionStatusLocal(q)}
                    title={q.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'}
                    className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 !shadow-none"
                  >
                    {q.status === 'published' ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button type="button" onClick={() => onEditQuestion?.(q)} className="rounded p-1 text-slate-500 hover:bg-white hover:text-slate-800 !shadow-none" title="Sửa câu hỏi">
                    <Pencil size={13} />
                  </button>
                  <button type="button" onClick={() => removeQuestion(q)} className="rounded p-1 text-red-500 hover:bg-red-50 !shadow-none" title="Xóa câu hỏi">
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9200] flex flex-col bg-slate-50" role="dialog" aria-modal="true" aria-label="Quản lý bài học theo mốc">
      {/* Top Bar tối giản */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 shadow-xs sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 !shadow-none"
          >
            <ArrowLeft size={15} /> Quay lại
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-wider text-emerald-700">
              <span>HẠT NƯỚC {String(lessonIndex + 1).padStart(2, '0')}/{String(Math.max(1, totalDroplets)).padStart(2, '0')} · {unit.title}</span>
              {!active && (
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold normal-case text-slate-700">
                  Đang ẩn
                </span>
              )}
              {lockMode !== 'sequential' && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold normal-case text-amber-800">
                  {lockMode === 'unlocked' ? 'Mở khóa sẵn' : 'Đang khóa'}
                </span>
              )}
            </div>
            <input
              value={title}
              maxLength={40}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên hạt nước (tối đa 40 ký tự)..."
              className="mt-0.5 w-full border-0 bg-transparent p-0 text-lg font-black text-slate-900 outline-none focus:ring-0 sm:text-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={icon}
              onChange={(e) => handleChangeRole(e.target.value)}
              aria-label="Loại hạt nước"
              className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-black text-sky-900 outline-none focus:border-sky-500"
            >
              {DROPLET_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

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

      {/* Main Workspace — tập trung đúng 1 khối chính + Thành phần bổ trợ tuỳ chọn */}
      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* 1. Khối nội dung chính theo đúng Loại hạt nước */}
          {primaryModule === 'materials' && renderMaterialsBlock(false)}
          {primaryModule === 'quiz' && renderQuizBlock(false)}
          {primaryModule === 'exercises' && renderExercisesBlock(false)}
          {primaryModule === 'testout' && renderTestOutBlock()}

          {/* 2. Thành phần bổ trợ tuỳ chọn (ẩn gọn khi không cần, bấm mở ngay khi muốn ghép thêm) */}
          {primaryModule !== 'testout' && (
            <section className="rounded-2xl border border-slate-200 bg-white/90 p-3.5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-slate-600">
                  Thành phần bổ trợ tuỳ chọn (bấm nếu muốn ghép thêm vào hạt nước này):
                </p>
                <div className="flex flex-wrap gap-2">
                  {primaryModule !== 'materials' && (
                    <button
                      type="button"
                      onClick={() => setExtraModules((p) => ({ ...p, materials: !p.materials }))}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition !shadow-none ${
                        extraModules.materials
                          ? 'border-sky-500 bg-sky-50 text-sky-800'
                          : hasMaterialsData
                            ? 'border-sky-200 bg-sky-50/60 text-sky-800 hover:bg-sky-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Clapperboard size={13} />
                      {extraModules.materials ? 'Đang mở Video · Nội dung · File' : '+ Kèm Video · Nội dung · File'}
                      {hasMaterialsData && <CheckCircle2 size={12} className="text-emerald-600" />}
                    </button>
                  )}

                  {primaryModule !== 'quiz' && (
                    <button
                      type="button"
                      onClick={() => setExtraModules((p) => ({ ...p, quiz: !p.quiz }))}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition !shadow-none ${
                        extraModules.quiz
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : nodeOwnQuestions.length > 0
                            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Gamepad2 size={13} />
                      {extraModules.quiz ? 'Đang mở Trắc nghiệm 3 cấp' : '+ Kèm Trắc nghiệm 3 cấp'}
                      {nodeOwnQuestions.length > 0 && (
                        <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] text-white">
                          {nodeOwnQuestions.length}
                        </span>
                      )}
                    </button>
                  )}

                  {primaryModule !== 'exercises' && (
                    <button
                      type="button"
                      onClick={() => setExtraModules((p) => ({ ...p, exercises: !p.exercises }))}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-black transition !shadow-none ${
                        extraModules.exercises
                          ? 'border-violet-500 bg-violet-50 text-violet-800'
                          : exercises.length > 0
                            ? 'border-violet-200 bg-violet-50/60 text-violet-800 hover:bg-violet-100'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <ClipboardCheck size={13} />
                      {extraModules.exercises ? 'Đang mở Đề bài tập' : '+ Kèm Đề bài tập tự nhập'}
                      {exercises.length > 0 && (
                        <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] text-white">
                          {exercises.length}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Render các thành phần bổ trợ đang mở */}
          {showMaterials && primaryModule !== 'materials' && renderMaterialsBlock(true)}
          {showQuiz && primaryModule !== 'quiz' && renderQuizBlock(true)}
          {showExercises && primaryModule !== 'exercises' && renderExercisesBlock(true)}

          {/* 3. Cài đặt mở khóa, hiển thị & thứ tự nâng cao (thu gọn mặc định cho gọn) */}
          <details className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-2xs">
            <summary className="cursor-pointer font-black text-slate-700">
              ⚙ Cài đặt mở khóa, hiển thị &amp; thứ tự nâng cao
            </summary>
            <div className="mt-3.5 space-y-4 border-t border-slate-100 pt-3.5">
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                  />
                  Hiển thị hạt nước này với học viên
                </label>

                <label className="inline-flex items-center gap-2 font-bold text-slate-700">
                  <span>Cách mở khóa:</span>
                  <select
                    value={lockMode}
                    onChange={(e) => setLockMode(e.target.value)}
                    aria-label="Chế độ mở khóa hạt nước"
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-700 outline-none focus:border-emerald-500"
                  >
                    <option value="sequential">🔒 Xong hạt trước mới mở</option>
                    <option value="unlocked">🔓 Mở khóa sẵn</option>
                    <option value="locked">⛔ Đang khóa hạt này</option>
                  </select>
                </label>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-emerald-600"
                    checked={materialsCfg.sequentialSections !== false}
                    onChange={(e) => patchMaterials({ sequentialSections: e.target.checked })}
                  />
                  Khóa tuần tự 4 phần (xong phần trước mới mở phần sau)
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-600">Thứ tự &amp; ẩn/hiện từng phần (kéo thả tay nắm hoặc bấm mũi tên)</p>
                {materialsCfg.sectionOrder.map((secKey, idx) => {
                  const meta = SECTION_META[secKey];
                  const Icon = meta.icon;
                  const isHidden = (materialsCfg.hiddenSections || []).includes(secKey);
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
                      className={`flex items-center gap-2.5 rounded-xl border bg-slate-50/70 px-3 py-2 transition ${
                        isDragTarget ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200'
                      } ${isHidden ? 'opacity-60' : ''}`}
                    >
                      <span className="cursor-grab rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600 active:cursor-grabbing" title="Kéo thả đổi vị trí">
                        <GripVertical size={15} />
                      </span>
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.iconBox}`}>
                        <Icon size={15} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-900">{idx + 1}. {meta.title}</p>
                        <p className="truncate text-[11px] text-slate-500">{sectionSummary(secKey)}</p>
                      </div>
                      <select
                        value={materialsCfg.sectionLocks?.[secKey] || 'auto'}
                        onChange={(e) => setSectionLock(secKey, e.target.value)}
                        aria-label={`Trạng thái mở khóa ${meta.title}`}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none"
                      >
                        <option value="auto">🔒 Theo tuần tự</option>
                        <option value="unlocked">🔓 Mở khóa</option>
                        <option value="locked">⛔ Đang đóng</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => toggleHideSection(secKey)}
                        title={isHidden ? 'Hiện phần này' : 'Ẩn phần này'}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-800 !shadow-none"
                      >
                        {isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <div className="flex flex-col">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveSection(secKey, -1)}
                          aria-label={`Đưa ${meta.title} lên`}
                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-25 !shadow-none"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === materialsCfg.sectionOrder.length - 1}
                          onClick={() => moveSection(secKey, 1)}
                          aria-label={`Đưa ${meta.title} xuống`}
                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-25 !shadow-none"
                        >
                          <ChevronDown size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      </main>

      {previewOpen && (
        <StudentPreviewModal
          title={title}
          index={lessonIndex}
          levelConfigs={levelConfigs}
          questionCounts={questionCounts}
          exerciseCount={exercises.length}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>,
    document.body,
  );
}

