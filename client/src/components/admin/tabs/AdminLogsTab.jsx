import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAdminTab } from '../AdminTabContext';
import { useAdminLogs } from '../hooks/AdminLogsContext';
import { Download, Lock, RefreshCw, MoreVertical, Search, Trash2, X } from 'lucide-react';
import api from '../../../services/api';
import { loadXlsx } from '../../../utils/loadXlsx';

function vnDateKey(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
}

function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
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
  if (!Number.isFinite(n) || n === 0) return '-';
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
    if (!(await window.cmsConfirm('Xóa dòng nhật ký này?'))) return;
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
  const { toast } = useAdminTab();
  const {
    isLoadingLogs, dbLogs, setDbLogs, refreshLogs,
  } = useAdminLogs();

  const refresh = () => {
    refreshLogs()
      .catch(() => toast?.error?.('Không tải được nhật ký'));
  };

  const onDeleted = (id) => {
    setDbLogs((prev) => (Array.isArray(prev) ? prev.filter((l) => String(l._id || l.id) !== String(id)) : []));
  };

  const rows = Array.isArray(dbLogs) ? dbLogs : [];
  const [search, setSearch] = useState('');
  const [moneyFilter, setMoneyFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [exporting, setExporting] = useState(false);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((log) => {
      if (q) {
        const hay = `${log.message || ''} ${log.action || ''} ${log.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const amount = Number(log.amount) || 0;
      if (moneyFilter === 'money' && amount === 0) return false;
      if (moneyFilter === 'income' && amount <= 0) return false;
      if (moneyFilter === 'expense' && amount >= 0) return false;
      if (fromDate || toDate) {
        const key = vnDateKey(log.createdAt);
        if (!key) return false;
        if (fromDate && key < fromDate) return false;
        if (toDate && key > toDate) return false;
      }
      return true;
    });
  }, [rows, search, moneyFilter, fromDate, toDate]);

  const hasFilter = Boolean(search.trim() || moneyFilter !== 'all' || fromDate || toDate);

  const clearFilters = () => {
    setSearch('');
    setMoneyFilter('all');
    setFromDate('');
    setToDate('');
  };

  const handleExportExcel = async () => {
    if (exporting || !filteredRows.length) return;
    setExporting(true);
    try {
      const XLSX = await loadXlsx();
      const exportData = filteredRows.map((log, idx) => ({
        STT: idx + 1,
        'Thời gian': formatDate(log.createdAt),
        'Nội dung': log.message || log.action || '-',
        'Hành động': log.action || '',
        'Ai thực hiện': log.name || 'Hệ thống',
        'Số tiền (VNĐ)': Number(log.amount) || 0,
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'NhatKyHeThong');
      XLSX.writeFile(wb, `Nhat-ky-he-thong-${vnDateKey(new Date()) || 'export'}.xlsx`);
      toast?.success?.(`Đã xuất ${filteredRows.length} dòng nhật ký ra Excel`);
    } catch (err) {
      toast?.error?.(err.message || 'Không thể xuất file Excel');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="cms-viewport-module bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in fade-in duration-500">
      <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white shrink-0">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Lock size={20} className="text-slate-600" />
            Nhật Ký Hệ Thống
          </h2>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-600 tabular-nums">
            {filteredRows.length}/{rows.length} dòng
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting || !filteredRows.length}
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download size={14} aria-hidden="true" />
            {exporting ? 'Đang xuất…' : 'Xuất Excel (.xlsx)'}
          </button>
          <button
            type="button"
            onClick={refresh}
            className="text-xs font-bold text-blue-600 flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-1.5 hover:bg-blue-100/80 transition"
          >
            <RefreshCw size={14} className={isLoadingLogs ? 'animate-spin' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* Bộ lọc thông minh */}
      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-2.5 shrink-0">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm nội dung, hành động, người làm…"
            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <select
          value={moneyFilter}
          onChange={(e) => setMoneyFilter(e.target.value)}
          aria-label="Lọc theo giao dịch tiền"
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 focus:border-emerald-500 focus:outline-none"
        >
          <option value="all">Tất cả hoạt động</option>
          <option value="money">Có phát sinh tiền</option>
          <option value="income">Khoản thu (+)</option>
          <option value="expense">Khoản chi (−)</option>
        </select>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="font-semibold">Từ:</span>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="Từ ngày"
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
          />
          <span className="font-semibold">Đến:</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="Đến ngày"
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-emerald-500 focus:outline-none"
          />
        </div>
        {hasFilter && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
          >
            <X size={13} aria-hidden="true" /> Xóa lọc
          </button>
        )}
      </div>

      <div className="cms-viewport-scroll overflow-x-auto">
        {isLoadingLogs ? (
          <div className="p-12 text-center text-gray-400">
            <RefreshCw size={40} className="mx-auto mb-3 text-gray-300 animate-spin" />
            <p className="text-sm">Đang tải nhật ký...</p>
          </div>
        ) : filteredRows.length > 0 ? (
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left text-[11px] font-black  tracking-wider text-slate-500">
                <th className="px-4 py-3 w-14">STT</th>
                <th className="px-4 py-3 w-44">Ngày tháng</th>
                <th className="px-4 py-3">Nội dung</th>
                <th className="px-4 py-3 w-44">Ai làm</th>
                <th className="px-4 py-3 w-36 text-right">Tiền</th>
                <th className="px-4 py-3 w-12" aria-label="Thao tác" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.map((log, idx) => {
                const id = log._id || log.id;
                const amount = Number(log.amount) || 0;
                return (
                  <tr key={id || idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 text-slate-400 font-semibold tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-800">
                      <div className="font-medium leading-snug">{log.message || log.action || '-'}</div>
                      {log.action && log.message && log.message !== log.action && (
                        <div className="text-[11px] text-slate-400 mt-0.5 font-semibold  tracking-wide">
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
            <p className="text-sm">
              {hasFilter ? 'Không có dòng nhật ký nào khớp bộ lọc hiện tại' : 'Chưa có hoạt động nào được ghi nhận'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
