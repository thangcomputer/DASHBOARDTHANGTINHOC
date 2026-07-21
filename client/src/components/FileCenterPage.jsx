import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText, HardDrive, Loader2, RefreshCw, Search, Trash2,
  UploadCloud, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { filesAPI, SOCKET_BASE } from '../services/api';
import { useToast } from '../utils/toast';

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function publicUrl(url) {
  if (!url) return '#';
  if (url.startsWith('http')) return url;
  return (SOCKET_BASE || '') + url;
}

export default function FileCenterPage() {
  const toast = useToast();
  const inputRef = useRef(null);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [uploadCat, setUploadCat] = useState('general');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const res = await filesAPI.stats();
      if (res.success) setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await filesAPI.list({ page: p, limit: 20, category: category || undefined, q: q || undefined });
      if (res.success) {
        setItems(res.data || []);
        setPage(res.pagination?.page || p);
        setPages(res.pagination?.pages || 1);
        setTotal(res.pagination?.total || 0);
      }
    } catch {
      toast.error('Không tải được danh sách file');
    } finally {
      setLoading(false);
    }
  }, [category, q, toast]);

  useEffect(() => {
    filesAPI.categories().then((res) => {
      if (res.success) setCategories(res.data || []);
    }).catch(() => {});
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    load(1);
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSearch = (e) => {
    e.preventDefault();
    load(1);
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await filesAPI.upload(file, uploadCat);
      if (res.success) {
        toast.success('Upload thành công');
        await load(1);
        await loadStats();
      } else {
        toast.error(res.message || 'Upload thất bại');
      }
    } catch {
      toast.error('Lỗi upload');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onDelete = async (id) => {
    if (!window.confirm('Xóa file này khỏi hệ thống?')) return;
    setBusyId(id);
    try {
      const res = await filesAPI.remove(id);
      if (res.success) {
        toast.success('Đã xóa file');
        setItems((prev) => prev.filter((f) => String(f._id) !== String(id)));
        setTotal((t) => Math.max(0, t - 1));
        loadStats();
      } else {
        toast.error(res.message || 'Xóa thất bại');
      }
    } finally {
      setBusyId(null);
    }
  };

  const onPurge = async () => {
    if (!window.confirm('Dọn tất cả file đã hết hạn?')) return;
    try {
      const res = await filesAPI.purgeExpired();
      if (res.success) {
        toast.success(res.message || 'Đã dọn file hết hạn');
        await load(page);
        await loadStats();
      }
    } catch {
      toast.error('Lỗi dọn file');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <HardDrive className="text-indigo-600" size={22} /> Quản lý file
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {stats?.totals?.count ?? total} file · {stats?.totals?.totalSizeLabel || '—'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => { load(page); loadStats(); }} className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button type="button" onClick={onPurge} className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold">
            Dọn hết hạn
          </button>
        </div>
      </div>

      {stats?.byCategory?.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {stats.byCategory.map((c) => (
            <button
              key={c.category}
              type="button"
              onClick={() => setCategory(c.category === category ? '' : c.category)}
              className={`text-left p-3 rounded-xl border text-xs ${
                category === c.category ? 'border-indigo-400 bg-indigo-50' : 'border-gray-100 bg-white'
              }`}
            >
              <p className="font-black text-gray-800 uppercase">{c.category}</p>
              <p className="text-gray-500 font-bold mt-0.5">{c.count} file · {c.totalSizeLabel}</p>
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-[10px] font-black text-gray-400 uppercase">Category upload</label>
          <select
            value={uploadCat}
            onChange={(e) => setUploadCat(e.target.value)}
            className="block mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
          >
            {(categories.length ? categories : [{ key: 'general' }]).map((c) => (
              <option key={c.key} value={c.key}>{c.key}{c.maxLabel ? ` (${c.maxLabel})` : ''}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-40"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Upload file
        </button>
        <input ref={inputRef} type="file" className="hidden" onChange={onUpload} />
      </div>

      <form onSubmit={onSearch} className="flex flex-wrap gap-2 items-center">
        <Filter size={14} className="text-gray-400" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
        >
          <option value="">Tất cả category</option>
          {(categories.length ? categories : Object.keys({})).map((c) => (
            <option key={c.key || c} value={c.key || c}>{c.key || c}</option>
          ))}
        </select>
        <div className="flex-1 min-w-[160px] flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <Search size={14} className="text-gray-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm tên file..."
            className="flex-1 text-sm outline-none font-medium"
          />
        </div>
        <button type="submit" className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-bold">Tìm</button>
      </form>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400"><Loader2 className="animate-spin" size={28} /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">Chưa có file trong registry</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((f) => (
              <li key={f._id} className="p-4 flex gap-3 items-center hover:bg-gray-50">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <a
                    href={publicUrl(f.url)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-bold text-gray-900 hover:text-indigo-600 truncate block"
                  >
                    {f.originalName || f.filename}
                  </a>
                  <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                    <span className="uppercase font-black text-indigo-600">{f.category}</span>
                    {' · '}{f.sizeLabel || f.size}
                    {' · '}{formatTime(f.createdAt)}
                    {f.uploadedBy ? ` · by ${f.uploadedBy}` : ''}
                    {f.expiresAt ? ` · hết hạn ${formatTime(f.expiresAt)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === f._id}
                  onClick={() => onDelete(f._id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  title="Xóa"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button type="button" disabled={page <= 1} onClick={() => load(page - 1)} className="p-2 rounded-xl border border-gray-200 disabled:opacity-40">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-gray-600">Trang {page}/{pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => load(page + 1)} className="p-2 rounded-xl border border-gray-200 disabled:opacity-40">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}