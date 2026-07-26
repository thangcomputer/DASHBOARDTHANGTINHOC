import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, ChevronLeft, ChevronRight, Filter, Loader2,
  Trash2, Megaphone, RefreshCw,
} from 'lucide-react';
import { notificationsAPI } from '../services/api';
import { useData } from '../context/DataContext';
import { useToast } from '../utils/toast';

const TYPES = [
  { value: '', label: 'Tất cả' },
  { value: 'SYSTEM', label: 'Hệ thống' },
  { value: 'COURSE', label: 'Khóa học' },
  { value: 'FINANCE', label: 'Tài chính' },
  { value: 'SCHEDULE', label: 'Lịch dạy' },
  { value: 'EXAM', label: 'Thi' },
  { value: 'EVALUATION', label: 'Đánh giá' },
  { value: 'MESSAGE', label: 'Tin nhắn' },
];

const RECEIVER_OPTS = [
  { value: 'ALL_ADMIN', label: 'Tất cả Admin/Staff' },
  { value: 'ALL_TEACHER', label: 'Tất cả Giảng viên' },
  { value: 'ALL_STUDENT', label: 'Tất cả Học viên' },
  { value: 'GLOBAL', label: 'Toàn hệ thống' },
];

function formatTime(t) {
  if (!t) return '';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return String(t);
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

function resolveNavPath(path) {
  if (!path) return null;
  let targetPath = path;
  if (targetPath.startsWith('http')) {
    try {
      const urlObj = new URL(targetPath);
      targetPath = urlObj.pathname + urlObj.search + urlObj.hash;
    } catch { /* ignore */ }
  }
  if (targetPath.startsWith('/admin/') && targetPath !== '/admin/inbox' && targetPath !== '/admin/notifications' && !targetPath.includes('#')) {
    targetPath = '/admin#' + targetPath.replace('/admin/', '');
  } else if (targetPath.startsWith('/student/') && !['/student/exam', '/student/inbox', '/student/notifications'].includes(targetPath) && !targetPath.includes('#')) {
    targetPath = '/student#' + targetPath.replace('/student/', '');
  } else if (targetPath.startsWith('/teacher/') && !['/teacher/test', '/teacher/finance', '/teacher/inbox', '/teacher/profile', '/teacher/notifications'].includes(targetPath) && !targetPath.includes('#')) {
    targetPath = '/teacher#' + targetPath.replace('/teacher/', '');
  }
  return targetPath;
}

/**
 * Notification Center — trang day du cho admin / teacher / student.
 */
export default function NotificationCenterPage({ role = 'admin', session }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { markNotificationRead, dismissNotificationLocal } = useData();
  const isAdmin = role === 'admin' || role === 'staff' || session?.adminRole === 'SUPER_ADMIN' || session?.adminRole === 'STAFF';

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcContent, setBcContent] = useState('');
  const [bcReceivers, setBcReceivers] = useState('ALL_ADMIN');
  const [bcSending, setBcSending] = useState(false);

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const res = await notificationsAPI.list({ page: p, limit: 20, type: type || undefined, unreadOnly });
      if (res.success) {
        setItems(res.data || []);
        setPages(res.pagination?.pages || 1);
        setTotal(res.pagination?.total || 0);
        setUnread(res.unread || 0);
        setPage(res.pagination?.page || p);
      }
    } catch {
      toast.error('Không tải được thông báo');
    } finally {
      setLoading(false);
    }
  }, [page, type, unreadOnly, toast]);

  useEffect(() => {
    load(1);
  }, [type, unreadOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMarkRead = async (id) => {
    setBusyId(id || 'all');
    try {
      await notificationsAPI.markRead(id || null);
      markNotificationRead(id || undefined);
      await load(page);
    } finally {
      setBusyId(null);
    }
  };

  const onDismiss = async (id) => {
    setBusyId(id);
    try {
      await notificationsAPI.dismiss(id);
      dismissNotificationLocal(id);
      setItems((prev) => prev.filter((n) => String(n.id || n._id) !== String(id)));
      setTotal((t) => Math.max(0, t - 1));
      setUnread((u) => Math.max(0, u - 1));
    } finally {
      setBusyId(null);
    }
  };

  const onOpen = async (n) => {
    const id = n.id || n._id;
    if (!n.read) await onMarkRead(id);
    if (n.payload?.action === 'RESET_PASSWORD') {
      window.dispatchEvent(new CustomEvent('open-reset-pw', { detail: n.payload }));
      return;
    }
    const path = resolveNavPath(n.path);
    if (path) navigate(path);
  };

  const onBroadcast = async () => {
    if (!bcTitle.trim() || !bcContent.trim()) {
      toast.error('Nhập tiêu đề và nội dung');
      return;
    }
    setBcSending(true);
    try {
      const res = await notificationsAPI.broadcast({
        title: bcTitle.trim(),
        content: bcContent.trim(),
        type: 'SYSTEM',
        receivers: bcReceivers,
      });
      if (res.success) {
        toast.success('Đã gửi thông báo');
        setBroadcastOpen(false);
        setBcTitle('');
        setBcContent('');
        await load(1);
      } else {
        toast.error(res.message || 'Gửi thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setBcSending(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Bell className="text-red-600" size={22} /> Trung tâm thông báo
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {unread} chưa đọc · {total} tổng cộng
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => load(page)}
            className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100"
            title="Làm mới"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => onMarkRead(null)}
            disabled={busyId === 'all' || unread === 0}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5"
          >
            <CheckCheck size={14} /> Đọc tất cả
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setBroadcastOpen((v) => !v)}
              className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5"
            >
              <Megaphone size={14} /> Gửi thông báo
            </button>
          )}
        </div>
      </div>

      {broadcastOpen && isAdmin && (
        <div className="bg-white border border-red-100 rounded-2xl p-4 space-y-3 shadow-sm">
          <p className="text-xs font-black text-red-600 uppercase tracking-wide">Broadcast hệ thống</p>
          <input
            value={bcTitle}
            onChange={(e) => setBcTitle(e.target.value)}
            placeholder="Tiêu đề"
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:border-red-300"
          />
          <textarea
            value={bcContent}
            onChange={(e) => setBcContent(e.target.value)}
            placeholder="Nội dung"
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-300"
          />
          <select
            value={bcReceivers}
            onChange={(e) => setBcReceivers(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
          >
            {RECEIVER_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onBroadcast}
            disabled={bcSending}
            className="w-full py-2.5 bg-red-600 text-white font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {bcSending ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            Gửi ngay
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Filter size={14} className="text-gray-400" />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white"
        >
          {TYPES.map((t) => (
            <option key={t.value || 'all'} value={t.value}>{t.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded"
          />
          Chỉ chưa đọc
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center text-gray-400">
            <Loader2 className="animate-spin" size={28} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm font-bold text-gray-400">Không có thông báo</div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {items.map((n) => {
              const id = n.id || n._id;
              return (
                <li
                  key={id}
                  className={`p-4 flex gap-3 hover:bg-gray-50 transition ${!n.read ? 'bg-red-50/30' : ''}`}
                >
                  <button type="button" onClick={() => onOpen(n)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-600">{n.type}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{formatTime(n.time || n.createdAt)}</span>
                    </div>
                    <h3 className={`text-sm truncate ${!n.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                      {n.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message || n.content}</p>
                  </button>
                  <div className="flex flex-col gap-1">
                    {!n.read && (
                      <button
                        type="button"
                        title="Đánh dấu đã đọc"
                        onClick={() => onMarkRead(id)}
                        disabled={busyId === id}
                        className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50"
                      >
                        <CheckCheck size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      title="Ẩn thông báo"
                      onClick={() => onDismiss(id)}
                      disabled={busyId === id}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => load(page - 1)}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-40"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-gray-600">Trang {page}/{pages}</span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => load(page + 1)}
            className="p-2 rounded-xl border border-gray-200 disabled:opacity-40"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}