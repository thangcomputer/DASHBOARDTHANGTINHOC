import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2, Loader2, Plus, Save, Trash2, ArrowUp, ArrowDown, ImagePlus, ArrowLeft, AlertCircle,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api, { resolveMediaUrl } from '../../services/api';
import RichTextEditor from '../admin/shared/RichTextEditor';
import CmsSelect from '../ui/CmsSelect';
import { useToast } from '../../utils/toast';
import { CENTER_SECTIONS, SECTION_ITEM_KEYS, blankItem } from './centerInfoConstants';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-500 uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full border-2 border-slate-200 rounded-xl p-3 text-sm focus:border-red-400 outline-none bg-white';

function snapshotOf(obj) {
  try {
    return JSON.stringify(obj ?? null);
  } catch {
    return '';
  }
}

async function confirmDiscard(message) {
  if (typeof window.cmsConfirm === 'function') {
    return window.cmsConfirm(message);
  }
  return window.confirm(message);
}

/** Tách ra ngoài page — tránh remount input file khi parent re-render (mất lần chọn ảnh đầu). */
function ImagePick({ value, onChange, label = 'Ảnh', uploading, onPickFile }) {
  const inputRef = useRef(null);
  const [localPreview, setLocalPreview] = useState('');
  const [imgFailed, setImgFailed] = useState(false);
  const localPreviewRef = useRef('');

  useEffect(() => {
    setImgFailed(false);
  }, [value, localPreview]);

  useEffect(() => () => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
  }, []);

  const displaySrc = localPreview || (value ? resolveMediaUrl(value) : '');

  const handlePick = (file) => {
    if (!file) return;
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    const blobUrl = URL.createObjectURL(file);
    localPreviewRef.current = blobUrl;
    setLocalPreview(blobUrl);
    setImgFailed(false);
    onPickFile(file, (url) => {
      onChange(url);
      // Giữ blob đến khi value server đã có — rồi bỏ blob
      if (localPreviewRef.current) {
        URL.revokeObjectURL(localPreviewRef.current);
        localPreviewRef.current = '';
      }
      setLocalPreview('');
    });
  };

  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-28 aspect-video rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center relative">
          {displaySrc && !imgFailed ? (
            <img
              key={displaySrc}
              src={displaySrc}
              alt=""
              className="w-full h-full object-cover"
              onLoad={() => setImgFailed(false)}
              onError={() => {
                if (localPreview) return; // blob lỗi rất hiếm — đừng hiện "lỗi tải"
                setImgFailed(true);
              }}
            />
          ) : null}
          {!displaySrc ? (
            <span className="text-[10px] text-slate-400 font-bold">Chưa có</span>
          ) : null}
          {displaySrc && imgFailed ? (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] text-amber-600 font-bold px-2 text-center bg-slate-50">
              Ảnh lỗi tải — chọn lại
            </span>
          ) : null}
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className={`inline-flex items-center gap-2 min-h-11 px-3 rounded-xl border-2 border-dashed border-red-300 bg-red-50/50 text-red-800 text-xs font-black ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
        >
          {uploading ? <Loader2 className="animate-spin" size={14} /> : <ImagePlus size={14} />}
          Chọn ảnh
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) handlePick(f);
          }}
        />
        {value || localPreview ? (
          <button
            type="button"
            onClick={() => {
              if (localPreviewRef.current) {
                URL.revokeObjectURL(localPreviewRef.current);
                localPreviewRef.current = '';
              }
              setLocalPreview('');
              setImgFailed(false);
              onChange('');
            }}
            className="text-xs font-bold text-red-600"
          >
            Xóa ảnh
          </button>
        ) : null}
      </div>
    </Field>
  );
}

function GalleryAddButton({ uploading, onPick }) {
  const inputRef = useRef(null);
  return (
    <>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`inline-flex mt-2 items-center gap-2 text-xs font-bold text-red-700 ${uploading ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
      >
        {uploading ? <Loader2 className="animate-spin" size={14} /> : <ImagePlus size={14} />}
        Thêm ảnh vào gallery
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) onPick(f);
        }}
      />
    </>
  );
}

