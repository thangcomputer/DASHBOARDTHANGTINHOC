import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown, ArrowUp, Bot, CheckCircle2, Eye, EyeOff, Gamepad2, Loader2, Pencil, PlayCircle, Plus, Send, Sparkles, Trash2, X,
} from 'lucide-react';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { useToast } from '../../../utils/useToast';
import {
  DIFFICULTIES, QUESTION_TYPES, TOPIC_COLORS, TOPIC_ICONS, difficultyMeta, topicColor, topicIcon,
} from '../../../utils/dailyPractice';

const TYPE_IDS = Object.keys(QUESTION_TYPES);
const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';

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
            <input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} className="h-4 w-4 accent-red-600" />
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
            <option value="">{lessonSubjects === null ? 'Đang tải môn học…' : '— Không gắn video —'}</option>
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
                        className="h-4 w-4 accent-red-600"
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

function QuestionModal({ topicId, question, defaultDifficulty, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => (question ? fromQuestion(question) : blankQuestion('mcq', defaultDifficulty || 'easy')));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));
  const blanks = useMemo(() => [...String(form.text || '').matchAll(/\{\{([^{}]+)\}\}/g)].map((m) => m[1]), [form.text]);

  const payload = () => {
    const body = {
      topicId, type: form.type, difficulty: form.difficulty, prompt: form.prompt, imageUrl: form.imageUrl,
      hint: form.hint, explanation: form.explanation, status: form.status,
    };
    if (form.type === 'mcq') Object.assign(body, { options: form.options.filter((o) => o.trim()), correctIndex: form.correctIndex });
    if (form.type === 'truefalse') body.answerBool = form.answerBool;
    if (form.type === 'order') body.items = form.items.filter((o) => o.trim());
    if (form.type === 'match') body.pairs = form.pairs.filter((p) => p.left.trim() && p.right.trim());
    if (form.type === 'fill') Object.assign(body, { text: form.text, distractors: form.distractors });
    if (form.type === 'sort') body.groups = form.groups.filter((g) => g.name.trim() && g.items.length);
    return body;
  };

  const save = async () => {
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
                <label className={LABEL} htmlFor="dp-q-text">Đoạn văn — đặt từ cần điền trong {'{{ }}'}</label>
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
          <div>
            <label className={LABEL} htmlFor="dp-q-hint">Gợi ý (không lộ thẳng đáp án)</label>
            <input id="dp-q-hint" className={INPUT} value={form.hint} maxLength={300} onChange={(e) => set({ hint: e.target.value })} />
          </div>
          <div>
            <label className={LABEL} htmlFor="dp-q-image">Ảnh minh họa (URL, không bắt buộc)</label>
            <input id="dp-q-image" className={INPUT} value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://..." />
          </div>
        </div>
        <div>
          <label className={LABEL} htmlFor="dp-q-explain">Giải thích (hiện sau khi trả lời)</label>
          <textarea id="dp-q-explain" rows={2} className={INPUT} value={form.explanation} maxLength={800} onChange={(e) => set({ explanation: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function AiModal({ topic, defaultDifficulty, onClose, onDone }) {
  const toast = useToast();
  const [difficulty, setDifficulty] = useState(defaultDifficulty || 'easy');
  const [count, setCount] = useState(6);
  const [types, setTypes] = useState(TYPE_IDS);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await dailyPracticeApi.admin.aiGenerate({ topicId: topic.id, difficulty, count, types });
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
      title={`AI tạo câu hỏi nháp — ${topic.name}`}
      onClose={busy ? () => {} : onClose}
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
          Câu do AI tạo được lưu ở trạng thái <b>Nháp</b> — học viên chưa thấy cho tới khi bạn kiểm tra và xuất bản.
        </p>
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
                <input type="checkbox" className="h-4 w-4 accent-red-600" checked={types.includes(type)} onChange={(e) => setTypes((prev) => (e.target.checked ? [...prev, type] : prev.filter((t) => t !== type)))} />
                {QUESTION_TYPES[type].label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function answerSummary(q) {
  if (q.type === 'mcq') return `✓ ${q.options?.[q.correctIndex] || ''}`;
  if (q.type === 'truefalse') return q.answerBool ? '✓ Đúng' : '✓ Sai';
  if (q.type === 'order') return (q.items || []).join(' → ');
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
  const [filters, setFilters] = useState({ difficulty: '', type: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [topicModal, setTopicModal] = useState(null);
  const [questionModal, setQuestionModal] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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

  useEffect(() => { loadTopics(); }, [loadTopics]);
  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const refreshAll = () => { loadTopics(); loadQuestions(); };

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
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-red-500 to-red-700 text-white"><Gamepad2 size={22} /></span>
          <div>
            <h2 className="text-lg font-black text-slate-900">Luyện tập hằng ngày</h2>
            <p className="text-xs text-slate-500">Ngân hàng câu hỏi trò chơi theo chủ đề và độ khó cho học viên</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={installStarter} disabled={busy} className="cms-btn cms-btn-outline">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Thêm bộ câu hỏi mẫu
          </button>
          <button type="button" onClick={() => setTopicModal({})} className="cms-btn cms-btn-primary"><Plus size={16} /> Thêm chủ đề</button>
        </div>
      </div>

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
                <button type="button" onClick={() => setAiOpen(true)} className="cms-btn cms-btn-outline !py-1.5 text-xs"><Bot size={14} /> AI tạo nháp</button>
                <button type="button" onClick={() => setQuestionModal({})} className="cms-btn cms-btn-primary !py-1.5 text-xs"><Plus size={14} /> Soạn câu hỏi</button>
              </div>
              <div className="flex flex-wrap gap-2">
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
                              {q.status === 'draft'
                                ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Nháp{q.source === 'ai' ? ' · AI' : ''}</span>
                                : <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700"><CheckCircle2 size={10} /> Đã xuất bản</span>}
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
          defaultDifficulty={filters.difficulty}
          onClose={() => setQuestionModal(null)}
          onSaved={() => { setQuestionModal(null); refreshAll(); }}
        />
      )}
      {aiOpen && topic && (
        <AiModal
          topic={topic}
          defaultDifficulty={filters.difficulty}
          onClose={() => setAiOpen(false)}
          onDone={() => { setAiOpen(false); setFilters((f) => ({ ...f, status: 'draft' })); loadTopics(); }}
        />
      )}
    </div>
  );
}
