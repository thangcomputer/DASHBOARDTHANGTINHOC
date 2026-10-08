import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';

const TYPES = [
  { id: 'image_view', label: 'Ảnh xem' },
  { id: 'hotspot', label: 'Bấm vùng' },
  { id: 'mcq', label: 'Trắc nghiệm' },
  { id: 'written', label: 'Tự ghi' },
];

function newOption() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `opt-${Date.now()}`;
  return { id, text: '' };
}

function blankItem() {
  const first = newOption();
  const second = newOption();
  return {
    type: 'mcq',
    prompt: '',
    imageUrl: '',
    caption: '',
    explanation: '',
    rubric: '',
    modelAnswer: '',
    correctOptionId: first.id,
    options: [first, second],
    region: null,
  };
}

function RegionDraw({ imageUrl, region, onChange }) {
  const ref = useRef(null);
  const drag = useRef(null);
  if (!imageUrl) return <p className="text-xs text-slate-500">Tải ảnh lên rồi kéo để khoanh vùng đúng.</p>;

  function percent(event) {
    const box = ref.current.getBoundingClientRect();
    return {
      x: Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - box.top) / box.height) * 100)),
    };
  }

  return (
    <div
      ref={ref}
      className="relative max-w-xl cursor-crosshair overflow-hidden rounded-xl border border-slate-200 bg-slate-50 select-none"
      onMouseDown={(event) => { drag.current = percent(event); }}
      onMouseMove={(event) => {
        if (!drag.current || !ref.current) return;
        const cur = percent(event);
        const x = Math.min(drag.current.x, cur.x);
        const y = Math.min(drag.current.y, cur.y);
        onChange({ x, y, w: Math.abs(cur.x - drag.current.x), h: Math.abs(cur.y - drag.current.y) });
      }}
      onMouseUp={() => { drag.current = null; }}
      onMouseLeave={() => { drag.current = null; }}
    >
      <img src={resolveMediaUrl(imageUrl)} alt="" className="block w-full max-h-80 object-contain pointer-events-none" />
      {region && (
        <span
          className="absolute border-2 border-red-500 bg-red-400/20 pointer-events-none"
          style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
        />
      )}
    </div>
  );
}

function statusLabel(row) {
  if (row.status === 'completed') return 'Đã học xong môn';
  if (row.currentUnitTitle) return `Đang học: ${row.currentUnitTitle}`;
  return 'Đang học';
}

