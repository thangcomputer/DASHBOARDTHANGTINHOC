import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award, CheckCircle, ChevronDown, ChevronUp, Clock, Download,
  ExternalLink, FileBox, Lock, MessageSquare, PlayCircle, Plus, Search, Star, Trash2,
} from 'lucide-react';
import { LMS_PLAYER_TABS, formatLessonDisplayTitle, formatLmsTimestamp, getChapterLessonIndex, isLessonFullyWatched } from '../../utils/lmsLessonUi';
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

function qaReadStorageKey({ userId, courseId, lessonId, audience }) {
  return `lms-qa-read:v1:${audience}:${userId}:${courseId}:${lessonId || 'all'}`;
}

function qaAnswerMarker(item) {
  const staffReplies = (Array.isArray(item.thread) ? item.thread : []).filter((message) => (
    ['admin', 'staff', 'teacher'].includes(String(message.authorRole || '').toLowerCase())
  ));
  const latestReply = staffReplies[staffReplies.length - 1];
  if (latestReply) {
    return `${latestReply.id || ''}:${latestReply.createdAt || ''}:${String(latestReply.body || '')}`;
  }
  if (item.answer || item.status === 'answered') {
    return `${item.answeredAt || item.updatedAt || ''}:${String(item.answer || '')}`;
  }
  return '';
}

function readQaReadMarkers(storageKey) {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    console.error('Failed to read LMS Q&A read markers:', error);
    return {};
  }
}

function markQaItemsAsRead(storageKey, items) {
  const markers = readQaReadMarkers(storageKey);
  let changed = false;
  for (const item of items) {
    const marker = qaAnswerMarker(item);
    const id = String(item.id || item._id || '');
    if (marker && id && markers[id] !== marker) {
      markers[id] = marker;
      changed = true;
    }
  }
  if (!changed) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(markers));
    window.dispatchEvent(new CustomEvent('lms-qa-read', { detail: { storageKey } }));
  } catch (error) {
    console.error('Failed to save LMS Q&A read marker:', error);
  }
}

function markQaAsRead(storageKey, item) {
  markQaItemsAsRead(storageKey, [item]);
}

function isQaItemRead(storageKey, item) {
  const marker = qaAnswerMarker(item);
  const id = String(item.id || item._id || '');
  return Boolean(marker && id && readQaReadMarkers(storageKey)[id] === marker);
}

