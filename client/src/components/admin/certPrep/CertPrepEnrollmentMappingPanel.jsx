import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import certPrepApi, { certPrepErrorMessage } from '../../../services/certPrepApi';
import { apiFetch } from '../../../services/api';
import CertPrepEmptyState from './CertPrepEmptyState';

async function loadCatalogCourses() {
  const res = await apiFetch('/courses');
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data.data) ? data.data : [];
}

export default function CertPrepEnrollmentMappingPanel({ certPrepCourses, toast }) {
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [certPrepCourseId, setCertPrepCourseId] = useState('');

  const reload = async () => {
    setLoading(true);
    try {
      const [mapRes, courses] = await Promise.all([
        certPrepApi.enrollmentMappings.list(),
        loadCatalogCourses(),
      ]);
      setRows(Array.isArray(mapRes.data) ? mapRes.data : []);
      setCatalog(courses);
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không tải được liên kết khóa học'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!courseId || !certPrepCourseId || saving) return;
    setSaving(true);
    try {
      await certPrepApi.enrollmentMappings.save({ courseId, certPrepCourseId, isActive: true });
      toast.success('Đã lưu liên kết khóa học');
      setCourseId('');
      setCertPrepCourseId('');
      await reload();
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không lưu được liên kết'));
    } finally {
      setSaving(false);
    }
  };

  const disable = async (row) => {
    setSaving(true);
    try {
      await certPrepApi.enrollmentMappings.disable(row.id);
      toast.success('Đã tắt liên kết. Enrollment mới sẽ không tự cấp quyền.');
      await reload();
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không tắt được liên kết'));
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSaving(true);
    try {
      const res = await certPrepApi.enrollmentMappings.sync();
      const granted = res.data?.granted ?? 0;
      toast.success(`Đã đồng bộ. Cấp/cập nhật ${granted} quyền từ enrollment hợp lệ.`);
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không đồng bộ được'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cms-card p-4 sm:p-5 space-y-3">
        <h3 className="text-base font-bold text-slate-900">Liên kết khóa học</h3>
        <p className="text-sm text-slate-500">
          Map khóa học đăng ký hiện tại với chương trình ôn thi. Học viên được thêm/gán khóa đã map sẽ tự được cấp quyền CertPrep.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm font-bold text-slate-600">
            Khóa học
            <CmsSelect aria-label="Khóa học" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Chọn khóa học</option>
              {catalog.map((c) => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </CmsSelect>
          </label>
          <label className="text-sm font-bold text-slate-600">
            CertPrep
            <CmsSelect aria-label="CertPrep" value={certPrepCourseId} onChange={(e) => setCertPrepCourseId(e.target.value)}>
              <option value="">Chọn chương trình ôn thi</option>
              {certPrepCourses.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
              ))}
            </CmsSelect>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving || !courseId || !certPrepCourseId}
            onClick={save}
            className="min-h-11 px-4 rounded-xl font-bold text-sm bg-red-600 text-white disabled:opacity-60"
          >
            Lưu mapping
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={sync}
            className="min-h-11 px-4 rounded-xl font-bold text-sm border border-slate-200 text-slate-700"
          >
            Đồng bộ quyền từ enrollment
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cms-card flex items-center justify-center py-10 text-slate-400" role="status">
          <Loader2 className="animate-spin mr-2" size={18} aria-hidden="true" /> Đang tải liên kết...
        </div>
      ) : !rows.length ? (
        <CertPrepEmptyState title="Chưa có liên kết khóa học." hint="Chọn khóa học và chương trình CertPrep rồi bấm Lưu mapping." />
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="cms-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-bold text-slate-900">{row.courseName || row.courseId}</p>
                <p className="text-sm text-slate-500">CertPrep: {row.certPrepCourseName || row.certPrepCourseId}</p>
                <p className={`text-xs font-bold mt-1 ${row.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                  {row.isActive ? '✓ Tự động cấp quyền' : 'Đã tắt'}
                </p>
              </div>
              {row.isActive ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => disable(row)}
                  className="min-h-11 px-3 rounded-xl text-sm font-bold text-slate-600 border border-slate-200"
                >
                  Tắt
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
