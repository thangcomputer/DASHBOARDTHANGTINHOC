import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive, Download, Loader2, RefreshCw, Trash2, Database, Plus,
} from 'lucide-react';
import { backupsAPI } from '../services/api';
import { useToast } from '../utils/toast';

function formatTime(t) {
  if (!t) return '—';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN');
}

const STATUS_STYLE = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-amber-50 text-amber-700',
  completed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
};

export default function BackupCenterPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        backupsAPI.list({ page: 1, limit: 30 }),
        backupsAPI.stats(),
      ]);
      if (listRes.success) setItems(listRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch {
      toast.error('Không tải được danh sách backup');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  const onCreate = async () => {
    setCreating(true);
    try {
      const res = await backupsAPI.create();
      if (res.success) {
        toast.success('Đã xếp hàng backup');
        await load();
      } else {
        toast.error(res.message || 'Tạo backup thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setCreating(false);
    }
  };

  const onDownload = async (row) => {
    setBusyId(row._id);
    try {
      await backupsAPI.download(row._id, row.filename || 'backup.json.gz');
    } catch (e) {
      toast.error(e.message || 'Tải thất bại');
    } finally {
      setBusyId(null);
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Xóa bản backup này?')) return;
    setBusyId(id);
    try {
      const res = await backupsAPI.remove(id);
      if (res.success) {
        toast.success('Đã xóa backup');
        setItems((prev) => prev.filter((x) => String(x._id) !== String(id)));
        load();
      } else {
        toast.error(res.message || 'Xóa thất bại');
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Archive className="text-violet-600" size={22} /> Sao lưu dữ liệu
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Chỉ Super Admin · Giữ tối đa {stats?.keep ?? 7} bản · {stats?.diskLabel || '—'} trên disk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={creating}
            className="px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Tạo backup
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Tổng job', value: stats?.total ?? '—' },
          { label: 'Thành công', value: stats?.completed ?? '—' },
          { label: 'Thất bại', value: stats?.failed ?? '—' },
          { label: 'Lần gần nhất', value: formatTime(stats?.lastBackupAt) },
        ].map((c) => (
          <div key={c.label} className="bg-white border border-gray-100 rounded-xl p-3">
            <p className="text-[10px] font-black text-gray-400 uppercase">{c.label}</p>
            <p className="text-sm font-black text-gray-800 mt-1 truncate">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-violet-50 border border-violet-100 rounded-xl p-3 text-xs text-violet-800 font-medium">
        Backup xuất toàn bộ collection MongoDB ra file <code className="font-mono">.json.gz</code>.
        Lịch tự động 03:00 hàng ngày (tắt bằng <code className="font-mono">BACKUP_SCHEDULE=0</code>).
        Restore thủ công từ file tải về — không ghi đè DB qua UI.
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400 flex flex-col items-center gap-2">
            <Database size={32} className="text-gray-200" />
            Chưa có bản backup nào
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((row) => (
              <li key={row._id} className="p-4 flex flex-wrap items-center gap-3 hover:bg-gray-50">
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_STYLE[row.status] || STATUS_STYLE.pending}`}>
                      {row.status}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">{row.type}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 mt-1 font-mono truncate">
                    {row.filename || row._id}
                  </p>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                    {formatTime(row.finishedAt || row.createdAt)}
                    {row.docCount ? ` · ${row.docCount} docs` : ''}
                    {row.sizeLabel ? ` · ${row.sizeLabel}` : ''}
                    {row.collections?.length ? ` · ${row.collections.length} collections` : ''}
                  </p>
                  {row.error && <p className="text-[11px] text-red-600 mt-1">{row.error}</p>}
                </div>
                <div className="flex items-center gap-1">
                  {row.status === 'completed' && (
                    <button
                      type="button"
                      disabled={busyId === row._id}
                      onClick={() => onDownload(row)}
                      className="p-2 rounded-lg text-violet-600 hover:bg-violet-50"
                      title="Tải về"
                    >
                      <Download size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === row._id || row.status === 'running'}
                    onClick={() => onDelete(row._id)}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
                    title="Xóa"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}