import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, CircleHelp, Clock, Download, GripVertical, Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import RichTextEditor from '../shared/RichTextEditor';
import AdminStudentTrainingTab from './AdminStudentTrainingTab';

const TYPES = [
  { id: 'multi', label: 'Chọn nhiều đáp án' },
  { id: 'match', label: 'Ghép đáp án' },
  { id: 'mcq', label: 'Trắc nghiệm chọn 1 đáp án' },
  { id: 'written', label: 'Tự ghi AI chấm' },
  { id: 'drag', label: 'Kéo thả đáp án' },
  { id: 'hotspot', label: 'Chọn vùng ảnh' },
];

function newOption() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `opt-${Date.now()}`;
  return { id, text: '' };
}

function newPair() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pair-${Date.now()}`;
  return { id, left: '', right: '' };
}

function blankItem() {
  const options = [newOption(), newOption(), newOption(), newOption()];
  return {
    type: 'mcq',
    prompt: '',
    imageUrl: '',
    imageName: '',
    caption: '',
    explanation: '',
    rubric: '',
    modelAnswer: '',
    correctOptionId: options[0].id,
    correctOptionIds: [],
    options,
    pairs: [newPair(), newPair()],
    region: null,
    timeLimitSec: 0,
  };
}

function draftHasContent(item) {
  if (!item) return false;
  return Boolean(
    item.id
    || String(item.prompt || '').trim()
    || String(item.imageUrl || '').trim()
    || String(item.caption || '').trim()
    || String(item.explanation || '').trim()
    || String(item.rubric || '').trim()
    || String(item.modelAnswer || '').trim()
    || item.options?.some((option) => String(option.text || '').trim())
    || item.pairs?.some((pair) => String(pair.left || '').trim() || String(pair.right || '').trim())
    || item.region,
  );
}

function draftIsComplete(item) {
  if (!item) return false;
  const prompt = String(item.prompt || '').trim();
  const options = Array.isArray(item.options) ? item.options : [];
  const optionsComplete = options.length >= 2
    && options.length <= 6
    && options.every((option) => String(option.text || '').trim() && String(option.id || '').trim())
    && new Set(options.map((option) => String(option.id))).size === options.length;

  if (item.type === 'mcq') {
    return !!prompt && optionsComplete && options.some((option) => option.id === item.correctOptionId);
  }
  if (item.type === 'multi') {
    return !!prompt && optionsComplete && (item.correctOptionIds || []).some((id) => options.some((option) => option.id === id));
  }
  if (item.type === 'drag') return !!prompt && optionsComplete;
  if (item.type === 'match') {
    return !!prompt
      && item.pairs?.length >= 2
      && item.pairs.length <= 6
      && item.pairs.every((pair) => String(pair.left || '').trim() && String(pair.right || '').trim() && String(pair.id || '').trim());
  }
  if (item.type === 'written') {
    return !!prompt && (!!String(item.rubric || '').trim() || !!String(item.modelAnswer || '').trim());
  }
  if (item.type === 'hotspot') {
    const region = item.region || {};
    const values = [region.x, region.y, region.w, region.h].map(Number);
    return !!String(item.imageUrl || '').trim()
      && values.every(Number.isFinite)
      && values[0] >= 0 && values[1] >= 0
      && values[2] >= 1 && values[3] >= 1
      && values[0] + values[2] <= 100.01
      && values[1] + values[3] <= 100.01;
  }
  return item.type === 'image_view' && !!String(item.imageUrl || '').trim();
}

function newContentId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `content-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeUnitContents(unit) {
  return {
    ...unit,
    videos: unit.videos?.length
      ? unit.videos
      : (unit.videoUrl ? [{ id: 'legacy-video', title: 'Video 1', url: unit.videoUrl }] : []),
    contents: unit.contents?.length
      ? unit.contents
      : (unit.note ? [{ id: 'legacy-note', title: 'Nội dung 1', content: unit.note }] : []),
  };
}

