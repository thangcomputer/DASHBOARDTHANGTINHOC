import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CircleHelp,
  Clapperboard,
  Clock,
  Download,
  Gamepad2,
  Loader2,
  NotebookPen,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import lessonPracticeApi from '../../../services/lessonPracticeApi';
import { resolveMediaUrl } from '../../../services/api';
import RichTextEditor from '../shared/RichTextEditor';
import AdminStudentTrainingTab from './AdminStudentTrainingTab';
import { cmsConfirmAction } from '../../../utils/cmsDialog';
import { useToast } from '../../../utils/useToast';
import { TOPIC_COLORS, TOPIC_ICONS, topicColor, topicIcon } from '../../../utils/dailyPractice';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';

const TYPES = [
  { id: 'mcq', label: 'Trắc nghiệm 1 đáp án' },
  { id: 'multi', label: 'Chọn nhiều đáp án' },
  { id: 'match', label: 'Ghép đáp án' },
  { id: 'drag', label: 'Kéo thả thứ tự' },
  { id: 'written', label: 'Tự ghi AI chấm' },
  { id: 'hotspot', label: 'Chọn vùng ảnh' },
];

function newOption() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `opt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, text: '' };
}

function newPair() {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pair-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id, left: '', right: '' };
}

function newContentId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `content-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatCheckpointLabel(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function resolveAdminItemVideoKey(item, videos = []) {
  const list = Array.isArray(videos) ? videos : [];
  const raw = String(item?.videoId || '').trim();
  if (!list.length || raw === 'none') return 'none';
  if (raw && list.some((v) => String(v.id) === raw)) return raw;
  return String(list[0].id);
}

function blankItem(practiceGroupId = '', videoId = '') {
  const options = [newOption(), newOption(), newOption(), newOption()];
  return {
    type: 'mcq',
    practiceGroupId,
    videoId,
    prompt: '',
    imageUrl: '',
    imageName: '',
    caption: '',
    hint: '',
    explanation: '',
    rubric: '',
    modelAnswer: '',
    correctOptionId: options[0].id,
    correctOptionIds: [],
    options,
    pairs: [newPair(), newPair()],
    region: null,
    timeLimitSec: 0,
    checkpointSec: 0,
  };
}

function draftHasContent(item) {
  if (!item) return false;
  return Boolean(
    item.id
    || String(item.prompt || '').trim()
    || String(item.imageUrl || '').trim()
    || String(item.caption || '').trim()
    || String(item.hint || '').trim()
    || String(item.explanation || '').trim()
    || String(item.rubric || '').trim()
    || String(item.modelAnswer || '').trim()
    || item.options?.some((option) => String(option.text || '').trim())
    || item.pairs?.some((pair) => String(pair.left || '').trim() || String(pair.right || '').trim())
    || item.region,
  );
}

function normalizeUnitContents(unit) {
  return {
    ...unit,
    videos: unit.videos?.length
      ? unit.videos
      : (unit.videoUrl ? [{ id: 'legacy-video', title: 'Video 1', url: unit.videoUrl, antiSeek: unit.antiSeek === true }] : []),
    contents: unit.contents?.length
      ? unit.contents
      : (unit.note ? [{ id: 'legacy-note', title: 'Nội dung 1', content: unit.note }] : []),
  };
}

function unitContentOrder(unit, items) {
  const contents = unit?.contents || [];
  const videos = unit?.videos || [];
  const practiceGroupIds = new Set((items || []).map((item) => String(item.practiceGroupId || unit?.id || '')).filter(Boolean));
  const practiceEntry = unit?.id ? `practice:${unit.id}` : '';
  (unit?.contentOrder || []).forEach((entry) => {
    const value = String(entry);
    if (value.startsWith('practice:')) practiceGroupIds.add(value.slice('practice:'.length));
    else if (value.startsWith('quiz:') && unit?.id) practiceGroupIds.add(unit.id);
  });
  const available = new Set([
    ...videos.map((item) => `video:${item.id}`),
    ...[...practiceGroupIds].map((id) => `practice:${id}`),
    ...contents.map((item) => `content:${item.id}`),
  ]);
  const result = [];
  const seen = new Set();
  [
    ...(unit?.contentOrder || []),
    ...videos.map((item) => `video:${item.id}`),
    ...[...practiceGroupIds].map((id) => `practice:${id}`),
    ...contents.map((item) => `content:${item.id}`),
  ].forEach((entry) => {
    const value = String(entry);
    const normalizedEntry = value.startsWith('quiz:') ? practiceEntry : value;
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
      <img src={resolveMediaUrl(imageUrl)} alt="" className="pointer-events-none block max-h-80 w-full object-contain" />
      {region && (
        <span
          className="pointer-events-none absolute border-2 border-emerald-500 bg-emerald-400/20"
          style={{ left: `${region.x}%`, top: `${region.y}%`, width: `${region.w}%`, height: `${region.h}%` }}
        />
      )}
    </div>
  );
}

function SubjectModal({ subject, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: subject?.name || '',
    summary: subject?.summary || '',
    icon: subject?.icon || 'book',
    color: subject?.color || 'green',
    sortOrder: subject?.sortOrder ?? 0,
    isActive: subject?.isActive !== false,
  }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = subject?.examSubjectId
        ? {
            summary: form.summary,
            icon: form.icon,
            color: form.color,
            sortOrder: form.sortOrder,
            isActive: form.isActive,
          }
        : form;
      const res = subject?.id
        ? await lessonPracticeApi.admin.updateSubject(subject.id, payload)
        : await lessonPracticeApi.admin.createSubject({ ...form, createDefaultUnit: true });
      toast.success(subject?.id ? 'Đã cập nhật môn học' : 'Đã thêm môn học mới');
      onSaved(res.data);
    } catch (err) {
      toast.error(err.message || 'Không lưu được môn học');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9300] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-base font-black text-slate-900">{subject?.id ? 'Sửa môn học' : 'Thêm môn học'}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <div>
            <label className={LABEL} htmlFor="lp-subj-name">Tên môn học</label>
            <input
              id="lp-subj-name"
              className={`${INPUT} ${subject?.examSubjectId ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : ''}`}
              value={form.name}
              maxLength={80}
              disabled={Boolean(subject?.examSubjectId)}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Ví dụ: Microsoft Excel"
            />
            {subject?.examSubjectId && (
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                Tên môn tự động đồng bộ từ Quản lý Khóa học
              </p>
            )}
          </div>
          <div>
            <label className={LABEL} htmlFor="lp-subj-desc">Mô tả ngắn</label>
            <input
              id="lp-subj-desc"
              className={INPUT}
              value={form.summary}
              maxLength={240}
              onChange={(e) => set({ summary: e.target.value })}
              placeholder="Bảng tính, công thức, hàm và biểu đồ"
            />
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
                  className={`flex h-10 items-center justify-center rounded-xl border-2 ${form.icon === key ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-200 text-slate-500'}`}
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={LABEL}>Màu hiển thị</span>
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
              <label className={LABEL} htmlFor="lp-subj-order">Thứ tự hiển thị</label>
              <input
                id="lp-subj-order"
                type="number"
                className={INPUT}
                value={form.sortOrder}
                onChange={(e) => set({ sortOrder: Number(e.target.value) })}
              />
            </div>
            <label className="mt-6 flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set({ isActive: e.target.checked })}
                className="h-4 w-4 accent-emerald-600"
              />
              Hiển thị cho học viên TT
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onClose} className="cms-btn cms-btn-outline">Hủy</button>
          <button type="button" onClick={save} disabled={saving || !form.name.trim()} className="cms-btn cms-btn-primary">
            {saving && <Loader2 size={16} className="animate-spin" />} Lưu môn học
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function statusLabel(row) {
  if (row.status === 'completed') return 'Đã hoàn thành môn';
  if (row.currentUnitTitle) return `Đang xem: ${row.currentUnitTitle}`;
  return 'Đang học';
}

export default function AdminLessonPracticeTab() {
  const toast = useToast();
  const [moduleTab, setModuleTab] = useState('lessons'); // lessons | progress | guide
  const [subjects, setSubjects] = useState([]);
  const [subjectId, setSubjectId] = useState('');
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState('');
  const [editingUnitId, setEditingUnitId] = useState('');
  const [editorSubTab, setEditorSubTab] = useState('video'); // video | practice | content
  const [practiceVideoFilter, setPracticeVideoFilter] = useState('all'); // 'all' | 'none' | videoId
  const [items, setItems] = useState([]);
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [draft, setDraft] = useState(null);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [creatingUnit, setCreatingUnit] = useState(false);
  const [subjectModal, setSubjectModal] = useState(null);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [syncingSubjects, setSyncingSubjects] = useState(false);

  const subject = subjects.find((row) => row.id === subjectId) || null;
  const editingUnit = units.find((row) => row.id === editingUnitId) || null;

  const loadSubjects = useCallback(async (preferId = '') => {
    const res = await lessonPracticeApi.admin.subjects();
    const rows = res.data || [];
    setSubjects(rows);
    setSubjectId((current) => {
      if (preferId && rows.some((r) => r.id === preferId)) return preferId;
      if (current && rows.some((r) => r.id === current)) return current;
      return rows[0]?.id || '';
    });
    return rows;
  }, []);

  const loadUnits = useCallback(async (id) => {
    if (!id) {
      setUnits([]);
      setUnitId('');
      setEditingUnitId('');
      return [];
    }
    const res = await lessonPracticeApi.admin.units(id);
    const rows = (res.data || []).map(normalizeUnitContents);
    setUnits(rows);
    setUnitId((current) => (rows.some((r) => r.id === current) ? current : (rows[0]?.id || '')));
    return rows;
  }, []);

  const loadItems = useCallback(async (id) => {
    if (!id) {
      setItems([]);
      return [];
    }
    const res = await lessonPracticeApi.admin.items(id);
    const rows = res.data || [];
    setItems(rows);
    return rows;
  }, []);

  useEffect(() => {
    let alive = true;
    loadSubjects()
      .catch((err) => { if (alive) toast.error(err.message || 'Không tải được danh sách môn học'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [loadSubjects, toast]);

  useEffect(() => {
    if (!subjectId) {
      setUnits([]);
      setUnitId('');
      setEditingUnitId('');
      setItems([]);
      return;
    }
    setEditingUnitId('');
    setDraft(null);
    setDeletedItemIds([]);
    loadUnits(subjectId).catch((err) => toast.error(err.message || 'Không tải được bài học'));
  }, [subjectId, loadUnits, toast]);

  useEffect(() => {
    setDeletedItemIds([]);
    setDraft(null);
    const targetId = editingUnitId || unitId;
    if (!targetId) {
      setItems([]);
      return;
    }
    loadItems(targetId).catch((err) => toast.error(err.message || 'Không tải được câu hỏi luyện tập'));
  }, [editingUnitId, unitId, loadItems, toast]);

  useEffect(() => {
    if (moduleTab !== 'progress') return undefined;
    lessonPracticeApi.admin.progress(subjectId)
      .then((res) => setProgress(res.data || []))
      .catch((err) => toast.error(err.message || 'Không tải được tiến độ'));
    return undefined;
  }, [moduleTab, subjectId, toast]);

  const primaryPracticeGroupId = items[0]?.practiceGroupId || editingUnitId || unitId || '';

  function openUnitEditor(targetUnit) {
    if (editingUnitId === targetUnit.id) {
      setEditingUnitId('');
      setDraft(null);
      return;
    }
    setUnitId(targetUnit.id);
    setEditingUnitId(targetUnit.id);
    setDraft(null);
    setEditorSubTab('video');
  }

  async function handleSyncSubjects() {
    setSyncingSubjects(true);
    try {
      await loadSubjects(subjectId);
      toast.success('Đã đồng bộ môn từ Quản lý Khóa học');
    } catch (err) {
      toast.error(err.message || 'Không đồng bộ được môn học');
    } finally {
      setSyncingSubjects(false);
    }
  }

  async function handleCreateUnit(e) {
    e.preventDefault();
    const title = newUnitTitle.trim();
    if (!title || !subjectId) return;
    setCreatingUnit(true);
    try {
      const res = await lessonPracticeApi.admin.createUnit(subjectId, { title });
      const created = normalizeUnitContents(res.data);
      setNewUnitTitle('');
      await Promise.all([loadUnits(subjectId), loadSubjects(subjectId)]);
      setUnitId(created.id);
      setEditingUnitId(created.id);
      setEditorSubTab('video');
      toast.success('Đã thêm bài học mới');
    } catch (err) {
      toast.error(err.message || 'Không tạo được bài học');
    } finally {
      setCreatingUnit(false);
    }
  }

  async function handleMoveUnit(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= units.length || !subjectId) return;
    const ids = units.map((u) => u.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      const res = await lessonPracticeApi.admin.reorderUnits(subjectId, ids);
      setUnits((res.data || []).map(normalizeUnitContents));
    } catch (err) {
      toast.error(err.message || 'Không đổi được thứ tự');
    }
  }

  async function handleDeleteUnit(unit) {
    if (!(await cmsConfirmAction(`Xóa bài "${unit.title}" và toàn bộ video, nội dung, câu hỏi trong đó?`))) return;
    try {
      await lessonPracticeApi.admin.deleteUnit(unit.id);
      if (editingUnitId === unit.id) {
        setEditingUnitId('');
        setDraft(null);
      }
      await Promise.all([loadUnits(subjectId), loadSubjects(subjectId)]);
      toast.success('Đã xóa bài học');
    } catch (err) {
      toast.error(err.message || 'Không xóa được bài học');
    }
  }

  async function saveEditingUnit() {
    if (!editingUnit) return;
    const title = String(editingUnit.title || '').trim();
    if (!title) {
      toast.error('Tên bài học không được để trống');
      return;
    }

    setSaving(true);
    try {
      let workingItems = items;
      if (draftHasContent(draft)) {
        const entryId = draft.id || `pending-${newContentId()}`;
        const stagedDraft = { ...draft, id: entryId, practiceGroupId: draft.practiceGroupId || primaryPracticeGroupId };
        workingItems = items.some((row) => row.id === entryId)
          ? items.map((row) => (row.id === entryId ? stagedDraft : row))
          : [...items, stagedDraft];
      }

      await lessonPracticeApi.admin.updateUnit(editingUnit.id, {
        title,
        videos: editingUnit.videos || [],
        contents: editingUnit.contents || [],
        antiSeek: editingUnit.antiSeek === true,
        isPreviewAllowed: true,
        timeLimitSec: editingUnit.timeLimitSec || 0,
        practiceTimeLimits: editingUnit.practiceTimeLimits || [],
      });

      for (const delId of deletedItemIds) {
        await lessonPracticeApi.admin.deleteItem(delId);
      }

      const savedItems = [];
      for (const item of workingItems) {
        const body = {
          ...item,
          videoId: item.videoId || '',
          checkpointSec: Number(item.checkpointSec) || 0,
          practiceGroupId: item.practiceGroupId || editingUnit.id,
        };
        if (String(item.id).startsWith('pending-')) {
          const created = await lessonPracticeApi.admin.createItem(editingUnit.id, body);
          if (!created.data?.id) throw new Error('Không nhận được mã câu hỏi sau khi lưu');
          savedItems.push({ ...body, id: created.data.id });
        } else {
          await lessonPracticeApi.admin.updateItem(item.id, body);
          savedItems.push(body);
        }
      }

      const contentOrder = unitContentOrder(editingUnit, savedItems);
      await lessonPracticeApi.admin.updateUnit(editingUnit.id, { contentOrder });

      setDeletedItemIds([]);
      setDraft(null);
      await Promise.all([loadUnits(subjectId), loadItems(editingUnit.id), loadSubjects(subjectId)]);
      toast.success('Đã lưu bài học');
    } catch (err) {
      toast.error(err.message || 'Không lưu được bài học');
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file) {
    if (!file || !draft) return;
    setDraft((current) => current && ({ ...current, pendingImageName: file.name, imageUploadStatus: 'uploading' }));
    setSaving(true);
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
      toast.error(err.message || 'Không tải được ảnh');
    } finally {
      setSaving(false);
    }
  }

  async function exportBackup() {
    setBackupBusy(true);
    try {
      const res = await lessonPracticeApi.admin.exportBackup('');
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `luyen-tap-tu-do-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Đã xuất dữ liệu Luyện tập tự do.');
    } catch (err) {
      toast.error(err.message || 'Không xuất được dữ liệu');
    } finally {
      setBackupBusy(false);
    }
  }

  async function importBackup(file) {
    if (!file) return;
    if (!(await cmsConfirmAction('Nhập dữ liệu JSON sẽ cập nhật bài học/video/câu hỏi trùng và bổ sung phần còn thiếu. Tiếp tục?'))) return;
    setBackupBusy(true);
    try {
      const res = await lessonPracticeApi.admin.importBackup(file, '');
      const d = res.data || {};
      toast.success(`Đã nhập ${d.units || 0} bài học, ${d.items || 0} câu hỏi.`);
      await loadSubjects();
      if (subjectId) await loadUnits(subjectId);
    } catch (err) {
      toast.error(err.message || 'Không nhập được dữ liệu');
    } finally {
      setBackupBusy(false);
    }
  }

  function updateEditingUnit(updater) {
    if (!editingUnitId) return;
    setUnits((rows) => rows.map((u) => (u.id === editingUnitId ? updater(u) : u)));
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setModuleTab('lessons')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${moduleTab === 'lessons' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <BookOpen size={15} /> Luyện tập tự do
          </button>
          <button
            type="button"
            onClick={() => setModuleTab('progress')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${moduleTab === 'progress' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Gamepad2 size={15} /> Tiến độ HV TT
          </button>
          <button
            type="button"
            onClick={() => setModuleTab('guide')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${moduleTab === 'guide' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <CircleHelp size={15} /> Hướng dẫn học
          </button>
        </div>

        {moduleTab === 'lessons' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleSyncSubjects} disabled={syncingSubjects} className="cms-btn cms-btn-outline !py-2 text-xs">
              <RefreshCw size={14} className={syncingSubjects ? 'animate-spin' : ''} /> Đồng bộ môn
            </button>
            <button type="button" onClick={exportBackup} disabled={backupBusy} className="cms-btn cms-btn-outline !py-2 text-xs">
              <Download size={14} /> Xuất JSON
            </button>
            <label className={`cms-btn cms-btn-outline !py-2 cursor-pointer text-xs ${backupBusy ? 'pointer-events-none opacity-50' : ''}`}>
              <Upload size={14} /> Nhập JSON
              <input type="file" accept="application/json,.json" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; importBackup(file); }} />
            </label>
          </div>
        )}
      </div>

      {moduleTab === 'guide' ? (
        <AdminStudentTrainingTab learningGuideOnly />
      ) : moduleTab === 'progress' ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Học viên TT</th>
                <th className="px-4 py-3">Môn</th>
                <th className="px-4 py-3">Bài đã hoàn thành</th>
                <th className="px-4 py-3">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {progress.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-slate-500">Chưa có học viên nào vào luyện tập tự do.</td></tr>
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
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Đang tải…</p>
      ) : !subjects.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-bold text-slate-700">Chưa có môn học nào được tạo trong Quản lý Khóa học.</p>
          <p className="mt-1 text-sm text-slate-500">Vào Cài đặt hệ thống → Học phí Khóa học để thêm môn cho khóa học; môn sẽ tự động hiển thị tại đây.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-2">
            {subjects.map((s) => {
              const Icon = topicIcon(s.icon);
              const color = topicColor(s.color);
              const active = s.id === subjectId;
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSubjectId(s.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSubjectId(s.id); }}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 bg-white p-3 transition ${active ? 'border-emerald-500 shadow-sm' : 'border-slate-100 hover:border-slate-200'} ${s.isActive ? '' : 'opacity-60'}`}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                    style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
                  >
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-slate-900">
                      {s.name}
                      {!s.isActive && <span className="ml-1 text-[10px] font-bold text-slate-400">(ẩn)</span>}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {s.unitCount || 0} bài · {s.videoCount || 0} video · {s.contentCount || 0} nội dung · {s.questionCount || 0} câu
                    </p>
                    <p className={`mt-0.5 truncate text-[10.5px] font-semibold ${s.courses?.length ? 'text-emerald-700' : 'text-amber-600'}`}>
                      {s.courses?.length ? `Khóa: ${s.courses.map((c) => c.name).join(', ')}` : 'Chưa gắn vào khóa học nào'}
                    </p>
                  </div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); setSubjectModal(s); }} aria-label="Sửa môn" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 !shadow-none"><Pencil size={14} /></button>
                </div>
              );
            })}
          </aside>

          {subject && (
            <section className="space-y-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  {(() => {
                    const Icon = topicIcon(subject.icon);
                    const color = topicColor(subject.color);
                    return (
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
                        style={{ background: `linear-gradient(180deg, ${color.from}, ${color.to})` }}
                      >
                        <Icon size={20} />
                      </span>
                    );
                  })()}
                  <div>
                    <h3 className="text-base font-black text-slate-900">{subject.name}</h3>
                    {subject.summary && <p className="text-xs text-slate-500">{subject.summary}</p>}
                    {subject.courses?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {subject.courses.map((c) => (
                          <span key={c.id} className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10.5px] font-bold text-slate-700">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                  Gắn theo môn trong Khóa học
                </span>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-slate-800">Danh sách bài học trong môn</p>
                    <p className="text-[11px] text-slate-500">
                      Học viên TT đăng ký khóa có môn này sẽ thấy môn trong phần Luyện tập tự do (Web & Mobile).
                    </p>
                  </div>
                  <form onSubmit={handleCreateUnit} className="flex items-center gap-2">
                    <input
                      value={newUnitTitle}
                      onChange={(e) => setNewUnitTitle(e.target.value)}
                      placeholder="Tên bài mới..."
                      className="w-44 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs outline-none focus:border-emerald-400 sm:w-56"
                    />
                    <button type="submit" disabled={creatingUnit || !newUnitTitle.trim()} className="cms-btn cms-btn-outline !py-1.5 text-xs">
                      {creatingUnit ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />} Thêm bài
                    </button>
                  </form>
                </div>

                {!units.length ? (
                  <p className="rounded-xl bg-white p-4 text-center text-xs text-slate-500">Môn này chưa có bài học nào. Nhập tên bài mới ở trên để bắt đầu soạn Video, Luyện tập và Nội dung.</p>
                ) : (
                  <ol className="space-y-2">
                    {units.map((unit, index) => {
                      const isEditing = editingUnitId === unit.id;
                      const currentItems = isEditing ? items : [];
                      const qCount = isEditing ? currentItems.length : (unit.questionCount || 0);
                      return (
                        <li key={unit.id} className={`rounded-xl bg-white p-3 ring-1 ${isEditing ? 'ring-emerald-400 shadow-sm' : 'ring-slate-100'}`}>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-emerald-500 to-emerald-700 text-xs font-black text-white">
                              {index + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black text-slate-900">{unit.title}</p>
                              <p className="text-[11px] text-slate-500">
                                {(unit.videos || []).length} video · {qCount} câu luyện tập · {(unit.contents || []).length} nội dung
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openUnitEditor(unit)}
                              className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-black transition !shadow-none ${isEditing ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'}`}
                            >
                              {isEditing ? 'Đóng' : 'Soạn'}
                            </button>
                            <span className="flex shrink-0 flex-col">
                              <button type="button" disabled={index === 0} onClick={() => handleMoveUnit(index, -1)} aria-label="Lên" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowUp size={13} /></button>
                              <button type="button" disabled={index === units.length - 1} onClick={() => handleMoveUnit(index, 1)} aria-label="Xuống" className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 !shadow-none"><ArrowDown size={13} /></button>
                            </span>
                            <button type="button" onClick={() => handleDeleteUnit(unit)} aria-label="Xóa bài" className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 !shadow-none"><Trash2 size={14} /></button>
                          </div>

                          {isEditing && editingUnit && (
                            <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                              <div>
                                <label className={LABEL} htmlFor={`unit-title-${unit.id}`}>Tên bài học</label>
                                <input
                                  id={`unit-title-${unit.id}`}
                                  className={INPUT}
                                  value={editingUnit.title}
                                  onChange={(e) => updateEditingUnit((u) => ({ ...u, title: e.target.value }))}
                                />
                              </div>

                              <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1">
                                <button
                                  type="button"
                                  onClick={() => setEditorSubTab('video')}
                                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition !shadow-none ${editorSubTab === 'video' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                  <Clapperboard size={14} /> Xem video ({(editingUnit.videos || []).length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditorSubTab('practice')}
                                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition !shadow-none ${editorSubTab === 'practice' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                  <Gamepad2 size={14} /> Luyện tập ({items.length} câu)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditorSubTab('content')}
                                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition !shadow-none ${editorSubTab === 'content' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                  <NotebookPen size={14} /> Nội dung ({(editingUnit.contents || []).length})
                                </button>
                              </div>

                              {editorSubTab === 'video' && (
                                <div className="space-y-2.5">
                                  {(editingUnit.videos || []).length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Chưa có video. Bấm "+ Thêm video" bên dưới.</p>
                                  ) : (editingUnit.videos || []).map((video, vIdx) => {
                                    const vCount = items.filter((item) => resolveAdminItemVideoKey(item, editingUnit.videos) === video.id).length;
                                    const hasUrl = Boolean(String(video.url || '').trim());
                                    return (
                                      <div key={video.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                        <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
                                          <input
                                            className={INPUT}
                                            value={video.title}
                                            onChange={(e) => updateEditingUnit((u) => ({
                                              ...u,
                                              videos: u.videos.map((v) => (v.id === video.id ? { ...v, title: e.target.value } : v)),
                                            }))}
                                            placeholder={`Tên video ${vIdx + 1}`}
                                          />
                                          <input
                                            className={INPUT}
                                            value={video.url}
                                            onChange={(e) => updateEditingUnit((u) => ({
                                              ...u,
                                              videos: u.videos.map((v) => (v.id === video.id ? { ...v, url: e.target.value } : v)),
                                            }))}
                                            placeholder="https://www.youtube.com/watch?v=... hoặc /uploads/..."
                                          />
                                          <button
                                            type="button"
                                            onClick={() => updateEditingUnit((u) => ({
                                              ...u,
                                              videos: u.videos.filter((v) => v.id !== video.id),
                                            }))}
                                            aria-label={`Xóa video ${vIdx + 1}`}
                                            className="inline-flex items-center justify-center rounded-xl px-2.5 text-red-600 hover:bg-red-50 !shadow-none"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                                            <input
                                              type="checkbox"
                                              checked={video.antiSeek === true}
                                              onChange={(e) => updateEditingUnit((u) => ({
                                                ...u,
                                                videos: u.videos.map((v) => (v.id === video.id ? { ...v, antiSeek: e.target.checked } : v)),
                                              }))}
                                              className="h-4 w-4 accent-emerald-600"
                                            />
                                            Bật chống tua video (xem tối thiểu 70%)
                                          </label>
                                          <div className="flex flex-wrap items-center gap-2">
                                            {!hasUrl && (
                                              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                                                Chưa có link — trắc nghiệm vẫn mở làm ngay
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setPracticeVideoFilter(video.id);
                                                setEditorSubTab('practice');
                                                if (vCount === 0) setDraft(blankItem(primaryPracticeGroupId, video.id));
                                                else setDraft(null);
                                              }}
                                              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-50 !shadow-none"
                                            >
                                              <Gamepad2 size={13} /> Mốc trắc nghiệm ({vCount} câu) · Thêm / Sửa
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => updateEditingUnit((u) => ({
                                      ...u,
                                      videos: [...(u.videos || []), { id: newContentId(), title: `Video ${(u.videos || []).length + 1}`, url: '', antiSeek: false }],
                                    }))}
                                    className="cms-btn cms-btn-outline !py-1.5 text-xs"
                                  >
                                    <Plus size={14} /> Thêm video
                                  </button>
                                </div>
                              )}

                              {editorSubTab === 'practice' && (() => {
                                const unitVideosList = editingUnit.videos || [];
                                const validFilter = practiceVideoFilter === 'none' || unitVideosList.some((v) => v.id === practiceVideoFilter)
                                  ? practiceVideoFilter
                                  : 'all';
                                const filteredItems = validFilter === 'all'
                                  ? items
                                  : items.filter((item) => resolveAdminItemVideoKey(item, unitVideosList) === validFilter);
                                const noneCount = items.filter((item) => resolveAdminItemVideoKey(item, unitVideosList) === 'none').length;
                                const defaultVideoForNew = validFilter !== 'all' ? validFilter : (unitVideosList[0]?.id || 'none');
                                const draftVideoKey = draft ? resolveAdminItemVideoKey(draft, unitVideosList) : 'none';
                                const draftTargetVideo = unitVideosList.find((v) => v.id === draftVideoKey) || null;
                                const draftIsImmediate = draftVideoKey === 'none' || !String(draftTargetVideo?.url || '').trim();

                                return (
                                <div className="space-y-3">
                                  <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                                      <Clock size={14} /> Câu hỏi gắn theo mốc video:
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-700">
                                      {unitVideosList.some((v) => String(v.url || '').trim())
                                        ? 'Chọn từng video bên dưới để thêm/lọc mốc cho riêng video đó. Video chưa đặt link hoặc "Không gắn video" vẫn mở trắc nghiệm cho học viên làm ngay.'
                                        : 'Bài chưa đặt link video — toàn bộ câu hỏi trắc nghiệm sẽ mở cho học viên làm ngay.'}
                                    </span>
                                  </div>

                                  {unitVideosList.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setPracticeVideoFilter('all')}
                                        className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition !shadow-none ${validFilter === 'all' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                      >
                                        Tất cả ({items.length})
                                      </button>
                                      {unitVideosList.map((v, vIdx) => {
                                        const vCount = items.filter((item) => resolveAdminItemVideoKey(item, unitVideosList) === v.id).length;
                                        const noUrl = !String(v.url || '').trim();
                                        return (
                                          <button
                                            key={v.id}
                                            type="button"
                                            onClick={() => setPracticeVideoFilter(v.id)}
                                            className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition !shadow-none ${validFilter === v.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50'}`}
                                          >
                                            {v.title || `Video ${vIdx + 1}`} ({vCount}){noUrl ? ' · chưa link' : ''}
                                          </button>
                                        );
                                      })}
                                      {(noneCount > 0 || validFilter === 'none') && (
                                        <button
                                          type="button"
                                          onClick={() => setPracticeVideoFilter('none')}
                                          className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition !shadow-none ${validFilter === 'none' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-emerald-50'}`}
                                        >
                                          Mở làm ngay ({noneCount})
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {filteredItems.length > 0 ? (
                                    <div className="space-y-1.5">
                                      {filteredItems.map((item, qIdx) => {
                                        const vKey = resolveAdminItemVideoKey(item, unitVideosList);
                                        const vIdx = unitVideosList.findIndex((v) => v.id === vKey);
                                        const vObj = vIdx >= 0 ? unitVideosList[vIdx] : null;
                                        const immediate = !vObj || !String(vObj.url || '').trim();
                                        return (
                                        <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                                          <span className="font-black text-slate-400">{qIdx + 1}.</span>
                                          <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                                            {TYPES.find((t) => t.id === item.type)?.label}: {item.prompt || item.caption || 'Ảnh'}
                                          </span>
                                          {unitVideosList.length > 0 && (
                                            <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold text-sky-700 ring-1 ring-sky-200">
                                              {vObj ? (vObj.title || `Video ${vIdx + 1}`) : 'Không gắn video'}
                                            </span>
                                          )}
                                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${immediate ? 'bg-amber-100 text-amber-800' : Number(item.checkpointSec) > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                                            {immediate ? 'Mở làm ngay' : Number(item.checkpointSec) > 0 ? `Mốc ${formatCheckpointLabel(item.checkpointSec)}` : 'Mốc tự động'}
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setDraft({
                                              ...blankItem(item.practiceGroupId || primaryPracticeGroupId, vKey),
                                              ...item,
                                              videoId: vKey,
                                              options: item.options?.length ? item.options : blankItem().options,
                                              pairs: item.pairs?.length ? item.pairs : blankItem().pairs,
                                              correctOptionIds: item.correctOptionIds || [],
                                              region: item.region || null,
                                            })}
                                            className="font-bold text-emerald-700 hover:underline !shadow-none"
                                          >
                                            Sửa
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setItems((rows) => rows.filter((row) => row.id !== item.id));
                                              if (!String(item.id).startsWith('pending-')) {
                                                setDeletedItemIds((rows) => (rows.includes(item.id) ? rows : [...rows, item.id]));
                                              }
                                              if (draft?.id === item.id) setDraft(null);
                                            }}
                                            className="font-bold text-red-600 hover:underline !shadow-none"
                                          >
                                            Xóa
                                          </button>
                                        </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                                      {validFilter === 'all' ? 'Chưa có câu hỏi luyện tập nào.' : 'Video/mục này chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" bên dưới.'}
                                    </p>
                                  )}

                                  {!draft && (
                                    <button
                                      type="button"
                                      onClick={() => setDraft(blankItem(primaryPracticeGroupId, defaultVideoForNew))}
                                      className="cms-btn cms-btn-outline !py-1.5 text-xs"
                                    >
                                      <Plus size={14} /> Thêm câu hỏi
                                    </button>
                                  )}

                                  {draft && (
                                    <form
                                      className="space-y-2.5 rounded-xl border border-emerald-200 bg-emerald-50/30 p-3"
                                      onSubmit={(event) => {
                                        event.preventDefault();
                                        const addAnother = event.nativeEvent.submitter?.dataset?.next === '1';
                                        const entryId = draft.id || `pending-${newContentId()}`;
                                        const resolvedVid = resolveAdminItemVideoKey(draft, unitVideosList);
                                        const staged = { ...draft, id: entryId, videoId: resolvedVid, practiceGroupId: draft.practiceGroupId || primaryPracticeGroupId };
                                        setItems((rows) => (rows.some((row) => row.id === entryId)
                                          ? rows.map((row) => (row.id === entryId ? staged : row))
                                          : [...rows, staged]));
                                        if (addAnother) setDraft(blankItem(primaryPracticeGroupId, resolvedVid));
                                        else setDraft(null);
                                      }}
                                    >
                                      <div className="flex flex-wrap gap-1">
                                        {TYPES.map((type) => (
                                          <button
                                            key={type.id}
                                            type="button"
                                            onClick={() => setDraft((cur) => ({ ...cur, type: type.id }))}
                                            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${draft.type === type.id ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                                          >
                                            {type.label}
                                          </button>
                                        ))}
                                      </div>
                                      <textarea
                                        value={draft.prompt}
                                        onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                                        rows={2}
                                        placeholder="Nội dung câu hỏi"
                                        className={INPUT}
                                      />
                                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                        {unitVideosList.length > 0 && (
                                          <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                            Gắn vào video
                                            <select
                                              value={draftVideoKey}
                                              onChange={(e) => setDraft({ ...draft, videoId: e.target.value })}
                                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold"
                                            >
                                              {unitVideosList.map((v, vIdx) => (
                                                <option key={v.id} value={v.id}>
                                                  {v.title || `Video ${vIdx + 1}`}{!String(v.url || '').trim() ? ' (chưa có link - làm ngay)' : ''}
                                                </option>
                                              ))}
                                              <option value="none">Không gắn mốc video (mở làm ngay)</option>
                                            </select>
                                          </label>
                                        )}
                                        {!draftIsImmediate ? (
                                          <>
                                            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                                              Mốc mở (giây)
                                              <input
                                                type="number"
                                                min="0"
                                                max="86400"
                                                value={draft.checkpointSec ?? 0}
                                                onChange={(e) => setDraft({ ...draft, checkpointSec: e.target.value })}
                                                className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold"
                                              />
                                            </label>
                                            {[
                                              { sec: 0, label: '0s (Tự động)' },
                                              { sec: 15, label: '15s' },
                                              { sec: 30, label: '30s' },
                                              { sec: 60, label: '60s' },
                                              { sec: 120, label: '120s' },
                                              { sec: 180, label: '180s' },
                                            ].map((preset) => (
                                              <button
                                                key={preset.sec}
                                                type="button"
                                                onClick={() => setDraft({ ...draft, checkpointSec: preset.sec })}
                                                className={`rounded-md border px-2 py-1 text-[11px] font-bold !shadow-none ${Number(draft.checkpointSec || 0) === preset.sec
                                                  ? 'border-emerald-500 bg-emerald-100 text-emerald-800'
                                                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'}`}
                                              >
                                                {preset.label}
                                              </button>
                                            ))}
                                          </>
                                        ) : (
                                          <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                                            Chưa đặt link video → câu hỏi mở cho học viên làm ngay
                                          </span>
                                        )}
                                        <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
                                          <span>Ảnh</span>
                                          <span className="rounded border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700">Chọn ảnh</span>
                                          <span className="max-w-52 truncate font-normal text-slate-600">
                                            {draft.imageUploadStatus === 'uploading'
                                              ? `Đang tải: ${draft.pendingImageName}`
                                              : draft.imageUploadStatus === 'error'
                                                ? `Lỗi tải: ${draft.pendingImageName}`
                                                : draft.imageName || 'Chưa chọn'}
                                          </span>
                                          <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; uploadImage(file); }} />
                                        </label>
                                      </div>
                                      {draft.type === 'hotspot' && (
                                        <RegionDraw imageUrl={draft.imageUrl} region={draft.region} onChange={(region) => setDraft({ ...draft, region })} />
                                      )}
                                      {(draft.type === 'mcq' || draft.type === 'multi' || draft.type === 'drag') && (
                                        <div className="space-y-1.5">
                                          {draft.type === 'drag' && <p className="text-xs text-slate-500">Xếp đúng thứ tự từ trên xuống. Học viên sẽ kéo thả sắp lại.</p>}
                                          {draft.type === 'multi' && <p className="text-xs text-slate-500">Tick các đáp án đúng.</p>}
                                          {draft.options.map((opt, idx) => (
                                            <div key={opt.id} className="flex items-center gap-1.5">
                                              {draft.type === 'mcq' && (
                                                <input type="radio" name="correct" checked={draft.correctOptionId === opt.id} onChange={() => setDraft({ ...draft, correctOptionId: opt.id })} />
                                              )}
                                              {draft.type === 'multi' && (
                                                <input
                                                  type="checkbox"
                                                  checked={(draft.correctOptionIds || []).includes(opt.id)}
                                                  onChange={() => {
                                                    const picked = new Set(draft.correctOptionIds || []);
                                                    if (picked.has(opt.id)) picked.delete(opt.id);
                                                    else picked.add(opt.id);
                                                    setDraft({ ...draft, correctOptionIds: [...picked] });
                                                  }}
                                                />
                                              )}
                                              <input
                                                value={opt.text}
                                                onChange={(e) => setDraft({
                                                  ...draft,
                                                  options: draft.options.map((row) => (row.id === opt.id ? { ...row, text: e.target.value } : row)),
                                                })}
                                                placeholder={draft.type === 'drag' ? `Thứ tự ${idx + 1}` : `Đáp án ${idx + 1}`}
                                                className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                                              />
                                            </div>
                                          ))}
                                          <div className="flex gap-3">
                                            {draft.options.length < 6 && (
                                              <button type="button" className="text-xs font-bold text-emerald-700 !shadow-none" onClick={() => setDraft({ ...draft, options: [...draft.options, newOption()] })}>+ Thêm đáp án</button>
                                            )}
                                            {draft.options.length > 2 && (
                                              <button
                                                type="button"
                                                className="text-xs font-bold text-slate-600 !shadow-none"
                                                onClick={() => {
                                                  const options = draft.options.slice(0, -1);
                                                  const correctOptionId = options.some((opt) => opt.id === draft.correctOptionId) ? draft.correctOptionId : options[0].id;
                                                  const correctOptionIds = (draft.correctOptionIds || []).filter((id) => options.some((opt) => opt.id === id));
                                                  setDraft({ ...draft, options, correctOptionId, correctOptionIds });
                                                }}
                                              >
                                                - Bớt đáp án
                                              </button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {draft.type === 'match' && (
                                        <div className="space-y-1.5">
                                          {draft.pairs.map((pair, idx) => (
                                            <div key={pair.id} className="grid gap-1.5 sm:grid-cols-2">
                                              <input
                                                value={pair.left}
                                                onChange={(e) => setDraft({ ...draft, pairs: draft.pairs.map((row) => (row.id === pair.id ? { ...row, left: e.target.value } : row)) })}
                                                placeholder={`Vế trái ${idx + 1}`}
                                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                                              />
                                              <input
                                                value={pair.right}
                                                onChange={(e) => setDraft({ ...draft, pairs: draft.pairs.map((row) => (row.id === pair.id ? { ...row, right: e.target.value } : row)) })}
                                                placeholder={`Vế phải ${idx + 1}`}
                                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                                              />
                                            </div>
                                          ))}
                                          <div className="flex gap-3">
                                            {draft.pairs.length < 6 && (
                                              <button type="button" className="text-xs font-bold text-emerald-700 !shadow-none" onClick={() => setDraft({ ...draft, pairs: [...draft.pairs, newPair()] })}>+ Thêm cặp</button>
                                            )}
                                            {draft.pairs.length > 2 && (
                                              <button type="button" className="text-xs font-bold text-slate-600 !shadow-none" onClick={() => setDraft({ ...draft, pairs: draft.pairs.slice(0, -1) })}>- Bớt cặp</button>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                      {draft.type === 'written' && (
                                        <div className="space-y-2">
                                          <textarea value={draft.rubric} onChange={(e) => setDraft({ ...draft, rubric: e.target.value })} rows={1} placeholder="Barem: ý nào được tính là đúng" className={INPUT} />
                                          <textarea value={draft.modelAnswer} onChange={(e) => setDraft({ ...draft, modelAnswer: e.target.value })} rows={1} placeholder="Đáp án mẫu để AI đối chiếu" className={INPUT} />
                                        </div>
                                      )}
                                      <input value={draft.hint} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} placeholder="Gợi ý (tuỳ chọn)" className={INPUT} />
                                      <input value={draft.explanation} onChange={(e) => setDraft({ ...draft, explanation: e.target.value })} placeholder="Giải thích sau khi xác nhận (tuỳ chọn)" className={INPUT} />
                                      <div className="flex flex-wrap gap-2">
                                        <button type="submit" disabled={saving} className="cms-btn cms-btn-primary !py-1.5 text-xs">
                                          {draft.id ? 'Cập nhật câu vào danh sách' : 'Thêm câu vào danh sách'}
                                        </button>
                                        {!draft.id && (
                                          <button type="submit" data-next="1" disabled={saving} className="cms-btn cms-btn-outline !py-1.5 text-xs">
                                            + Thêm & soạn tiếp
                                          </button>
                                        )}
                                        <button type="button" onClick={() => setDraft(null)} className="cms-btn cms-btn-outline !py-1.5 text-xs">
                                          Hủy
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </div>
                                );
                              })()}

                              {editorSubTab === 'content' && (
                                <div className="space-y-2.5">
                                  {(editingUnit.contents || []).length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">Chưa có nội dung bài đọc. Bấm "+ Thêm nội dung" bên dưới.</p>
                                  ) : (editingUnit.contents || []).map((content, cIdx) => (
                                    <div key={content.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                      <div className="flex gap-2">
                                        <input
                                          className={INPUT}
                                          value={content.title}
                                          onChange={(e) => updateEditingUnit((u) => ({
                                            ...u,
                                            contents: u.contents.map((c) => (c.id === content.id ? { ...c, title: e.target.value } : c)),
                                          }))}
                                          placeholder={`Tiêu đề nội dung ${cIdx + 1}`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => updateEditingUnit((u) => ({
                                            ...u,
                                            contents: u.contents.filter((c) => c.id !== content.id),
                                          }))}
                                          aria-label={`Xóa nội dung ${cIdx + 1}`}
                                          className="inline-flex items-center justify-center rounded-xl px-2.5 text-red-600 hover:bg-red-50 !shadow-none"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                      <RichTextEditor
                                        value={content.content}
                                        onChange={(value) => updateEditingUnit((u) => ({
                                          ...u,
                                          contents: u.contents.map((c) => (c.id === content.id ? { ...c, content: value } : c)),
                                        }))}
                                        placeholder="Nội dung học viên đọc trong môn học"
                                      />
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => updateEditingUnit((u) => ({
                                      ...u,
                                      contents: [...(u.contents || []), { id: newContentId(), title: `Nội dung ${(u.contents || []).length + 1}`, content: '' }],
                                    }))}
                                    className="cms-btn cms-btn-outline !py-1.5 text-xs"
                                  >
                                    <Plus size={14} /> Thêm nội dung
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                                <button type="button" onClick={() => setEditingUnitId('')} className="cms-btn cms-btn-outline !py-2 text-xs">
                                  Đóng
                                </button>
                                <button type="button" onClick={saveEditingUnit} disabled={saving} className="cms-btn cms-btn-primary !py-2 text-xs">
                                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu bài học
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {subjectModal && (
        <SubjectModal
          subject={subjectModal.id ? subjectModal : null}
          onClose={() => setSubjectModal(null)}
          onSaved={async (saved) => {
            setSubjectModal(null);
            await loadSubjects(saved?.id || '');
            if (saved?.id) {
              setSubjectId(saved.id);
              const rows = await loadUnits(saved.id);
              if (rows?.[0]?.id) {
                setEditingUnitId(rows[0].id);
                setEditorSubTab('video');
              }
            }
          }}
        />
      )}
    </div>
  );
}
