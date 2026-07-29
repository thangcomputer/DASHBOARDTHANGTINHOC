import React, { useEffect, useRef, useState } from 'react';
import { useAdminTab } from '../AdminTabContext';
import { Lock, RefreshCw, MoreVertical, Trash2 } from 'lucide-react';
import api from '../../../services/api';

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatMoney(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n === 0) return '—';
  const abs = Math.abs(n).toLocaleString('vi-VN') + 'đ';
  return n < 0 ? `−${abs}` : abs;
}

function RowMenu({ logId, onDeleted, toast }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm('Xóa dòng nhật ký này?')) return;
    setBusy(true);
    try {
      const res = await api.systemLogs.remove(logId);
      if (!res?.success) throw new Error(res?.message || 'Xóa thất bại');
      toast?.success?.('Đã xóa nhật ký');
      setOpen(false);
      onDeleted?.(logId);
    } catch (err) {
      toast?.error?.(err.message || 'Không xóa được nhật ký');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex justify-end" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Tùy chọn"
      >
        <MoreVertical size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          <button
            type="button"
            disabled={busy}
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={14} />
            {busy ? 'Đang xóa…' : 'Xóa nhật ký'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminLogsTab() {
  const {
    isLoadingLogs, setIsLoadingLogs, dbLogs, setDbLogs, toast,
  } = useAdminTab();

  const refresh = () => {
    setIsLoadingLogs(true);
    api.systemLogs.getAll(1, 100)
      .then((res) => setDbLogs(res.data || []))
      .catch(() => toast?.error?.('Không tải được nhật ký'))
      .finally(() => setIsLoadingLogs(false));
  };

  const onDeleted = (id) => {
    setDbLogs((prev) => (Array.isArray(prev) ? prev.filter((l) => String(l._id || l.id) !== String(id)) : []));
  };

  const rows = Array.isArray(dbLogs) ? dbLogs : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Lock size={20} className="text-slate-600" />
            Nhật Ký Hệ Thống
          </h2>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-bold text-blue-600 flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4"
          >
            <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          {isLoadingLogs ? (
            <div className="p-12 text-center text-gray-400">
              <RefreshCw size={40} className="mx-auto mb-3 text-gray-300 animate-spin" />
              <p className="text-sm">Đang tải nhật ký...</p>
            </div>
          ) : rows.length > 0 ? (
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 w-14">STT</th>
                  <th className="px-4 py-3 w-44">Ngày tháng</th>
                  <th className="px-4 py-3">Nội dung</th>
                  <th className="px-4 py-3 w-44">Ai làm</th>
                  <th className="px-4 py-3 w-36 text-right">Tiền</th>
                  <th className="px-4 py-3 w-12" aria-label="Thao tác" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((log, idx) => {
                  const id = log._id || log.id;
                  const amount = Number(log.amount) || 0;
                  return (
                    <tr key={id || idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 text-slate-400 font-semibold tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                      <td className="px-4 py-3 text-slate-800">
                        <div className="font-medium leading-snug">{log.message || log.action || '—'}</div>
                        {log.action && log.message && log.message !== log.action && (
                          <div className="text-[11px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wide">
                            {log.action}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">
                        {log.name || 'Hệ thống'}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold tabular-nums whitespace-nowrap ${amount < 0 ? 'text-red-600' : amount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {formatMoney(amount)}
                      </td>
                      <td className="px-2 py-3">
                        <RowMenu logId={id} onDeleted={onDeleted} toast={toast} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-12 text-center text-gray-400">
              <Lock size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm">Chưa có hoạt động nào được ghi nhận</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