function unitContentOrder(unit, items) {
  const contents = unit?.contents || [];
  const videos = unit?.videos || [];
  const practiceEntry = unit?.id ? `practice:${unit.id}` : '';
  const hasPractice = (items || []).length > 0
    || (unit?.contentOrder || []).some((entry) => entry === practiceEntry || String(entry).startsWith('quiz:'));
  const available = new Set([
    ...contents.map((item) => `content:${item.id}`),
    ...videos.map((item) => `video:${item.id}`),
    ...(hasPractice ? [practiceEntry] : []),
  ]);
  const result = [];
  const seen = new Set();
  [...(unit?.contentOrder || []), ...contents.map((item) => `content:${item.id}`), ...videos.map((item) => `video:${item.id}`), ...(hasPractice ? [practiceEntry] : [])]
    .forEach((entry) => {
      const normalizedEntry = String(entry).startsWith('quiz:') ? practiceEntry : entry;
      if (available.has(normalizedEntry) && !seen.has(normalizedEntry)) {
        seen.add(normalizedEntry);
        result.push(normalizedEntry);
      }
    });
  return result;
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

function findCourseLessonSubject(subjects, examSubjectId) {
  const id = String(examSubjectId || '').toLowerCase();
  const aliases = id === 'coban' ? ['coban', 'su-dung-may-tinh'] : [id];
  return subjects.find((row) =>
    aliases.includes(String(row.examSubjectId || '').toLowerCase())
    || aliases.includes(String(row.slug || '').toLowerCase()));
}

export default function AdminLessonPracticeTab() {
  const [moduleTab, setModuleTab] = useState('lessons');
  const [section, setSection] = useState('build');
  const [subjects, setSubjects] = useState([]);
  const [courses, setCourses] = useState([]);
  const [expandedCourseId, setExpandedCourseId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [isUnitEditing, setIsUnitEditing] = useState(false);
  const [items, setItems] = useState([]);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [draft, setDraft] = useState(null);
  const [showAddContentMenu, setShowAddContentMenu] = useState(false);
  const [draggedEntry, setDraggedEntry] = useState('');
  const [dragOverEntry, setDragOverEntry] = useState('');
  const [dragOverAfter, setDragOverAfter] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [unitTitle, setUnitTitle] = useState('');
  const [progress, setProgress] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const subject = subjects.find((row) => row.id === subjectId) || null;
  const selectedUnit = units.find((row) => row.id === unitId) || null;
  const practiceItems = items;
  const lessonVideos = selectedUnit?.videos || [];
  const lessonContents = selectedUnit?.contents || [];
  const practiceEntry = unitId ? `practice:${unitId}` : '';
  const hasPracticeBlock = items.length > 0
    || (selectedUnit?.contentOrder || []).some((entry) => entry === practiceEntry || String(entry).startsWith('quiz:'));
  const hasLessonContent = lessonVideos.length > 0 || lessonContents.length > 0 || hasPracticeBlock;
  const lessonContentReady = hasLessonContent
    && String(selectedUnit?.title || '').trim().length > 0
    && lessonVideos.every((video) => {
      try {
        const url = new URL(String(video.url || '').trim());
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    })
    && lessonContents.every((content) => String(content.content || '').trim().length > 0)
    && (!hasPracticeBlock || (draftHasContent(draft) ? draftIsComplete(draft) : items.length > 0));
  const orderedLessonEntries = unitContentOrder(selectedUnit, items);
  const courseGroups = courses.map((course) => {
    const courseSubjects = (course.examSubjects || []).map((examSubjectId) => {
      return findCourseLessonSubject(subjects, examSubjectId);
    }).filter((row, index, rows) => row && rows.findIndex((candidate) => candidate.id === row.id) === index);
    return { ...course, subjects: courseSubjects };
  }).filter((course) => course.subjects.length > 0);

  function toggleUnitEditor(id) {
    if (isUnitEditing && unitId === id) {
      setIsUnitEditing(false);
      return;
    }
    setUnitId(id);
    setIsUnitEditing(true);
  }

  function reorderLessonEntries(source, target, insertAfter = false) {
    if (!source || !target || source === target) return;
    setUnits((rows) => rows.map((unit) => {
      if (unit.id !== unitId) return unit;
      const order = unitContentOrder(unit, items);
      const from = order.indexOf(source);
      const to = order.indexOf(target);
      if (from < 0 || to < 0) return unit;
      const next = [...order];
      next.splice(from, 1);
      const targetIndex = next.indexOf(target);
      next.splice(targetIndex + (insertAfter ? 1 : 0), 0, source);
      return { ...unit, contentOrder: next };
    }));
  }

  function handleLessonEntryDrop(event, target) {
    event.preventDefault();
    const source = event.dataTransfer.getData('text/plain') || draggedEntry;
    const bounds = event.currentTarget.getBoundingClientRect();
    const insertAfter = event.clientY > bounds.top + bounds.height / 2;
    reorderLessonEntries(source, target, insertAfter);
    setDraggedEntry('');
    setDragOverEntry('');
  }

  function entryDropProps(entry) {
    return {
      onDragOver: (event) => {
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        setDragOverEntry(entry);
        setDragOverAfter(event.clientY > bounds.top + bounds.height / 2);
      },
      onDrop: (event) => handleLessonEntryDrop(event, entry),
    };
  }

  function entryDragStart(event, entry) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', entry);
    const card = event.currentTarget.closest('[data-lesson-entry]');
    if (card) event.dataTransfer.setDragImage(card, 24, 20);
    setDraggedEntry(entry);
    setDragOverEntry('');
  }

  function entryCardClass(entry) {
    if (draggedEntry === entry) return 'space-y-2 rounded-xl border border-red-300 p-3 opacity-50 transition-colors';
    const line = dragOverEntry === entry && draggedEntry
      ? (dragOverAfter ? 'shadow-[0_5px_0_0_#ef4444]' : 'shadow-[0_-5px_0_0_#ef4444]')
      : '';
    return `space-y-2 rounded-xl border border-slate-200 p-3 transition-colors ${line}`;
  }

  async function loadSubjects(preferId) {
    const res = await lessonPracticeApi.admin.subjects();
    const rows = (res.data || []).map(normalizeUnitContents);
    setSubjects(rows);
    const nextId = preferId || subjectId || '';
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
    (async () => {
      const subjectRowsResponse = await lessonPracticeApi.admin.subjects();
      if (!alive) return;
      const subjectRows = subjectRowsResponse.data || [];
      setSubjects(subjectRows);
      const coursesResponse = await lessonPracticeApi.admin.courses();
      if (!alive) return;
      const courseRows = coursesResponse.data || [];
      setCourses(courseRows);
      const firstCourse = courseRows.find((course) =>
        (course.examSubjects || []).some((examSubjectId) => findCourseLessonSubject(subjectRows, examSubjectId)));
      const firstSubject = firstCourse?.examSubjects
        .map((examSubjectId) => findCourseLessonSubject(subjectRows, examSubjectId))
        .find(Boolean);
      setExpandedCourseId(firstCourse?.id || '');
      setSubjectId(firstSubject?.id || '');
    })()
      .catch((err) => { if (alive) setError(err.message || 'Không tải được môn học'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!subjectId) return undefined;
    setIsUnitEditing(false);
    setItems([]);
    loadUnits(subjectId).catch((err) => setError(err.message || 'Không tải được buổi học'));
    return undefined;
  }, [subjectId]);

  useEffect(() => {
    setDeletedItemIds([]);
    setDraft(null);
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

  async function saveAllUnitContent() {
    const unit = units.find((row) => row.id === unitId);
    if (!unit) throw new Error('Vui lòng chọn buổi học');
    if (!String(unit.title || '').trim()) throw new Error('Tên buổi không được để trống');

    const itemsToSave = draftHasContent(draft)
      ? (() => {
        const stagedDraft = { ...draft, id: draft.id || `pending-${newContentId()}` };
        return items.some((item) => item.id === stagedDraft.id)
          ? items.map((item) => item.id === stagedDraft.id ? stagedDraft : item)
          : [...items, stagedDraft];
      })()
      : items;

    const videos = unit.videos || [];
    await lessonPracticeApi.admin.updateUnit(unitId, {
      title: String(unit.title || '').trim(),
      videos,
      contents: unit.contents || [],
      antiSeek: unit.antiSeek !== false,
      timeLimitSec: unit.timeLimitSec || 0,
    });

    for (const id of deletedItemIds) {
      await lessonPracticeApi.admin.deleteItem(id);
      setDeletedItemIds((rows) => rows.filter((row) => row !== id));
    }

    const savedItems = [];
    for (const item of itemsToSave) {
      const body = {
        ...item,
        videoId: '',
      };
      if (String(item.id).startsWith('pending-')) {
        const created = await lessonPracticeApi.admin.createItem(unitId, body);
        if (!created.data?.id) throw new Error('Không nhận được mã câu trắc nghiệm sau khi lưu');
        const persisted = { ...body, id: created.data.id };
        savedItems.push(persisted);
        setItems((rows) => rows.map((row) => row.id === item.id ? persisted : row));
      } else {
        await lessonPracticeApi.admin.updateItem(item.id, body);
        savedItems.push(body);
      }
    }

    const allowedEntries = new Set([
      ...(unit.videos || []).map((video) => `video:${video.id}`),
      ...(unit.contents || []).map((content) => `content:${content.id}`),
      ...(savedItems.length > 0 || unit.contentOrder?.includes(`practice:${unitId}`) ? [`practice:${unitId}`] : []),
    ]);
    const contentOrder = unitContentOrder(unit, itemsToSave).filter((entry) => allowedEntries.has(entry));
    await lessonPracticeApi.admin.updateUnit(unitId, { contentOrder });
    setDeletedItemIds([]);
    setDraft(null);
    await Promise.all([loadUnits(subject.id), loadItems(unitId)]);
    setIsUnitEditing(false);
  }

  async function exportBackup() {
    setBackupBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await lessonPracticeApi.admin.exportBackup();
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sao-luu-bai-hoc-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setNotice('Đã xuất dữ liệu bài học.');
    } catch (err) {
      setError(err.message || 'Không xuất được dữ liệu');
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (!window.confirm('Nhập dữ liệu sẽ cập nhật các buổi/câu hỏi trùng và thêm phần còn thiếu (không xóa dữ liệu hiện có). Tiếp tục?')) return;
    setBackupBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await lessonPracticeApi.admin.importBackup(file);
      const d = res.data || {};
      const skipped = d.skippedSubjects?.length ? ` Bỏ qua môn không tồn tại: ${d.skippedSubjects.join(', ')}.` : '';
      setNotice(`Đã nhập ${d.units || 0} buổi, ${d.items || 0} câu hỏi.${skipped}`);
      const nextId = await loadSubjects(subjectId);
      await loadUnits(nextId);
    } catch (err) {
      setError(err.message || 'Không nhập được dữ liệu');
    } finally {
      setBackupBusy(false);
    }
  }

  async function uploadImage(file) {
    if (!file || !draft) return;
    setDraft((current) => current && ({
      ...current,
      pendingImageName: file.name,
      imageUploadStatus: 'uploading',
    }));
    setSaving(true);
    setError('');
    try {
      const res = await lessonPracticeApi.upload(file);
      setDraft((current) => current && ({
        ...current,
        imageUrl: res.data.url,
        imageName: res.data.originalName || file.name,
        pendingImageName: '',
        imageUploadStatus: 'success',
      }));
    } catch (err) {
      setDraft((current) => current && ({ ...current, imageUploadStatus: 'error' }));
      setError(err.message || 'Không tải được ảnh');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="w-full space-y-4">
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-white p-2">
          <button
            type="button"
            onClick={() => setModuleTab('videos')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${moduleTab === 'videos' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Video khóa học
          </button>
          <button
            type="button"
            onClick={() => setModuleTab('lessons')}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${moduleTab === 'lessons' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Bài học học viên
          </button>
          <button
            type="button"
            onClick={() => setModuleTab('guide')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition ${moduleTab === 'guide' ? 'bg-red-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <CircleHelp size={16} />
            Hướng dẫn học
          </button>
        </div>
        {moduleTab === 'videos' ? (
          <AdminStudentTrainingTab videoCoursesOnly />
        ) : moduleTab === 'guide' ? (
          <AdminStudentTrainingTab learningGuideOnly />
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-black text-slate-900">Bài học</h1>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={exportBackup} disabled={backupBusy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold disabled:opacity-50"><Download size={15} /> Xuất dữ liệu</button>
                <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold ${backupBusy ? 'pointer-events-none opacity-50' : ''}`}>
                  <Upload size={15} /> Nhập dữ liệu
                  <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; importBackup(file); }} />
                </label>
                <button type="button" onClick={() => setSection('build')} className={`rounded-xl px-3 py-2 text-sm font-bold ${section === 'build' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>Soạn bài</button>
                <button type="button" onClick={() => setSection('progress')} className={`rounded-xl px-3 py-2 text-sm font-bold ${section === 'progress' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200'}`}>Tiến độ</button>
              </div>
            </div>
            {loading && <div className="flex items-center gap-2 text-slate-400"><Loader2 className="animate-spin" size={18} /> Đang tải...</div>}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {notice && <p className="text-sm font-semibold text-emerald-700">{notice}</p>}

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
              <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
                <aside className="space-y-2">
                  {courseGroups.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-4 text-xs text-slate-500">
                      Chưa có khóa học đã xuất bản kèm môn để soạn bài.
                    </p>
                  )}
                  {courseGroups.map((course) => {
                    const expanded = expandedCourseId === course.id;
                    return (
                      <div key={course.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => setExpandedCourseId(expanded ? '' : course.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm font-bold ${expanded ? 'border-red-100 bg-red-50 text-red-700' : 'border-slate-100 bg-white text-slate-700'}`}
                        >
                          <span className="min-w-0 truncate">{course.name}</span>
                          {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                        </button>
                        {expanded && (
                          <div className="ml-3 space-y-1 border-l-2 border-slate-100 pl-2">
                            {course.subjects.map((row) => (
                              <button
                                key={`${course.id}-${row.id}`}
                                type="button"
                                onClick={() => setSubjectId(row.id)}
                                className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold ${row.id === subjectId ? 'bg-red-600 text-white' : 'bg-white border border-slate-100 text-slate-700'}`}
                              >
                                {row.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </aside>

                {subject && (
                  <section className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-slate-100 bg-white p-4 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-48 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 font-bold text-slate-800">{subject.name}</div>
                        <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                          Học viên cần hoàn thành các nội dung đã thêm của buổi trước mới mở được buổi tiếp theo.
                        </p>
                      </div>
                    </div>

                    <div
                      style={{ order: Math.max(0, units.findIndex((unit) => unit.id === unitId)) + 1 }}
                      className={`flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 ${isUnitEditing && unitId ? '' : 'hidden'}`}
                    >
                      {isUnitEditing && unitId && (() => {
                        const selectedIndex = units.findIndex((unit) => unit.id === unitId);
                        const unit = units[selectedIndex];
                        if (!unit) return null;
                        return (
                          <div className="space-y-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] items-stretch gap-2">
                              <div className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                                <span className="shrink-0 text-sm font-bold text-slate-500">{selectedIndex + 1}.</span>
                                <input
                                  value={unit.title}
                                  onChange={(event) => setUnits((rows) => rows.map((row) => row.id === unit.id
                                    ? { ...row, title: event.target.value }
                                    : row))}
                                  aria-label={`Tiêu đề buổi ${selectedIndex + 1}`}
                                  className="min-w-0 flex-1 text-sm font-bold text-slate-800 outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => run(async () => {
                                  await lessonPracticeApi.admin.updateUnit(unit.id, { isPreviewAllowed: unit.isPreviewAllowed !== true });
                                  await loadUnits(subject.id);
                                })}
                                className={`rounded-xl px-2 py-2 text-xs font-bold text-white disabled:opacity-60 ${unit.isPreviewAllowed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                              >
                                {unit.isPreviewAllowed ? 'Đang mở' : 'Đang khóa'}
                              </button>
                              <button
                                type="button"
                                aria-label={`Chỉnh sửa ${unit.title}`}
                                title={`Chỉnh sửa ${unit.title}`}
                                onClick={() => toggleUnitEditor(unit.id)}
                                className="inline-flex min-w-10 items-center justify-center rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa ${unit.title}`}
                                title={`Xóa ${unit.title}`}
                                disabled={saving}
                                onClick={() => {
                                  if (!window.confirm(`Xóa ${unit.title}?`)) return;
                                  run(async () => {
                                    await lessonPracticeApi.admin.deleteUnit(unit.id);
                                    setUnitId('');
                                    setIsUnitEditing(false);
                                    await loadUnits(subject.id);
                                  });
                                }}
                                className="inline-flex min-w-10 items-center justify-center rounded-xl px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                      {isUnitEditing && unitId && (
                        <div className="contents">
                          {orderedLessonEntries.map((entry, entryIndex) => {
                            if (entry.startsWith('content:')) {
                              const contentId = entry.slice('content:'.length);
                              const content = lessonContents.find((row) => row.id === contentId);
                              if (!content) return null;
                              const index = lessonContents.findIndex((row) => row.id === contentId);
                              return (
                                <div
                                  key={entry}
                                  data-lesson-entry={entry}
                                  style={{ order: entryIndex }}
                                  {...entryDropProps(entry)}
                                  className={entryCardClass(entry)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        draggable
                                        onDragStart={(event) => entryDragStart(event, entry)}
                                        onDragEnd={() => { setDraggedEntry(''); setDragOverEntry(''); }}
                                        aria-label="Kéo để di chuyển nội dung buổi học"
                                        title="Kéo để sắp xếp"
                                        className="cursor-grab touch-none text-slate-400 active:cursor-grabbing"
                                      >
                                        <GripVertical size={17} />
                                      </button>
                                      <p className="text-sm font-bold text-slate-800">Nội dung bài học</p>
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-slate-50 p-2">
                                    <div className="mb-2 flex gap-2">
                                      <input
                                        value={content.title}
                                        onChange={(event) => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                          ? { ...unit, contents: unit.contents.map((row) => row.id === content.id ? { ...row, title: event.target.value } : row) }
                                          : unit))}
                                        placeholder={`Tiêu đề nội dung ${index + 1}`}
                                        aria-label={`Tiêu đề nội dung ${index + 1}`}
                                        className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                      />
                                      <button type="button" onClick={() => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                        ? {
                                          ...unit,
                                          contents: unit.contents.filter((row) => row.id !== content.id),
                                          contentOrder: unitContentOrder(unit, items).filter((row) => row !== entry),
                                        }
                                        : unit))} aria-label={`Xóa nội dung ${index + 1}`} className="inline-flex items-center justify-center rounded-lg px-2 text-red-600 hover:bg-red-50">
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                    <RichTextEditor
                                      value={content.content}
                                      onChange={(value) => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                        ? { ...unit, contents: unit.contents.map((row) => row.id === content.id ? { ...row, content: value } : row) }
                                        : unit))}
                                      placeholder="Nội dung học viên đọc trong buổi học"
                                    />
                                  </div>
                                </div>
                              );
                            }
                            if (entry.startsWith('video:')) {
                              const videoId = entry.slice('video:'.length);
                              const video = lessonVideos.find((row) => row.id === videoId);
                              if (!video) return null;
                              const index = lessonVideos.findIndex((row) => row.id === videoId);
                              return (
                                <div
                                  key={entry}
                                  data-lesson-entry={entry}
                                  style={{ order: entryIndex }}
                                  {...entryDropProps(entry)}
                                  className={entryCardClass(entry)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        draggable
                                        onDragStart={(event) => entryDragStart(event, entry)}
                                        onDragEnd={() => { setDraggedEntry(''); setDragOverEntry(''); }}
                                        aria-label="Kéo để di chuyển video"
                                        title="Kéo để sắp xếp"
                                        className="cursor-grab touch-none text-slate-400 active:cursor-grabbing"
                                      >
                                        <GripVertical size={17} />
                                      </button>
                                      <p className="text-sm font-bold text-slate-800">Video bài học</p>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)_auto]">
                                    <input
                                      value={video.title}
                                      onChange={(event) => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                        ? { ...unit, videos: unit.videos.map((row) => row.id === video.id ? { ...row, title: event.target.value } : row) }
                                        : unit))}
                                      placeholder={`Tên video ${index + 1}`}
                                      aria-label={`Tên video ${index + 1}`}
                                      className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    />
                                    <input
                                      value={video.url}
                                      onChange={(event) => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                        ? { ...unit, videos: unit.videos.map((row) => row.id === video.id ? { ...row, url: event.target.value } : row) }
                                        : unit))}
                                      placeholder="https://www.youtube.com/watch?v=..."
                                      aria-label={`Đường dẫn video ${index + 1}`}
                                      className="min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                    />
                                    <button type="button" onClick={() => setUnits((rows) => rows.map((unit) => unit.id === unitId
                                      ? {
                                        ...unit,
                                        videos: unit.videos.filter((row) => row.id !== video.id),
                                        contentOrder: unitContentOrder(unit, items).filter((row) => row !== entry),
                                      }
                                      : unit))} aria-label={`Xóa video ${index + 1}`} className="inline-flex items-center justify-center rounded-lg px-2 text-red-600 hover:bg-red-50">
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                                    <input
                                      type="checkbox"
                                      checked={(video.antiSeek ?? selectedUnit?.antiSeek) !== false}
                                      onChange={(event) => setUnits((rows) => rows.map((unit) => (unit.id === unitId
                                        ? { ...unit, videos: unit.videos.map((row) => (row.id === video.id ? { ...row, antiSeek: event.target.checked } : row)) }
                                        : unit)))}
                                    />
                                    Bật chống tua video (học viên phải xem tối thiểu 70%)
                                  </label>
                                </div>
                              );
                            }
                            return null;
                          })}
                        </div>
                      )}
                      {unitId && hasPracticeBlock && (
                        <div
                          data-lesson-entry={practiceEntry}
                          style={{ order: orderedLessonEntries.indexOf(practiceEntry) }}
                          {...entryDropProps(practiceEntry)}
                          className={entryCardClass(practiceEntry)}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-3">
                              <button
                                type="button"
                                draggable
                                onDragStart={(event) => entryDragStart(event, practiceEntry)}
                                onDragEnd={() => { setDraggedEntry(''); setDragOverEntry(''); }}
                                aria-label="Kéo để di chuyển luyện tập bài học"
                                title="Kéo để sắp xếp"
                                className="cursor-grab touch-none text-slate-400 active:cursor-grabbing"
                              >
                                <GripVertical size={17} />
                              </button>
                              <h2 className="text-sm font-black text-slate-900">Luyện tập bài học · {practiceItems.length} câu</h2>
                            </div>
                            {!draft && (
                              <button
                                type="button"
                                onClick={() => setDraft(blankItem())}
                                className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-700"
                              >
                                Thêm câu luyện tập
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {practiceItems.map((item, index) => (
                              <div key={item.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs">
                                <span className="font-bold text-slate-400">{index + 1}.</span>
                                <span className="min-w-0 flex-1 truncate">{TYPES.find((type) => type.id === item.type)?.label}: {item.prompt || item.caption || 'Ảnh'}</span>
                                {Number(item.timeLimitSec) > 0 && <span className="shrink-0 font-bold text-slate-500">{item.timeLimitSec}s</span>}
                                <button
                                  type="button"
                                  className="font-bold text-slate-700"
                                  onClick={() => setDraft({ ...blankItem(), ...item, videoId: '', options: item.options?.length ? item.options : blankItem().options, pairs: item.pairs?.length ? item.pairs : blankItem().pairs, correctOptionIds: item.correctOptionIds || [], region: item.region || null })}
                                >
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  className="font-bold text-red-600"
                                  onClick={() => {
                                    setItems((rows) => rows.filter((row) => row.id !== item.id));
                                    if (!String(item.id).startsWith('pending-')) {
                                      setDeletedItemIds((rows) => rows.includes(item.id) ? rows : [...rows, item.id]);
                                    }
                                    if (items.length === 1) {
                                      setUnits((rows) => rows.map((unit) => unit.id === unitId
                                        ? { ...unit, contentOrder: unitContentOrder(unit, items).filter((row) => row !== practiceEntry) }
                                        : unit));
                                    }
                                    if (draft?.id === item.id) setDraft(null);
                                  }}
                                >
                                  Xóa
                                </button>
                              </div>
                            ))}
                            {practiceItems.length === 0 && !draft && (
                              <p className="rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500">Chưa có câu luyện tập. Thêm câu để hoàn tất phần này.</p>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-2.5 py-2">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-800">
                              <Clock size={14} /> Thời gian chung
                            </span>
                            <input
                              type="number"
                              min="0"
                              max="3600"
                              value={units.find((unit) => unit.id === unitId)?.timeLimitSec ?? 0}
                              onChange={(e) => setUnits((rows) => rows.map((unit) => (unit.id === unitId ? { ...unit, timeLimitSec: e.target.value } : unit)))}
                              aria-label="Thời gian chung cho mỗi câu tính bằng giây"
                              className="w-16 rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-bold"
                            />
                            <span className="text-[11px] text-red-700">giây · 0 = tắt</span>
                            {[30, 60, 90, 120].map((sec) => (
                              <button
                                key={sec}
                                type="button"
                                className="rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-bold text-red-700"
                                onClick={() => setUnits((rows) => rows.map((unit) => (unit.id === unitId ? { ...unit, timeLimitSec: sec } : unit)))}
                              >
                                {sec}s
                              </button>
                            ))}

                          </div>
                          {draft && (
                            <form className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5" onSubmit={(event) => {
                              event.preventDefault();
                              const addAnother = event.nativeEvent.submitter?.dataset?.next === '1';
                              const entryId = draft.id || `pending-${newContentId()}`;
                              const staged = { ...draft, id: entryId };
                              setItems((rows) => rows.some((row) => row.id === entryId)
                                ? rows.map((row) => row.id === entryId ? staged : row)
                                : [...rows, staged]);
                              if (!draft.id) {
                                setUnits((rows) => rows.map((unit) => unit.id === unitId
                                  ? { ...unit, contentOrder: [...unitContentOrder(unit, items), `quiz:${entryId}`] }
                                  : unit));
                              }
                              if (addAnother) {
                                setDraft(blankItem());
                              } else {
                                setDraft(null);
                              }
                            }}>
                              <div className="flex flex-wrap gap-1">
                                {TYPES.map((type) => (
                                  <button key={type.id} type="button" onClick={() => setDraft((current) => ({ ...current, type: type.id }))} className={`rounded-lg px-2 py-1 text-[11px] font-bold ${draft.type === type.id ? 'bg-red-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{type.label}</button>
                                ))}
                              </div>
                              <textarea value={draft.prompt} onChange={(e) => setDraft({ ...draft, prompt: e.target.value })} rows={2} placeholder="Nội dung câu hỏi" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm" />
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                  Thời gian riêng (giây)
                                  <input
                                    type="number"
                                    min="0"
                                    max="3600"
                                    value={draft.timeLimitSec ?? 0}
                                    onChange={(e) => setDraft({ ...draft, timeLimitSec: e.target.value })}
                                    className="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                                  />
                                </label>
                                <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-500">
                                  <span>Ảnh</span>
                                  <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700">Choose File</span>
                                  <span className="max-w-64 truncate font-normal text-slate-600" title={draft.imageName || draft.pendingImageName || ''}>
                                    {draft.imageUploadStatus === 'uploading'
                                      ? `Đang tải: ${draft.pendingImageName}`
                                      : draft.imageUploadStatus === 'error'
                                        ? `Tải lên thất bại: ${draft.pendingImageName}`
                                        : draft.imageName || 'No file chosen'}
                                  </span>
                                  <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadImage(file); }} />
                                </label>
                              </div>
                              {draft.type === 'hotspot' && (
                                <RegionDraw imageUrl={draft.imageUrl} region={draft.region} onChange={(region) => setDraft({ ...draft, region })} />
                              )}
                              {(draft.type === 'mcq' || draft.type === 'multi' || draft.type === 'drag') && (
                                <div className="space-y-1.5">
                                  {draft.type === 'drag' && <p className="text-xs text-slate-500">Xếp đúng thứ tự từ trên xuống. Học viên sẽ kéo thả để sắp lại.</p>}
                                  {draft.type === 'multi' && <p className="text-xs text-slate-500">Tick các đáp án đúng. Học viên được chọn nhiều đáp án.</p>}
                                  {draft.options.map((opt, index) => (
                                    <div key={opt.id} className="flex items-center gap-1.5">
                                      {draft.type === 'mcq' && (
                                        <input type="radio" name="correct" checked={draft.correctOptionId === opt.id} onChange={() => setDraft({ ...draft, correctOptionId: opt.id })} />
                                      )}
                                      {draft.type === 'multi' && (
                                        <input type="checkbox" checked={(draft.correctOptionIds || []).includes(opt.id)} onChange={() => {
                                          const picked = new Set(draft.correctOptionIds || []);
                                          if (picked.has(opt.id)) picked.delete(opt.id);
                                          else picked.add(opt.id);
                                          setDraft({ ...draft, correctOptionIds: [...picked] });
                                        }} />
                                      )}
                                      <input value={opt.text} onChange={(e) => {
                                        const options = draft.options.map((row) => (row.id === opt.id ? { ...row, text: e.target.value } : row));
                                        setDraft({ ...draft, options });
                                      }} placeholder={draft.type === 'drag' ? `Thứ tự ${index + 1}` : `Đáp án ${index + 1}`} className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                                    </div>
                                  ))}
                                  <div className="flex gap-3">
                                    {draft.options.length < 6 && (
                                      <button type="button" className="text-xs font-bold text-slate-600" onClick={() => setDraft({ ...draft, options: [...draft.options, newOption()] })}>Thêm đáp án</button>
                                    )}
                                    {draft.options.length > 2 && (
                                      <button type="button" className="text-xs font-bold text-slate-600" onClick={() => {
                                        const options = draft.options.slice(0, -1);
                                        const correctOptionId = options.some((opt) => opt.id === draft.correctOptionId) ? draft.correctOptionId : options[0].id;
                                        const correctOptionIds = (draft.correctOptionIds || []).filter((id) => options.some((opt) => opt.id === id));
                                        setDraft({ ...draft, options, correctOptionId, correctOptionIds });
                                      }}>Bớt đáp án</button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {draft.type === 'match' && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-slate-500">Mỗi dòng là một cặp đúng. Học viên sẽ ghép cột trái với cột phải.</p>
                                  {draft.pairs.map((pair, index) => (
                                    <div key={pair.id} className="grid gap-1.5 sm:grid-cols-2">
                                      <input value={pair.left} onChange={(e) => {
                                        const pairs = draft.pairs.map((row) => (row.id === pair.id ? { ...row, left: e.target.value } : row));
                                        setDraft({ ...draft, pairs });
                                      }} placeholder={`Vế trái ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                                      <input value={pair.right} onChange={(e) => {
                                        const pairs = draft.pairs.map((row) => (row.id === pair.id ? { ...row, right: e.target.value } : row));
                                        setDraft({ ...draft, pairs });
                                      }} placeholder={`Vế phải ${index + 1}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                                    </div>
                                  ))}
                                  <div className="flex gap-3">
                                    {draft.pairs.length < 6 && (
                                      <button type="button" className="text-xs font-bold text-slate-600" onClick={() => setDraft({ ...draft, pairs: [...draft.pairs, newPair()] })}>Thêm cặp</button>
                                    )}
                                    {draft.pairs.length > 2 && (
                                      <button type="button" className="text-xs font-bold text-slate-600" onClick={() => setDraft({ ...draft, pairs: draft.pairs.slice(0, -1) })}>Bớt cặp</button>
                                    )}
                                  </div>
                                </div>
                              )}
                              {draft.type === 'written' && (
                                <>
                                  <p className="text-xs text-slate-500">AI đối chiếu câu hỏi với bài học viên. Đúng trên 70% thì qua, dưới 70% phải trả lời lại.</p>
                                  <textarea value={draft.rubric} onChange={(e) => setDraft({ ...draft, rubric: e.target.value })} rows={1} placeholder="Barem: ý nào được tính là đúng" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                                  <textarea value={draft.modelAnswer} onChange={(e) => setDraft({ ...draft, modelAnswer: e.target.value })} rows={1} placeholder="Đáp án mẫu để AI đối chiếu" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                                </>
                              )}
                              <textarea value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} rows={1} placeholder="Lời giải (hiện sau khi học viên xác nhận)" className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm" />
                              <div className="flex flex-wrap gap-1.5">
                                {draft.id ? (
                                  <button type="submit" disabled={saving} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">Cập nhật câu</button>
                                ) : (
                                  <button
                                    type="submit"
                                    data-next="1"
                                    disabled={saving}
                                    aria-label="Thêm câu và tạo câu tiếp theo"
                                    title="Thêm câu và tạo câu tiếp theo"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white disabled:opacity-60"
                                  >
                                    <Plus size={17} />
                                  </button>
                                )}
                                <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold" onClick={() => {
                                  if (items.length === 0) {
                                    setUnits((rows) => rows.map((unit) => unit.id === unitId
                                      ? { ...unit, contentOrder: unitContentOrder(unit, items).filter((entry) => entry !== practiceEntry) }
                                      : unit));
                                  }
                                  setDraft(null);
                                }}>Đóng</button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                      {isUnitEditing && unitId && (
                        <>
                          <div
                            style={{ order: orderedLessonEntries.length + 1 }}
                            className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4"
                          >
                            <div className="relative min-w-0">
                              <button
                                type="button"
                                onClick={() => setShowAddContentMenu((open) => !open)}
                                aria-expanded={showAddContentMenu}
                                className="inline-flex min-h-9 min-w-36 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"
                              >
                                <Plus size={16} /> Thêm nội dung
                              </button>
                              {showAddContentMenu && (
                                <div className="absolute bottom-full left-0 z-20 mb-2 grid min-w-52 gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                                  <button type="button" onClick={() => {
                                    const id = newContentId();
                                    setUnits((rows) => rows.map((unit) => unit.id === unitId
                                      ? {
                                        ...unit,
                                        contents: [...(unit.contents || []), { id, title: '', content: '' }],
                                        contentOrder: [...unitContentOrder(unit, items), `content:${id}`],
                                      }
                                      : unit));
                                    setShowAddContentMenu(false);
                                  }} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    Nội dung bài học
                                  </button>
                                  <button type="button" onClick={() => {
                                    const id = newContentId();
                                    setUnits((rows) => rows.map((unit) => unit.id === unitId
                                      ? {
                                        ...unit,
                                        videos: [...(unit.videos || []), { id, title: '', url: '' }],
                                        contentOrder: [...unitContentOrder(unit, items), `video:${id}`],
                                      }
                                      : unit));
                                    setShowAddContentMenu(false);
                                  }} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    Video bài học
                                  </button>
                                  <button type="button" onClick={() => {
                                    setUnits((rows) => rows.map((unit) => unit.id === unitId
                                      ? { ...unit, contentOrder: [...unitContentOrder(unit, items), practiceEntry] }
                                      : unit));
                                    setDraft((current) => current || blankItem());
                                    setShowAddContentMenu(false);
                                  }} className="rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-700 hover:bg-slate-50">
                                    Luyện tập bài học
                                  </button>
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={!lessonContentReady || saving}
                              className="min-h-9 min-w-36 rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 enabled:hover:bg-red-700"
                              onClick={() => run(saveAllUnitContent)}
                            >
                              Hoàn tất
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {units.length > 0 && (!isUnitEditing || units.some((unit) => unit.id !== unitId)) && (
                      <div className="contents">
                        {units.map((unit, index) => isUnitEditing && unit.id === unitId ? null : (
                          <div key={unit.id} style={{ order: index + 1 }} className="rounded-2xl border border-slate-100 bg-white p-2">
                            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto_auto] items-stretch gap-2">
                              <button
                                type="button"
                                onClick={() => { setUnitId(unit.id); setIsUnitEditing(false); }}
                                className={`min-w-0 rounded-xl px-3 py-2 text-left text-sm font-bold ${unit.id === unitId ? 'bg-slate-900 text-white' : 'bg-slate-50'}`}
                              >
                                {index + 1}. {unit.title}
                              </button>
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => run(async () => {
                                  await lessonPracticeApi.admin.updateUnit(unit.id, { isPreviewAllowed: unit.isPreviewAllowed !== true });
                                  await loadUnits(subject.id);
                                })}
                                className={`rounded-xl px-2 py-2 text-xs font-bold text-white disabled:opacity-60 ${unit.isPreviewAllowed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-700 hover:bg-slate-800'}`}
                              >
                                {unit.isPreviewAllowed ? 'Đang mở' : 'Đang khóa'}
                              </button>
                              <button
                                type="button"
                                aria-label={`Chỉnh sửa ${unit.title}`}
                                title={`Chỉnh sửa ${unit.title}`}
                                onClick={() => toggleUnitEditor(unit.id)}
                                className="inline-flex min-w-10 items-center justify-center rounded-xl px-3 py-2 text-slate-600 hover:bg-slate-100"
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                aria-label={`Xóa ${unit.title}`}
                                title={`Xóa ${unit.title}`}
                                disabled={saving}
                                onClick={() => {
                                  if (!window.confirm(`Xóa ${unit.title}?`)) return;
                                  run(async () => {
                                    await lessonPracticeApi.admin.deleteUnit(unit.id);
                                    if (unitId === unit.id) setUnitId('');
                                    if (unitId === unit.id) setIsUnitEditing(false);
                                    await loadUnits(subject.id);
                                  });
                                }}
                                className="inline-flex min-w-10 items-center justify-center rounded-xl px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ order: units.length + 1 }} className="flex gap-2 rounded-2xl border border-slate-100 bg-white p-4">
                      <input
                        value={unitTitle}
                        onChange={(event) => setUnitTitle(event.target.value)}
                        placeholder="Tên bài, ví dụ Bài 1"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
                        onClick={() => run(async () => {
                          const title = unitTitle.trim();
                          if (!title) throw new Error('Nhập tên buổi');
                          const created = await lessonPracticeApi.admin.createUnit(subject.id, { title });
                          setUnitTitle('');
                          await loadUnits(subject.id);
                          setUnitId(created.data.id);
                          setIsUnitEditing(true);
                        })}
                      >
                        Thêm bài
                      </button>
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
