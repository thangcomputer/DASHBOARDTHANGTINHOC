import { useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import CmsSelect from '../../ui/CmsSelect';
import certPrepApi, { certPrepErrorMessage } from '../../../services/certPrepApi';
import CertPrepEmptyState from './CertPrepEmptyState';
import CertPrepConfirmDialog from './CertPrepConfirmDialog';

function studentLabel(row) {
  const s = row.studentId && typeof row.studentId === 'object' ? row.studentId : null;
  if (!s) return String(row.studentId || '—');
  return `${s.name || 'Học viên'}${s.studentCode ? ` · ${s.studentCode}` : ''}${s.phone ? ` · ${s.phone}` : ''}`;
}

function courseLabel(row, courses) {
  const c = row.courseId && typeof row.courseId === 'object' ? row.courseId : null;
  if (c?.name) return c.name;
  const found = courses.find((x) => String(x._id || x.id) === String(row.courseId));
  return found?.name || '—';
}

export default function CertPrepAccessManager({ courses, rows, loading, onRefresh, toast }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [courseId, setCourseId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [extendRow, setExtendRow] = useState(null);
  const [extendDate, setExtendDate] = useState('');

  useEffect(() => {
    if (q.trim().length < 2) {
      return undefined;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await certPrepApi.students.search(q.trim());
        setHits(res.data || []);
      } catch (err) {
        toast.error(certPrepErrorMessage(err, 'Không tìm được học viên'));
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, toast]);

  const visibleHits = !selected && q.trim().length >= 2 ? hits : [];

  const grant = async () => {
    if (!selected || !courseId || saving) return;
    setSaving(true);
    try {
      await certPrepApi.access.grant({
        studentId: selected._id || selected.id,
        courseId,
        expiresAt: expiresAt || null,
      });
      toast.success('Đã cấp quyền ôn thi');
      setSelected(null);
      setQ('');
      setHits([]);
      await onRefresh();
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không cấp được quyền'));
    } finally {
      setSaving(false);
    }
  };

  const disable = async (row) => {
    setSaving(true);
    try {
      await certPrepApi.access.disable(row._id || row.id);
      toast.success('Đã vô hiệu hóa quyền');
      setConfirm(null);
      await onRefresh();
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không vô hiệu hóa được'));
    } finally {
      setSaving(false);
    }
  };

  const openExtend = (row, reenable = false) => {
    const iso = row.expiresAt ? new Date(row.expiresAt).toISOString().slice(0, 10) : '';
    setExtendDate(iso);
    setExtendRow({ row, reenable });
  };

  const applyExtend = async () => {
    if (!extendRow || saving) return;
    const { row, reenable } = extendRow;
    const studentId = row.studentId?._id || row.studentId;
    const cid = row.courseId?._id || row.courseId;
    setSaving(true);
    try {
      await certPrepApi.access.grant({
        studentId,
        courseId: cid,
        expiresAt: extendDate.trim() ? extendDate.trim() : null,
      });
      toast.success(reenable ? 'Đã bật lại quyền' : 'Đã cập nhật hạn quyền');
      setExtendRow(null);
      await onRefresh();
    } catch (err) {
      toast.error(certPrepErrorMessage(err, 'Không cập nhật được hạn'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="cms-card space-y-3">
        <h3 className="text-base font-bold text-slate-900">Cấp quyền ôn thi</h3>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Tìm học viên</span>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelected(null); }}
              placeholder="Tên, SĐT hoặc mã HV (tối thiểu 2 ký tự)"
              aria-label="Tìm học viên"
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm"
            />
          </div>
        </label>
        {searching ? <p className="text-xs text-slate-400 inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Đang tìm...</p> : null}
        {visibleHits.length > 0 ? (
          <ul className="rounded-xl border border-slate-100 divide-y max-h-48 overflow-y-auto">
            {visibleHits.map((s) => (
              <li key={s._id}>
                <button
                  type="button"
                  onClick={() => { setSelected(s); setHits([]); setQ(s.name || ''); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-50 text-sm"
                >
                  <span className="font-bold text-slate-800">{s.name}</span>
                  <span className="text-slate-500"> {s.studentCode || ''} {s.phone || ''}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {q.trim().length >= 2 && !searching && !visibleHits.length && !selected ? (
          <CertPrepEmptyState title="Không có học viên." hint="Thử tên, số điện thoại hoặc mã HV." />
        ) : null}
        {selected ? (
          <p className="text-sm font-semibold text-emerald-700">
            Đã chọn: {selected.name} {selected.studentCode ? `· ${selected.studentCode}` : ''}
          </p>
        ) : null}
        <label className="block space-y-1">
          <span className="text-xs font-bold text-slate-600">Khóa học</span>
          <CmsSelect value={courseId} aria-label="Khóa học cấp quyền" onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Chọn khóa</option>
            {courses.map((c) => (
              <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
            ))}
          </CmsSelect>
        </label>
        <label className="block space-y-1 max-w-xs">
          <span className="text-xs font-bold text-slate-600">Hạn quyền</span>
          <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm" />
        </label>
        <button
          type="button"
          disabled={!selected || !courseId || saving}
          onClick={grant}
          className="min-h-11 px-5 rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-50 inline-flex items-center gap-2"
        >
          {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
          Cấp quyền
        </button>
      </div>

      {loading ? (
        <div className="cms-card flex justify-center py-10 text-slate-400"><Loader2 className="animate-spin mr-2" /> Đang tải quyền...</div>
      ) : !rows?.length ? (
        <CertPrepEmptyState title="Chưa cấp quyền cho học viên nào." />
      ) : (
        <div className="overflow-x-auto cms-card p-0">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase text-left">
              <tr>
                <th className="px-4 py-3">Học viên</th>
                <th className="px-4 py-3">Khóa</th>
                <th className="px-4 py-3">Cấp lúc</th>
                <th className="px-4 py-3">Hết hạn</th>
                <th className="px-4 py-3">Trạng thái</th>
                <th className="px-4 py-3">Người cấp</th>
                <th className="px-4 py-3 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id || row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{studentLabel(row)}</td>
                  <td className="px-4 py-3">{courseLabel(row, courses)}</td>
                  <td className="px-4 py-3">{row.grantedAt ? new Date(row.grantedAt).toLocaleString('vi-VN') : '—'}</td>
                  <td className="px-4 py-3">{row.expiresAt ? new Date(row.expiresAt).toLocaleDateString('vi-VN') : 'Không hết hạn'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${row.isActive === false ? 'text-slate-400' : 'text-emerald-600'}`}>
                      {row.isActive === false ? 'Tắt' : 'Bật'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.grantedBy || '—'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button type="button" onClick={() => openExtend(row, false)} className="text-xs font-bold text-slate-600 hover:text-red-600">Gia hạn</button>
                    {row.isActive === false ? (
                      <button type="button" onClick={() => openExtend(row, true)} className="text-xs font-bold text-emerald-600">Bật lại</button>
                    ) : (
                      <button type="button" onClick={() => setConfirm(row)} className="text-xs font-bold text-red-600">Vô hiệu hóa</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CertPrepConfirmDialog
        open={!!confirm}
        title="Vô hiệu hóa quyền"
        message="Học viên sẽ không còn thấy khóa ôn thi này. Lịch sử phiên làm bài được giữ."
        confirmText="Vô hiệu hóa"
        loading={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => disable(confirm)}
      />
      <CertPrepConfirmDialog
        open={!!extendRow}
        title={extendRow?.reenable ? 'Bật lại quyền' : 'Gia hạn quyền'}
        message={(
          <label className="block space-y-1">
            <span className="text-xs font-bold text-slate-600">Hạn quyền (để trống = không hết hạn)</span>
            <input
              type="date"
              value={extendDate}
              onChange={(e) => setExtendDate(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl px-3 py-2.5 text-sm"
              aria-label="Hạn quyền mới"
            />
          </label>
        )}
        confirmText={extendRow?.reenable ? 'Bật lại' : 'Cập nhật hạn'}
        loading={saving}
        onCancel={() => setExtendRow(null)}
        onConfirm={applyExtend}
      />
    </div>
  );
}
