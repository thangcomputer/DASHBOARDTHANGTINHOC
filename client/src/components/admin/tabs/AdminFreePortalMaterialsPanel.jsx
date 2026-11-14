import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen, Download, ExternalLink, FileBox, Link2, Loader2, Pencil, Plus, Trash2, UploadCloud, X,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../../../services/api';
import dailyPracticeApi from '../../../services/dailyPracticeApi';
import { useToast } from '../../../utils/useToast';

const INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const LABEL = 'mb-1 block text-xs font-bold text-slate-600';

export const FREE_ASSIGNMENT_DIFFICULTIES = [
  { id: 'easy', label: 'Dễ', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'medium', label: 'Vừa', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200' },
  { id: 'hard', label: 'Khó', badgeClass: 'bg-rose-100 text-rose-700 border-rose-200' },
];

function diffMeta(difficulty) {
  return FREE_ASSIGNMENT_DIFFICULTIES.find((d) => d.id === difficulty) || FREE_ASSIGNMENT_DIFFICULTIES[0];
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminFreePortalMaterialsPanel({ topics = [] }) {
  const toast = useToast();
  const [subTab, setSubTab] = useState('files'); // files | softwareLinks | assignments
  const [data, setData] = useState({ files: [], softwareLinks: [], assignments: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [unitsByTopic, setUnitsByTopic] = useState({});
  const [filterTopicId, setFilterTopicId] = useState('');
  const [filterUnitId, setFilterUnitId] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');
  const [modal, setModal] = useState(null); // { mode: 'files'|'softwareLinks'|'assignments', form: {...}, isEdit: boolean }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.settings.getFreePortalTrainingData();
      if (res?.success && res.data) {
        setData({
          files: Array.isArray(res.data.files) ? res.data.files : [],
          softwareLinks: Array.isArray(res.data.softwareLinks) ? res.data.softwareLinks : [],
          assignments: Array.isArray(res.data.assignments) ? res.data.assignments : [],
        });
      }
    } catch (err) {
      toast.error(err?.message || 'Không tải được tài nguyên tài khoản miễn phí');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const ensureUnitsForTopic = useCallback(async (tId) => {
    const id = String(tId || '').trim();
    if (!id || unitsByTopic[id]) return;
    try {
      const res = await dailyPracticeApi.admin.units(id);
      setUnitsByTopic((prev) => ({ ...prev, [id]: Array.isArray(res?.units) ? res.units : [] }));
    } catch {
      setUnitsByTopic((prev) => ({ ...prev, [id]: [] }));
    }
  }, [unitsByTopic]);

  useEffect(() => {
    if (filterTopicId) ensureUnitsForTopic(filterTopicId);
  }, [filterTopicId, ensureUnitsForTopic]);

  useEffect(() => {
    if (modal?.form?.topicId) ensureUnitsForTopic(modal.form.topicId);
  }, [modal?.form?.topicId, ensureUnitsForTopic]);

  const topicMap = useMemo(() => new Map(topics.map((t) => [String(t.id), t])), [topics]);

  const persistData = async (nextData, successMsg) => {
    setSaving(true);
    try {
      const res = await api.settings.updateFreePortalTrainingData(nextData);
      if (res?.success) {
        setData(res.data || nextData);
        toast.success(successMsg);
        return true;
      }
      toast.error(res?.message || 'Chưa lưu được thay đổi');
      return false;
    } catch (err) {
      toast.error(err?.message || 'Lỗi khi lưu tài nguyên miễn phí');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    const defaultTopic = filterTopicId || topics[0]?.id || '';
    if (subTab === 'files') {
      setModal({
        mode: 'files',
        isEdit: false,
        form: {
          id: '',
          title: '',
          desc: '',
          fileUrl: '',
          fileType: 'FILE',
          fileSize: '',
          fileOriginalName: '',
          topicId: defaultTopic,
          unitId: filterUnitId || '',
        },
      });
    } else if (subTab === 'softwareLinks') {
      setModal({
        mode: 'softwareLinks',
        isEdit: false,
        form: {
          id: '',
          title: '',
          linkUrl: '',
          description: '',
          installGuide: '',
          topicId: defaultTopic,
          unitId: filterUnitId || '',
        },
      });
    } else {
      setModal({
        mode: 'assignments',
        isEdit: false,
        form: {
          id: '',
          title: '',
          description: '',
          fileUrl: '',
          fileOriginalName: '',
          difficulty: filterDifficulty || 'easy',
          deadline: '',
          topicId: defaultTopic,
          unitId: filterUnitId || '',
        },
      });
    }
  };

  const openEditModal = (mode, item) => {
    setModal({
      mode,
      isEdit: true,
      form: { ...item },
    });
  };

  const handleUploadFile = async (e, targetField = 'fileUrl') => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.settings.uploadTrainingFile(file);
      const uploadedUrl = res?.fileUrl || res?.url || res?.data?.fileUrl || res?.data?.url || '';
      if (!uploadedUrl) {
        toast.error(res?.message || 'Không lấy được đường dẫn file đã tải lên');
        return;
      }
      const ext = (file.name.split('.').pop() || 'FILE').toUpperCase().slice(0, 10);
      setModal((prev) => (prev ? {
        ...prev,
        form: {
          ...prev.form,
          [targetField]: uploadedUrl,
          fileOriginalName: file.name,
          ...(prev.mode === 'files' ? { fileType: ext, fileSize: formatBytes(file.size) } : {}),
          ...(!prev.form.title ? { title: file.name.replace(/\.[^.]+$/, '') } : {}),
        },
      } : prev));
      toast.success('Đã tải file lên');
    } catch (err) {
      toast.error(err?.message || 'Lỗi tải file lên');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveModal = async (e) => {
    e.preventDefault();
    if (!modal) return;
    const { mode, isEdit, form } = modal;
    const title = String(form.title || '').trim();
    if (!title) {
      toast.error('Vui lòng nhập tiêu đề');
      return;
    }
    if (!form.topicId) {
      toast.error('Vui lòng chọn môn học (chủ đề theo chặng)');
      return;
    }
    if (mode === 'softwareLinks' && !String(form.linkUrl || '').trim()) {
      toast.error('Vui lòng nhập link phần mềm');
      return;
    }

    const topicObj = topicMap.get(String(form.topicId));
    const unitList = unitsByTopic[String(form.topicId)] || [];
    const unitIndex = unitList.findIndex((u) => String(u.id) === String(form.unitId));
    const unitObj = unitIndex >= 0 ? unitList[unitIndex] : null;

    const idPrefix = mode === 'files' ? 'fp-file' : mode === 'softwareLinks' ? 'fp-sw' : 'fp-assign';
    const nextItem = {
      ...form,
      id: isEdit && form.id ? form.id : `${idPrefix}-${Date.now()}`,
      title,
      topicId: String(form.topicId),
      topicName: topicObj?.name || form.topicName || '',
      unitId: unitObj ? String(unitObj.id) : '',
      unitTitle: unitObj ? `Chặng ${unitIndex + 1}: ${unitObj.title}` : '',
      createdAt: form.createdAt || new Date().toISOString().slice(0, 10),
    };

    const list = Array.isArray(data[mode]) ? data[mode] : [];
    const nextList = isEdit
      ? list.map((item) => (String(item.id) === String(nextItem.id) ? nextItem : item))
      : [nextItem, ...list];

    const ok = await persistData(
      { ...data, [mode]: nextList },
      isEdit ? 'Đã cập nhật mục tài nguyên miễn phí' : 'Đã thêm vào tài nguyên miễn phí',
    );
    if (ok) setModal(null);
  };

  const handleDeleteItem = async (mode, item) => {
    if (!window.confirm(`Xóa "${item.title}" khỏi tài nguyên tài khoản miễn phí?`)) return;
    const nextList = (data[mode] || []).filter((entry) => String(entry.id) !== String(item.id));
    await persistData({ ...data, [mode]: nextList }, 'Đã xóa');
  };

  const filteredItems = useMemo(() => {
    const list = Array.isArray(data[subTab]) ? data[subTab] : [];
    return list.filter((item) => {
      if (filterTopicId && String(item.topicId) !== String(filterTopicId)) return false;
      if (filterUnitId && String(item.unitId) !== String(filterUnitId)) return false;
      if (subTab === 'assignments' && filterDifficulty && String(item.difficulty || 'easy') !== filterDifficulty) return false;
      return true;
    });
  }, [data, subTab, filterTopicId, filterUnitId, filterDifficulty]);

  const filterUnits = filterTopicId ? (unitsByTopic[filterTopicId] || []) : [];
  const modalUnits = modal?.form?.topicId ? (unitsByTopic[String(modal.form.topicId)] || []) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-900">
        <p className="font-bold">Khu vực riêng cho Tài khoản miễn phí (tách biệt hoàn toàn với Tài khoản theo khóa)</p>
        <p className="mt-1 text-emerald-800">
          Tài liệu, Phần mềm và Bài tập thêm tại đây được gắn với các môn theo chặng của Luyện tập hằng ngày. Học viên đăng ký khóa học trả phí sẽ không thấy mục này, và tài khoản miễn phí không thấy tài nguyên của khóa trả phí.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-2">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'files', icon: FileBox, label: 'Tài liệu', count: data.files.length },
            { key: 'softwareLinks', icon: Link2, label: 'Phần mềm', count: data.softwareLinks.length },
            { key: 'assignments', icon: BookOpen, label: 'Bài tập', count: data.assignments.length },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                subTab === t.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <t.icon size={15} />
              <span>{t.label}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-black ${
                subTab === t.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
              }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          disabled={!topics.length}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          <Plus size={16} />
          {subTab === 'files' ? 'Thêm tài liệu' : subTab === 'softwareLinks' ? 'Thêm phần mềm' : 'Thêm bài tập'}
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <select
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
          value={filterTopicId}
          onChange={(e) => { setFilterTopicId(e.target.value); setFilterUnitId(''); }}
        >
          <option value="">Tất cả môn học ({topics.length})</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {filterTopicId && (
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
            value={filterUnitId}
            onChange={(e) => setFilterUnitId(e.target.value)}
          >
            <option value="">Tất cả chặng</option>
            {filterUnits.map((u, idx) => (
              <option key={u.id} value={u.id}>{`Chặng ${idx + 1}: ${u.title}`}</option>
            ))}
          </select>
        )}

        {subTab === 'assignments' && (
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: '', label: 'Mọi mức độ' },
              ...FREE_ASSIGNMENT_DIFFICULTIES,
            ].map((d) => (
              <button
                key={d.id || 'all'}
                type="button"
                onClick={() => setFilterDifficulty(d.id)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition ${
                  filterDifficulty === d.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...
        </div>
      ) : !topics.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          Chưa có môn học theo chặng nào. Hãy tạo chủ đề ở tab &quot;Lộ trình &amp; Câu hỏi&quot; trước để liên kết tài nguyên.
        </div>
      ) : !filteredItems.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-bold text-slate-700">Chưa có mục nào phù hợp</p>
          <p className="mt-1 text-xs text-slate-500">Bấm nút thêm ở góc phải để gắn {subTab === 'files' ? 'tài liệu' : subTab === 'softwareLinks' ? 'phần mềm' : 'bài tập'} cho tài khoản miễn phí.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredItems.map((item) => {
            const topicLabel = topicMap.get(String(item.topicId))?.name || item.topicName || 'Chưa gắn môn';
            const dm = subTab === 'assignments' ? diffMeta(item.difficulty) : null;
            const rawUrl = subTab === 'softwareLinks' ? item.linkUrl : item.fileUrl;
            return (
              <div key={item.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                      {topicLabel}
                    </span>
                    {item.unitTitle && (
                      <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                        {item.unitTitle}
                      </span>
                    )}
                    {dm && (
                      <span className={`rounded-md border px-2 py-0.5 text-[11px] font-black ${dm.badgeClass}`}>
                        Mức: {dm.label}
                      </span>
                    )}
                    {subTab === 'files' && item.fileType && (
                      <span className="rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-black text-sky-700">
                        {item.fileType}{item.fileSize ? ` · ${item.fileSize}` : ''}
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                  {(item.desc || item.description) && (
                    <p className="line-clamp-2 whitespace-pre-wrap text-xs text-slate-500">{item.desc || item.description}</p>
                  )}
                  {subTab === 'softwareLinks' && item.installGuide && (
                    <p className="line-clamp-1 text-[11px] font-medium text-slate-500">Hướng dẫn: {item.installGuide}</p>
                  )}
                  {subTab === 'assignments' && item.deadline && (
                    <p className="text-[11px] font-semibold text-amber-700">Hạn gợi ý: {item.deadline}</p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                  {rawUrl ? (
                    <a
                      href={resolveMediaUrl(rawUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                    >
                      {subTab === 'softwareLinks' ? <ExternalLink size={13} /> : <Download size={13} />}
                      {subTab === 'softwareLinks' ? 'Mở link phần mềm' : 'Xem / Tải file'}
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">Chưa gắn file/link</span>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(subTab, item)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      title="Sửa"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(subTab, item)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                      title="Xóa"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && createPortal(
        <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleSaveModal} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">
                {modal.isEdit ? 'Chỉnh sửa ' : 'Thêm '}
                {modal.mode === 'files' ? 'Tài liệu miễn phí' : modal.mode === 'softwareLinks' ? 'Phần mềm miễn phí' : 'Bài tập miễn phí'}
              </h3>
              <button type="button" onClick={() => setModal(null)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Môn học theo chặng *</label>
                <select
                  className={INPUT}
                  value={modal.form.topicId || ''}
                  onChange={(e) => setModal((prev) => ({
                    ...prev,
                    form: { ...prev.form, topicId: e.target.value, unitId: '' },
                  }))}
                  required
                >
                  <option value="">-- Chọn môn --</option>
                  {topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Chặng liên kết</label>
                <select
                  className={INPUT}
                  value={modal.form.unitId || ''}
                  onChange={(e) => setModal((prev) => ({
                    ...prev,
                    form: { ...prev.form, unitId: e.target.value },
                  }))}
                  disabled={!modal.form.topicId}
                >
                  <option value="">Cả môn (mọi chặng)</option>
                  {modalUnits.map((u, idx) => (
                    <option key={u.id} value={u.id}>{`Chặng ${idx + 1}: ${u.title}`}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Tiêu đề *</label>
              <input
                className={INPUT}
                value={modal.form.title || ''}
                onChange={(e) => setModal((prev) => ({ ...prev, form: { ...prev.form, title: e.target.value } }))}
                placeholder={modal.mode === 'softwareLinks' ? 'VD: Bộ cài Office 2021 / Unikey' : 'Nhập tiêu đề...'}
                required
              />
            </div>

            {modal.mode === 'assignments' && (
              <div>
                <label className={LABEL}>Mức độ bài tập (3 mức) *</label>
                <div className="grid grid-cols-3 gap-2">
                  {FREE_ASSIGNMENT_DIFFICULTIES.map((d) => {
                    const active = (modal.form.difficulty || 'easy') === d.id;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setModal((prev) => ({ ...prev, form: { ...prev.form, difficulty: d.id } }))}
                        className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                          active ? `${d.badgeClass} ring-2 ring-emerald-500/30` : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {modal.mode === 'softwareLinks' ? (
              <>
                <div>
                  <label className={LABEL}>Link tải / trang chủ *</label>
                  <input
                    className={INPUT}
                    value={modal.form.linkUrl || ''}
                    onChange={(e) => setModal((prev) => ({ ...prev, form: { ...prev.form, linkUrl: e.target.value } }))}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <label className={LABEL}>Mô tả ngắn</label>
                  <textarea
                    rows={2}
                    className={INPUT}
                    value={modal.form.description || ''}
                    onChange={(e) => setModal((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                  />
                </div>
                <div>
                  <label className={LABEL}>Hướng dẫn cài đặt</label>
                  <textarea
                    rows={3}
                    className={INPUT}
                    value={modal.form.installGuide || ''}
                    onChange={(e) => setModal((prev) => ({ ...prev, form: { ...prev.form, installGuide: e.target.value } }))}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={LABEL}>{modal.mode === 'files' ? 'File tài liệu hoặc link ngoài' : 'File đề bài hoặc link đề bài'}</label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className={INPUT}
                      value={modal.form.fileUrl || ''}
                      onChange={(e) => setModal((prev) => ({
                        ...prev,
                        form: {
                          ...prev.form,
                          fileUrl: e.target.value,
                          ...(prev.mode === 'files' && /^https?:\/\//i.test(e.target.value) ? { fileType: 'LINK' } : {}),
                        },
                      }))}
                      placeholder="Dán link hoặc tải file từ máy..."
                    />
                    <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
                      Tải file
                      <input type="file" className="hidden" onChange={(e) => handleUploadFile(e, 'fileUrl')} disabled={uploading} />
                    </label>
                  </div>
                </div>

                {modal.mode === 'assignments' && (
                  <div>
                    <label className={LABEL}>Hạn nộp gợi ý (tùy chọn)</label>
                    <input
                      type="date"
                      className={INPUT}
                      value={modal.form.deadline || ''}
                      onChange={(e) => setModal((prev) => ({ ...prev, form: { ...prev.form, deadline: e.target.value } }))}
                    />
                  </div>
                )}

                <div>
                  <label className={LABEL}>{modal.mode === 'files' ? 'Mô tả tài liệu' : 'Mô tả / Hướng dẫn làm bài'}</label>
                  <textarea
                    rows={3}
                    className={INPUT}
                    value={(modal.mode === 'files' ? modal.form.desc : modal.form.description) || ''}
                    onChange={(e) => setModal((prev) => ({
                      ...prev,
                      form: {
                        ...prev.form,
                        ...(modal.mode === 'files' ? { desc: e.target.value } : { description: e.target.value }),
                      },
                    }))}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving || uploading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {modal.isEdit ? 'Lưu thay đổi' : 'Thêm mới'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}
    </div>
  );
}
