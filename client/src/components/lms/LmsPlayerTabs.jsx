import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, Award, CheckCircle, ChevronDown, ChevronUp, Clock, Download,
  ExternalLink, FileBox, Lock, MessageSquare, PlayCircle, Plus, Search, Star, Trash2,
} from 'lucide-react';
import { LMS_PLAYER_TABS, formatLessonDisplayTitle, formatLmsTimestamp, getChapterLessonIndex } from '../../utils/lmsLessonUi';
import LessonSidebarMeta from './LessonSidebarMeta';
import { htmlToPlainText, sanitizeRichHtml } from '../../utils/htmlContent';
import { buildMediaDownloadUrl, downloadMediaFile, resolveMediaUrl, apiFetch } from '../../services/api';
import useLmsLocalStore, { lmsStoreKey } from '../../hooks/useLmsLocalStore';
import { useSocket } from '../../context/SocketContext';

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function timeAgo(ts) {
  const diff = Date.now() - Number(ts || 0);
  if (diff < 60_000) return 'Vừa xong';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} phút trước`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} giờ trước`;
  return `${Math.floor(diff / 86_400_000)} ngày trước`;
}

export function LmsTabBar({ courseTab, setCourseTab, className = '' }) {
  return (
    <div
      className={`border-b border-white/[0.08] bg-[#0d1117] ${className}`}
      role="tablist"
      aria-label="Tab nội dung bài học"
    >
      <div className="flex flex-wrap items-stretch gap-0 max-w-3xl mx-auto w-full px-1 sm:px-0">
        {LMS_PLAYER_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={courseTab === t.key}
            onClick={() => setCourseTab(t.key)}
            className={`min-w-0 flex-1 basis-[30%] sm:flex-none sm:basis-auto px-2 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold tracking-wide border-b-2 transition-colors text-center leading-tight ${
              t.mobileOnly ? 'lg:hidden' : ''
            } ${
              courseTab === t.key
                ? 'text-white border-emerald-500 bg-white/[0.03]'
                : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function OverviewPanel({
  currentLesson,
  selectedCourse,
  lessons,
  overallProgress,
  antiSeekEnabled,
  teacherAntiSeekSlot = null,
}) {
  if (!currentLesson) {
    return <p className="text-slate-500 text-sm">Chọn một bài giảng để xem tổng quan.</p>;
  }
  const idx = getChapterLessonIndex(lessons, currentLesson);
  const courseDesc = selectedCourse?.description || selectedCourse?.desc || '';

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block text-[9px] font-black text-emerald-400/80 uppercase tracking-[0.15em] mb-2">
            {currentLesson.chapterTitle || selectedCourse?.title || 'Bài giảng'}
          </span>
          <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
            {formatLessonDisplayTitle(currentLesson.title, idx)}
          </h1>
          {Number(currentLesson.duration) > 0 ? (
            <span className="inline-flex items-center gap-1.5 mt-2 text-slate-400 text-[11px] font-semibold">
              <Clock size={12} />
              {Math.floor(currentLesson.duration / 60)} phút {String(currentLesson.duration % 60).padStart(2, '0')}s
            </span>
          ) : null}
          <p className="mt-2 text-[12px] text-slate-500 font-medium">
            Tiến độ khóa học: <span className="text-emerald-400 font-bold tabular-nums">{overallProgress}%</span>
          </p>
        </div>
        {currentLesson.isCompleted && (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold border border-emerald-500/20">
            <CheckCircle size={13} /> Đã xong
          </div>
        )}
      </div>

      {antiSeekEnabled ? (
        <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3.5 py-3">
          <AlertCircle size={14} className="text-amber-400/80 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200/70 text-[11px] sm:text-xs leading-relaxed">
            <strong className="text-amber-400">Chống tua:</strong> ĐÃ BẬT — cần xem đủ thời lượng yêu cầu để ghi nhận tiến độ.
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3.5 py-3">
          <CheckCircle size={14} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-emerald-200/80 text-[11px] sm:text-xs leading-relaxed">
            <strong className="text-emerald-400">Chống tua:</strong> ĐÃ TẮT — có thể tua tự do.
          </p>
        </div>
      )}

      {teacherAntiSeekSlot}

      <div className="pt-1 space-y-2">
        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Mô tả bài giảng</p>
        {currentLesson.description && /<[a-z][\s\S]*>/i.test(currentLesson.description) ? (
          <div
            className="text-slate-400 leading-relaxed text-[13px] break-words [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-emerald-400 [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(currentLesson.description) }}
          />
        ) : (
          <p className="text-slate-400 leading-relaxed text-[13px] whitespace-pre-wrap">
            {htmlToPlainText(currentLesson.description) ||
              'Theo dõi video để nắm kiến thức. Hệ thống ghi nhận tiến độ khi bạn xem đủ thời lượng yêu cầu.'}
          </p>
        )}
      </div>

      {courseDesc ? (
        <div className="pt-3 border-t border-white/[0.06] space-y-2">
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Về khóa học</p>
          {/<[a-z][\s\S]*>/i.test(courseDesc) ? (
            <div
              className="text-slate-400 leading-relaxed text-[13px] break-words [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(courseDesc) }}
            />
          ) : (
            <p className="text-slate-400 leading-relaxed text-[13px] whitespace-pre-wrap">
              {htmlToPlainText(courseDesc)}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function readNoteTimeSec(getCurrentTime) {
  try {
    return Math.max(0, Math.floor(Number(getCurrentTime?.() || 0) || 0));
  } catch {
    return 0;
  }
}

function NotesPanel({ storageKey, lessonId, lessonTitle, getCurrentTime }) {
  const [notes, setNotes] = useLmsLocalStore(storageKey, []);
  const [draft, setDraft] = useState('');
  const [filterLesson, setFilterLesson] = useState('current');
  // Đồng bộ với giây player — trước đây chỉ đọc lúc render nên lệch đến khi đổi tab
  const [liveAtSec, setLiveAtSec] = useState(() => readNoteTimeSec(getCurrentTime));
  const getCurrentTimeRef = useRef(getCurrentTime);
  getCurrentTimeRef.current = getCurrentTime;

  useEffect(() => {
    const tick = () => {
      const next = readNoteTimeSec(getCurrentTimeRef.current);
      setLiveAtSec((prev) => (prev === next ? prev : next));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [lessonId]);

  const filtered = useMemo(() => {
    const list = Array.isArray(notes) ? notes : [];
    const sorted = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (filterLesson === 'current') return sorted.filter((n) => String(n.lessonId) === String(lessonId));
    return sorted;
  }, [notes, filterLesson, lessonId]);

  const addNote = () => {
    const text = draft.trim();
    if (!text || !lessonId) return;
    const at = readNoteTimeSec(getCurrentTimeRef.current);
    setLiveAtSec(at);
    setNotes((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        lessonId: String(lessonId),
        lessonTitle: lessonTitle || '',
        text,
        atSec: at,
        createdAt: Date.now(),
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setDraft('');
  };

  const removeNote = (id) => setNotes((prev) => (prev || []).filter((n) => n.id !== id));

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              addNote();
            }
          }}
          placeholder={`Tạo ghi chú mới tại ${formatLmsTimestamp(liveAtSec)}`}
          className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
        />
        <button
          type="button"
          onClick={addNote}
          className="shrink-0 w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center hover:bg-emerald-500/30"
          aria-label="Thêm ghi chú"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterLesson('current')}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
            filterLesson === 'current'
              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : 'border-white/10 text-slate-400'
          }`}
        >
          Bài hiện tại
        </button>
        <button
          type="button"
          onClick={() => setFilterLesson('all')}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
            filterLesson === 'all'
              ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : 'border-white/10 text-slate-400'
          }`}
        >
          Tất cả bài giảng
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-10 leading-relaxed px-4">
          Nhấp vào ô &quot;Tạo ghi chú mới&quot; hoặc nút + để tạo ghi chú đầu tiên của bạn.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-400/90 font-bold mb-1">
                  <span className="tabular-nums">{formatLmsTimestamp(n.atSec)}</span>
                  {filterLesson === 'all' && n.lessonTitle ? (
                    <span className="text-slate-500 font-semibold truncate">{n.lessonTitle}</span>
                  ) : null}
                  <span className="text-slate-600 font-medium">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">{n.text}</p>
              </div>
              <button
                type="button"
                onClick={() => removeNote(n.id)}
                className="shrink-0 w-8 h-8 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 flex items-center justify-center"
                aria-label="Xóa ghi chú"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QaPanel({
  courseId,
  lessonId,
  lessonTitle,
  courseTitle,
  userName,
  audience = 'student',
  canAnswer = false,
  highlightQaId = null,
  getCurrentTime,
  videoUrl = '',
  videoDuration = 0,
  currentUserId = '',
}) {
  const { socket } = useSocket() || {};
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});
  const [error, setError] = useState('');
  const [liveAtSec, setLiveAtSec] = useState(() => readNoteTimeSec(getCurrentTime));
  const getCurrentTimeRef = useRef(getCurrentTime);
  const liveAtSecRef = useRef(liveAtSec);
  getCurrentTimeRef.current = getCurrentTime;
  liveAtSecRef.current = liveAtSec;

  useEffect(() => {
    const id = setInterval(() => {
      const next = readNoteTimeSec(getCurrentTimeRef.current);
      setLiveAtSec((prev) => (prev === next ? prev : next));
      liveAtSecRef.current = next;
    }, 400);
    return () => clearInterval(id);
  }, [lessonId]);

  const load = useCallback(async (opts = {}) => {
    const silent = opts === true || opts?.silent === true;
    if (!courseId) {
      setItems([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const qs = new URLSearchParams({ courseId: String(courseId) });
      if (lessonId) qs.set('lessonId', String(lessonId));
      if (audience) qs.set('audience', audience);
      // Deep-link từ thông báo: vẫn cho phép tải theo qaId trong khóa
      if (highlightQaId && !lessonId) qs.set('qaId', String(highlightQaId));
      const res = await apiFetch(`/training-lms/qa?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json.data)) {
        setItems(json.data);
      } else if (!silent) {
        setError(json?.message || 'Không tải được hỏi đáp');
      }
    } catch {
      if (!silent) setError('Lỗi kết nối hỏi đáp');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [courseId, lessonId, audience, highlightQaId]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: Support/GV trả lời hoặc đối thoại → reload danh sách (không flash loading)
  useEffect(() => {
    if (!socket) return undefined;
    const onQaEvent = (raw) => {
      const p = raw?.payload || raw || {};
      if (String(p.kind || '') !== 'lms_qa') return;
      if (courseId && p.courseId && String(p.courseId) !== String(courseId)) return;
      if (audience && p.audience && String(p.audience) !== String(audience)) return;
      loadRef.current?.({ silent: true });
    };
    socket.on('lms_qa:updated', onQaEvent);
    socket.on('RECEIVE_NOTIFICATION', onQaEvent);
    return () => {
      socket.off('lms_qa:updated', onQaEvent);
      socket.off('RECEIVE_NOTIFICATION', onQaEvent);
    };
  }, [socket, courseId, audience]);

  useEffect(() => {
    if (!highlightQaId) return;
    const el = document.getElementById(`lms-qa-${highlightQaId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightQaId, items]);

  const filtered = useMemo(() => {
    let list = [...(Array.isArray(items) ? items : [])];
    // Chỉ hiện câu hỏi của video/bài đang xem
    if (lessonId) {
      list = list.filter((it) => String(it.lessonId || '') === String(lessonId));
    }
    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (it) =>
        String(it.title || '').toLowerCase().includes(needle) ||
        String(it.body || '').toLowerCase().includes(needle) ||
        String(it.answer || '').toLowerCase().includes(needle)
    );
  }, [items, q, lessonId]);

  const submit = async () => {
    const t = title.trim();
    if (!t || !courseId || !lessonId || sending) return;
    setSending(true);
    setError('');
    try {
      const fromPlayer = readNoteTimeSec(getCurrentTimeRef.current);
      const fromLive = Math.max(0, Math.floor(Number(liveAtSecRef.current) || 0));
      const atSec = Math.max(fromLive, fromPlayer);
      const res = await apiFetch('/training-lms/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          courseTitle: courseTitle || '',
          lessonId,
          lessonTitle: lessonTitle || '',
          title: t,
          body: body.trim(),
          audience,
          atSec,
          atSeconds: atSec,
          videoUrl: videoUrl || '',
          videoDuration: Math.max(0, Math.floor(Number(videoDuration) || 0)),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Gửi câu hỏi thất bại');
        return;
      }
      setTitle('');
      setBody('');
      // Optimistic: hiện đúng giây ngay cả khi response cũ chưa có atSec
      if (json?.data) {
        const row = { ...json.data, atSec: Math.max(Number(json.data.atSec) || 0, atSec) };
        setItems((prev) => {
          const id = String(row.id || row._id);
          const rest = (Array.isArray(prev) ? prev : []).filter((it) => String(it.id || it._id) !== id);
          return [row, ...rest];
        });
      }
      await load({ silent: true });
    } catch {
      setError('Lỗi kết nối khi gửi câu hỏi');
    } finally {
      setSending(false);
    }
  };

  const submitAnswer = async (qaId) => {
    const text = String(answerDrafts[qaId] || '').trim();
    if (!text) return;
    setSending(true);
    try {
      const res = await apiFetch(`/training-lms/qa/${qaId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answer: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Trả lời thất bại');
        return;
      }
      setAnswerDrafts((prev) => ({ ...prev, [qaId]: '' }));
      await load();
    } catch {
      setError('Lỗi kết nối khi trả lời');
    } finally {
      setSending(false);
    }
  };

  const submitReply = async (qaId) => {
    const text = String(replyDrafts[qaId] || '').trim();
    if (!text) return;
    setSending(true);
    setError('');
    try {
      const res = await apiFetch(`/training-lms/qa/${qaId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Gửi phản hồi thất bại');
        return;
      }
      setReplyDrafts((prev) => ({ ...prev, [qaId]: '' }));
      await load();
    } catch {
      setError('Lỗi kết nối khi phản hồi');
    } finally {
      setSending(false);
    }
  };

  const dialogueOf = (it) => {
    const thread = Array.isArray(it.thread) ? it.thread : [];
    if (thread.length > 0) {
      if (it.answer && !thread.some((m) => String(m.body || '') === String(it.answer || ''))) {
        return [
          {
            authorName: it.answeredByName || 'Support',
            authorRole: it.answeredByRole || 'staff',
            body: it.answer,
            createdAt: it.answeredAt,
          },
          ...thread,
        ];
      }
      return thread;
    }
    if (it.answer) {
      return [{
        authorName: it.answeredByName || 'Support',
        authorRole: it.answeredByRole || 'staff',
        body: it.answer,
        createdAt: it.answeredAt,
      }];
    }
    return [];
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto w-full">
      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-3 text-[12px] text-slate-300">
        Tab <span className="font-bold text-emerald-300">Hỏi đáp</span> nằm ngay dưới video.
        Câu hỏi lưu trên server — Admin/Giảng viên nhận thông báo chuông và có thể trả lời.
      </div>

      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm câu hỏi trong khóa học"
            className="flex-1 min-w-0 bg-transparent text-sm text-slate-200 placeholder:text-slate-500 outline-none"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Đặt câu hỏi</p>
          <span className="text-[11px] font-semibold tabular-nums text-emerald-400/90">
            Tại {formatLmsTimestamp(liveAtSec)}
          </span>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề câu hỏi"
          className="w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Mô tả chi tiết (tuỳ chọn)"
          className="w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40 resize-y"
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !title.trim() || !lessonId}
          className="inline-flex items-center gap-2 px-4 min-h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
        >
          <MessageSquare size={14} /> {sending ? 'Đang gửi...' : 'Gửi câu hỏi'}
        </button>
        <p className="text-[11px] text-slate-500">
          Câu hỏi sẽ gắn với thời điểm video hiện tại ({formatLmsTimestamp(liveAtSec)}) để Support xem đúng đoạn.
        </p>
        {!lessonId ? (
          <p className="text-[11px] text-amber-400">Chọn một bài học trước khi gửi câu hỏi.</p>
        ) : null}
        {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
      </div>

      <h3 className="text-sm font-bold text-slate-300">
        Các câu hỏi trong video này ({filtered.length})
      </h3>

      {loading ? (
        <p className="text-slate-500 text-sm py-8 text-center">Đang tải hỏi đáp...</p>
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 text-sm py-8 text-center">Chưa có câu hỏi. Hãy là người đầu tiên hỏi!</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => {
            const id = String(it.id || it._id);
            const highlighted = highlightQaId && String(highlightQaId) === id;
            return (
              <li
                key={id}
                id={`lms-qa-${id}`}
                className={`rounded-xl border p-4 ${
                  highlighted
                    ? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black flex items-center justify-center shrink-0">
                    {initials(it.askerName || it.author)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-bold text-slate-100">{it.title}</p>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          it.status === 'answered'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {it.status === 'answered' ? 'Đã trả lời' : 'Chờ trả lời'}
                      </span>
                    </div>
                    {it.body ? <p className="text-[13px] text-slate-400 mt-1 whitespace-pre-wrap">{it.body}</p> : null}
                    <p className="text-[11px] text-slate-500 mt-2">
                      <span className="text-emerald-400/90 font-semibold">{it.askerName || it.author || userName}</span>
                      {it.lessonTitle ? ` · ${it.lessonTitle}` : ''}
                      <span className="text-amber-300/90 font-semibold tabular-nums">{` · ${formatLmsTimestamp(it.atSec)}`}</span>
                      {` · ${timeAgo(it.createdAt)}`}
                    </p>

                    {dialogueOf(it).map((msg, idx) => {
                      const staffish = ['admin', 'staff', 'teacher'].includes(String(msg.authorRole || '').toLowerCase());
                      return (
                        <div
                          key={msg.id || `${id}-m-${idx}`}
                          className={`mt-3 rounded-lg px-3 py-2.5 ${
                            staffish
                              ? 'border border-slate-200 bg-white shadow-sm'
                              : 'border border-emerald-500/20 bg-emerald-500/10'
                          }`}
                        >
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${staffish ? 'text-red-600' : 'text-emerald-300'}`}>
                            {staffish ? `Trả lời · ${msg.authorName || 'Support'}` : `Phản hồi · ${msg.authorName || 'Học viên'}`}
                          </p>
                          <p className={`text-[13px] whitespace-pre-wrap ${staffish ? 'text-slate-700' : 'text-slate-200'}`}>
                            {msg.body}
                          </p>
                          {msg.createdAt ? (
                            <p className="text-[10px] text-slate-400 mt-1">{timeAgo(msg.createdAt)}</p>
                          ) : null}
                        </div>
                      );
                    })}

                    {canAnswer ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={answerDrafts[id] || ''}
                          onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                          rows={2}
                          placeholder={it.status === 'answered' ? 'Tiếp tục trả lời trong đối thoại...' : 'Nhập câu trả lời...'}
                          className="w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none focus:border-red-500/40 resize-y"
                        />
                        <button
                          type="button"
                          disabled={sending || !String(answerDrafts[id] || '').trim()}
                          onClick={() => submitAnswer(id)}
                          className="px-3 min-h-9 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xs font-bold"
                        >
                          Gửi trả lời
                        </button>
                      </div>
                    ) : null}

                    {!canAnswer && String(it.askerId || '') === String(currentUserId || '') && (it.answer || (Array.isArray(it.thread) && it.thread.length > 0)) ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyDrafts[id] || ''}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                          rows={2}
                          placeholder="Phản hồi thêm / hỏi lại Support..."
                          className="w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40 resize-y"
                        />
                        <button
                          type="button"
                          disabled={sending || !String(replyDrafts[id] || '').trim()}
                          onClick={() => submitReply(id)}
                          className="px-3 min-h-9 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold"
                        >
                          Gửi phản hồi
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ReviewsPanel({ courseId, courseTitle, userName, audience = 'student' }) {
  const [items, setItems] = useState([]);
  const [avg, setAvg] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const load = useCallback(async () => {
    if (!courseId) {
      setItems([]);
      setAvg(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(
        `/training-lms/reviews?courseId=${encodeURIComponent(courseId)}&audience=${encodeURIComponent(audience)}`
      );
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Không tải được đánh giá');
        return;
      }
      setItems(Array.isArray(json.data) ? json.data : []);
      setAvg(Number(json.avg) || 0);
    } catch {
      setError('Lỗi kết nối khi tải đánh giá');
    } finally {
      setLoading(false);
    }
  }, [courseId, audience]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    const text = comment.trim();
    if (!text || !courseId || sending) return;
    setSending(true);
    setError('');
    setOkMsg('');
    try {
      const res = await apiFetch('/training-lms/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          courseTitle: courseTitle || '',
          rating: Math.min(5, Math.max(1, Number(rating) || 5)),
          comment: text,
          audience,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Gửi đánh giá thất bại');
        return;
      }
      setComment('');
      setRating(5);
      setOkMsg('Đã gửi đánh giá — Admin sẽ nhận thông báo.');
      await load();
    } catch {
      setError('Lỗi kết nối khi gửi đánh giá');
    } finally {
      setSending(false);
    }
  };

  const list = [...(Array.isArray(items) ? items : [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return (
    <div className="space-y-5 max-w-3xl mx-auto w-full">
      <div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <div>
          <p className="text-3xl font-extrabold text-white tabular-nums">{avg ? avg.toFixed(1) : '—'}</p>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                className={avg >= s - 0.25 ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">{list.length} đánh giá</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.08] p-4 space-y-3">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Viết đánh giá</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setRating(s)}
              className="p-1"
              aria-label={`${s} sao`}
            >
              <Star size={20} className={rating >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-600'} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Chia sẻ trải nghiệm học của bạn..."
          className="w-full rounded-lg border border-white/10 bg-[#0b1018] px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/40 resize-y"
        />
        {error ? <p className="text-xs text-red-400 font-semibold">{error}</p> : null}
        {okMsg ? <p className="text-xs text-emerald-400 font-semibold">{okMsg}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={sending || !comment.trim()}
          className="px-4 min-h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold"
        >
          {sending ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-6">Đang tải đánh giá...</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 text-[10px] font-bold text-white flex items-center justify-center">
                  {initials(r.author)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200">{r.author}</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={11}
                        className={r.rating >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
                <span className="ml-auto text-[11px] text-slate-500">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="text-[13px] text-slate-300 whitespace-pre-wrap">{r.comment}</p>
            </li>
          ))}
          {!list.length ? (
            <li className="text-center text-sm text-slate-500 py-6">Chưa có đánh giá nào</li>
          ) : null}
        </ul>
      )}
    </div>
  );
}

function ResourcesPanel({ files }) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) {
    return (
      <div className="py-12 text-center text-slate-500 max-w-3xl mx-auto w-full">
        <FileBox size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">Chưa có tài liệu đính kèm</p>
      </div>
    );
  }

  return (
    <ul className="space-y-3 max-w-3xl mx-auto w-full">
      {list.map((file, idx) => {
        const rawUrl = file.fileUrl || file.url || '';
        const isLink = String(file.fileType || file.type || '').toUpperCase() === 'LINK';
        const href = rawUrl
          ? (isLink ? resolveMediaUrl(rawUrl) : buildMediaDownloadUrl(rawUrl, file.fileOriginalName || file.title))
          : null;
        return (
          <li
            key={file._id || file.id || idx}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">{file.title || 'Tài liệu'}</p>
              <p className="text-[11px] text-slate-500 mt-1">{file.fileSize || file.size || file.fileType || file.type || 'File'}</p>
            </div>
            {href ? (
              isLink ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shrink-0 no-underline"
                >
                  <ExternalLink size={14} /> Mở
                </a>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadMediaFile(rawUrl, file.fileOriginalName || file.title);
                    } catch (err) {
                      // eslint-disable-next-line no-alert
                      window.cmsAlert(err?.message || 'Không tải được tài liệu', 'error');
                    }
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shrink-0 border-0 cursor-pointer"
                >
                  <Download size={14} /> Tải về
                </button>
              )
            ) : (
              <span className="text-xs font-bold text-slate-500 shrink-0">Chưa có file</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListPanel({
  groupedLessons,
  lessons,
  currentLesson,
  overallProgress,
  expandedChapters,
  setExpandedChapters,
  onSelectLesson,
}) {
  return (
    <div className="max-w-3xl mx-auto w-full space-y-3 lg:hidden">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-300">Nội dung khóa học</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {lessons.filter((l) => l.isCompleted).length}/{lessons.length} bài · {overallProgress}%
          </p>
        </div>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${overallProgress}%` }} />
      </div>
      {Object.entries(groupedLessons).map(([chapter, chapterLessons]) => {
        const isExpanded = expandedChapters[chapter] !== false;
        const chapterCompleted = chapterLessons.filter((l) => l.isCompleted).length;
        return (
          <div key={chapter} className="rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]">
            <button
              type="button"
              onClick={() => setExpandedChapters((prev) => ({ ...prev, [chapter]: !prev[chapter] }))}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5"
            >
              <div>
                <p className="text-[11px] font-bold text-slate-300">{chapter}</p>
                <p className="text-[9px] text-slate-600 mt-0.5 font-semibold">
                  {chapterCompleted}/{chapterLessons.length} hoàn thành
                </p>
              </div>
              {isExpanded ? <ChevronUp size={13} className="text-slate-600" /> : <ChevronDown size={13} className="text-slate-600" />}
            </button>
            {isExpanded &&
              chapterLessons.map((lesson, idx) => {
                const isCurrent = currentLesson?._id === lesson._id;
                return (
                  <div
                    key={lesson._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (!lesson.isUnlocked) return;
                      onSelectLesson?.(lesson);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && lesson.isUnlocked) onSelectLesson?.(lesson);
                    }}
                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-all ${
                      !lesson.isUnlocked ? 'opacity-40 pointer-events-none' : ''
                    } ${
                      isCurrent
                        ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
                        : 'border-l-4 border-transparent hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {lesson.isCompleted ? (
                        <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle size={12} className="text-emerald-400" />
                        </div>
                      ) : !lesson.isUnlocked ? (
                        <Lock size={14} className="text-slate-600" />
                      ) : isCurrent ? (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-emerald-500 flex items-center justify-center">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                      ) : (
                        <PlayCircle size={16} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-[12px] leading-snug line-clamp-2 normal-case ${
                          isCurrent
                            ? 'text-emerald-400 font-bold'
                            : lesson.isCompleted
                              ? 'text-slate-500 font-semibold'
                              : 'text-slate-300 font-semibold'
                        }`}
                      >
                        {formatLessonDisplayTitle(lesson.title, idx)}
                      </h4>
                      <LessonSidebarMeta lesson={lesson} isCurrent={isCurrent} />
                    </div>
                  </div>
                );
              })}
          </div>
        );
      })}
      {overallProgress === 100 ? (
        <div className="p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 text-center">
          <Award size={26} className="text-emerald-400 mx-auto mb-2" />
          <p className="font-black text-emerald-400 text-sm">Hoàn thành 100%</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tab panels for Udemy-style LMS player.
 */
export default function LmsPlayerPanels({
  courseTab,
  userId,
  userName,
  selectedCourse,
  currentLesson,
  lessons,
  groupedLessons,
  overallProgress,
  expandedChapters,
  setExpandedChapters,
  onSelectLesson,
  getCurrentTime,
  antiSeekEnabled = true,
  teacherAntiSeekSlot = null,
  audience = 'student',
  canAnswerQa = false,
  highlightQaId = null,
}) {
  const courseId = selectedCourse?._id || selectedCourse?.id || 'course';
  const lessonId = currentLesson?._id;
  const lessonTitle = currentLesson
    ? formatLessonDisplayTitle(
        currentLesson.title,
        getChapterLessonIndex(lessons, currentLesson),
      )
    : '';

  const notesKey = lmsStoreKey('notes', userId, courseId);

  if (courseTab === 'overview' || courseTab === 'announcements') {
    return (
      <OverviewPanel
        currentLesson={currentLesson}
        selectedCourse={selectedCourse}
        lessons={lessons}
        overallProgress={overallProgress}
        antiSeekEnabled={antiSeekEnabled}
        teacherAntiSeekSlot={teacherAntiSeekSlot}
      />
    );
  }
  if (courseTab === 'notes') {
    return (
      <NotesPanel
        storageKey={notesKey}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        getCurrentTime={getCurrentTime}
      />
    );
  }
  if (courseTab === 'qa') {
    return (
      <QaPanel
        courseId={courseId}
        courseTitle={selectedCourse?.title || ''}
        lessonId={lessonId}
        lessonTitle={lessonTitle}
        userName={userName}
        audience={audience}
        canAnswer={canAnswerQa}
        highlightQaId={highlightQaId}
        getCurrentTime={getCurrentTime}
        currentUserId={userId}
        videoUrl={
          currentLesson?.videoUrl
          || currentLesson?.url
          || currentLesson?.youtubeUrl
          || currentLesson?.link
          || ''
        }
        videoDuration={
          Number(currentLesson?.adminDurationSeconds)
          || Number(currentLesson?.duration)
          || 0
        }
      />
    );
  }
  if (courseTab === 'reviews') {
    return (
      <ReviewsPanel
        courseId={courseId}
        courseTitle={selectedCourse?.title || ''}
        userName={userName}
        audience={audience}
      />
    );
  }
  if (courseTab === 'resources') {
    return <ResourcesPanel files={selectedCourse?.files} />;
  }
  if (courseTab === 'list') {
    return (
      <ListPanel
        groupedLessons={groupedLessons}
        lessons={lessons}
        currentLesson={currentLesson}
        overallProgress={overallProgress}
        expandedChapters={expandedChapters}
        setExpandedChapters={setExpandedChapters}
        onSelectLesson={onSelectLesson}
      />
    );
  }
  return null;
}