export default function AdminLessonPracticeTab() {
  const [section, setSection] = useState('build');
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [items, setItems] = useState([]);
  const [draft, setDraft] = useState(null);
  const [unitTitle, setUnitTitle] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const subject = subjects.find((row) => row.id === subjectId) || null;

  async function loadSubjects(preferId) {
    const res = await lessonPracticeApi.admin.subjects();
    const rows = res.data || [];
    setSubjects(rows);
    const nextId = preferId || subjectId || rows[0]?.id || '';
    setSubjectId(nextId);
    return nextId;
  }

  async function loadUnits(id) {
    if (!id) { setUnits([]); setUnitId(''); return; }
    const res = await lessonPracticeApi.admin.units(id);
    const rows = res.data || [];
    setUnits(rows);
    setUnitId((current) => (rows.some((row) => row.id === current) ? current : (rows[0]?.id || '')));
  }

  async function loadItems(id) {
    if (!id) { setItems([]); return; }
    const res = await lessonPracticeApi.admin.items(id);
    setItems(res.data || []);
  }

  useEffect(() => {
    let alive = true;
    loadSubjects()
      .catch((err) => { if (alive) setError(err.message || 'Không tải được môn học'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!subjectId) return undefined;
    setItems([]);
    loadUnits(subjectId).catch((err) => setError(err.message || 'Không tải được buổi học'));
    return undefined;
  }, [subjectId]);

  useEffect(() => {
    if (!unitId) { setItems([]); return undefined; }
    loadItems(unitId).catch((err) => setError(err.message || 'Không tải được nội dung'));
    return undefined;
  }, [unitId]);

  useEffect(() => {
    if (section !== 'progress') return undefined;
    lessonPracticeApi.admin.progress(subjectId)
      .then((res) => setProgress(res.data || []))
      .catch((err) => setError(err.message || 'Không tải được tiến độ'));
    return undefined;
  }, [section, subjectId]);

  async function run(task) {
    setSaving(true);
    setError('');
    try { await task(); } catch (err) { setError(err.message || 'Không lưu được'); }
    finally { setSaving(false); }
  }

  async function uploadImage(file) {
    if (!file || !draft) return;
    setSaving(true);
    setError('');
    try {
      const res = await lessonPracticeApi.upload(file);
      setDraft((current) => ({ ...current, imageUrl: res.data.url }));
    } catch (err) {
      setError(err.message || 'Không tải được ảnh');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-red-600">Đào tạo học viên</p>
            <h1 className="text-2xl font-black text-slate-900">Bài học</h1>
            <p className="text-sm text-slate-500">Soạn môn, buổi và câu hỏi. Tiến độ chỉ hiện buổi học viên đã tới, không hiện điểm.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setSection('build')} className={`rounded-xl px-3 py-2 text-sm font-bold ${section === 'build' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>Soạn bài</button>
            <button type="button" onClick={() => setSection('progress')} className={`rounded-xl px-3 py-2 text-sm font-bold ${section === 'progress' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>Tiến độ</button>
          </div>
        </div>
        {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải...</div>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {section === 'progress' && (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Học viên</th>
                  <th className="px-4 py-3">Môn</th>
                  <th className="px-4 py-3">Buổi đã xong</th>
                  <th className="px-4 py-3">Hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {progress.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-6 text-slate-500">Chưa có học viên vào bài.</td></tr>
                )}
                {progress.map((row) => (
                  <tr key={`${row.studentId}-${row.subjectId}`} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.studentName}</td>
                    <td className="px-4 py-3">{row.subjectName}</td>
                    <td className="px-4 py-3">{row.completedUnitCount}/{row.totalUnitCount}</td>
                    <td className="px-4 py-3">{statusLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {section === 'build' && (
          <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
            <aside className="space-y-2">
              <div className="flex gap-2">
                <button type="button" className="flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold" onClick={() => run(async () => { const id = await loadSubjects((await lessonPracticeApi.admin.createSubject({ name: subjectName.trim() || 'Môn mới' })).data.id); setSubjectName(''); })}>
                  <Plus size={14} className="inline mr-1" /> Môn
                </button>
                <button type="button" className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-bold" onClick={() => run(async () => { await lessonPracticeApi.admin.seedDefaults(); await loadSubjects(); })}>
                  Môn mẫu
                </button>
              </div>
              <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="Tên môn mới" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              {subjects.map((row) => (
                <button key={row.id} type="button" onClick={() => setSubjectId(row.id)} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${row.id === subjectId ? 'bg-red-600 text-white' : 'bg-white border border-slate-100'}`}>
                  {row.name}
                </button>
              ))}
            </aside>

            {subject && (
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      defaultValue={subject.name}
                      key={subject.id}
                      onBlur={(e) => {
                        const name = e.target.value.trim();
                        if (name && name !== subject.name) run(async () => { await lessonPracticeApi.admin.updateSubject(subject.id, { name }); await loadSubjects(subject.id); });
                      }}
                      className="flex-1 min-w-48 rounded-xl border border-slate-200 px-3 py-2 font-bold"
                    />
                    <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" onClick={() => run(async () => {
                      await lessonPracticeApi.admin.updateSubject(subject.id, { unlockMode: subject.unlockMode === 'sequential' ? 'open' : 'sequential' });
                      await loadSubjects(subject.id);
                    })}>
                      {subject.unlockMode === 'sequential' ? 'Đang mở tuần tự' : 'Đang mở hết'}
                    </button>
                    <button type="button" className="rounded-xl border border-red-100 px-3 py-2 text-sm font-bold text-red-600" onClick={() => {
                      if (!window.confirm(`Xóa môn ${subject.name}?`)) return;
                      run(async () => { await lessonPracticeApi.admin.deleteSubject(subject.id); setSubjectId(''); await loadSubjects(); });
                    }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Bấm nút tuần tự / mở hết để đổi cách khóa buổi. Bấm ra ngoài ô tên để lưu tên.</p>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                  <div className="flex gap-2">
                    <input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} placeholder="Tên buổi, ví dụ Buổi 1" className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                    <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white" onClick={() => run(async () => {
                      const title = unitTitle.trim();
                      if (!title) throw new Error('Nhập tên buổi');
                      const created = await lessonPracticeApi.admin.createUnit(subject.id, { title });
                      setUnitTitle('');
                      await loadUnits(subject.id);
                      setUnitId(created.data.id);
                    })}>Thêm buổi</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {units.map((unit, index) => (
                      <button key={unit.id} type="button" onClick={() => setUnitId(unit.id)} className={`rounded-xl px-3 py-2 text-sm font-bold ${unit.id === unitId ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}>
                        {index + 1}. {unit.title}
                      </button>
                    ))}
                  </div>
                  {unitId && (
                    <button type="button" className="text-xs font-bold text-red-600" onClick={() => {
                      if (!window.confirm('Xóa buổi này?')) return;
                      run(async () => { await lessonPracticeApi.admin.deleteUnit(unitId); setUnitId(''); await loadUnits(subject.id); });
                    }}>Xóa buổi đang chọn</button>
                  )}
                </div>

                {unitId && (
                  <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-black text-slate-900">Nội dung buổi</h2>
                      <button type="button" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" onClick={() => setDraft(blankItem())}>Thêm nội dung</button>
                    </div>
                    <ul className="space-y-2">
                      {items.map((item, index) => (
                        <li key={item.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
                          <span className="font-bold text-slate-400">{index + 1}.</span>
                          <span className="flex-1 truncate">{TYPES.find((type) => type.id === item.type)?.label}: {item.prompt || item.caption || 'Ảnh'}</span>
                          <button type="button" className="font-bold text-slate-700" onClick={() => setDraft({ ...blankItem(), ...item, options: item.options?.length ? item.options : blankItem().options, region: item.region || null })}>Sửa</button>
                          <button type="button" className="font-bold text-red-600" onClick={() => run(async () => { await lessonPracticeApi.admin.deleteItem(item.id); if (draft?.id === item.id) setDraft(null); await loadItems(unitId); })}>Xóa</button>
                        </li>
                      ))}
                      {items.length === 0 && <li className="text-sm text-slate-500">Buổi chưa có ảnh hay câu hỏi.</li>}
                    </ul>

                    {draft && (
                      <form className="space-y-3 border-t border-slate-100 pt-4" onSubmit={(event) => {
                        event.preventDefault();
                        run(async () => {
                          const body = { ...draft };
                          if (draft.id) await lessonPracticeApi.admin.updateItem(draft.id, body);
                          else await lessonPracticeApi.admin.createItem(unitId, body);
                          setDraft(null);
                          await loadItems(unitId);
                        });
                      }}>
                        <div className="flex flex-wrap gap-2">
                          {TYPES.map((type) => (
                            <button key={type.id} type="button" onClick={() => setDraft((current) => ({ ...current, type: type.id }))} className={`rounded-xl px-3 py-1.5 text-xs font-bold ${draft.type === type.id ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>{type.label}</button>
                          ))}
                        </div>
                        {draft.type !== 'image_view' && (
                          <textarea value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={3} placeholder="Nội dung câu hỏi" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        )}
                        <label className="block text-xs font-bold text-slate-500">
                          Ảnh
                          <input type="file" accept="image/*" className="mt-1 block text-sm" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadImage(file); }} />
                        </label>
                        {draft.imageUrl && <img src={resolveMediaUrl(draft.imageUrl)} alt="" className="max-h-40 rounded-xl border border-slate-100" />}
                        {draft.type === 'image_view' && (
                          <input value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} placeholder="Chú thích ảnh" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        )}
                        {draft.type === 'hotspot' && (
                          <RegionDraw imageUrl={draft.imageUrl} region={draft.region} onChange={(region) => setDraft({ ...draft, region })} />
                        )}
                        {draft.type === 'mcq' && (
                          <div className="space-y-2">
                            {draft.options.map((opt, index) => (
                              <div key={opt.id} className="flex items-center gap-2">
                                <input type="radio" name="correct" checked={draft.correctOptionId === opt.id} onChange={() => setDraft({ ...draft, correctOptionId: opt.id })} />
                                <input value={opt.text} onChange={(e) => {
                                  const options = draft.options.map((row) => (row.id === opt.id ? { ...row, text: e.target.value } : row));
                                  setDraft({ ...draft, options });
                                }} placeholder={`Đáp án ${index + 1}`} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                              </div>
                            ))}
                            {draft.options.length < 6 && (
                              <button type="button" className="text-xs font-bold text-slate-600" onClick={() => setDraft({ ...draft, options: [...draft.options, newOption()] })}>Thêm đáp án</button>
                            )}
                          </div>
                        )}
                        {draft.type === 'written' && (
                          <>
                            <textarea value={draft.rubric} onChange={(e) => setDraft({ ...draft, rubric: e.target.value })} rows={2} placeholder="Barem: ý nào được tính là đúng" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                            <textarea value={draft.modelAnswer} onChange={(e) => setDraft({ ...draft, modelAnswer: e.target.value })} rows={2} placeholder="Đáp án mẫu cho AI" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                          </>
                        )}
                        {draft.type !== 'image_view' && (
                          <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={2} placeholder="Lời giải hiện ngay sau khi học viên xác nhận" className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                        )}
                        <div className="flex gap-2">
                          <button type="submit" disabled={saving} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60">Lưu nội dung</button>
                          <button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold" onClick={() => setDraft(null)}>Đóng</button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
