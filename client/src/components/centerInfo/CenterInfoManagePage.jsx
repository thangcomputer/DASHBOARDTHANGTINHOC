import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Loader2, Plus, Save, Trash2, ArrowUp, ArrowDown, ImagePlus, ArrowLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
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

export default function CenterInfoManagePage() {
  const toast = useToast();
  const [section, setSection] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadOverview = useCallback(async () => {
    const res = await api.centerInfo.getOverview();
    if (!res?.success) throw new Error(res?.message || 'Không tải overview');
    setOverview(res.data);
  }, []);

  const loadItems = useCallback(async (sec) => {
    const res = await api.centerInfo.listItems(sec);
    if (!res?.success) throw new Error(res?.message || 'Không tải danh sách');
    setItems(Array.isArray(res.data) ? res.data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setForm(null);
      try {
        if (section === 'overview') {
          await loadOverview();
        } else {
          await loadItems(section);
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || 'Lỗi tải dữ liệu');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [section, loadOverview, loadItems, toast]);

  const uploadImage = async (file, onUrl) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.centerInfo.uploadImage(file);
      if (!res?.success || !res.imageUrl) throw new Error(res?.message || 'Upload thất bại');
      onUrl(res.imageUrl);
      toast.success('Đã tải ảnh');
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
      if (form?.id === id) setForm(null);
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

  const ImagePick = ({ value, onChange, label = 'Ảnh' }) => (
    <Field label={label}>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="w-28 aspect-video rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={resolveMediaUrl(value)} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400 font-bold">Chưa có</span>
          )}
        </div>
        <label className={`inline-flex items-center gap-2 min-h-11 px-3 rounded-xl border-2 border-dashed border-red-300 bg-red-50/50 text-red-800 text-xs font-black cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? <Loader2 className="animate-spin" size={14} /> : <ImagePlus size={14} />}
          Chọn ảnh
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              uploadImage(f, onChange);
            }}
          />
        </label>
        {value ? (
          <button type="button" onClick={() => onChange('')} className="text-xs font-bold text-red-600">
            Xóa ảnh
          </button>
        ) : null}
      </div>
    </Field>
  );

  return (
    <div className="cms-sd cms-sd-page bg-slate-50 min-h-full py-2 sm:py-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div>
          <Link to="/admin/center-info" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 hover:text-red-600 mb-1">
            <ArrowLeft size={14} /> Xem trang công khai
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Building2 className="text-red-600" size={22} />
            Quản trị Thông tin trung tâm
          </h1>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4">
        <aside className="lg:w-52 shrink-0">
          <nav className="rounded-2xl border border-slate-100 bg-white p-2 shadow-sm space-y-1">
            {CENTER_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSection(s.key)}
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
                <ImagePick value={overview.logoUrl} onChange={(u) => patchOverview('logoUrl', u)} label="Logo" />
                <ImagePick value={overview.bannerUrl} onChange={(u) => patchOverview('bannerUrl', u)} label="Banner" />
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
                <label className="inline-flex mt-2 items-center gap-2 text-xs font-bold text-red-700 cursor-pointer">
                  <ImagePlus size={14} /> Thêm ảnh vào gallery
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      uploadImage(f, (url) => {
                        setOverview((prev) => ({
                          ...prev,
                          galleryUrls: [...(prev.galleryUrls || []), url],
                        }));
                      });
                    }}
                  />
                </label>
              </Field>
              <Field label="Video giới thiệu (URL YouTube embed hoặc file)">
                <input className={inputClass} value={overview.introVideoUrl || ''} onChange={(e) => patchOverview('introVideoUrl', e.target.value)} />
              </Field>
              <button
                type="button"
                disabled={saving}
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
                  onClick={() => setForm(blankItem(section))}
                  className="inline-flex items-center gap-2 min-h-10 px-4 rounded-2xl bg-red-600 text-white text-sm font-bold"
                >
                  <Plus size={15} /> Thêm mới
                </button>
              </div>

              {form ? (
                <div className="bg-white rounded-2xl border border-red-200 p-4 sm:p-6 space-y-3 shadow-sm">
                  <h3 className="font-bold text-red-700">{form.id ? 'Chỉnh sửa' : 'Thêm mới'}</h3>
                  <Field label="Tên / tiêu đề *">
                    <input className={inputClass} value={form.title || ''} onChange={(e) => patchForm('title', e.target.value)} />
                  </Field>
                  <Field label="Phụ đề / chức danh">
                    <input className={inputClass} value={form.subtitle || ''} onChange={(e) => patchForm('subtitle', e.target.value)} />
                  </Field>
                  <ImagePick value={form.imageUrl} onChange={(u) => patchForm('imageUrl', u)} />
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
                    <button type="button" disabled={saving} onClick={saveItem} className="inline-flex items-center gap-2 min-h-11 px-5 rounded-2xl bg-red-600 text-white text-sm font-bold disabled:opacity-50">
                      {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Lưu
                    </button>
                    <button type="button" onClick={() => setForm(null)} className="min-h-11 px-4 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600">
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
                      <button type="button" onClick={() => setForm({ ...item })} className="px-3 min-h-9 rounded-xl text-xs font-bold text-sky-700 bg-sky-50">
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
    </div>
  );
}