export default function CenterInfoManagePage() {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const navigate = useNavigate();
  const [section, setSection] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const overviewBaselineRef = useRef('');
  const formBaselineRef = useRef('');

  const overviewDirty = useMemo(() => {
    if (section !== 'overview' || !overview) return false;
    return snapshotOf(overview) !== overviewBaselineRef.current;
  }, [section, overview]);

  const formDirty = useMemo(() => {
    if (!form || !SECTION_ITEM_KEYS.includes(section)) return false;
    return snapshotOf(form) !== formBaselineRef.current;
  }, [form, section]);

  const hasUnsaved = overviewDirty || formDirty;

  const loadOverview = useCallback(async () => {
    const res = await api.centerInfo.getOverview();
    if (!res?.success) throw new Error(res?.message || 'Không tải overview');
    setOverview(res.data);
    overviewBaselineRef.current = snapshotOf(res.data);
  }, []);

  const loadItems = useCallback(async (sec) => {
    const res = await api.centerInfo.listItems(sec);
    if (!res?.success) throw new Error(res?.message || 'Không tải danh sách');
    setItems(Array.isArray(res.data) ? res.data : []);
  }, []);

  // Chỉ reload khi đổi tab — KHÔNG phụ thuộc toast (toast đổi identity mỗi lần hiện → xóa form/ảnh vừa upload)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setForm(null);
      formBaselineRef.current = '';
      try {
        if (section === 'overview') {
          await loadOverview();
        } else {
          await loadItems(section);
        }
      } catch (err) {
        if (!cancelled) toastRef.current.error(err.message || 'Lỗi tải dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section, loadOverview, loadItems]);

  useEffect(() => {
    if (!hasUnsaved) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasUnsaved]);

  const requestSectionChange = async (nextKey) => {
    if (nextKey === section) return;
    if (hasUnsaved) {
      const ok = await confirmDiscard(
        'Bạn có thay đổi chưa lưu. Đổi mục sẽ mất nội dung đang soạn. Tiếp tục?'
      );
      if (!ok) return;
    }
    setSection(nextKey);
  };

  const openItemForm = (nextForm) => {
    setForm(nextForm);
    formBaselineRef.current = snapshotOf(nextForm);
  };

  const closeItemForm = async () => {
    if (formDirty) {
      const ok = await confirmDiscard('Hủy sẽ mất thay đổi chưa lưu. Tiếp tục?');
      if (!ok) return;
    }
    setForm(null);
    formBaselineRef.current = '';
  };

  const uploadImage = async (file, onUrl) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.centerInfo.uploadImage(file);
      if (!res?.success || !res.imageUrl) throw new Error(res?.message || 'Upload thất bại');
      onUrl(res.imageUrl);
      toast.success('Đã tải ảnh — nhớ bấm Lưu để giữ lại');
    } catch (err) {
      toast.error(err.message || 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  };

  const saveOverview = async () => {
    if (!overview) return;
    setSaving(true);
    try {
      const res = await api.centerInfo.saveOverview(overview);
      if (!res?.success) throw new Error(res?.message || 'Lưu thất bại');
      setOverview(res.data);
      overviewBaselineRef.current = snapshotOf(res.data);
      toast.success('Đã lưu tổng quan');
    } catch (err) {
      toast.error(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const saveItem = async () => {
    if (!form) return;
    if (!String(form.title || '').trim()) {
      toast.error('Nhập tiêu đề / tên');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, section };
      let res;
      if (form.id) res = await api.centerInfo.updateItem(form.id, payload);
      else res = await api.centerInfo.createItem(payload);
      if (!res?.success) throw new Error(res?.message || 'Lưu thất bại');
      toast.success(form.id ? 'Đã cập nhật' : 'Đã thêm');
      setForm(null);
      formBaselineRef.current = '';
      await loadItems(section);
    } catch (err) {
      toast.error(err.message || 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const removeItem = async (id) => {
    if (!(await window.cmsConfirm?.('Xóa mục này?') ?? window.confirm('Xóa mục này?'))) return;
    try {
      const res = await api.centerInfo.removeItem(id);
      if (!res?.success) throw new Error(res?.message || 'Xóa thất bại');
      toast.success('Đã xóa');
      if (form?.id === id) {
        setForm(null);
        formBaselineRef.current = '';
      }
      await loadItems(section);
    } catch (err) {
      toast.error(err.message || 'Xóa thất bại');
    }
  };

  const moveItem = async (index, dir) => {
    const next = [...items];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    try {
      await api.centerInfo.reorderItems(section, next.map((x) => x.id));
    } catch {
      toast.error('Không sắp xếp được');
      await loadItems(section);
    }
  };

  const patchOverview = (key, val) => setOverview((prev) => ({ ...prev, [key]: val }));
  const patchForm = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const statusLabel =
    overview?.status === 'published'
      ? 'Published — đang hiện công khai'
      : overview?.status === 'archived'
        ? 'Archived — đang ẩn'
        : 'Draft — chưa hiện cho mọi người';

  return (
    <div className={`cms-sd cms-sd-page bg-slate-50 min-h-full py-2 sm:py-4 ${hasUnsaved ? 'pb-24' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link
            to="/admin/center-info"
            className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-red-600 mb-1"
            onClick={async (e) => {
              if (!hasUnsaved) return;
              e.preventDefault();
              const ok = await confirmDiscard(
                'Bạn có thay đổi chưa lưu. Rời trang sẽ mất nội dung đang soạn. Tiếp tục?'
              );
              if (ok) navigate('/admin/center-info');
            }}
          >
            <ArrowLeft size={14} /> Xem trang công khai
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-red-600" size={22} />
            Quản trị Thông tin trung tâm
          </h1>
        </div>
        {section === 'overview' && overview && !loading ? (
          <button
            type="button"
            disabled={saving || !overviewDirty}
            onClick={saveOverview}
            className="inline-flex items-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 shrink-0"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            Lưu tổng quan
          </button>
        ) : null}
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <aside className="lg:w-52 shrink-0">
          <nav className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm space-y-1 lg:sticky lg:top-4">
            {CENTER_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => requestSectionChange(s.key)}
                className={`w-full text-left px-3 min-h-10 rounded-xl text-sm font-bold ${
                  section === s.key ? 'bg-red-600 text-white' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 py-12 justify-center">
              <Loader2 className="animate-spin" /> Đang tải...
            </div>
          ) : section === 'overview' && overview ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 space-y-4 shadow-sm">
              {overview.status !== 'published' ? (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">{statusLabel}</p>
                    <p className="text-xs mt-0.5 text-amber-800/90">
                      Nội dung vẫn lưu được khi bấm 「Lưu tổng quan」, nhưng trang công khai chỉ hiện khi chọn Published rồi lưu lại.
                    </p>
                  </div>
                </div>
              ) : null}
              {overviewDirty ? (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 font-bold">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  Có thay đổi chưa lưu — nhớ bấm 「Lưu tổng quan」.
                </div>
              ) : null}
              <Field label="Trạng thái trang">
                <CmsSelect
                  value={overview.status || 'draft'}
                  onChange={(e) => patchOverview('status', e.target.value)}
                  className={inputClass}
                >
                  <option value="draft">Draft — chưa hiện cho mọi người</option>
                  <option value="published">Published — công khai</option>
                  <option value="archived">Archived — ẩn</option>
                </CmsSelect>
              </Field>
              <Field label="Tên trung tâm">
                <input className={inputClass} value={overview.name || ''} onChange={(e) => patchOverview('name', e.target.value)} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <ImagePick
                  value={overview.logoUrl}
                  onChange={(u) => patchOverview('logoUrl', u)}
                  label="Logo"
                  uploading={uploading}
                  onPickFile={uploadImage}
                />
                <ImagePick
                  value={overview.bannerUrl}
                  onChange={(u) => patchOverview('bannerUrl', u)}
                  label="Banner"
                  uploading={uploading}
                  onPickFile={uploadImage}
                />
              </div>
              <Field label="Giới thiệu ngắn">
                <textarea className={inputClass} rows={3} value={overview.intro || ''} onChange={(e) => patchOverview('intro', e.target.value)} />
              </Field>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Sứ mệnh">
                  <textarea className={inputClass} rows={3} value={overview.mission || ''} onChange={(e) => patchOverview('mission', e.target.value)} />
                </Field>
                <Field label="Tầm nhìn">
                  <textarea className={inputClass} rows={3} value={overview.vision || ''} onChange={(e) => patchOverview('vision', e.target.value)} />
                </Field>
                <Field label="Giá trị cốt lõi">
                  <textarea className={inputClass} rows={3} value={overview.coreValues || ''} onChange={(e) => patchOverview('coreValues', e.target.value)} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Năm thành lập">
                  <input className={inputClass} value={overview.foundedYear || ''} onChange={(e) => patchOverview('foundedYear', e.target.value)} />
                </Field>
                <Field label="Website">
                  <input className={inputClass} value={overview.website || ''} onChange={(e) => patchOverview('website', e.target.value)} placeholder="https://" />
                </Field>
                <Field label="Email">
                  <input className={inputClass} value={overview.contactEmail || ''} onChange={(e) => patchOverview('contactEmail', e.target.value)} />
                </Field>
                <Field label="Số điện thoại">
                  <input className={inputClass} value={overview.contactPhone || ''} onChange={(e) => patchOverview('contactPhone', e.target.value)} />
                </Field>
              </div>
              <Field label="Địa chỉ trụ sở">
                <input className={inputClass} value={overview.headquartersAddress || ''} onChange={(e) => patchOverview('headquartersAddress', e.target.value)} />
              </Field>
              <Field label="Nội dung giới thiệu chi tiết">
                <RichTextEditor
                  value={overview.detailHtml || ''}
                  onChange={(v) => patchOverview('detailHtml', v)}
                  placeholder="Soạn bài giới thiệu..."
                />
              </Field>
              <Field label="Gallery (mỗi URL một dòng, hoặc upload rồi dán path)">
                <textarea
                  className={inputClass}
                  rows={3}
                  value={(overview.galleryUrls || []).join('\n')}
                  onChange={(e) => patchOverview('galleryUrls', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
                  placeholder="/uploads/center-info/..."
                />
                <GalleryAddButton
                  uploading={uploading}
                  onPick={(f) => {
                    uploadImage(f, (url) => {
                      setOverview((prev) => ({
                        ...prev,
                        galleryUrls: [...(prev.galleryUrls || []), url],
                      }));
                    });
                  }}
                />
              </Field>
              <Field label="Video giới thiệu (URL YouTube embed hoặc file)">
                <input className={inputClass} value={overview.introVideoUrl || ''} onChange={(e) => patchOverview('introVideoUrl', e.target.value)} />
              </Field>
              <button
                type="button"
                disabled={saving || !overviewDirty}
                onClick={saveOverview}
                className="inline-flex items-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Lưu tổng quan
              </button>
            </div>
          ) : SECTION_ITEM_KEYS.includes(section) ? (
            <>
              <div className="flex justify-between items-center gap-2">
                <p className="text-sm font-bold text-slate-600">{items.length} mục</p>
                <button
                  type="button"
                  onClick={async () => {
                    if (formDirty) {
                      const ok = await confirmDiscard('Có form đang sửa chưa lưu. Tạo mới sẽ mất thay đổi. Tiếp tục?');
                      if (!ok) return;
                    }
                    openItemForm(blankItem(section));
                  }}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-2xl bg-red-600 text-white text-sm font-bold"
                >
                  <Plus size={15} /> Thêm mới
                </button>
              </div>

              {form ? (
                <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-6 space-y-3 shadow-sm">
                  <h3 className="font-bold text-red-700">{form.id ? 'Chỉnh sửa' : 'Thêm mới'}</h3>
                  {formDirty ? (
                    <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 font-bold">
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      Có thay đổi chưa lưu — nhớ bấm 「Lưu」.
                    </div>
                  ) : null}
                  <Field label="Tên / tiêu đề *">
                    <input className={inputClass} value={form.title || ''} onChange={(e) => patchForm('title', e.target.value)} />
                  </Field>
                  <Field label="Phụ đề / chức danh">
                    <input className={inputClass} value={form.subtitle || ''} onChange={(e) => patchForm('subtitle', e.target.value)} />
                  </Field>
                  <ImagePick
                    value={form.imageUrl}
                    onChange={(u) => patchForm('imageUrl', u)}
                    uploading={uploading}
                    onPickFile={uploadImage}
                  />
                  {(section === 'social') ? (
                    <Field label="Icon (emoji)">
                      <input className={inputClass} value={form.icon || ''} onChange={(e) => patchForm('icon', e.target.value)} placeholder="📘" />
                    </Field>
                  ) : null}
                  <Field label="Mô tả ngắn">
                    <textarea className={inputClass} rows={2} value={form.description || ''} onChange={(e) => patchForm('description', e.target.value)} />
                  </Field>
                  <Field label="Nội dung chi tiết">
                    <RichTextEditor value={form.detailHtml || ''} onChange={(v) => patchForm('detailHtml', v)} />
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['staff', 'branch', 'exam_venue'].includes(section) ? (
                      <>
                        <Field label="Email">
                          <input className={inputClass} value={form.email || ''} onChange={(e) => patchForm('email', e.target.value)} />
                        </Field>
                        <Field label="Điện thoại">
                          <input className={inputClass} value={form.phone || ''} onChange={(e) => patchForm('phone', e.target.value)} />
                        </Field>
                      </>
                    ) : null}
                    {section === 'staff' ? (
                      <>
                        <Field label="Bộ phận">
                          <input className={inputClass} value={form.department || ''} onChange={(e) => patchForm('department', e.target.value)} />
                        </Field>
                        <Field label="Chuyên môn">
                          <input className={inputClass} value={form.expertise || ''} onChange={(e) => patchForm('expertise', e.target.value)} />
                        </Field>
                        <Field label="Kinh nghiệm">
                          <input className={inputClass} value={form.experience || ''} onChange={(e) => patchForm('experience', e.target.value)} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mt-6">
                          <input type="checkbox" checked={Boolean(form.showEmail)} onChange={(e) => patchForm('showEmail', e.target.checked)} />
                          Hiện email công khai
                        </label>
                      </>
                    ) : null}
                    {['branch', 'exam_venue'].includes(section) ? (
                      <>
                        <Field label="Mã">
                          <input className={inputClass} value={form.code || ''} onChange={(e) => patchForm('code', e.target.value)} />
                        </Field>
                        <Field label="Địa chỉ">
                          <input className={inputClass} value={form.address || ''} onChange={(e) => patchForm('address', e.target.value)} />
                        </Field>
                        <Field label="Thành phố / tỉnh">
                          <input className={inputClass} value={form.city || ''} onChange={(e) => patchForm('city', e.target.value)} />
                        </Field>
                        <Field label="Người phụ trách">
                          <input className={inputClass} value={form.managerName || ''} onChange={(e) => patchForm('managerName', e.target.value)} />
                        </Field>
                        <Field label="Giờ hoạt động / lịch">
                          <input className={inputClass} value={form.hours || form.scheduleInfo || ''} onChange={(e) => {
                            patchForm('hours', e.target.value);
                            patchForm('scheduleInfo', e.target.value);
                          }} />
                        </Field>
                        <Field label="Google Maps URL">
                          <input className={inputClass} value={form.mapsUrl || ''} onChange={(e) => patchForm('mapsUrl', e.target.value)} />
                        </Field>
                      </>
                    ) : null}
                    {section === 'exam_venue' ? (
                      <>
                        <Field label="Loại kỳ thi">
                          <input className={inputClass} value={form.examType || ''} onChange={(e) => patchForm('examType', e.target.value)} />
                        </Field>
                        <Field label="Sức chứa">
                          <input className={inputClass} value={form.capacity || ''} onChange={(e) => patchForm('capacity', e.target.value)} />
                        </Field>
                      </>
                    ) : null}
                    {section === 'social' || section === 'service' || section === 'certificate' ? (
                      <Field label="URL / Link">
                        <input className={inputClass} value={form.url || ''} onChange={(e) => patchForm('url', e.target.value)} placeholder="https://" />
                      </Field>
                    ) : null}
                    {section === 'service' ? (
                      <>
                        <Field label="Đối tượng học">
                          <input className={inputClass} value={form.audience || ''} onChange={(e) => patchForm('audience', e.target.value)} />
                        </Field>
                        <Field label="Nội dung đào tạo">
                          <input className={inputClass} value={form.curriculum || ''} onChange={(e) => patchForm('curriculum', e.target.value)} />
                        </Field>
                        <Field label="Thời lượng">
                          <input className={inputClass} value={form.duration || ''} onChange={(e) => patchForm('duration', e.target.value)} />
                        </Field>
                        <Field label="Hình thức học">
                          <input className={inputClass} value={form.learningMode || ''} onChange={(e) => patchForm('learningMode', e.target.value)} />
                        </Field>
                        <Field label="Thông tin học phí">
                          <input className={inputClass} value={form.priceInfo || ''} onChange={(e) => patchForm('priceInfo', e.target.value)} />
                        </Field>
                      </>
                    ) : null}
                    {section === 'certificate' ? (
                      <>
                        <Field label="Đơn vị cấp">
                          <input className={inputClass} value={form.issuer || ''} onChange={(e) => patchForm('issuer', e.target.value)} />
                        </Field>
                        <Field label="Điều kiện đạt">
                          <input className={inputClass} value={form.requirements || ''} onChange={(e) => patchForm('requirements', e.target.value)} />
                        </Field>
                        <Field label="Kỳ thi liên quan">
                          <input className={inputClass} value={form.relatedExam || ''} onChange={(e) => patchForm('relatedExam', e.target.value)} />
                        </Field>
                        <Field label="Thời hạn">
                          <input className={inputClass} value={form.validity || ''} onChange={(e) => patchForm('validity', e.target.value)} />
                        </Field>
                        <Field label="Thông tin xác minh">
                          <input className={inputClass} value={form.verifyInfo || ''} onChange={(e) => patchForm('verifyInfo', e.target.value)} />
                        </Field>
                        <Field label="Link xác minh">
                          <input className={inputClass} value={form.verifyUrl || ''} onChange={(e) => patchForm('verifyUrl', e.target.value)} />
                        </Field>
                      </>
                    ) : null}
                    <Field label="Trạng thái">
                      <CmsSelect value={form.status || 'published'} onChange={(e) => patchForm('status', e.target.value)} className={inputClass}>
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </CmsSelect>
                    </Field>
                    <label className="flex items-center gap-2 text-sm font-bold text-slate-700 mt-6">
                      <input type="checkbox" checked={form.isActive !== false} onChange={(e) => patchForm('isActive', e.target.checked)} />
                      Active (hiện khi Published)
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button type="button" disabled={saving || !formDirty} onClick={saveItem} className="inline-flex items-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 text-white text-sm font-bold disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Lưu
                    </button>
                    <button type="button" onClick={closeItemForm} className="min-h-11 px-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">
                      Hủy
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {items.map((item, idx) => (
                  <div key={item.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="min-w-0 flex items-center gap-3">
                      {item.imageUrl ? (
                        <img src={resolveMediaUrl(item.imageUrl)} alt="" className="w-12 h-12 rounded-lg object-cover" />
                      ) : null}
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 truncate">{item.title}</p>
                        <p className="text-xs text-slate-400">
                          {item.status} · {item.isActive === false ? 'Inactive' : 'Active'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={() => moveItem(idx, -1)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Lên">
                        <ArrowUp size={16} />
                      </button>
                      <button type="button" onClick={() => moveItem(idx, 1)} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Xuống">
                        <ArrowDown size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (formDirty) {
                            const ok = await confirmDiscard('Có form đang sửa chưa lưu. Đổi sang mục khác sẽ mất thay đổi. Tiếp tục?');
                            if (!ok) return;
                          }
                          openItemForm({ ...item });
                        }}
                        className="px-3 min-h-9 rounded-xl text-xs font-bold text-sky-700 bg-sky-50"
                      >
                        Sửa
                      </button>
                      <button type="button" onClick={() => removeItem(item.id)} className="p-2 rounded-lg text-red-600 hover:bg-red-50" aria-label="Xóa">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {!items.length ? (
                  <p className="p-8 text-center text-sm text-slate-400">Chưa có mục — bấm Thêm mới</p>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {hasUnsaved ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 justify-between">
            <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              Có nội dung chưa lưu — thoát hoặc đổi mục sẽ mất thay đổi.
            </p>
            {section === 'overview' ? (
              <button
                type="button"
                disabled={saving}
                onClick={saveOverview}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Lưu tổng quan
              </button>
            ) : form ? (
              <button
                type="button"
                disabled={saving}
                onClick={saveItem}
                className="inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Lưu mục
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
