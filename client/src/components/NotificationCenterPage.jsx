import React, { useCallback, useEffect, useState } from 'react';
import CmsSelect from './ui/CmsSelect';
import { useNavigate } from 'react-router-dom';
import {
  Bell, CheckCheck, ChevronLeft, ChevronRight, Filter, Loader2,
  Trash2, Megaphone, RefreshCw, X, ExternalLink,
} from 'lucide-react';
import { notificationsAPI, apiFetch } from '../services/api';
import { useData } from '../context/DataContext';
import { useToast } from '../utils/toast';
import { formatNotificationStudentMask } from '../utils/studentMask';
import { useSearchParams } from 'react-router-dom';

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
 * Notification Center — trang đầy đủ thông báo hệ thống với Modal Chi tiết & cuộn trang mượt mà.
 */
export default function NotificationCenterPage({ role = 'admin', session }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToast();
  const { markNotificationRead, dismissNotificationLocal, students } = useData();
  const isAdmin = role === 'admin' || role === 'staff' || session?.adminRole === 'SUPER_ADMIN' || session?.adminRole === 'STAFF';
  const canAnswerQa = isAdmin || role === 'teacher';

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [qaDetail, setQaDetail] = useState(null);
  const [qaAnswer, setQaAnswer] = useState('');
  const [qaSaving, setQaSaving] = useState(false);

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

  const openQaById = useCallback(async (qaId) => {
    if (!qaId) return;
    try {
      const res = await apiFetch(`/training-lms/qa?qaId=${encodeURIComponent(qaId)}`);
      const json = await res.json().catch(() => ({}));
      const row = Array.isArray(json?.data) ? json.data[0] : null;
      if (!json?.success || !row) {
        toast.error(json?.message || 'Không tải được câu hỏi LMS');
        return;
      }
      setQaDetail(row);
      setQaAnswer('');
      setSelectedNotif({
        title: 'Hỏi đáp LMS',
        type: 'COURSE',
        message: `${row.askerName || 'Học viên'}: ${row.title}`,
        content: row.body || row.title,
        payload: { kind: 'lms_qa', qaId: String(row.id || row._id), status: row.status },
        time: row.createdAt,
      });
    } catch {
      toast.error('Lỗi kết nối hỏi đáp');
    }
  }, [toast]);

  useEffect(() => {
    const qaId = searchParams.get('qaId');
    if (!qaId || !canAnswerQa) return;
    openQaById(qaId);
    const next = new URLSearchParams(searchParams);
    next.delete('qaId');
    setSearchParams(next, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- open once from query

  const submitQaAnswer = async () => {
    const qaId = qaDetail?.id || qaDetail?._id || selectedNotif?.payload?.qaId;
    const text = qaAnswer.trim();
    if (!qaId || !text) return;
    setQaSaving(true);
    try {
      const res = await apiFetch(`/training-lms/qa/${qaId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        toast.error(json?.message || 'Trả lời thất bại');
        return;
      }
      toast.success('Đã trả lời câu hỏi');
      setQaDetail(json.data || { ...qaDetail, status: 'answered', answer: text });
      setQaAnswer('');
      await load(page);
    } catch {
      toast.error('Lỗi kết nối');
    } finally {
      setQaSaving(false);
    }
  };

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
      if (selectedNotif && String(selectedNotif.id || selectedNotif._id) === String(id)) {
        setSelectedNotif(null);
      }
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
    if (n.payload?.action === 'blog_published' && n.payload?.slug) {
      navigate(`/${role}/news/${n.payload.slug}`);
      return;
    }
    if (n.payload?.kind === 'lms_qa' && n.payload?.qaId && canAnswerQa) {
      await openQaById(n.payload.qaId);
      return;
    }
    const path = resolveNavPath(n.path);
    if (path && !n.payload?.kind) {
      navigate(path);
    } else {
      setSelectedNotif(n);
      setQaDetail(null);
    }
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
    <div className="w-full max-w-full space-y-4 pb-28 sm:pb-32 px-2 sm:px-6 min-h-screen overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0 pt-2">
        <div className="min-w-0">
          <h1 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <Bell className="text-red-600" size={22} /> Trung tâm thông báo
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            {unread} chưa đọc · {total} tổng cộng
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => load(page)}
            className="p-2.5 rounded-xl bg-gray-50 text-gray-500 hover:bg-gray-100 shrink-0"
            title="Làm mới"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            type="button"
            onClick={() => onMarkRead(null)}
            disabled={busyId === 'all' || unread === 0}
            className="px-3 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-40 flex items-center gap-1.5 min-w-0"
          >
            <CheckCheck size={14} /> Đọc tất cả
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setBroadcastOpen((v) => !v)}
              className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5 min-w-0"
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
          <CmsSelect
            value={bcReceivers}
            onChange={(e) => setBcReceivers(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-bold"
          >
            {RECEIVER_OPTS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </CmsSelect>
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

      <div className="flex flex-wrap items-center gap-2 min-w-0">
        <Filter size={14} className="text-gray-400" />
        <CmsSelect
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold bg-white min-w-[110px]"
        >
          {TYPES.map((t) => (
            <option key={t.value || 'all'} value={t.value}>{t.label}</option>
          ))}
        </CmsSelect>
        <label className="flex items-center gap-2 text-xs font-bold text-gray-600 cursor-pointer min-w-0">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded"
          />
          Chỉ chưa đọc
        </label>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[250px]">
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
                  className={`p-4 flex gap-3 hover:bg-gray-50 transition cursor-pointer ${!n.read ? 'bg-red-50/30' : ''}`}
                  onClick={() => onOpen(n)}
                >
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-600">{n.type}</span>
                      <span className="text-[10px] text-gray-400 font-bold">{formatTime(n.time || n.createdAt)}</span>
                    </div>
                    <h3 className={`text-sm truncate ${!n.read ? 'font-black text-gray-900' : 'font-bold text-gray-700'}`}>
                      {n.title}
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                      {formatNotificationStudentMask(n.message || n.content || n.text, students)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
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
        <div className="flex items-center justify-center gap-3 py-3 sticky bottom-4 bg-white/90 backdrop-blur-md border border-gray-200/80 rounded-2xl shadow-lg w-fit mx-auto px-6 z-10">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => {
              load(page - 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-bold text-gray-700">Trang {page} / {pages}</span>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => {
              load(page + 1);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* ── Modal Chi tiết Thông báo ── */}
      {selectedNotif && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 relative border border-slate-100 animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-md inline-block mb-1">
                  {selectedNotif.type || 'HỆ THỐNG'}
                </span>
                <h2 className="text-base font-black text-slate-900 leading-snug">
                  {selectedNotif.title}
                </h2>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  {formatTime(selectedNotif.time || selectedNotif.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNotif(null)}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 text-sm text-slate-700 leading-relaxed whitespace-pre-line pr-1 font-medium space-y-3">
              {formatNotificationStudentMask(selectedNotif.message || selectedNotif.content || selectedNotif.text, students)}
              {qaDetail ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-left">
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Chi tiết câu hỏi LMS</p>
                  <p className="text-sm font-bold text-slate-900">{qaDetail.title}</p>
                  {qaDetail.body ? <p className="text-xs text-slate-600 whitespace-pre-wrap">{qaDetail.body}</p> : null}
                  <p className="text-[11px] text-slate-500">
                    {qaDetail.askerName} · {qaDetail.lessonTitle || 'Bài học'} · {qaDetail.courseTitle || ''}
                  </p>
                  {qaDetail.status === 'answered' && qaDetail.answer ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2.5">
                      <p className="text-[10px] font-black text-emerald-700 uppercase mb-1">Đã trả lời</p>
                      <p className="text-xs text-emerald-900 whitespace-pre-wrap">{qaDetail.answer}</p>
                    </div>
                  ) : canAnswerQa ? (
                    <div className="space-y-2 pt-1">
                      <textarea
                        value={qaAnswer}
                        onChange={(e) => setQaAnswer(e.target.value)}
                        rows={3}
                        placeholder="Nhập câu trả lời cho học viên/giảng viên..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-red-300"
                      />
                      <button
                        type="button"
                        disabled={qaSaving || !qaAnswer.trim()}
                        onClick={submitQaAnswer}
                        className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold disabled:opacity-40"
                      >
                        {qaSaving ? 'Đang gửi...' : 'Gửi trả lời'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2 shrink-0">
              {resolveNavPath(selectedNotif.path) && !qaDetail && (
                <button
                  type="button"
                  onClick={() => {
                    const path = resolveNavPath(selectedNotif.path);
                    setSelectedNotif(null);
                    if (path) navigate(path);
                  }}
                  className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Đi tới liên kết
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setSelectedNotif(null);
                  setQaDetail(null);
                  setQaAnswer('');
                }}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}