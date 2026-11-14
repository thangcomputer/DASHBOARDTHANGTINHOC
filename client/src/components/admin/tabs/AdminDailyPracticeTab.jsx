import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, BookOpen, Bot, CheckCircle2, Eye, EyeOff, Gamepad2, ImagePlus, Loader2, Pencil, PlayCircle, Plus, Route, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { useToast } from '../../../utils/useToast';
import {
  DIFFICULTIES, QUESTION_TYPES, TOPIC_COLORS, TOPIC_ICONS, difficultyMeta, topicColor, topicIcon,
} from '../../../utils/dailyPractice';
import AdminMilestoneEditor, { VideoChecksEditor, normalizeLevelConfigs } from './AdminMilestoneEditor';
import AdminFreePortalMaterialsPanel from './AdminFreePortalMaterialsPanel';

const TYPE_IDS = Object.keys(QUESTION_TYPES);
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';
const UNIT_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,.png,.jpg,.jpeg,.webp,.gif';

/** Ô ảnh chặng: dán URL hoặc tải từ máy → `/uploads/...`. */
function UnitImageField({
  id = 'dp-unit-image',
  value,
  onChange,
  label = 'Ảnh minh họa chặng (lộ trình Duolingo)',
  compact = false,
}) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const url = String(value || '');

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chọn file ảnh (PNG/JPG/WebP/GIF)');
      return;
    }
    setUploading(true);
    try {
      const data = await api.settings.uploadTrainingFile(file);
      if (!data?.success || !data.fileUrl) throw new Error(data?.message || 'Upload thất bại');
      onChange(data.fileUrl);
      toast.success('Đã tải ảnh lên máy chủ');
    } catch (err) {
      toast.error(err.message || 'Không tải được ảnh');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={compact ? 'space-y-2' : ''}>
      {label ? <label className={LABEL} htmlFor={id}>{label}</label> : null}
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-stretch ${compact ? '' : 'mt-0'}`}>
        <input
          id={id}
          className={`${INPUT} ${compact ? '!py-1.5' : ''} min-w-0 flex-1`}
          value={url}
          maxLength={500}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... hoặc /uploads/..."
          aria-label="URL ảnh minh họa chặng"
        />
        <label
          className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-black text-sky-700 transition hover:bg-sky-100 ${uploading ? 'pointer-events-none opacity-60' : ''} ${compact ? 'py-1.5' : 'py-2'}`}
        >
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} aria-hidden="true" />}
          {uploading ? 'Đang tải…' : 'Tải từ máy'}
          <input type="file" className="hidden" accept={UNIT_IMAGE_ACCEPT} disabled={uploading} onChange={handleUpload} />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">PNG/JPG/WebP · gợi ý khoảng 512px. Dán link hoặc tải từ máy. Để trống nếu dùng linh vật mặc định.</p>
      {url.trim() ? (
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2">
          <img
            src={resolveMediaUrl(url.trim()) || url.trim()}
            alt=""
            className="h-16 w-16 rounded-lg object-contain bg-slate-50 ring-1 ring-slate-200"
            onError={(e) => { e.currentTarget.style.opacity = '0.35'; }}
          />
          <button type="button" className="text-xs font-bold text-red-600 hover:underline" onClick={() => onChange('')}>
            Xóa ảnh
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Modal({ title, onClose, children, footer, wide = false }) {
  return createPortal(
    <div className="fixed inset-0 z-[9300] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className={`flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-lg'}`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Chủ đề ───────────────────────────────────────────────────────────────────
function TopicModal({ topic, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: topic?.name || '',
    description: topic?.description || '',
    icon: topic?.icon || 'book',
    color: topic?.color || 'red',
    sortOrder: topic?.sortOrder || 0,
    active: topic?.active !== false,
    lessonSubjectId: topic?.lessonSubjectId || '',
    lessonUnitIds: topic?.lessonUnitIds || [],
  }));
  const [saving, setSaving] = useState(false);
  const [lessonSubjects, setLessonSubjects] = useState(null);
  const [lessonUnits, setLessonUnits] = useState({ subjectId: '', rows: null });
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    let alive = true;
    lessonPracticeApi.admin.subjects()
      .then((res) => { if (alive) setLessonSubjects(res?.data || []); })
      .catch(() => { if (alive) setLessonSubjects([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const subjectId = form.lessonSubjectId;
    if (!subjectId) return undefined;
    let alive = true;
    lessonPracticeApi.admin.units(subjectId)
      .then((res) => { if (alive) setLessonUnits({ subjectId, rows: res?.data || [] }); })
      .catch(() => { if (alive) setLessonUnits({ subjectId, rows: [] }); });
    return () => { alive = false; };
  }, [form.lessonSubjectId]);

  const unitRows = lessonUnits.subjectId === form.lessonSubjectId ? lessonUnits.rows : null;
  const toggleUnit = (unitId) => set({
    lessonUnitIds: form.lessonUnitIds.includes(unitId)
      ? form.lessonUnitIds.filter((id) => id !== unitId)
      : [...form.lessonUnitIds, unitId],
  });

  const save = async () => {
    setSaving(true);
    try {
      const saved = topic ? await dailyPracticeApi.admin.updateTopic(topic.id, form) : await dailyPracticeApi.admin.createTopic(form);
      toast.success(topic ? 'Đã cập nhật chủ đề' : 'Đã thêm chủ đề');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={topic ? 'Sửa chủ đề' : 'Thêm chủ đề'}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="cms-btn cms-btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="dp-topic-name">Tên chủ đề</label>
          <input id="dp-topic-name" className={INPUT} value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Ví dụ: Microsoft Excel" />
        </div>
        <div>
          <label className={LABEL} htmlFor="dp-topic-desc">Mô tả ngắn</label>
          <input id="dp-topic-desc" className={INPUT} value={form.description} maxLength={240} onChange={(e) => set({ description: e.target.value })} placeholder="Bảng tính, hàm và biểu đồ" />
        </div>
        <div>
          <span className={LABEL}>Biểu tượng</span>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(TOPIC_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => set({ icon: key })}
                aria-label={key}
                className={`flex h-10 items-center justify-center rounded-xl border-2 ${form.icon === key ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-200 text-slate-500'}`}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={LABEL}>Màu</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(TOPIC_COLORS).map(([key, color]) => (
              <button
                key={key}
                type="button"
                onClick={() => set({ color: key })}
                aria-label={key}
                className={`h-9 w-9 rounded-full ring-offset-2 ${form.color === key ? 'ring-2 ring-slate-900' : ''}`}
                style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
              />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL} htmlFor="dp-topic-order">Thứ tự hiển thị</label>
            <input id="dp-topic-order" type="number" className={INPUT} value={form.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} />
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4 accent-emerald-600" />
            Hiển thị cho học viên
          </label>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <label className={`${LABEL} flex items-center gap-1.5`} htmlFor="dp-topic-lesson">
            <PlayCircle size={14} className="text-red-600" /> Video bài giảng liên quan
          </label>
          <p className="mb-2 text-xs text-slate-500">
            Học viên luyện xong chủ đề sẽ được gợi ý xem video này; đang học video sẽ được gợi ý luyện chủ đề này.
          </p>
          <select
            id="dp-topic-lesson"
            className={INPUT}
            value={form.lessonSubjectId}
            disabled={lessonSubjects === null}
            onChange={(e) => set({ lessonSubjectId: e.target.value, lessonUnitIds: [] })}
          >
            <option value="">{lessonSubjects === null ? 'Đang tải môn học…' : 'Không gắn video'}</option>
            {(lessonSubjects || []).map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          {form.lessonSubjectId && (
            <div className="mt-2">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Buổi cụ thể <span className="font-normal text-slate-400">(bỏ trống = cả môn)</span>
              </span>
              {unitRows === null ? (
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><Loader2 size={13} className="animate-spin" /> Đang tải buổi học…</p>
              ) : unitRows.length ? (
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5">
                  {unitRows.map((unit, index) => (
                    <label key={unit.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={form.lessonUnitIds.includes(unit.id)}
                        onChange={() => toggleUnit(unit.id)}
                        className="h-4 w-4 accent-emerald-600"
                      />
                      <span className="min-w-0 flex-1 truncate">{index + 1}. {unit.title}</span>
                      <span className="shrink-0 text-[11px] text-slate-400">{(unit.videos || []).length} video</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">Môn này chưa có buổi học.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── Soạn câu hỏi ─────────────────────────────────────────────────────────────
function blankQuestion(type, difficulty) {
  return {
    type,
    difficulty,
    prompt: '',
    imageUrl: '',
    hint: '',
    explanation: '',
    status: 'published',
    options: ['', '', '', ''],
    correctIndex: 0,
    answerBool: true,
    items: ['', '', ''],
    pairs: [{ left: '', right: '' }, { left: '', right: '' }, { left: '', right: '' }],
    text: '',
    distractors: [],
    groups: [{ name: '', items: [] }, { name: '', items: [] }],
  };
}

function fromQuestion(q) {
  const base = blankQuestion(q.type, q.difficulty);
  return {
    ...base,
    ...Object.fromEntries(Object.entries(q).filter(([, value]) => value !== undefined && value !== null)),
  };
}

function ListEditor({ values, onChange, min = 2, max = 8, placeholder, ordered = false, renderPrefix }) {
  const update = (index, value) => onChange(values.map((v, i) => (i === index ? value : v)));
  const move = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= values.length) return;
    const next = [...values];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        <div key={index} className="flex items-center gap-2">
          {renderPrefix ? renderPrefix(index) : ordered && <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{index + 1}</span>}
          <input className={INPUT} value={value} onChange={(e) => update(index, e.target.value)} placeholder={`${placeholder} ${index + 1}`} />
          {ordered && (
            <span className="flex shrink-0 flex-col">
              <button type="button" onClick={() => move(index, -1)} aria-label="Lên" className="p-0.5 text-slate-400 hover:text-slate-700 !shadow-none"><ArrowUp size={13} /></button>
              <button type="button" onClick={() => move(index, 1)} aria-label="Xuống" className="p-0.5 text-slate-400 hover:text-slate-700 !shadow-none"><ArrowDown size={13} /></button>
            </span>
          )}
          <button type="button" disabled={values.length <= min} onClick={() => onChange(values.filter((_, i) => i !== index))} aria-label="Xóa" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 !shadow-none">
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      {values.length < max && (
        <button type="button" onClick={() => onChange([...values, ''])} className="flex items-center gap-1 text-xs font-bold text-red-600 !shadow-none">
          <Plus size={14} /> Thêm dòng
        </button>
      )}
    </div>
  );
}

const splitList = (text) => String(text || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

function QuestionModal({ topicId, question, defaultDifficulty, units = [], defaultUnitId = '', lockUnit = false, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => (question
    ? fromQuestion(question)
    : { ...blankQuestion('mcq', defaultDifficulty || 'easy'), unitId: defaultUnitId }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const blanks = useMemo(() => [...String(form.text || '').matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]), [form.text]);
  const lockedUnitId = form.unitId || defaultUnitId || '';
  const lockedUnit = lockUnit && lockedUnitId ? units.find((u) => u.id === lockedUnitId) : null;
  const lockedUnitIndex = lockUnit && lockedUnitId ? units.findIndex((u) => u.id === lockedUnitId) : -1;
  const freePracticeLock = lockUnit && !lockedUnitId;

  const payload = () => {
    const body = {
      topicId, type: form.type, difficulty: form.difficulty, prompt: form.prompt, imageUrl: form.imageUrl,
      hint: form.hint, explanation: form.explanation, status: form.status, unitId: form.unitId || '',
    };
    if (form.type === 'mcq') Object.assign(body, { options: form.options.filter((o) => o.trim()), correctIndex: form.correctIndex });
    if (form.type === 'truefalse') body.answerBool = form.answerBool;
    if (form.type === 'order') body.items = form.items.filter((o) => o.trim());
    if (form.type === 'match') body.pairs = form.pairs.filter((p) => p.left.trim() && p.right.trim());
    if (form.type === 'fill') Object.assign(body, { text: form.text, distractors: form.distractors });
    if (form.type === 'sort') body.groups = form.groups.filter((g) => g.name.trim() && g.items.length);
    return body;
  };

  const EXPLAIN_MIN = 10;
  const explainOk = String(form.explanation || '').trim().length >= EXPLAIN_MIN;
  const hintDup = form.hint.trim() && form.explanation.trim()
    && form.hint.trim().toLocaleLowerCase('vi') === form.explanation.trim().toLocaleLowerCase('vi');

  const save = async () => {
    if (form.status === 'published') {
      if (!explainOk) {
        toast.error(`Cần nhập Giải thích chi tiết (ít nhất ${EXPLAIN_MIN} ký tự) khi xuất bản.`);
        return;
      }
      if (hintDup) {
        toast.error('Giải thích không được trùng nội dung Gợi ý.');
        return;
      }
    }
    setSaving(true);
    try {
      const saved = question
        ? await dailyPracticeApi.admin.updateQuestion(question.id, payload())
        : await dailyPracticeApi.admin.createQuestion(payload());
      toast.success(question ? 'Đã cập nhật câu hỏi' : 'Đã thêm câu hỏi');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      wide
      title={question ? 'Sửa câu hỏi' : 'Soạn câu hỏi mới'}
      onClose={onClose}
      footer={(
        <>
          <select className={`${INPUT} !w-auto`} value={form.status} onChange={(e) => set({ status: e.target.value })} aria-label="Trạng thái">
            <option value="published">Xuất bản cho học viên</option>
            <option value="draft">Lưu nháp</option>
          </select>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={save} disabled={saving} className="cms-btn cms-btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu câu hỏi
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div>
          <span className={LABEL}>Phạm vi câu hỏi</span>
          {freePracticeLock ? (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900">
              Luyện tự do
              <span className="mt-0.5 block text-[11px] font-semibold text-sky-700">Chỉ dùng ở Luyện tự do. Không vào lộ trình, không gắn video.</span>
            </p>
          ) : lockUnit && lockedUnit ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
              Chặng {lockedUnitIndex + 1}: {lockedUnit.title}
              <span className="mt-0.5 block text-[11px] font-semibold text-emerald-700">Gắn theo nút trắc nghiệm bạn vừa bấm. Không đổi chặng tại đây.</span>
            </p>
          ) : (
            <UnitSelect id="dp-q-unit" units={units} value={form.unitId || ''} onChange={(unitId) => set({ unitId })} />
          )}
        </div>
        <div>
          <span className={LABEL}>Dạng câu hỏi</span>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TYPE_IDS.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => set({ type })}
                className={`rounded-xl border-2 px-2 py-2 text-xs font-bold ${form.type === type ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}
              >
                {QUESTION_TYPES[type].label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className={LABEL} htmlFor="dp-q-prompt">{form.type === 'truefalse' ? 'Phát biểu' : 'Câu hỏi / yêu cầu'}</label>
            <textarea id="dp-q-prompt" rows={2} className={INPUT} value={form.prompt} maxLength={600} onChange={(e) => set({ prompt: e.target.value })} />
          </div>
          <div>
            <span className={LABEL}>Độ khó</span>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => set({ difficulty: level.id })}
                  className="rounded-xl border-2 px-3 py-2 text-xs font-black"
                  style={{ borderColor: form.difficulty === level.id ? level.color : '#E2E8F0', color: form.difficulty === level.id ? level.color : '#475569', background: form.difficulty === level.id ? level.soft : '#FFF' }}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          {form.type === 'mcq' && (
            <>
              <span className={LABEL}>Phương án (chọn đáp án đúng)</span>
              <ListEditor
                values={form.options}
                min={2}
                max={6}
                placeholder="Phương án"
                onChange={(options) => set({ options, correctIndex: Math.min(form.correctIndex, options.length - 1) })}
                renderPrefix={(index) => (
                  <input type="radio" name="dp-correct" checked={form.correctIndex === index} onChange={() => set({ correctIndex: index })} className="h-4 w-4 shrink-0 accent-emerald-600" aria-label={`Đáp án ${index + 1} đúng`} />
                )}
              />
            </>
          )}
          {form.type === 'truefalse' && (
            <>
              <span className={LABEL}>Phát biểu trên là</span>
              <div className="flex gap-2">
                {[true, false].map((value) => (
                  <button key={String(value)} type="button" onClick={() => set({ answerBool: value })} className={`rounded-xl border-2 px-5 py-2 text-sm font-black ${form.answerBool === value ? (value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700') : 'border-slate-200 text-slate-600'}`}>
                    {value ? 'Đúng' : 'Sai'}
                  </button>
                ))}
              </div>
            </>
          )}
          {form.type === 'order' && (
            <>
              <span className={LABEL}>Các bước theo ĐÚNG thứ tự (học viên sẽ thấy bị xáo trộn)</span>
              <ListEditor values={form.items} min={3} max={8} placeholder="Bước" ordered onChange={(items) => set({ items })} />
            </>
          )}
          {form.type === 'match' && (
            <>
              <span className={LABEL}>Các cặp ghép đúng</span>
              <div className="space-y-2">
                {form.pairs.map((pair, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input className={INPUT} value={pair.left} placeholder="Vế trái (vd: Ctrl + C)" onChange={(e) => set({ pairs: form.pairs.map((p, i) => (i === index ? { ...p, left: e.target.value } : p)) })} />
                    <span className="text-slate-400">↔</span>
                    <input className={INPUT} value={pair.right} placeholder="Vế phải (vd: Sao chép)" onChange={(e) => set({ pairs: form.pairs.map((p, i) => (i === index ? { ...p, right: e.target.value } : p)) })} />
                    <button type="button" disabled={form.pairs.length <= 2} onClick={() => set({ pairs: form.pairs.filter((_, i) => i !== index) })} aria-label="Xóa cặp" className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 !shadow-none"><Trash2 size={15} /></button>
                  </div>
                ))}
                {form.pairs.length < 6 && (
                  <button type="button" onClick={() => set({ pairs: [...form.pairs, { left: '', right: '' }] })} className="flex items-center gap-1 text-xs font-bold text-red-600 !shadow-none"><Plus size={14} /> Thêm cặp</button>
                )}
              </div>
            </>
          )}
          {form.type === 'fill' && (
            <div className="space-y-3">
              <div>
                <label className={LABEL} htmlFor="dp-q-text">Đoạn văn. Đặt từ cần điền trong {'{{ }}'}</label>
                <textarea id="dp-q-text" rows={3} className={INPUT} value={form.text} onChange={(e) => set({ text: e.target.value })} placeholder="Nhấn {{Ctrl}} + {{S}} để lưu tài liệu." />
                <p className="mt-1 text-xs text-slate-500">
                  {blanks.length ? <>Chỗ trống: {blanks.map((b) => <span key={b} className="mr-1 rounded bg-emerald-100 px-1.5 py-0.5 font-bold text-emerald-700">{b}</span>)}</> : 'Chưa có chỗ trống nào.'}
                </p>
              </div>
              <div>
                <label className={LABEL} htmlFor="dp-q-distractors">Từ gây nhiễu (cách nhau bằng dấu phẩy)</label>
                <input id="dp-q-distractors" className={INPUT} defaultValue={(form.distractors || []).join(', ')} onBlur={(e) => set({ distractors: splitList(e.target.value) })} placeholder="Alt, P" />
              </div>
            </div>
          )}
          {form.type === 'sort' && (
            <div className="space-y-2">
              <span className={LABEL}>Các nhóm và mục thuộc nhóm (mục cách nhau bằng dấu phẩy)</span>
              {form.groups.map((group, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                  <input className={INPUT} value={group.name} placeholder={`Tên nhóm ${index + 1}`} onChange={(e) => set({ groups: form.groups.map((g, i) => (i === index ? { ...g, name: e.target.value } : g)) })} />
                  <input className={INPUT} defaultValue={group.items.join(', ')} placeholder="Mục 1, Mục 2" onBlur={(e) => set({ groups: form.groups.map((g, i) => (i === index ? { ...g, items: splitList(e.target.value) } : g)) })} />
                  <button type="button" disabled={form.groups.length <= 2} onClick={() => set({ groups: form.groups.filter((_, i) => i !== index) })} aria-label="Xóa nhóm" className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-30 !shadow-none"><Trash2 size={15} /></button>
                </div>
              ))}
              {form.groups.length < 4 && (
                <button type="button" onClick={() => set({ groups: [...form.groups, { name: '', items: [] }] })} className="flex items-center gap-1 text-xs font-bold text-red-600 !shadow-none"><Plus size={14} /> Thêm nhóm</button>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3">
            <label className={LABEL} htmlFor="dp-q-hint">Gợi ý (khi học viên bấm Gợi ý · trừ XP)</label>
            <p className="mb-1.5 text-[11px] font-semibold text-amber-900/80">Chỉ manh mối ngắn — không lộ hết đáp án, không dùng làm giải thích.</p>
            <input id="dp-q-hint" className={INPUT} value={form.hint} maxLength={300} onChange={(e) => set({ hint: e.target.value })} placeholder="Ví dụ: Nghĩ phím tắt chung của PowerPoint…" />
          </div>
          <div>
            <label className={LABEL} htmlFor="dp-q-image">Ảnh minh họa (URL, không bắt buộc)</label>
            <input id="dp-q-image" className={INPUT} value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <label className={LABEL} htmlFor="dp-q-explain">
            Giải thích chi tiết
            {form.status === 'published' ? <span className="text-red-600"> *</span> : null}
          </label>
          <p className="mb-1.5 text-[11px] font-semibold text-sky-900/85">
            Học viên xem khi bấm <b>Giải thích</b> sau khi trả lời. Viết riêng (vì sao đúng, mẹo nhớ) — không copy Gợi ý.
          </p>
          <textarea
            id="dp-q-explain"
            rows={4}
            className={`${INPUT} !min-h-[88px]`}
            value={form.explanation}
            maxLength={800}
            onChange={(e) => set({ explanation: e.target.value })}
            placeholder="Ví dụ: Ctrl + M thêm slide mới trong PowerPoint; khác Ctrl + N (tài liệu mới)…"
          />
          {form.status === 'published' && !explainOk ? (
            <p className="mt-1 text-[11px] font-bold text-red-600">Cần ít nhất {EXPLAIN_MIN} ký tự để xuất bản.</p>
          ) : null}
          {hintDup ? (
            <p className="mt-1 text-[11px] font-bold text-red-600">Giải thích đang trùng với Gợi ý.</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function AiModal({ topic, defaultDifficulty, units = [], defaultUnitId = '', lockUnit = false, onClose, onDone }) {
  const toast = useToast();
  const [difficulty, setDifficulty] = useState(defaultDifficulty || 'easy');
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [count, setCount] = useState(6);
  const [types, setTypes] = useState(TYPE_IDS);
  const [busy, setBusy] = useState(false);
  const lockedUnit = lockUnit && unitId ? units.find((u) => u.id === unitId) : null;
  const lockedUnitIndex = lockUnit && unitId ? units.findIndex((u) => u.id === unitId) : -1;
  const freePracticeLock = lockUnit && !unitId;

  const run = async () => {
    setBusy(true);
    try {
      const result = await dailyPracticeApi.admin.aiGenerate({ topicId: topic.id, difficulty, count, types, unitId });
      toast.success(`AI đã tạo ${result.created} câu nháp${result.skipped ? ` (bỏ ${result.skipped} câu lỗi)` : ''}. Hãy duyệt rồi xuất bản.`);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`AI tạo câu hỏi nháp: ${topic.name}`}
      onClose={busy ? () => { } : onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} disabled={busy} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={run} disabled={busy || !types.length} className="cms-btn cms-btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {busy ? 'AI đang soạn…' : 'Tạo nháp'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Câu do AI tạo được lưu ở trạng thái <b>Nháp</b>. Học viên chưa thấy cho tới khi bạn kiểm tra và xuất bản.
        </p>
        <div>
          <span className={LABEL}>Phạm vi câu hỏi</span>
          {freePracticeLock ? (
            <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900">
              Luyện tự do
              <span className="mt-0.5 block text-[11px] font-semibold text-sky-700">Chỉ dùng ở Luyện tự do. Không vào lộ trình.</span>
            </p>
          ) : lockUnit && lockedUnit ? (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-900">
              Chặng {lockedUnitIndex + 1}: {lockedUnit.title}
              <span className="mt-0.5 block text-[11px] font-semibold text-emerald-700">Gắn theo nút trắc nghiệm bạn vừa bấm.</span>
            </p>
          ) : (
            <UnitSelect id="dp-ai-unit" units={units} value={unitId} onChange={setUnitId} />
          )}
        </div>
        <div>
          <span className={LABEL}>Độ khó</span>
          <div className="flex gap-2">
            {DIFFICULTIES.map((level) => (
              <button key={level.id} type="button" onClick={() => setDifficulty(level.id)} className="rounded-xl border-2 px-4 py-2 text-sm font-black" style={{ borderColor: difficulty === level.id ? level.color : '#E2E8F0', color: difficulty === level.id ? level.color : '#475569' }}>
                {level.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={LABEL} htmlFor="dp-ai-count">Số câu (tối đa 10)</label>
          <input id="dp-ai-count" type="number" min={1} max={10} className={`${INPUT} !w-28`} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} />
        </div>
        <div>
          <span className={LABEL}>Dạng câu</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPE_IDS.map((type) => (
              <label key={type} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={types.includes(type)} onChange={(e) => setTypes((prev) => (e.target.checked ? [...prev, type] : prev.filter((t) => t !== type)))} />
                {QUESTION_TYPES[type].label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Chặng lộ trình ───────────────────────────────────────────────────────────
const MIN_UNIT_QUESTIONS = 4;

function UnitModal({ topic, unit, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    title: unit?.title || '',
    description: unit?.description || '',
    imageUrl: unit?.imageUrl || '',
    active: unit?.active !== false,
    lessonUnitId: unit?.lessonUnitId || '',
  }));
  const [subjectId, setSubjectId] = useState(topic.lessonSubjectId || '');
  const [subjects, setSubjects] = useState(null);
  const [lessonUnits, setLessonUnits] = useState({ subjectId: '', rows: null });
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    let alive = true;
    lessonPracticeApi.admin.subjects()
      .then((res) => { if (alive) setSubjects(res?.data || []); })
      .catch(() => { if (alive) setSubjects([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!subjectId) return undefined;
    let alive = true;
    lessonPracticeApi.admin.units(subjectId)
      .then((res) => {
        if (!alive) return;
        const rows = res?.data || [];
        setLessonUnits({ subjectId, rows });
      })
      .catch(() => { if (alive) setLessonUnits({ subjectId, rows: [] }); });
    return () => { alive = false; };
  }, [subjectId]);

  const unitRows = lessonUnits.subjectId === subjectId ? lessonUnits.rows : null;

  const save = async () => {
    setSaving(true);
    try {
      const saved = unit
        ? await dailyPracticeApi.admin.updateUnit(unit.id, form)
        : await dailyPracticeApi.admin.createUnit(topic.id, form);
      toast.success(unit ? 'Đã cập nhật chặng' : 'Đã thêm chặng');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={unit ? 'Sửa chặng' : `Thêm chặng: ${topic.name}`}
      onClose={onClose}
      footer={(
        <>
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !form.title.trim()}
            className="cms-btn cms-btn-primary"
          >
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu
          </button>
        </>
      )}
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL} htmlFor="dp-unit-title">Tên chặng</label>
          <input id="dp-unit-title" className={INPUT} value={form.title} maxLength={80} onChange={(e) => set({ title: e.target.value })} placeholder="Ví dụ: Định dạng chữ và đoạn văn" />
        </div>
        <div>
          <label className={LABEL} htmlFor="dp-unit-desc">Mô tả ngắn</label>
          <input id="dp-unit-desc" className={INPUT} value={form.description} maxLength={240} onChange={(e) => set({ description: e.target.value })} placeholder="Học viên sẽ luyện những gì ở chặng này" />
        </div>
        <UnitImageField
          id="dp-unit-image"
          value={form.imageUrl}
          onChange={(imageUrl) => set({ imageUrl })}
        />
        <div className="rounded-xl bg-slate-50 p-3">
          <span className={LABEL}>Buổi video trong khóa bài giảng nên xem trước (không bắt buộc)</span>
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={INPUT} value={subjectId} onChange={(e) => { setSubjectId(e.target.value); set({ lessonUnitId: '' }); }} aria-label="Môn video">
              <option value="">{subjects === null ? 'Đang tải môn…' : 'Không gắn video'}</option>
              {(subjects || []).map((s) => <option key={s._id || s.id} value={s._id || s.id}>{s.name}</option>)}
            </select>
            <select className={INPUT} value={form.lessonUnitId} disabled={!subjectId} onChange={(e) => set({ lessonUnitId: e.target.value })} aria-label="Buổi video">
              <option value="">{subjectId && unitRows === null ? 'Đang tải buổi…' : 'Chọn buổi'}</option>
              {(unitRows || []).map((u) => <option key={u._id || u.id} value={u._id || u.id}>{u.title}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />
          Hiện chặng này trên lộ trình
        </label>
      </div>
    </Modal>
  );
}

const MAX_UNIT_VIDEOS = 20;
const PATH_NODE_PRESETS = [
  { key: 'study', label: 'Học bài', icon: 'book' },
  { key: 'practice-1', label: 'Luyện tập', icon: 'dumbbell' },
  { key: 'challenge', label: 'Thử thách', icon: 'flame' },
  { key: 'practice-2', label: 'Luyện tập', icon: 'dumbbell' },
  { key: 'complete', label: 'Hoàn thành', icon: 'crown' },
];

function emptyNodeStepVideos() {
  return { learn: [], practice: [], challenge: [] };
}

function mapNodeStepVideos(raw) {
  const mapItem = (v) => ({
    id: v.id,
    title: v.title,
    url: v.url || '',
    content: v.content || '',
    fileUrl: v.fileUrl || '',
    fileName: v.fileName || '',
    checks: v.checks || [],
  });
  return {
    learn: (raw?.learn || []).map(mapItem),
    practice: (raw?.practice || []).map(mapItem),
    challenge: (raw?.challenge || []).map(mapItem),
  };
}

/** Mặc định đủ 5 nút như lộ trình Duolingo trên HV. */
function defaultPathNodes(unit) {
  return PATH_NODE_PRESETS.map((preset, index) => ({
    ...preset,
    sortOrder: index,
    active: true,
    stepVideos: index === 0
      ? mapNodeStepVideos(unit?.stepVideos)
      : emptyNodeStepVideos(),
  }));
}

function pathNodesFromUnit(unit) {
  if (unit.pathNodes?.length) {
    return unit.pathNodes.map((node, index) => ({
      key: node.key,
      label: node.label,
      icon: node.icon || 'dumbbell',
      sortOrder: node.sortOrder ?? index,
      active: node.active !== false,
      stepVideos: mapNodeStepVideos(node.stepVideos),
      levelConfigs: node.levelConfigs || null,
    }));
  }
  return defaultPathNodes(unit);
}

function blankBai(title) {
  return { title, active: true, url: '', content: '', fileUrl: '', fileName: '', checks: [], nodeKey: '', levelConfigs: null };
}

function lessonsFromUnit(unit) {
  const nodes = unit.pathNodes?.length ? pathNodesFromUnit(unit) : [];
  if (!nodes.length || isStockTemplate(nodes)) return [];
  const lessons = [];
  nodes.forEach((node) => {
    if (node.icon !== 'book') return;
    const learn = node.stepVideos?.learn || [];
    if (!learn.length) {
      lessons.push({
        ...blankBai(node.label),
        active: node.active !== false,
        nodeKey: node.key,
        levelConfigs: node.levelConfigs || null,
      });
      return;
    }
    learn.forEach((item, idx) => {
      lessons.push({
        id: item.id,
        title: item.title || node.label,
        active: node.active !== false,
        url: item.url || '',
        content: item.content || '',
        fileUrl: item.fileUrl || '',
        fileName: item.fileName || '',
        checks: item.checks || [],
        nodeKey: learn.length === 1 ? node.key : '',
        levelConfigs: idx === 0 ? (node.levelConfigs || null) : null,
      });
    });
  });
  return lessons;
}

function isStockTemplate(nodes) {
  if (nodes.length !== PATH_NODE_PRESETS.length) return false;
  return nodes.every((node, index) => {
    const preset = PATH_NODE_PRESETS[index];
    const levels = ['learn', 'practice', 'challenge'];
    const empty = levels.every((key) => (node.stepVideos?.[key] || []).every((row) => !String(row.url || '').trim() && !String(row.content || '').trim()));
    return node.key === preset.key && node.label === preset.label && node.icon === preset.icon && empty;
  });
}

function _uniqueNodeKey(nodes, base) {
  const keys = new Set(nodes.map((node) => node.key));
  if (!keys.has(base)) return base;
  let index = 2;
  while (keys.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function stageItemSummary(unit) {
  const count = lessonsFromUnit(unit).length;
  if (!count) return 'Chưa có bài';
  return `${count} bài · mỗi bài có nội dung, file, video, luyện tập`;
}

function milestoneLevelSummary(lesson) {
  const cfg = normalizeLevelConfigs(lesson);
  const ready = ['easy', 'medium', 'hard'].filter((k) => {
    const c = cfg[k];
    return Boolean(c.content?.body || c.files?.length || c.video?.url);
  });
  if (!ready.length) return 'Chưa có nội dung · Bấm Quản lý để soạn 3 mức';
  const labels = { easy: 'Dễ', medium: 'Vừa', hard: 'Khó' };
  return `Đã soạn: ${ready.map((k) => labels[k]).join(', ')} · 4 phần độc lập`;
}

/** Danh sách mốc bài học trong một chặng. Bấm Quản lý để mở trang chỉnh sửa 3 mức Dễ/Vừa/Khó. */
function UnitPathNodesPanel({ unit, onSaved, onComposeQuestion, onAiDraft, onEditQuestion, questionsVersion = 0 }) {
  const toast = useToast();
  const initial = lessonsFromUnit(unit);
  const [lessons, setLessons] = useState(initial);
  const [editingIndex, setEditingIndex] = useState(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(lessons) !== JSON.stringify(initial);

  const buildNodesPayload = (list) => {
    const used = new Set();
    const nodes = list.map((lesson, index) => {
      const base = String(lesson.nodeKey || `bai-${index + 1}`).replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || `bai-${index + 1}`;
      let key = base;
      let n = 2;
      while (used.has(key)) {
        key = `${base}-${n}`.slice(0, 40);
        n += 1;
      }
      used.add(key);
      const levelConfigs = normalizeLevelConfigs(lesson);
      const easy = levelConfigs.easy;
      const hasEasy = Boolean(easy.content?.body || easy.files?.length || easy.video?.url);
      return {
        key,
        label: String(lesson.title || '').trim().slice(0, 40) || `Bài ${index + 1}`,
        icon: 'book',
        sortOrder: index,
        active: lesson.active !== false,
        levelConfigs,
        stepVideos: {
          learn: hasEasy ? [{
            id: lesson.id,
            title: String(lesson.title || '').trim() || `Bài ${index + 1}`,
            url: String(easy.video?.url || '').trim(),
            content: String(easy.content?.body || '').trim(),
            fileUrl: String(easy.files?.[0]?.url || '').trim(),
            fileName: String(easy.files?.[0]?.name || '').trim(),
            checks: (easy.video?.checks || []).filter((check) => String(check.prompt || '').trim()),
          }] : [],
          practice: [],
          challenge: [],
        },
      };
    });
    let practiceKey = 'practice';
    let practiceN = 2;
    while (used.has(practiceKey)) {
      practiceKey = `practice-${practiceN}`;
      practiceN += 1;
    }
    nodes.push({
      key: practiceKey,
      label: 'Luyện tập',
      icon: 'dumbbell',
      sortOrder: nodes.length,
      active: true,
      stepVideos: emptyNodeStepVideos(),
    });
    return nodes;
  };

  const persistList = async (nextList, message = 'Đã lưu bài học') => {
    setSaving(true);
    try {
      await dailyPracticeApi.admin.updateUnit(unit.id, {
        title: unit.title,
        description: unit.description,
        active: unit.active,
        lessonUnitId: unit.lessonUnitId || '',
        videos: unit.videos || [],
        pathNodes: buildNodesPayload(nextList),
      });
      toast.success(message);
      onSaved();
      return true;
    } catch (err) {
      toast.error(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const moveLesson = (index, delta) => {
    setLessons((list) => {
      const target = index + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addLesson = () => {
    if (lessons.length >= 12) return;
    const nextIndex = lessons.length;
    setLessons((list) => [...list, blankBai(`Bài ${list.length + 1}`)]);
    setEditingIndex(nextIndex);
  };

  const removeLesson = (index) => {
    if (!window.confirm(`Xóa mốc "${lessons[index]?.title || `Bài ${index + 1}`}"?`)) return;
    setLessons((list) => list.filter((_, i) => i !== index));
    setEditingIndex((current) => (current === index ? null : current > index ? current - 1 : current));
  };

  const editingLesson = editingIndex !== null ? lessons[editingIndex] : null;

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-slate-500">
          Mỗi mốc tương ứng một bài học gồm 3 mức (Dễ – Vừa – Khó) với 4 phần độc lập. Bấm <b>Quản lý</b> để chỉnh sửa.
        </p>
      </div>
      {lessons.length === 0 ? (
        <p className="rounded-xl bg-white px-3 py-4 text-center text-xs font-semibold text-slate-500">
          Chưa có bài học nào. Bấm <b>Thêm bài</b> để tạo mốc mới.
        </p>
      ) : (
        <ol className="space-y-2">
          {lessons.map((lesson, index) => {
            const isActive = lesson.active !== false;
            return (
              <li key={lesson.id || lesson.nodeKey || index} className={`rounded-xl bg-white p-2.5 ring-1 ring-slate-200 ${isActive ? '' : 'opacity-65'}`}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <BookOpen size={15} className="shrink-0 text-sky-700" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setEditingIndex(index)}
                    className="min-w-0 flex-1 text-left !shadow-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-black text-slate-900">{lesson.title || `Bài ${index + 1}`}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {isActive ? 'Đang hiển thị' : 'Đang ẩn'}
                      </span>
                    </div>
                    <p className="truncate text-[11px] font-medium text-slate-500">{milestoneLevelSummary(lesson)}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIndex(index)}
                    className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-black text-white hover:bg-slate-800 !shadow-none"
                  >
                    Quản lý
                  </button>
                  <span className="flex shrink-0 flex-col">
                    <button type="button" disabled={index === 0} onClick={() => moveLesson(index, -1)} aria-label="Lên" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowUp size={13} /></button>
                    <button type="button" disabled={index === lessons.length - 1} onClick={() => moveLesson(index, 1)} aria-label="Xuống" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowDown size={13} /></button>
                  </span>
                  <button type="button" onClick={() => removeLesson(index)} aria-label="Xóa bài" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={addLesson} disabled={lessons.length >= 12} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Plus size={14} /> Thêm bài</button>
        {dirty && (
          <button type="button" onClick={() => persistList(lessons, 'Đã lưu thứ tự và danh sách bài')} disabled={saving || !lessons.length} className="cms-btn cms-btn-primary ml-auto !py-1.5 text-xs">
            {saving && <Loader2 size={13} className="animate-spin" />} Lưu thay đổi thứ tự
          </button>
        )}
      </div>

      {editingLesson && (
        <AdminMilestoneEditor
          unit={unit}
          lesson={editingLesson}
          lessonIndex={editingIndex}
          questionsVersion={questionsVersion}
          onClose={() => setEditingIndex(null)}
          onComposeQuestion={(uId, diff) => onComposeQuestion?.(uId, diff)}
          onAiDraft={(uId, diff) => onAiDraft?.(uId, diff)}
          onEditQuestion={(q) => onEditQuestion?.(q)}
          onSaveLesson={async (updatedLesson) => {
            const nextList = lessons.map((item, i) => (i === editingIndex ? updatedLesson : item));
            const ok = await persistList(nextList, `Đã lưu "${updatedLesson.title}"`);
            if (ok) {
              setLessons(nextList);
              setEditingIndex(null);
            }
          }}
        />
      )}
    </div>
  );
}


/** Ảnh minh họa chặng - sửa ngay trong khung Lộ trình (desktop), không cần mở modal. */
function UnitImagePanel({ unit, onSaved }) {
  const toast = useToast();
  const [imageUrl, setImageUrl] = useState(unit.imageUrl || '');
  const [saving, setSaving] = useState(false);
  const dirty = imageUrl.trim() !== String(unit.imageUrl || '').trim();

  const save = async () => {
    setSaving(true);
    try {
      await dailyPracticeApi.admin.updateUnit(unit.id, { imageUrl: imageUrl.trim() });
      toast.success(imageUrl.trim() ? 'Đã lưu ảnh minh họa chặng' : 'Đã xóa ảnh minh họa chặng');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-sky-100 bg-sky-50/50 p-2.5">
      <UnitImageField
        id={`dp-unit-image-panel-${unit.id}`}
        value={imageUrl}
        onChange={setImageUrl}
        compact
      />
      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-[11px] font-bold text-amber-600">Có thay đổi chưa lưu</span>}
        <button type="button" onClick={save} disabled={!dirty || saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">
          {saving && <Loader2 size={13} className="animate-spin" />} Lưu ảnh chặng
        </button>
      </div>
    </div>
  );
}

/** Danh sách video riêng của một chặng - sửa ngay trong khung Lộ trình chặng. */
function UnitVideosPanel({ unit, onSaved }) {
  const toast = useToast();
  const mapVideo = (video) => ({ id: video.id, title: video.title, url: video.url, checks: video.checks || [] });
  const [videos, setVideos] = useState(() => (unit.videos || []).map(mapVideo));
  const [draft, setDraft] = useState({ title: '', url: '' });
  const [saving, setSaving] = useState(false);
  const original = JSON.stringify((unit.videos || []).map(mapVideo));
  const dirty = JSON.stringify(videos) !== original;
  const invalid = videos.some((video) => !video.title.trim() || !video.url.trim());

  const update = (index, patch) => setVideos((list) => list.map((video, i) => (i === index ? { ...video, ...patch } : video)));
  const move = (index, delta) => setVideos((list) => {
    const target = index + delta;
    if (target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const addDraft = () => {
    if (!draft.title.trim() || !draft.url.trim()) return;
    setVideos((list) => [...list, { title: draft.title.trim(), url: draft.url.trim() }]);
    setDraft({ title: '', url: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      await dailyPracticeApi.admin.updateUnit(unit.id, {
        title: unit.title,
        description: unit.description,
        active: unit.active,
        lessonUnitId: unit.lessonUnitId || '',
        videos,
        stepVideos: unit.stepVideos || { learn: [], practice: [], challenge: [] },
      });
      toast.success('Đã lưu danh sách video của chặng');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-red-100 bg-red-50/40 p-2.5">
      <p className="text-[11px] font-semibold text-slate-500">
        Mỗi video hiện thành nút 🎬 trên lộ trình của chặng; học viên bấm vào sẽ mở popup trình phát Thắng Tin Học ngay tại trang.
      </p>
      {videos.length > 0 && (
        <ol className="space-y-1.5">
          {videos.map((video, index) => (
            <li key={video.id || `new-${index}`} className="flex items-start gap-2 rounded-lg bg-white p-2 ring-1 ring-slate-100">
              <span className="mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-black text-white">{index + 1}</span>
              <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <input className={`${INPUT} !py-1.5`} value={video.title} maxLength={120} onChange={(e) => update(index, { title: e.target.value })} placeholder="Tên video" aria-label={`Tên video ${index + 1}`} />
                <input className={`${INPUT} !py-1.5`} value={video.url} maxLength={500} onChange={(e) => update(index, { url: e.target.value })} placeholder="Link YouTube / Vimeo / .mp4" aria-label={`Link video ${index + 1}`} />
                <VideoChecksEditor checks={video.checks} onChange={(checks) => update(index, { checks })} />
              </div>
              <span className="flex shrink-0 flex-col pt-0.5">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Lên" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowUp size={13} /></button>
                <button type="button" disabled={index === videos.length - 1} onClick={() => move(index, 1)} aria-label="Xuống" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowDown size={13} /></button>
              </span>
              <button type="button" onClick={() => setVideos((list) => list.filter((_, i) => i !== index))} aria-label="Xóa video" className="mt-0.5 shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
            </li>
          ))}
        </ol>
      )}
      {videos.length < MAX_UNIT_VIDEOS && (
        <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
          <input className={`${INPUT} !py-1.5`} value={draft.title} maxLength={120} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Tên video mới" aria-label="Tên video mới" />
          <input
            className={`${INPUT} !py-1.5`}
            value={draft.url}
            maxLength={500}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') addDraft(); }}
            placeholder="Dán link YouTube / Vimeo / .mp4"
            aria-label="Link video mới"
          />
          <button type="button" onClick={addDraft} disabled={!draft.title.trim() || !draft.url.trim()} className="cms-btn cms-btn-outline !py-1.5 text-xs">
            <Plus size={14} /> Thêm video
          </button>
        </div>
      )}
      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-[11px] font-bold text-amber-600">Có thay đổi chưa lưu</span>}
        <button type="button" onClick={save} disabled={!dirty || invalid || saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">
          {saving && <Loader2 size={13} className="animate-spin" />} Lưu danh sách video
        </button>
      </div>
    </div>
  );
}

/** Video ôn theo cấp - hoặc danh sách Bài 1, 2… (lessonMode: nội dung +/hoặc video). */
function UnitStepVideosPanel({
  unit, stepKey, stepLabel, onSaved, videos: controlledVideos, onVideosChange, deferSave = false, lessonMode = false,
}) {
  const toast = useToast();
  const mapRow = (video) => ({
    id: video.id,
    title: video.title || '',
    url: video.url || '',
    content: video.content || '',
    checks: video.checks || [],
  });
  const [videos, setVideos] = useState(() => (controlledVideos || unit.stepVideos?.[stepKey] || []).map(mapRow));
  const [draft, setDraft] = useState({ title: '', url: '', content: '' });
  const [saving, setSaving] = useState(false);
  const original = JSON.stringify((controlledVideos || unit.stepVideos?.[stepKey] || []).map(mapRow));
  const dirty = JSON.stringify(videos) !== original;
  const invalid = videos.some((video) => {
    if (!video.title.trim()) return true;
    if (lessonMode) return !video.url.trim() && !video.content.trim();
    return !video.url.trim();
  });

  const setList = (updater) => {
    setVideos((list) => {
      const next = typeof updater === 'function' ? updater(list) : updater;
      if (deferSave && onVideosChange) onVideosChange(next);
      return next;
    });
  };
  const update = (index, patch) => setList((list) => list.map((video, i) => (i === index ? { ...video, ...patch } : video)));
  const addDraft = () => {
    if (!draft.title.trim()) return;
    if (lessonMode) {
      if (!draft.url.trim() && !draft.content.trim()) return;
      setList((list) => [...list, { title: draft.title.trim(), url: draft.url.trim(), content: draft.content.trim() }]);
    } else {
      if (!draft.url.trim()) return;
      setList((list) => [...list, { title: draft.title.trim(), url: draft.url.trim(), content: '' }]);
    }
    setDraft({ title: '', url: '', content: '' });
  };

  const save = async () => {
    setSaving(true);
    try {
      await dailyPracticeApi.admin.updateUnit(unit.id, {
        title: unit.title,
        description: unit.description,
        active: unit.active,
        lessonUnitId: unit.lessonUnitId || '',
        videos: unit.videos || [],
        stepVideos: {
          learn: unit.stepVideos?.learn || [],
          practice: unit.stepVideos?.practice || [],
          challenge: unit.stepVideos?.challenge || [],
          [stepKey]: videos,
        },
      });
      toast.success(lessonMode ? 'Đã lưu bài học' : `Đã lưu video cấp ${stepLabel}`);
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2.5">
      <p className="text-xs font-black text-slate-800">
        {lessonMode ? stepLabel : `Video ôn · ${stepLabel}`}
      </p>
      {lessonMode && (
        <p className="text-[11px] font-semibold text-slate-500">
          Mỗi bài có thể có <span className="font-black text-slate-700">nội dung chữ</span>, <span className="font-black text-slate-700">video</span>, hoặc cả hai. Học xong bài trước mới mở bài sau.
        </p>
      )}
      {videos.map((video, index) => (
        <div key={video.id || `new-${index}`} className={`rounded-xl bg-slate-50 p-2 ring-1 ring-slate-100 ${lessonMode ? 'space-y-1.5' : 'grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]'}`}>
          {lessonMode ? (
            <>
              <div className="flex items-start gap-2">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-[11px] font-black text-white">{index + 1}</span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    className={`${INPUT} !py-1.5`}
                    value={video.title}
                    maxLength={120}
                    onChange={(e) => update(index, { title: e.target.value })}
                    placeholder={`Tên Bài ${index + 1}`}
                  />
                  <textarea
                    className={`${INPUT} !min-h-[72px] !py-1.5`}
                    value={video.content}
                    maxLength={5000}
                    onChange={(e) => update(index, { content: e.target.value })}
                    placeholder="Nội dung bài học (chữ). Không bắt buộc nếu đã có video"
                  />
                  <input
                    className={`${INPUT} !py-1.5`}
                    value={video.url}
                    maxLength={500}
                    onChange={(e) => update(index, { url: e.target.value })}
                    placeholder="Link video (tuỳ chọn)"
                  />
                  {video.url.trim() && <VideoChecksEditor checks={video.checks} onChange={(checks) => update(index, { checks })} />}
                </div>
                <button type="button" onClick={() => setList((list) => list.filter((_, i) => i !== index))} className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
              </div>
            </>
          ) : (
            <>
              <input className={`${INPUT} !py-1.5`} value={video.title} maxLength={120} onChange={(e) => update(index, { title: e.target.value })} placeholder="Tên video" />
              <input className={`${INPUT} !py-1.5`} value={video.url} maxLength={500} onChange={(e) => update(index, { url: e.target.value })} placeholder="Link video" />
              <button type="button" onClick={() => setList((list) => list.filter((_, i) => i !== index))} className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
              <VideoChecksEditor checks={video.checks} onChange={(checks) => update(index, { checks })} />
            </>
          )}
        </div>
      ))}
      {videos.length < MAX_UNIT_VIDEOS && (
        lessonMode ? (
          <div className="space-y-1.5 rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-2">
            <input className={`${INPUT} !py-1.5`} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder={`Tên Bài ${videos.length + 1}`} />
            <textarea className={`${INPUT} !min-h-[64px] !py-1.5`} value={draft.content} onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))} placeholder="Nội dung bài học (chữ)" />
            <input className={`${INPUT} !py-1.5`} value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="Link video (tuỳ chọn)" />
            <button
              type="button"
              onClick={addDraft}
              disabled={!draft.title.trim() || (!draft.url.trim() && !draft.content.trim())}
              className="cms-btn cms-btn-outline !py-1.5 text-xs"
            >
              <Plus size={14} /> Thêm bài
            </button>
          </div>
        ) : (
          <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <input className={`${INPUT} !py-1.5`} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Tên video mới" />
            <input className={`${INPUT} !py-1.5`} value={draft.url} onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))} placeholder="Link video" />
            <button type="button" onClick={addDraft} disabled={!draft.title.trim() || !draft.url.trim()} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Plus size={14} /> Thêm</button>
          </div>
        )
      )}
      {!deferSave && (
        <div className="flex justify-end">
          <button type="button" onClick={save} disabled={!dirty || invalid || saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">
            {saving && <Loader2 size={13} className="animate-spin" />} Lưu
          </button>
        </div>
      )}
    </div>
  );
}

/** Danh sách chặng của chủ đề: thứ tự mở khóa, số câu theo độ khó, gắn video. */
function UnitsManager({ topic, units, unassigned, filterUnitId, onFilterUnit, onChanged, onComposeQuestion, onAiDraft, onEditQuestion, questionsVersion = 0 }) {
  const toast = useToast();
  const [modal, setModal] = useState(null);
  const [targetUnitId, setTargetUnitId] = useState('');
  const [openVideosId, setOpenVideosId] = useState('');
  const [busy, setBusy] = useState(false);

  const move = async (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= units.length) return;
    const ids = units.map((u) => u.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await dailyPracticeApi.admin.reorderUnits(topic.id, ids);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (unit) => {
    if (!window.confirm(`Xóa chặng "${unit.title}"? Câu hỏi trong chặng sẽ chuyển về "Chưa xếp chặng", tiến độ học viên ở chặng này bị xóa.`)) return;
    try {
      await dailyPracticeApi.admin.deleteUnit(unit.id);
      toast.success('Đã xóa chặng');
      if (filterUnitId === unit.id) onFilterUnit('');
      onChanged();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const assign = async () => {
    setBusy(true);
    try {
      const result = await dailyPracticeApi.admin.assignUnassigned(topic.id, targetUnitId ? { unitId: targetUnitId } : {});
      toast.success(`Đã xếp ${result.assigned} câu vào chặng`);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto flex items-center gap-1.5 text-sm font-black text-slate-800"><Route size={16} className="text-red-600" /> Các chặng</p>
        <button type="button" onClick={() => setModal({})} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Plus size={14} /> Thêm chặng</button>
      </div>
      <p className="text-[11px] text-slate-500">
        Mỗi chặng là một đoạn trên lộ trình. Mở chặng để thêm video, nội dung hoặc luyện tập. Học viên xong chặng này mới sang chặng sau.
      </p>
      {!units.length ? (
        <p className="rounded-xl bg-white p-4 text-center text-xs text-slate-500">Chưa có chặng nào. Thêm chặng rồi xếp câu hỏi vào chặng.</p>
      ) : (
        <ol className="space-y-1.5">
          {units.map((unit, index) => {
            const short = unit.counts.total < MIN_UNIT_QUESTIONS;
            const active = filterUnitId === unit.id;
            const videosOpen = openVideosId === unit.id;
            return (
              <li key={unit.id} className={`space-y-2 rounded-xl bg-white p-2.5 ring-1 ${active || videosOpen ? 'ring-red-300' : 'ring-slate-100'} ${unit.active ? '' : 'opacity-60'}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-xs font-black text-white">{index + 1}</span>
                  <button type="button" onClick={() => onFilterUnit(active ? '' : unit.id)} className="min-w-0 flex-1 text-left !shadow-none" title="Lọc câu hỏi của chặng">
                    <p className="truncate text-sm font-black text-slate-900">
                      {unit.title}{!unit.active && <span className="ml-1 text-[10px] font-bold text-slate-400">(ẩn)</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {stageItemSummary(unit)}
                      {unit.counts.total ? ` · ${unit.counts.total} câu` : ''}
                      {unit.counts.draft ? <span className="font-bold text-amber-600"> · {unit.counts.draft} nháp</span> : null}
                    </p>
                    {short && <p className="text-[11px] font-bold text-amber-600">Chưa hiện trên lộ trình: cần ≥ {MIN_UNIT_QUESTIONS} câu đã xuất bản</p>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenVideosId(videosOpen ? '' : unit.id)}
                    aria-expanded={videosOpen}
                    title="Video, nội dung và luyện tập của chặng"
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-black transition !shadow-none ${videosOpen ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                  >
                    {videosOpen ? 'Đóng' : 'Soạn'}
                  </button>
                  <span className="flex shrink-0 flex-col">
                    <button type="button" disabled={index === 0} onClick={() => move(index, -1)} aria-label="Lên" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowUp size={13} /></button>
                    <button type="button" disabled={index === units.length - 1} onClick={() => move(index, 1)} aria-label="Xuống" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowDown size={13} /></button>
                  </span>
                  <button type="button" onClick={() => setModal(unit)} aria-label="Sửa chặng" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><Pencil size={14} /></button>
                  <button type="button" onClick={() => remove(unit)} aria-label="Xóa chặng" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
                </div>
                {videosOpen && (
                  <div className="space-y-2 border-t border-slate-100 pt-2">
                    <UnitPathNodesPanel
                      key={`${unit.id}-nodes-${JSON.stringify(unit.pathNodes || [])}`}
                      unit={unit}
                      questionsVersion={questionsVersion}
                      onSaved={onChanged}
                      onComposeQuestion={onComposeQuestion}
                      onAiDraft={onAiDraft}
                      onEditQuestion={onEditQuestion}
                    />
                    <details className="rounded-xl bg-slate-50 px-2.5 py-2 text-xs">
                      <summary className="cursor-pointer font-bold text-slate-600">Ảnh chặng và video danh sách (tuỳ chọn)</summary>
                      <div className="mt-2 space-y-2">
                        <UnitImagePanel key={`${unit.id}-image-${unit.imageUrl || ''}`} unit={unit} onSaved={onChanged} />
                        <UnitVideosPanel key={`${unit.id}-all-${JSON.stringify(unit.videos || [])}`} unit={unit} onSaved={onChanged} />
                      </div>
                    </details>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {unassigned > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 p-2.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
          <button type="button" onClick={() => onFilterUnit('none')} className="mr-auto text-left underline-offset-2 hover:underline !shadow-none">
            {unassigned} câu Luyện tự do (chưa xếp chặng lộ trình)
          </button>
          <select className={`${INPUT} !w-auto !py-1.5 text-xs`} value={targetUnitId} onChange={(e) => setTargetUnitId(e.target.value)} aria-label="Chặng đích">
            <option value="">Tạo chặng mới “Tổng hợp”</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={assign} className="cms-btn cms-btn-primary !py-1.5 text-xs">
            {busy && <Loader2 size={13} className="animate-spin" />} Xếp tất cả vào chặng
          </button>
        </div>
      )}
      {modal && (
        <UnitModal
          topic={topic}
          unit={modal.id ? modal : null}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function UnitSelect({ units, value, onChange, id }) {
  return (
    <select id={id} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Chưa xếp chặng (chỉ Luyện tự do)</option>
      {units.map((unit, index) => <option key={unit.id} value={unit.id}>Chặng {index + 1}: {unit.title}</option>)}
    </select>
  );
}

function answerSummary(q) {
  if (q.type === 'mcq') return `✓ ${q.options?.[q.correctIndex] || ''}`;
  if (q.type === 'truefalse') return q.answerBool ? '✓ Đúng' : '✓ Sai';
  if (q.type === 'order') return (q.items || []).join(' · ');
  if (q.type === 'match') return (q.pairs || []).map((p) => `${p.left} ↔ ${p.right}`).join(' · ');
  if (q.type === 'fill') return String(q.text || '').replace(/\{\{([^{}]+)\}\}/g, '[$1]');
  if (q.type === 'sort') return (q.groups || []).map((g) => `${g.name}: ${g.items.join(', ')}`).join(' · ');
  return '';
}

/** Admin: chủ đề + ngân hàng câu hỏi Luyện tập hằng ngày (6 dạng, AI tạo nháp). */
export default function AdminDailyPracticeTab() {
  const toast = useToast();
  const [topics, setTopics] = useState([]);
  const [topicId, setTopicId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [filters, setFilters] = useState({ difficulty: '', type: '', status: '', unitId: '' });
  const [unitData, setUnitData] = useState({ topicId: '', units: [], unassigned: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [topicModal, setTopicModal] = useState(null);
  const [questionModal, setQuestionModal] = useState(null);
  const [aiOpen, setAiOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sectionTab, setSectionTab] = useState('practice'); // practice | free-materials
  const topic = topics.find((t) => t.id === topicId) || null;

  const loadTopics = useCallback(async () => {
    try {
      const data = await dailyPracticeApi.admin.topics();
      setTopics(data);
      setTopicId((prev) => (data.some((t) => t.id === prev) ? prev : data[0]?.id || ''));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadQuestions = useCallback(async () => {
    if (!topicId) { setQuestions([]); return; }
    setLoadingQuestions(true);
    try {
      setQuestions(await dailyPracticeApi.admin.questions({ topicId, ...filters }));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, [topicId, filters, toast]);

  const loadUnits = useCallback(async () => {
    if (!topicId) return;
    try {
      const data = await dailyPracticeApi.admin.units(topicId);
      setUnitData({ topicId, units: data.units || [], unassigned: data.unassigned || 0 });
    } catch (err) {
      toast.error(err.message);
    }
  }, [topicId, toast]);

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => { loadUnits(); }, [loadUnits]);
  useEffect(() => { setFilters((f) => (f.unitId ? { ...f, unitId: '' } : f)); }, [topicId]);

  const units = useMemo(() => (unitData.topicId === topicId ? unitData.units : []), [unitData, topicId]);
  const unitTitle = useMemo(() => new Map(units.map((unit, index) => [unit.id, `Chặng ${index + 1}: ${unit.title}`])), [units]);
  const defaultUnitId = filters.unitId && filters.unitId !== 'none' ? filters.unitId : '';
  const refreshAll = () => { loadTopics(); loadQuestions(); loadUnits(); };

  const installStarter = async () => {
    setBusy(true);
    try {
      const result = await dailyPracticeApi.admin.installStarter();
      toast.success(result.topics ? `Đã thêm ${result.topics} chủ đề, ${result.questions} câu hỏi mẫu` : 'Bộ mẫu đã có sẵn, không thêm trùng');
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const removeTopic = async (t) => {
    if (!window.confirm(`Xóa chủ đề "${t.name}" và toàn bộ câu hỏi trong đó?`)) return;
    try {
      await dailyPracticeApi.admin.deleteTopic(t.id);
      toast.success('Đã xóa chủ đề');
      loadTopics();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleStatus = async (q) => {
    try {
      await dailyPracticeApi.admin.updateQuestion(q.id, { status: q.status === 'published' ? 'draft' : 'published' });
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const removeQuestion = async (q) => {
    if (!window.confirm('Xóa câu hỏi này?')) return;
    try {
      await dailyPracticeApi.admin.deleteQuestion(q.id);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const publishDrafts = async () => {
    try {
      const { published } = await dailyPracticeApi.admin.publishDrafts(topicId);
      toast.success(`Đã xuất bản ${published} câu nháp`);
      refreshAll();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setSectionTab('practice')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              sectionTab === 'practice' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Gamepad2 size={15} /> Lộ trình &amp; Câu hỏi theo chặng
          </button>
          <button
            type="button"
            onClick={() => setSectionTab('free-materials')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
              sectionTab === 'free-materials' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen size={15} /> Tài nguyên miễn phí
          </button>
        </div>
        {sectionTab === 'practice' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={installStarter} disabled={busy} className="cms-btn cms-btn-outline">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Thêm bộ câu hỏi mẫu
            </button>
            <button type="button" onClick={() => setTopicModal({})} className="cms-btn cms-btn-primary"><Plus size={16} /> Thêm chủ đề</button>
          </div>
        )}
      </div>

      {sectionTab === 'free-materials' ? (
        <AdminFreePortalMaterialsPanel topics={topics} />
      ) : (
        <>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải…</p>
      ) : !topics.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-bold text-slate-700">Chưa có chủ đề nào.</p>
          <p className="mt-1 text-sm text-slate-500">Bấm "Thêm bộ câu hỏi mẫu" để có ngay 6 chủ đề với 42 câu hỏi, hoặc tự tạo chủ đề mới.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {topics.map((t) => {
              const Icon = topicIcon(t.icon);
              const color = topicColor(t.color);
              const active = t.id === topicId;
              const published = t.counts.easy + t.counts.medium + t.counts.hard;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTopicId(t.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setTopicId(t.id); }}
                  className={`flex items-center gap-3 rounded-2xl border-2 bg-white p-3 transition ${active ? 'border-red-400' : 'border-slate-100 hover:border-slate-200'} ${t.active ? '' : 'opacity-60'}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">{t.name}{!t.active && <span className="ml-1 text-[10px] font-bold text-slate-400">(ẩn)</span>}</p>
                    <p className="text-[11px] text-slate-500">
                      {published} câu · Dễ {t.counts.easy} · Vừa {t.counts.medium} · Khó {t.counts.hard}
                      {t.counts.draft ? <span className="ml-1 font-bold text-amber-600">· {t.counts.draft} nháp</span> : null}
                    </p>
                    {t.lessonSubjectId ? (
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] font-bold text-red-600">
                        <PlayCircle size={11} /> Đã gắn video{t.lessonUnitIds?.length ? ` · ${t.lessonUnitIds.length} buổi` : ' · cả môn'}
                      </p>
                    ) : null}
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setTopicModal(t); }} aria-label="Sửa chủ đề" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><Pencil size={14} /></button>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeTopic(t); }} aria-label="Xóa chủ đề" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </aside>

          {topic && (
            <section className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="mr-auto text-base font-black text-slate-900">{topic.name}</h3>
                {topic.counts.draft > 0 && (
                  <button type="button" onClick={publishDrafts} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Send size={14} /> Xuất bản {topic.counts.draft} nháp</button>
                )}
              </div>
              <UnitsManager
                topic={topic}
                units={units}
                unassigned={unitData.topicId === topicId ? unitData.unassigned : 0}
                filterUnitId={filters.unitId}
                questionsVersion={questions.length}
                onFilterUnit={(unitId) => setFilters((f) => ({ ...f, unitId }))}
                onChanged={refreshAll}
                onComposeQuestion={(unitId, difficulty) => {
                  setFilters((f) => ({ ...f, unitId: unitId || f.unitId }));
                  setQuestionModal({ defaultUnitId: unitId || '', defaultDifficulty: difficulty || '', lockUnit: Boolean(unitId) });
                }}
                onAiDraft={(unitId, difficulty) => {
                  setFilters((f) => ({ ...f, unitId: unitId || f.unitId }));
                  setAiOpen({ defaultUnitId: unitId || '', defaultDifficulty: difficulty || '', lockUnit: Boolean(unitId) });
                }}
                onEditQuestion={(q) => setQuestionModal(q)}
              />
              <div className="space-y-2 rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="mr-auto text-sm font-black text-slate-800">Luyện tự do · chỉ trắc nghiệm</p>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, unitId: 'none' }));
                      setAiOpen({ defaultUnitId: '', lockUnit: true });
                    }}
                    className="cms-btn cms-btn-outline !py-1.5 text-xs"
                  >
                    <Bot size={14} /> AI tạo nháp
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, unitId: 'none' }));
                      setQuestionModal({ defaultUnitId: '', lockUnit: true });
                    }}
                    className="cms-btn cms-btn-primary !py-1.5 text-xs"
                  >
                    <Plus size={14} /> Soạn câu hỏi
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-slate-600">
                  Ngân hàng riêng cho chế độ <span className="font-black text-slate-800">Luyện tự do</span> của học viên.
                  Không dùng câu đã xếp vào lộ trình chặng · không gắn video · chỉ làm trắc nghiệm theo độ khó.
                  {(unitData.topicId === topicId ? unitData.unassigned : 0) > 0
                    ? ` Đang có ${unitData.unassigned} câu chưa xếp chặng (dùng cho Luyện tự do).`
                    : ' Chưa có câu Luyện tự do. Hãy soạn hoặc dùng AI.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select className={`${INPUT} !w-auto`} value={filters.unitId} onChange={(e) => setFilters((f) => ({ ...f, unitId: e.target.value }))} aria-label="Lọc chặng">
                  <option value="">Mọi phạm vi</option>
                  <option value="none">Chỉ Luyện tự do</option>
                  {units.map((unit, index) => <option key={unit.id} value={unit.id}>Chặng {index + 1}: {unit.title}</option>)}
                </select>
                <select className={`${INPUT} !w-auto`} value={filters.difficulty} onChange={(e) => setFilters((f) => ({ ...f, difficulty: e.target.value }))} aria-label="Lọc độ khó">
                  <option value="">Mọi độ khó</option>
                  {DIFFICULTIES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                <select className={`${INPUT} !w-auto`} value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} aria-label="Lọc dạng câu">
                  <option value="">Mọi dạng câu</option>
                  {TYPE_IDS.map((t) => <option key={t} value={t}>{QUESTION_TYPES[t].label}</option>)}
                </select>
                <select className={`${INPUT} !w-auto`} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} aria-label="Lọc trạng thái">
                  <option value="">Mọi trạng thái</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="draft">Nháp</option>
                </select>
              </div>

              {loadingQuestions ? (
                <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải câu hỏi…</p>
              ) : !questions.length ? (
                <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Chưa có câu hỏi phù hợp bộ lọc.</p>
              ) : (
                <ul className="space-y-2">
                  {questions.map((q) => {
                    const level = difficultyMeta(q.difficulty);
                    return (
                      <li key={q.id} className={`rounded-xl border p-3 ${q.status === 'draft' ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap gap-1.5 text-[10px] font-black">
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-white">{QUESTION_TYPES[q.type]?.label}</span>
                              <span className="rounded-full px-2 py-0.5" style={{ background: level.soft, color: level.color }}>{level.label}</span>
                              {q.unitId
                                ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">{unitTitle.get(q.unitId) || 'Chặng'}</span>
                                : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500">Chưa xếp chặng</span>}
                              {q.status === 'draft'
                                ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Nháp{q.source === 'ai' ? ' · AI' : ''}</span>
                                : <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"><CheckCircle2 size={10} /> Đã xuất bản</span>}
                              {!String(q.explanation || '').trim() ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Thiếu giải thích</span>
                              ) : null}
                            </div>
                            <p className="text-sm font-bold text-slate-800">{q.prompt}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{answerSummary(q)}</p>
                          </div>
                          <button type="button" onClick={() => toggleStatus(q)} title={q.status === 'published' ? 'Chuyển về nháp' : 'Xuất bản'} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none">
                            {q.status === 'published' ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                          <button type="button" onClick={() => setQuestionModal(q)} aria-label="Sửa" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><Pencil size={15} /></button>
                          <button type="button" onClick={() => removeQuestion(q)} aria-label="Xóa" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={15} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
        </div>
      )}
        </>
      )}

      {topicModal && (
        <TopicModal
          topic={topicModal.id ? topicModal : null}
          onClose={() => setTopicModal(null)}
          onSaved={(saved) => { setTopicModal(null); setTopicId(saved.id); loadTopics(); }}
        />
      )}
      {questionModal && topic && (
        <QuestionModal
          topicId={topic.id}
          question={questionModal.id ? questionModal : null}
          defaultDifficulty={questionModal.defaultDifficulty || filters.difficulty}
          units={units}
          defaultUnitId={questionModal.defaultUnitId ?? defaultUnitId}
          lockUnit={Boolean(questionModal.lockUnit)}
          onClose={() => setQuestionModal(null)}
          onSaved={() => { setQuestionModal(null); refreshAll(); }}
        />
      )}
      {aiOpen && topic && (
        <AiModal
          topic={topic}
          defaultDifficulty={aiOpen.defaultDifficulty || filters.difficulty}
          units={units}
          defaultUnitId={aiOpen.defaultUnitId ?? defaultUnitId}
          lockUnit={Boolean(aiOpen.lockUnit)}
          onClose={() => setAiOpen(null)}
          onDone={() => { setAiOpen(null); setFilters((f) => ({ ...f, status: 'draft' })); refreshAll(); }}
        />
      )}
    </div>
  );
}
