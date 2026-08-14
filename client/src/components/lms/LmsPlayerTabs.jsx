import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, Award, CheckCircle, ChevronDown, ChevronUp, Clock, Download,
  FileBox, Lock, MessageSquare, PlayCircle, Plus, Search, Star, Trash2,
} from 'lucide-react';
import { LMS_PLAYER_TABS, formatLessonDisplayTitle, formatLmsTimestamp, getChapterLessonIndex } from '../../utils/lmsLessonUi';
import LessonSidebarMeta from './LessonSidebarMeta';
import { htmlToPlainText, sanitizeRichHtml } from '../../utils/htmlContent';
import { buildMediaDownloadUrl, downloadMediaFile, apiFetch } from '../../services/api';
import useLmsLocalStore, { lmsStoreKey } from '../../hooks/useLmsLocalStore';

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

function NotesPanel({ storageKey, lessonId, lessonTitle, getCurrentTime }) {
  const [notes, setNotes] = useLmsLocalStore(storageKey, []);
  const [draft, setDraft] = useState('');
  const [filterLesson, setFilterLesson] = useState('current');

  const filtered = useMemo(() => {
    const list = Array.isArray(notes) ? notes : [];
    const sorted = [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    if (filterLesson === 'current') return sorted.filter((n) => String(n.lessonId) === String(lessonId));
    return sorted;
  }, [notes, filterLesson, lessonId]);

  const addNote = () => {
    const text = draft.trim();
    if (!text || !lessonId) return;
    let at = 0;
    try {
      at = Number(getCurrentTime?.() || 0) || 0;
    } catch {
      at = 0;
    }
    setNotes((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        lessonId: String(lessonId),
        lessonTitle: lessonTitle || '',
        text,
        atSec: Math.floor(at),
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
          placeholder={`Tạo ghi chú mới tại ${formatLmsTimestamp(getCurrentTime?.() || 0)}`}
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
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [q, setQ] = useState('');
  const [answerDrafts, setAnswerDrafts] = useState({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!courseId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ courseId: String(courseId) });
      if (audience) qs.set('audience', audience);
      const res = await apiFetch(`/training-lms/qa?${qs.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (json?.success && Array.isArray(json.data)) {
        setItems(json.data);
      } else {
        setError(json?.message || 'Không tải được hỏi đáp');
      }
    } catch {
      setError('Lỗi kết nối hỏi đáp');
    } finally {
      setLoading(false);
    }
  }, [courseId, audience]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!highlightQaId) return;
    const el = document.getElementById(`lms-qa-${highlightQaId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightQaId, items]);

  const filtered = useMemo(() => {
    const list = [...(Array.isArray(items) ? items : [])].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (it) =>
        String(it.title || '').toLowerCase().includes(needle) ||
        String(it.body || '').toLowerCase().includes(needle) ||
        String(it.answer || '').toLowerCase().includes(needle)
    );
  }, [items, q]);

  const submit = async () => {
    const t = title.trim();
    if (!t || !courseId || !lessonId || sending) return;
    setSending(true);
    setError('');
    try {
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
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!json?.success) {
        setError(json?.message || 'Gửi câu hỏi thất bại');
        return;
      }
      setTitle('');
      setBody('');
      await load();
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
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500">Đặt câu hỏi</p>
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
        {!lessonId ? (
          <p className="text-[11px] text-amber-400">Chọn một bài học trước khi gửi câu hỏi.</p>
        ) : null}
        {error ? <p className="text-[11px] text-red-400">{error}</p> : null}
      </div>

      <h3 className="text-sm font-bold text-slate-300">
        Các câu hỏi trong khóa học này ({filtered.length})
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
                      {` · ${timeAgo(it.createdAt)}`}
                    </p>

                    {it.status === 'answered' && it.answer ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">
                          Trả lời · {it.answeredByName || 'Admin/GV'}
                        </p>
                        <p className="text-[13px] text-slate-700 whitespace-pre-wrap">{it.answer}</p>
                      </div>
                    ) : null}

                    {canAnswer && it.status !== 'answered' ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={answerDrafts[id] || ''}
                          onChange={(e) => setAnswerDrafts((prev) => ({ ...prev, [id]: e.target.value }))}
                          rows={2}
                          placeholder="Nhập câu trả lời..."
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

function ReviewsPanel({ storageKey, userName }) {
  const [items, setItems] = useLmsLocalStore(storageKey, []);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const avg = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    if (!list.length) return 0;
    return list.reduce((s, r) => s + (Number(r.rating) || 0), 0) / list.length;
  }, [items]);

  const submit = () => {
    const text = comment.trim();
    if (!text) return;
    setItems((prev) => [
      {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        rating: Math.min(5, Math.max(1, Number(rating) || 5)),
        comment: text,
        author: userName || 'Học viên',
        createdAt: Date.now(),
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setComment('');
    setRating(5);
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
        <button
          type="button"
          onClick={submit}
          className="px-4 min-h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
        >
          Gửi đánh giá
        </button>
      </div>

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
      </ul>
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
        const href = (file.fileUrl || file.url)
          ? buildMediaDownloadUrl(file.fileUrl || file.url, file.fileOriginalName || file.title)
          : null;
        return (
          <li
            key={file._id || file.id || idx}
            className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-100 truncate">{file.title || 'Tài liệu'}</p>
              <p className="text-[11px] text-slate-500 mt-1">{file.fileSize || file.size || file.type || 'File'}</p>
            </div>
            {href ? (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await downloadMediaFile(file.fileUrl || file.url, file.fileOriginalName || file.title);
                  } catch (err) {
                    // eslint-disable-next-line no-alert
                    window.alert(err?.message || 'Không tải được tài liệu');
                  }
                }}
                className="inline-flex items-center justify-center gap-2 px-4 min-h-10 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold shrink-0 border-0 cursor-pointer"
              >
                <Download size={14} /> Tải về
              </button>
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
  const reviewsKey = lmsStoreKey('reviews', userId, courseId);

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
      />
    );
  }
  if (courseTab === 'reviews') {
    return <ReviewsPanel storageKey={reviewsKey} userName={userName} />;
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