export function LmsTabBar({
  courseTab,
  setCourseTab,
  className = '',
  includeLessonList = true,
  light = false,
  courseId = '',
  lessonId = '',
  audience = 'student',
  userId = '',
}) {
  const { socket } = useSocket() || {};
  const tabs = includeLessonList ? LMS_PLAYER_TABS : LMS_PLAYER_TABS.filter((tab) => tab.key !== 'list');
  const [qaItems, setQaItems] = useState([]);
  const storageKey = qaReadStorageKey({ userId, courseId, lessonId, audience });
  const { answeredQaCount, unreadQaCount } = useMemo(() => {
    const readMarkers = readQaReadMarkers(storageKey);
    let answered = 0;
    let unread = 0;
    for (const item of qaItems) {
      const marker = qaAnswerMarker(item);
      const id = String(item.id || item._id || '');
      if (!marker || !id) continue;
      answered += 1;
      if (readMarkers[id] !== marker) unread += 1;
    }
    return { answeredQaCount: answered, unreadQaCount: unread };
  }, [qaItems, storageKey]);

  const loadQaItems = useCallback(() => {
    let active = true;
    if (!courseId) {
      setQaItems([]);
      return () => { active = false; };
    }

    const params = new URLSearchParams({ courseId: String(courseId) });
    if (lessonId) params.set('lessonId', String(lessonId));
    if (audience) params.set('audience', audience);

    apiFetch(`/training-lms/qa?${params.toString()}`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        if (!json?.success || !Array.isArray(json.data)) {
          setQaItems([]);
          return;
        }
        setQaItems(json.data);
      })
      .catch((error) => {
        console.error('Failed to load answered LMS questions for tab badge:', error);
        if (active) setQaItems([]);
      });

    return () => { active = false; };
  }, [courseId, lessonId, audience]);

  useEffect(() => loadQaItems(), [loadQaItems]);

  useEffect(() => {
    const updateReadState = (event) => {
      if (event.detail?.storageKey === storageKey) setQaItems((items) => [...items]);
    };
    window.addEventListener('lms-qa-read', updateReadState);
    return () => window.removeEventListener('lms-qa-read', updateReadState);
  }, [storageKey]);

  useEffect(() => {
    const refreshOnUpdate = (event) => {
      const detail = event.detail || {};
      if (detail.courseId && String(detail.courseId) !== String(courseId)) return;
      if (detail.audience && String(detail.audience) !== String(audience)) return;
      if (detail.lessonId && String(detail.lessonId) !== String(lessonId || '')) return;
      loadQaItems();
    };
    window.addEventListener('lms-qa-updated', refreshOnUpdate);
    return () => window.removeEventListener('lms-qa-updated', refreshOnUpdate);
  }, [courseId, lessonId, audience, loadQaItems]);

  useEffect(() => {
    if (!socket) return undefined;
    const onQaEvent = (raw) => {
      const payload = raw?.payload || raw || {};
      if (String(payload.kind || '') !== 'lms_qa') return;
      if (courseId && payload.courseId && String(payload.courseId) !== String(courseId)) return;
      if (audience && payload.audience && String(payload.audience) !== String(audience)) return;
      loadQaItems();
    };
    socket.on('lms_qa:updated', onQaEvent);
    socket.on('RECEIVE_NOTIFICATION', onQaEvent);
    return () => {
      socket.off('lms_qa:updated', onQaEvent);
      socket.off('RECEIVE_NOTIFICATION', onQaEvent);
    };
  }, [socket, courseId, audience, loadQaItems]);

  return (
    <div
      className={`${light ? 'border-b border-slate-200 bg-white' : 'border-b border-white/[0.08] bg-[#0d1117]'} ${className}`}
      role="tablist"
      aria-label="Tab nội dung bài học"
    >
      <div className={`flex flex-wrap items-stretch gap-0 w-full px-1 sm:px-0 ${light ? '' : 'max-w-3xl mx-auto'}`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={courseTab === t.key}
            onClick={() => {
              if (t.key === 'qa') markQaItemsAsRead(storageKey, qaItems);
              setCourseTab(t.key);
            }}
            className={`min-w-0 flex-1 basis-[30%] sm:flex-none sm:basis-auto px-2 sm:px-4 py-2.5 sm:py-3 text-[11px] sm:text-sm font-bold tracking-wide border-b-2 transition-colors text-center leading-tight ${
              t.mobileOnly ? 'lg:hidden' : ''
            } ${
              courseTab === t.key
                ? light
                  ? 'text-red-700 border-red-600 bg-red-50'
                  : 'text-white border-emerald-500 bg-white/[0.03]'
                : light
                  ? 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-800'
                  : 'text-slate-500 border-transparent hover:text-slate-300'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {t.label}
              {t.key === 'qa' && unreadQaCount > 0 ? (
                <span
                  aria-label={`${unreadQaCount} tin nhắn mới chưa đọc`}
                  className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black leading-none text-white"
                >
                  {unreadQaCount}
                </span>
              ) : null}
            </span>
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
  teacherAntiSeekSlot = null,
  light = false,
}) {
  if (!currentLesson) {
    return <p className={`${light ? 'text-slate-500' : 'text-slate-500'} text-sm`}>Chọn một bài giảng để xem tổng quan.</p>;
  }
  const idx = getChapterLessonIndex(lessons, currentLesson);
  const courseDesc = selectedCourse?.description || selectedCourse?.desc || '';

  return (
    <div className={`space-y-5 w-full ${light ? 'mx-0 text-slate-800' : 'max-w-3xl mx-auto'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className={`inline-block text-[9px] font-black uppercase tracking-[0.15em] mb-2 ${light ? 'text-emerald-700' : 'text-emerald-400/80'}`}>
            {currentLesson.chapterTitle || selectedCourse?.title || 'Bài giảng'}
          </span>
          <h1 className={`text-lg sm:text-xl font-bold leading-snug ${light ? 'text-slate-900' : 'text-white'}`}>
            {formatLessonDisplayTitle(currentLesson.title, idx)}
          </h1>
          {Number(currentLesson.duration) > 0 ? (
            <span className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-semibold ${light ? 'text-slate-500' : 'text-slate-400'}`}>
              <Clock size={12} />
              {Math.floor(currentLesson.duration / 60)} phút {String(currentLesson.duration % 60).padStart(2, '0')}s
            </span>
          ) : null}
        </div>
        {currentLesson.isCompleted && (
          <div className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-bold ${light ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'}`}>
            <CheckCircle size={13} /> Đã xong
          </div>
        )}
      </div>

      {teacherAntiSeekSlot}

      <div className="pt-1 space-y-2">
        <p className={`text-[11px] font-black uppercase tracking-widest ${light ? 'text-slate-500' : 'text-slate-500'}`}>Mô tả bài giảng</p>
        {currentLesson.description && /<[a-z][\s\S]*>/i.test(currentLesson.description) ? (
          <div
            className={`${light ? 'text-slate-600 [&_a]:text-emerald-700' : 'text-slate-400 [&_a]:text-emerald-400'} leading-relaxed text-[13px] break-words [&_p]:mb-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline`}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(currentLesson.description) }}
          />
        ) : (
          <p className={`${light ? 'text-slate-600' : 'text-slate-400'} leading-relaxed text-[13px] whitespace-pre-wrap`}>
            {htmlToPlainText(currentLesson.description) ||
              'Theo dõi video để nắm kiến thức. Hệ thống ghi nhận tiến độ khi bạn xem đủ thời lượng yêu cầu.'}
          </p>
        )}
      </div>

      {courseDesc ? (
        <div className={`pt-3 border-t space-y-2 ${light ? 'border-slate-200' : 'border-white/[0.06]'}`}>
          <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Về khóa học</p>
          {/<[a-z][\s\S]*>/i.test(courseDesc) ? (
            <div
              className={`${light ? 'text-slate-600' : 'text-slate-400'} leading-relaxed text-[13px] break-words [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5`}
              dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(courseDesc) }}
            />
          ) : (
            <p className={`${light ? 'text-slate-600' : 'text-slate-400'} leading-relaxed text-[13px] whitespace-pre-wrap`}>
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

function NotesPanel({ storageKey, lessonId, lessonTitle, getCurrentTime, light = false }) {
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
    <div className={`space-y-4 w-full ${light ? 'mx-0' : 'max-w-3xl mx-auto'}`}>
      <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${light ? 'border-slate-300 bg-white shadow-sm' : 'border-white/10 bg-white/[0.03]'}`}>
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
          className={`flex-1 min-w-0 bg-transparent text-sm outline-none ${light ? 'text-slate-900 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-500'}`}
        />
        <button
          type="button"
          onClick={addNote}
          className={`shrink-0 w-9 h-9 rounded-full border flex items-center justify-center ${light ? 'bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-200' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'}`}
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
              ? light ? 'border-emerald-600 text-emerald-800 bg-emerald-50' : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : light ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400'
          }`}
        >
          Bài hiện tại
        </button>
        <button
          type="button"
          onClick={() => setFilterLesson('all')}
          className={`text-[11px] font-bold px-3 py-1.5 rounded-lg border ${
            filterLesson === 'all'
              ? light ? 'border-emerald-600 text-emerald-800 bg-emerald-50' : 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10'
              : light ? 'border-slate-300 text-slate-600 hover:bg-slate-50' : 'border-white/10 text-slate-400'
          }`}
        >
          Tất cả bài giảng
        </button>
      </div>

      {filtered.length === 0 ? (
        <p className={`text-center text-sm py-10 leading-relaxed px-4 ${light ? 'text-slate-600' : 'text-slate-500'}`}>
          Nhấp vào ô &quot;Tạo ghi chú mới&quot; hoặc nút + để tạo ghi chú đầu tiên của bạn.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((n) => (
            <li
              key={n.id}
              className={`rounded-xl border px-4 py-3 flex gap-3 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.06] bg-white/[0.02]'}`}
            >
              <div className="flex-1 min-w-0">
                <div className={`flex flex-wrap items-center gap-2 text-[11px] font-bold mb-1 ${light ? 'text-emerald-800' : 'text-emerald-400/90'}`}>
                  <span className="tabular-nums">{formatLmsTimestamp(n.atSec)}</span>
                  {filterLesson === 'all' && n.lessonTitle ? (
                    <span className={`${light ? 'text-slate-600' : 'text-slate-500'} font-semibold truncate`}>{n.lessonTitle}</span>
                  ) : null}
                  <span className={`${light ? 'text-slate-500' : 'text-slate-600'} font-medium`}>{timeAgo(n.createdAt)}</span>
                </div>
                <p className={`text-sm whitespace-pre-wrap break-words ${light ? 'text-slate-800' : 'text-slate-300'}`}>{n.text}</p>
              </div>
              <button
                type="button"
                onClick={() => removeNote(n.id)}
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${light ? 'text-slate-500 hover:text-red-700 hover:bg-red-50' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'}`}
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
  light = false,
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
  const [expandedQaId, setExpandedQaId] = useState('');
  const [error, setError] = useState('');
  const [liveAtSec, setLiveAtSec] = useState(() => readNoteTimeSec(getCurrentTime));
  const getCurrentTimeRef = useRef(getCurrentTime);
  const liveAtSecRef = useRef(liveAtSec);
  const readStorageKey = qaReadStorageKey({
    userId: currentUserId,
    courseId,
    lessonId,
    audience,
  });
  getCurrentTimeRef.current = getCurrentTime;
  liveAtSecRef.current = liveAtSec;

  useEffect(() => {
    setExpandedQaId('');
  }, [lessonId]);

  useEffect(() => {
    if (!expandedQaId) return undefined;
    const collapseOnOutsideClick = (event) => {
      const target = event.target;
      const clickedQa = target instanceof Element ? target.closest('[data-lms-qa-id]') : null;
      if (clickedQa?.getAttribute('data-lms-qa-id') !== expandedQaId) {
        setExpandedQaId('');
      }
    };
    document.addEventListener('pointerdown', collapseOnOutsideClick);
    return () => document.removeEventListener('pointerdown', collapseOnOutsideClick);
  }, [expandedQaId]);

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
        window.dispatchEvent(new CustomEvent('lms-qa-updated', {
          detail: { courseId: String(courseId), lessonId: String(lessonId || ''), audience },
        }));
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
    setExpandedQaId(String(highlightQaId));
    const highlightedItem = items.find((item) => String(item.id || item._id) === String(highlightQaId));
    if (highlightedItem) markQaAsRead(readStorageKey, highlightedItem);
    const el = document.getElementById(`lms-qa-${highlightQaId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightQaId, items, readStorageKey]);

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
    <div className={`space-y-4 w-full ${light ? 'mx-0' : 'max-w-3xl mx-auto'}`}>
      <div className="flex gap-2">
        <div className={`flex-1 flex items-center gap-2 rounded-xl border px-3 py-2 ${light ? 'border-slate-300 bg-white' : 'border-white/10 bg-white/[0.03]'}`}>
          <Search size={14} className="text-slate-500 shrink-0" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm kiếm câu hỏi trong khóa học"
            className={`flex-1 min-w-0 bg-transparent text-sm outline-none ${light ? 'text-slate-900 placeholder:text-slate-500' : 'text-slate-200 placeholder:text-slate-500'}`}
          />
        </div>
      </div>

      <div className={`rounded-xl border p-4 space-y-2 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.08] bg-white/[0.02]'}`}>
        <div className="flex items-center justify-between gap-2">
          <p className={`text-[11px] font-black uppercase tracking-widest ${light ? 'text-slate-700' : 'text-slate-500'}`}>Đặt câu hỏi</p>
          <span className={`text-[11px] font-semibold tabular-nums ${light ? 'text-emerald-800' : 'text-emerald-400/90'}`}>
            Tại {formatLmsTimestamp(liveAtSec)}
          </span>
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tiêu đề câu hỏi"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${light ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-emerald-600' : 'border-white/10 bg-[#0b1018] text-slate-200 focus:border-emerald-500/40'}`}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Mô tả chi tiết (tuỳ chọn)"
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${light ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-emerald-600' : 'border-white/10 bg-[#0b1018] text-slate-200 focus:border-emerald-500/40'}`}
        />
        <button
          type="button"
          onClick={submit}
          disabled={sending || !title.trim() || !lessonId}
          className="inline-flex items-center gap-2 px-4 min-h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold"
        >
          <MessageSquare size={14} /> {sending ? 'Đang gửi...' : 'Gửi câu hỏi'}
        </button>
        {!lessonId ? (
          <p className={`text-[11px] ${light ? 'text-amber-800' : 'text-amber-400'}`}>Chọn một bài học trước khi gửi câu hỏi.</p>
        ) : null}
        {error ? <p className={`text-[11px] ${light ? 'text-red-700' : 'text-red-400'}`}>{error}</p> : null}
      </div>

      <h3 className={`text-sm font-bold ${light ? 'text-slate-900' : 'text-slate-300'}`}>
        Các câu hỏi trong video này ({filtered.length})
      </h3>

      {loading ? (
        <p className={`text-sm py-8 text-center ${light ? 'text-slate-600' : 'text-slate-500'}`}>Đang tải hỏi đáp...</p>
      ) : filtered.length === 0 ? (
        <p className={`text-sm py-8 text-center ${light ? 'text-slate-600' : 'text-slate-500'}`}>Chưa có câu hỏi. Hãy là người đầu tiên hỏi!</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((it) => {
            const id = String(it.id || it._id);
            const highlighted = highlightQaId && String(highlightQaId) === id;
            const expanded = expandedQaId === id;
            const dialogue = dialogueOf(it);
            const isRead = isQaItemRead(readStorageKey, it);
            return (
              <li
                key={id}
                id={`lms-qa-${id}`}
                data-lms-qa-id={id}
                className={`relative rounded-xl border p-4 ${
                  highlighted
                    ? light ? 'border-emerald-400 bg-emerald-50 ring-1 ring-emerald-300' : 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.06] bg-white/[0.02]'
                }`}
              >
                {dialogue.length > 0 ? (
                  <button
                    type="button"
                    aria-label={`${expanded ? 'Thu gọn' : 'Xem'} ${dialogue.length} tin nhắn trả lời`}
                    aria-expanded={expanded}
                    title={`${dialogue.length} tin nhắn trả lời`}
                    onClick={() => {
                      if (!expanded) markQaAsRead(readStorageKey, it);
                      setExpandedQaId((current) => (current === id ? '' : id));
                    }}
                    className={`absolute right-3 top-3 inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full border px-2 text-xs font-black transition-colors ${
                      isRead
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        : 'border-red-700 bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    <MessageSquare size={14} />
                    <span>{dialogue.length}</span>
                  </button>
                ) : null}
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full text-xs font-black flex items-center justify-center shrink-0 ${light ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {initials(it.askerName || it.author)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 flex-wrap pr-12">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={`${expanded ? 'Thu gọn' : 'Xem'} câu hỏi ${it.title}`}
                        onClick={() => {
                          if (!expanded) markQaAsRead(readStorageKey, it);
                          setExpandedQaId((current) => (current === id ? '' : id));
                        }}
                        className={`flex min-w-0 items-center gap-1.5 text-left text-sm font-bold ${light ? 'text-slate-900' : 'text-slate-100'}`}
                      >
                        <span>{it.title}</span>
                        <ChevronDown size={15} className={`shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                          it.status === 'answered'
                            ? isRead
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                            : light ? 'bg-amber-100 text-amber-800' : 'bg-amber-500/15 text-amber-300'
                        }`}
                      >
                        {it.status === 'answered' ? 'Đã trả lời' : 'Chờ trả lời'}
                      </span>
                    </div>
                    {it.body ? <p className={`text-[13px] mt-1 whitespace-pre-wrap ${light ? 'text-slate-700' : 'text-slate-400'}`}>{it.body}</p> : null}
                    <p className={`text-[11px] mt-2 ${light ? 'text-slate-600' : 'text-slate-500'}`}>
                      <span className={`font-semibold ${light ? 'text-emerald-800' : 'text-emerald-400/90'}`}>{it.askerName || it.author || userName}</span>
                      {it.lessonTitle ? ` · ${it.lessonTitle}` : ''}
                      <span className={`font-semibold tabular-nums ${light ? 'text-amber-800' : 'text-amber-300/90'}`}>{` · ${formatLmsTimestamp(it.atSec)}`}</span>
                      {` · ${timeAgo(it.createdAt)}`}
                    </p>

                    {expanded && dialogue.map((msg, idx) => {
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
                          <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${staffish ? 'text-red-700' : light ? 'text-emerald-800' : 'text-emerald-300'}`}>
                            {staffish ? `Trả lời · ${msg.authorName || 'Support'}` : `Phản hồi · ${msg.authorName || 'Học viên'}`}
                          </p>
                          <p className={`text-[13px] whitespace-pre-wrap ${staffish || light ? 'text-slate-800' : 'text-slate-200'}`}>
                            {msg.body}
                          </p>
                          {msg.createdAt ? (
                            <p className={`text-[10px] mt-1 ${light ? 'text-slate-500' : 'text-slate-400'}`}>{timeAgo(msg.createdAt)}</p>
                          ) : null}
                        </div>
                      );
                    })}

                    {expanded && canAnswer ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={answerDrafts[id] || ''}
                          onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                          rows={2}
                          placeholder={it.status === 'answered' ? 'Tiếp tục trả lời trong đối thoại...' : 'Nhập câu trả lời...'}
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${light ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-red-600' : 'border-white/10 bg-[#0b1018] text-slate-200 focus:border-red-500/40'}`}
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

                    {expanded && !canAnswer && String(it.askerId || '') === String(currentUserId || '') && (it.answer || (Array.isArray(it.thread) && it.thread.length > 0)) ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={replyDrafts[id] || ''}
                          onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                          rows={2}
                          placeholder="Phản hồi thêm / hỏi lại Support..."
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${light ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-emerald-600' : 'border-white/10 bg-[#0b1018] text-slate-200 focus:border-emerald-500/40'}`}
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

function ReviewsPanel({ courseId, courseTitle, userName, audience = 'student', light = false }) {
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
    <div className={`space-y-5 w-full ${light ? 'mx-0' : 'max-w-3xl mx-auto'}`}>
      <div className={`flex items-center gap-4 rounded-xl border p-4 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.06] bg-white/[0.02]'}`}>
        <div>
          <p className={`text-3xl font-extrabold tabular-nums ${light ? 'text-slate-900' : 'text-white'}`}>{avg ? avg.toFixed(1) : '—'}</p>
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                className={avg >= s - 0.25 ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
              />
            ))}
          </div>
          <p className="text-[11px] text-slate-600 mt-1">{list.length} đánh giá</p>
        </div>
      </div>

      <div className={`rounded-xl border p-4 space-y-3 ${light ? 'border-slate-200 bg-white' : 'border-white/[0.08]'}`}>
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
              <Star size={20} className={rating >= s ? 'text-amber-500 fill-amber-500' : light ? 'text-slate-400' : 'text-slate-600'} />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Chia sẻ trải nghiệm học của bạn..."
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-y ${light ? 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-emerald-600' : 'border-white/10 bg-[#0b1018] text-slate-200 focus:border-emerald-500/40'}`}
        />
        {error ? <p className={`text-xs font-semibold ${light ? 'text-red-700' : 'text-red-400'}`}>{error}</p> : null}
        {okMsg ? <p className={`text-xs font-semibold ${light ? 'text-emerald-800' : 'text-emerald-400'}`}>{okMsg}</p> : null}
        <button
          type="button"
          onClick={submit}
          disabled={sending || !comment.trim()}
          className="px-4 min-h-10 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold"
        >
          {sending ? 'Đang gửi...' : 'Gửi đánh giá'}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 text-center py-6">Đang tải đánh giá...</p>
      ) : (
        <ul className="space-y-3">
          {list.map((r) => (
            <li key={r.id} className={`rounded-xl border p-4 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center ${light ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white'}`}>
                  {initials(r.author)}
                </div>
                <div>
                  <p className={`text-sm font-bold ${light ? 'text-slate-900' : 'text-slate-200'}`}>{r.author}</p>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={11}
                        className={r.rating >= s ? 'text-amber-500 fill-amber-500' : light ? 'text-slate-400' : 'text-slate-600'}
                      />
                    ))}
                  </div>
                </div>
                <span className="ml-auto text-[11px] text-slate-500">{timeAgo(r.createdAt)}</span>
              </div>
              <p className={`text-[13px] whitespace-pre-wrap ${light ? 'text-slate-700' : 'text-slate-300'}`}>{r.comment}</p>
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

function ResourcesPanel({ files, light = false }) {
  const list = Array.isArray(files) ? files : [];
  if (!list.length) {
    return (
      <div className={`py-12 text-center text-slate-600 w-full ${light ? '' : 'max-w-3xl mx-auto'}`}>
        <FileBox size={36} className="mx-auto mb-3 opacity-40" />
        <p className="text-sm font-semibold">Chưa có tài liệu đính kèm</p>
      </div>
    );
  }

  return (
    <ul className={`space-y-3 w-full ${light ? 'mx-0' : 'max-w-3xl mx-auto'}`}>
      {list.map((file, idx) => {
        const rawUrl = file.fileUrl || file.url || '';
        const isLink = String(file.fileType || file.type || '').toUpperCase() === 'LINK';
        const href = rawUrl
          ? (isLink ? resolveMediaUrl(rawUrl) : buildMediaDownloadUrl(rawUrl, file.fileOriginalName || file.title))
          : null;
        return (
          <li
            key={file._id || file.id || idx}
            className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border p-4 ${light ? 'border-slate-200 bg-white shadow-sm' : 'border-white/[0.06] bg-white/[0.02]'}`}
          >
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold truncate ${light ? 'text-slate-900' : 'text-slate-100'}`}>{file.title || 'Tài liệu'}</p>
              <p className="text-[11px] text-slate-500 mt-1">{file.fileSize || file.size || file.fileType || file.type || 'File'}</p>
            </div>
            {href ? (
              isLink ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 min-h-10 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-bold shrink-0 no-underline"
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
                      {isCurrent ? (
                        <div className="w-[18px] h-[18px] rounded-full border-2 border-emerald-500 flex items-center justify-center">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                      ) : isLessonFullyWatched(lesson) ? (
                        <div className="w-[18px] h-[18px] rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <CheckCircle size={12} className="text-emerald-400" />
                        </div>
                      ) : !lesson.isUnlocked ? (
                        <Lock size={14} className="text-slate-600" />
                      ) : (
                        <PlayCircle size={16} className="text-slate-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4
                        className={`text-[12px] leading-snug line-clamp-2 normal-case ${
                          isCurrent
                            ? 'text-emerald-400 font-bold'
                            : isLessonFullyWatched(lesson)
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
  teacherAntiSeekSlot = null,
  audience = 'student',
  canAnswerQa = false,
  highlightQaId = null,
  light = false,
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
        teacherAntiSeekSlot={teacherAntiSeekSlot}
        light={light}
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
        light={light}
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
        light={light}
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
        light={light}
      />
    );
  }
  if (courseTab === 'resources') {
    return <ResourcesPanel files={selectedCourse?.files} light={light} />;
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
