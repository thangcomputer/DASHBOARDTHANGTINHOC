import React, { useCallback, useEffect, useState } from 'react';
import {
  GitBranch, Loader2, RefreshCw, CheckCircle2, XCircle, Filter,
} from 'lucide-react';
import { workflowsAPI } from '../services/api';
import { useToast } from '../utils/toast';

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN');
}

const STATUS_CLS = {
  open: 'bg-amber-50 text-amber-800 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-50 text-red-800 border-red-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export default function WorkflowCenterPage() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [openCount, setOpenCount] = useState(0);
  const [definitions, setDefinitions] = useState([]);
  const [status, setStatus] = useState('open');
  const [definitionKey, setDefinitionKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, defRes] = await Promise.all([
        workflowsAPI.list({ status, definitionKey: definitionKey || undefined, sync: status === 'open' }),
        workflowsAPI.definitions(),
      ]);
      if (listRes.success) {
        setItems(listRes.data || []);
        setOpenCount(listRes.openCount ?? 0);
      }
      if (defRes.success) setDefinitions(defRes.data || []);
    } catch {
      toast.error('Không tải được workflow');
    } finally {
      setLoading(false);
    }
  }, [status, definitionKey, toast]);

  useEffect(() => { load(); }, [load]);

  const onAdvance = async (id, action) => {
    setBusyId(id + action);
    try {
      const res = await workflowsAPI.advance(id, { action, note });
      if (res.success) {
        toast.success(action === 'approve' ? 'Đã duyệt' : 'Đã từ chối');
        setNote('');
        await load();
      } else {
        toast.error(res.message || 'Thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <GitBranch className="text-teal-600" size={22} /> Workflow
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {openCount} đang mở · duyệt GV / mở khóa thi / chi lương
          </p>
        </div>
        <button type="button" onClick={load} className="p-2.5 rounded-xl bg-gray-50 text-gray-500">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white">
          <option value="open">Đang mở</option>
          <option value="completed">Hoàn thành</option>
          <option value="rejected">Từ chối</option>
          <option value="all">Tất cả</option>
        </select>
        <select value={definitionKey} onChange={(e) => setDefinitionKey(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white">
          <option value="">Mọi loại</option>
          {definitions.map((d) => (
            <option key={d.key} value={d.key}>{d.name}</option>
          ))}
        </select>
      </div>

      {status === 'open' && (
        <div className="bg-white border border-gray-100 rounded-xl p-3">
          <label className="text-[10px] font-black text-gray-400 uppercase">Ghi chú khi duyệt / từ chối</label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tùy chọn..."
            className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
          />
        </div>
      )}

      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">Không có workflow</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((w) => (
              <li key={w._id} className="p-4 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_CLS[w.status] || STATUS_CLS.open}`}>
                    {w.status}
                  </span>
                  <span className="text-[10px] font-bold text-teal-700 uppercase">{w.definitionName || w.definitionKey}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{formatTime(w.createdAt)}</span>
                </div>
                <p className="text-sm font-black text-gray-900">{w.title || w.entityLabel}</p>
                <p className="text-[11px] text-gray-500 font-medium">
                  {w.entityType} · {w.entityId} · bước: {w.currentStep}
                </p>
                {w.payload?.testScore != null && (
                  <p className="text-[11px] text-gray-500">Điểm test: {w.payload.testScore}</p>
                )}
                {w.payload?.amount != null && (
                  <p className="text-[11px] text-gray-500">Số tiền: {Number(w.payload.amount).toLocaleString('vi-VN')}đ</p>
                )}
                {w.status === 'open' && (
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => onAdvance(w._id, 'approve')}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    >
                      {busyId === w._id + 'approve' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={!!busyId}
                      onClick={() => onAdvance(w._id, 'reject')}
                      className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    >
                      {busyId === w._id + 'reject' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                      Từ chối
                    </button>
                  </div>
                )}
                {Array.isArray(w.history) && w.history.length > 0 && (
                  <details className="text-[11px] text-gray-500">
                    <summary className="cursor-pointer font-bold">Lịch sử ({w.history.length})</summary>
                    <ul className="mt-1 space-y-1 pl-2 border-l border-gray-100">
                      {w.history.map((h, i) => (
                        <li key={i}>{formatTime(h.at)} · {h.action} · {h.byName || h.by}{h.note ? ` — ${h.note}` : ''}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}