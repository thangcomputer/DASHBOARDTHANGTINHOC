/**
 * Bang tin chung — HV / GV / Admin hoi bai, binh luan, thich, anh.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Heart, ThumbsUp, Laugh, Frown, Sparkles, MessageCircle, ImagePlus, Send, Trash2,
  Loader2, X, Newspaper, RefreshCw, Reply,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../services/api';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { useToast } from '../utils/toast';
import { useSocket } from '../context/SocketContext';

const ROLE_LABEL = {
  admin: 'Admin',
  staff: 'NV',
  teacher: 'GV',
  student: 'HV',
};

const ROLE_BADGE = {
  admin: 'bg-rose-100 text-rose-700',
  staff: 'bg-slate-100 text-slate-700',
  teacher: 'bg-amber-100 text-amber-800',
  student: 'bg-sky-100 text-sky-800',
};

const REACTIONS = [
  { type: 'heart', label: 'Tim', Icon: Heart, active: 'text-rose-600', fill: 'fill-rose-600' },
  { type: 'like', label: 'Like', Icon: ThumbsUp, active: 'text-blue-600' },
  { type: 'haha', label: 'Haha', Icon: Laugh, active: 'text-amber-500' },
  { type: 'wow', label: 'Wow', Icon: Sparkles, active: 'text-violet-600' },
  { type: 'sad', label: 'Buồn', Icon: Frown, active: 'text-slate-600' },
];

function reactionIconClass(r, active) {
  if (!active) return '';
  if (r.type === 'heart') return `${r.active} ${r.fill}`;
  return r.active;
}


function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' phút trước';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' giờ trước';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isAdminLike(role, userId) {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'staff' || userId === 'admin';
}

export default function FeedBoard({ session, role }) {
  const toast = useToast();
  const { socket } = useSocket() || {};
  const fileRef = useRef(null);
  const meId = String(session?.id || session?._id || '');
  const meRole = role || session?.role || 'student';

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [content, setContent] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [posting, setPosting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentFiles, setCommentFiles] = useState({});
  const [commentPreviews, setCommentPreviews] = useState({});
  const [replyTo, setReplyTo] = useState({});
  const [reactOpen, setReactOpen] = useState(null);
  const [commentsOpen, setCommentsOpen] = useState({});
  const [busyId, setBusyId] = useState(null);
  const commentFileRef = useRef(null);

  const convertImageFileToWebp = async (file, quality = 0.85) => {
    try {
      const type = String(file?.type || '');
      const name = String(file?.name || '').toLowerCase();
      const isPng = type === 'image/png' || name.endsWith('.png');
      if (!isPng) return file;
      if (typeof window === 'undefined') return file;

      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.decoding = 'async';

        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('Image load error'));
          img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;

        ctx.drawImage(img, 0, 0);

        const blob = await new Promise((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/webp', quality);
        });

        if (!blob) return file;

        const outName = String(file.name || 'image.png').replace(/\.png$/i, '.webp');
        return new File([blob], outName, { type: 'image/webp' });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      // If conversion fails, fallback to original file.
      return file;
    }
  };

  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setLightbox(null);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey, true);
    };
  }, [lightbox]);


  const load = useCallback(async (p = 1, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await api.feed.list(p, 15);
      if (res.success) {
        setPosts((prev) => (append ? [...prev, ...(res.data || [])] : (res.data || [])));
        setPage(res.pagination?.page || p);
        setTotalPages(res.pagination?.totalPages || 1);
      } else {
        toast.error(res.message || 'Không tải được bảng tin');
      }
    } catch {
      toast.error('Lỗi kết nối bảng tin');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [toast]);

  useEffect(() => { load(1, false); }, [load]);

  useEffect(() => {
    if (!socket) return undefined;
    try { socket.emit('feed:join'); } catch { /* ignore */ }

    const onNew = (post) => {
      if (!post?.id) return;
      setPosts((prev) => (prev.some((x) => x.id === post.id) ? prev : [{ ...post, likedByMe: false }, ...prev]));
    };
    const onDeleted = ({ id }) => setPosts((prev) => prev.filter((x) => x.id !== id));
    const onLike = ({ id, likesCount, reactions, reactionsCount }) => {
      setPosts((prev) => prev.map((post) => {
        if (post.id !== id) return post;
        return {
          ...post,
          likesCount: typeof likesCount === 'number' ? likesCount : post.likesCount,
          reactions: reactions || post.reactions,
          reactionsCount: typeof reactionsCount === 'number' ? reactionsCount : post.reactionsCount,
        };
      }));
    };
    const onComment = ({ id, comments, commentsCount }) => {
      setPosts((prev) => prev.map((post) => {
        if (post.id !== id) return post;
        return {
          ...post,
          comments: Array.isArray(comments) ? comments : post.comments,
          commentsCount: typeof commentsCount === 'number' ? commentsCount : post.commentsCount,
        };
      }));
    };

    socket.on('feed:new', onNew);
    socket.on('feed:deleted', onDeleted);
    socket.on('feed:like', onLike);
    socket.on('feed:comment', onComment);
    return () => {
      socket.off('feed:new', onNew);
      socket.off('feed:deleted', onDeleted);
      socket.off('feed:like', onLike);
      socket.off('feed:comment', onComment);
    };
  }, [socket, meId]);

  useEffect(() => () => {
    previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    setPendingFiles((prev) => {
      const next = [...prev, ...files].slice(0, 6);
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  };

  const removePending = (idx) => {
    setPendingFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  };

  const handlePost = async () => {
    const text = content.trim();
    if (!text && pendingFiles.length === 0) {
      toast.error('Nhập nội dung hoặc thêm ảnh');
      return;
    }
    setPosting(true);
    try {
      let images = [];
      if (pendingFiles.length) {
        const uploadFiles = await Promise.all(pendingFiles.map((f) => convertImageFileToWebp(f)));
        const up = await api.feed.uploadImages(uploadFiles);
        if (!up.success) {
          toast.error(up.message || 'Upload ảnh thất bại');
          return;
        }
        images = up.urls || [];
      }
      const res = await api.feed.create({
        content: text,
        images,
        authorAvatar: session?.avatar || '',
      });
      if (res.success) {
        setContent('');
        setPendingFiles([]);
        setPreviews([]);
        setPosts((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
        toast.success('Đã đăng bài');
      } else {
        toast.error(res.message || 'Không đăng được');
      }
    } catch {
      toast.error('Lỗi đăng bài');
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (postId, type) => {
    setReactOpen(null);
    let snapshot = null;
    setPosts((prev) => prev.map((post) => {
      if (post.id !== postId) return post;
      snapshot = post;
      const prevType = post.myReaction;
      const reactions = { heart: 0, like: 0, haha: 0, wow: 0, sad: 0, ...(post.reactions || {}) };
      if (prevType) reactions[prevType] = Math.max(0, (reactions[prevType] || 0) - 1);
      let myReaction = type;
      if (prevType === type) myReaction = null;
      else reactions[type] = (reactions[type] || 0) + 1;
      const reactionsCount = Object.values(reactions).reduce((a, b) => a + (Number(b) || 0), 0);
      return { ...post, reactions, myReaction, likedByMe: !!myReaction, reactionsCount, likesCount: reactionsCount };
    }));
    try {
      const res = await api.feed.react(postId, type);
      if (res.success) setPosts((prev) => prev.map((post) => (post.id === postId ? res.data : post)));
      else if (snapshot) {
        setPosts((prev) => prev.map((post) => (post.id === postId ? snapshot : post)));
        toast.error(res.message || 'Không thả cảm xúc được');
      }
    } catch {
      if (snapshot) setPosts((prev) => prev.map((post) => (post.id === postId ? snapshot : post)));
      toast.error('Không thả cảm xúc được');
    }
  };

  const handleDelete = async (postId) => {
    if (!window.confirm('Xóa bài viết này?')) return;
    setBusyId(postId);
    try {
      const res = await api.feed.remove(postId);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success('Đã xóa bài');
      } else toast.error(res.message || 'Không xóa được');
    } catch {
      toast.error('Lỗi xóa bài');
    } finally {
      setBusyId(null);
    }
  };

  const pickCommentFiles = (postId, e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/')).slice(0, 3);
    e.target.value = '';
    if (!files.length) return;
    setCommentFiles((prev) => ({ ...prev, [postId]: files }));
    setCommentPreviews((prev) => ({ ...prev, [postId]: files.map((f) => URL.createObjectURL(f)) }));
  };

  const handleComment = async (postId) => {
    const text = String(commentDrafts[postId] || '').trim();
    const files = commentFiles[postId] || [];
    if (!text && files.length === 0) return;
    setBusyId('c-' + postId);
    try {
      let images = [];
      if (files.length) {
        const uploadFiles = await Promise.all(files.map((f) => convertImageFileToWebp(f)));
        const up = await api.feed.uploadImages(uploadFiles);
        if (!up.success) { toast.error(up.message || 'Upload ảnh thất bại'); return; }
        images = up.urls || [];
      }
      const parentId = replyTo[postId]?.id || null;
      const res = await api.feed.comment(postId, { content: text, images, parentId });
      if (res.success) {
        setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)));
        setCommentDrafts((d) => ({ ...d, [postId]: '' }));
        setCommentFiles((d) => ({ ...d, [postId]: [] }));
        setCommentPreviews((d) => ({ ...d, [postId]: [] }));
        setReplyTo((d) => ({ ...d, [postId]: null }));
          setCommentsOpen((d) => ({ ...d, [postId]: true }));
      } else toast.error(res.message || 'Không gửi bình luận');
    } catch { toast.error('Lỗi bình luận'); }
    finally { setBusyId(null); }
  };

  const handleDeleteComment = async (postId, commentId) => {
    setBusyId('dc-' + commentId);
    try {
      const res = await api.feed.removeComment(postId, commentId);
      if (res.success) setPosts((prev) => prev.map((p) => (p.id === postId ? res.data : p)));
      else toast.error(res.message || 'Không xóa bình luận');
    } catch {
      toast.error('Lỗi xóa bình luận');
    } finally {
      setBusyId(null);
    }
  };

  const canDeletePost = (post) => isAdminLike(meRole, meId) || String(post.authorId) === meId;
  const canDeleteComment = (post, c) =>
    isAdminLike(meRole, meId) || String(c.authorId) === meId || String(post.authorId) === meId;

  return (
    <div className="cms-feed max-w-2xl mx-auto w-full px-3 sm:px-4 py-4 sm:py-6 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900 flex items-center gap-2">
            <Newspaper size={22} className="text-indigo-600" />
            Bảng tin hỏi bài
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Đăng câu hỏi, chia sẻ ảnh bài tập — mọi người cùng xem và trả lời.
          </p>
        </div>
        <button type="button" onClick={() => load(1, false)} className="w-9 h-9 rounded-xl bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center" title="Tải lại">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="cms-feed-composer">
        <div className="cms-feed-composer__row">
          <img src={resolveAvatarUrl({ avatar: session?.avatar, role: meRole, adminRole: session?.adminRole })} alt="" className="cms-feed-composer__avatar" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} maxLength={5000} placeholder="Bạn muốn hỏi gì về bài học? Viết câu hỏi tại đây..." className="cms-feed-composer__input" />
        </div>
        {previews.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-100">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePending(i)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="cms-feed-composer__actions">
          <div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={pendingFiles.length >= 6} className="cms-btn cms-btn--media">
              <ImagePlus size={16} /> Thêm ảnh
            </button>
          </div>
          <button type="button" onClick={handlePost} disabled={posting} className="cms-btn cms-btn-primary">
            {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Đăng bài
          </button>
        </div>
      </div>

      {loading ? (
        <div className="cms-feed-skeleton-list" aria-busy="true" aria-label="Đang tải bảng tin">
          {[0, 1, 2].map((i) => (
            <div key={i} className="cms-feed-card cms-feed-skeleton-card">
              <div className="cms-feed-skeleton-head">
                <div className="cms-skeleton cms-skeleton--avatar" />
                <div className="cms-feed-skeleton-lines">
                  <div className="cms-skeleton cms-skeleton--line cms-skeleton--short" />
                  <div className="cms-skeleton cms-skeleton--line" />
                </div>
              </div>
              <div className="cms-skeleton cms-skeleton--block" />
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
          <Newspaper className="mx-auto text-slate-300 mb-2" size={36} />
          <p className="text-sm font-bold text-slate-500">Chưa có bài nào</p>
          <p className="text-xs text-slate-400 mt-1">Hãy là người đầu tiên đặt câu hỏi!</p>
        </div>
      ) : (
        <div className="cms-feed-list">
          {posts.map((post) => (
            <article key={post.id} className="cms-feed-card">
              <div className="cms-feed-card__head">
                <img src={resolveAvatarUrl({ avatar: post.authorAvatar, role: post.authorRole })} alt="" className="cms-feed-card__avatar" />
                <div className="flex-1 min-w-0">
                  <div className="cms-feed-card__meta">
                    <span className="cms-feed-card__author truncate">{post.authorName}</span>
                    <span className={'cms-feed-card__role ' + (ROLE_BADGE[post.authorRole] || ROLE_BADGE.student)}>{ROLE_LABEL[post.authorRole] || post.authorRole}</span>
                    <span className="cms-feed-card__time">{formatTime(post.createdAt)}</span>
                  </div>
                  {post.content ? <p className="cms-feed-card__body">{post.content}</p> : null}
                </div>
                {canDeletePost(post) ? (
                  <button type="button" onClick={() => handleDelete(post.id)} disabled={busyId === post.id} className="text-slate-300 hover:text-red-500 p-1" title="Xóa bài"><Trash2 size={16} /></button>
                ) : null}
              </div>

              {post.images?.length > 0 ? (
                <div className={'grid gap-1 px-4 pb-2 ' + (post.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                  {post.images.map((url) => {
                    const src = resolveMediaUrl(url) || url;
                    return (
                      <button key={url} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(src); }} className="rounded-xl overflow-hidden bg-slate-50 max-h-72">
                        <img src={src} alt="" className="w-full h-full object-cover max-h-72" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="cms-feed-action">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setReactOpen((id) => (id === post.id ? null : post.id))}
                    className={'cms-feed-action__btn ' + (post.myReaction ? (REACTIONS.find((r) => r.type === post.myReaction)?.active || 'text-rose-600') : 'cms-feed-action__btn--idle')}
                  >
                    {(() => {
                      const cur = REACTIONS.find((r) => r.type === post.myReaction) || REACTIONS[0];
                      const Icon = cur.Icon;
                      return <Icon size={16} className={reactionIconClass(cur, !!post.myReaction)} />;
                    })()}
                    {post.reactionsCount || post.likesCount || 0}
                  </button>
                  {reactOpen === post.id ? (
                    <div className="absolute bottom-full left-0 mb-2 z-20 flex gap-1 bg-white border border-slate-200 shadow-lg rounded-full px-2 py-1.5">
                      {REACTIONS.map((r) => {
                        const Icon = r.Icon;
                        const active = post.myReaction === r.type;
                        return (
                          <button
                            key={r.type}
                            type="button"
                            title={r.label}
                            onClick={() => handleReact(post.id, r.type)}
                            className={'w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-50 ' + (active ? r.active : 'text-slate-500')}
                          >
                            <Icon size={16} className={reactionIconClass(r, active)} />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setCommentsOpen((d) => ({ ...d, [post.id]: !d[post.id] }))}
                  className={'cms-feed-action__btn cms-feed-action__btn--comment ' + (commentsOpen[post.id] ? 'cms-feed-action__btn--active' : 'cms-feed-action__btn--idle')}
                >
                  <MessageCircle size={16} />
                  {commentsOpen[post.id]
                    ? ('Ẩn bình luận' + ((post.commentsCount || 0) > 0 ? (' (' + String(post.commentsCount || 0) + ')') : ''))
                    : ((post.commentsCount || 0) > 0
                      ? ('Hiển thị bình luận (' + String(post.commentsCount || 0) + ')')
                      : 'Viết bình luận')}
                </button>
              </div>

              {commentsOpen[post.id] ? (
              <div className="px-4 pb-3 space-y-2 bg-slate-50/50">
                {(post.comments || []).filter((c) => !c.parentId).map((c) => {
                  const replies = (post.comments || []).filter((r) => r.parentId === c.id);
                  return (
                    <div key={c.id} className="pt-2 space-y-1.5">
                      <div className="flex gap-2">
                        <div className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2 border border-slate-100">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <img
                              src={resolveAvatarUrl({ avatar: c.authorAvatar, role: c.authorRole })}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                            />
                            <span className="text-xs font-black text-slate-800">{c.authorName}</span>
                            <span className={'text-[8px] font-black px-1 py-0.5 rounded ' + (ROLE_BADGE[c.authorRole] || '')}>{ROLE_LABEL[c.authorRole] || ''}</span>
                            <span className="text-[10px] text-slate-400">{formatTime(c.createdAt)}</span>
                            {canDeleteComment(post, c) ? (
                              <button type="button" onClick={() => handleDeleteComment(post.id, c.id)} className="ml-auto text-slate-300 hover:text-red-500" title="Xóa bình luận"><Trash2 size={12} /></button>
                            ) : null}
                          </div>
                          {c.content ? <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{c.content}</p> : null}
                          {(c.images || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {c.images.map((url) => {
                                const src = resolveMediaUrl(url) || url;
                                return (
                                <button key={url} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(src); }} className="block w-16 h-16 rounded-lg overflow-hidden border border-slate-100 cursor-zoom-in">
                                  <img src={src} alt="" className="w-full h-full object-cover" />
                                </button>
                              );})}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setReplyTo((d) => ({ ...d, [post.id]: { id: c.id, name: c.authorName, focusId: c.id } }))}
                            className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                          >
                            <Reply size={11} /> Trả lời
                          </button>
                        </div>
                      </div>

                      {replyTo[post.id]?.focusId === c.id ? (
                        <div className="pt-2 space-y-1.5">
                          <div className="flex items-center gap-2 text-[11px] text-indigo-600 font-semibold px-1">
                            <Reply size={12} />
                            Đang trả lời {replyTo[post.id].name}
                            <button type="button" onClick={() => setReplyTo((d) => ({ ...d, [post.id]: null }))} className="text-slate-400 hover:text-slate-600 ml-1" title="Hủy"><X size={12} /></button>
                          </div>
                          {(commentPreviews[post.id] || []).length > 0 ? (
                            <div className="flex flex-wrap gap-2 px-1">
                              {(commentPreviews[post.id] || []).map((src, i) => (
                                <div key={src} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100">
                                  <img src={src} alt="" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCommentFiles((d) => ({ ...d, [post.id]: [] }));
                                      setCommentPreviews((d) => ({ ...d, [post.id]: [] }));
                                    }}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          <div className="flex gap-2 items-center">
                            <input
                              value={commentDrafts[post.id] || ''}
                              onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                              placeholder={'Trả lời ' + replyTo[post.id]?.name + '...'}
                              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                            <label
                              className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1.5"
                              title="Thêm ảnh"
                            >
                              <ImagePlus size={16} />
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => pickCommentFiles(post.id, e)}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleComment(post.id)}
                              disabled={busyId === ('c-' + post.id)}
                              className="text-indigo-600 hover:text-indigo-800 p-1.5 disabled:opacity-40"
                              title="Gửi"
                            >
                              {busyId === ('c-' + post.id) ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Send size={16} />
                              )}
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {replies.map((r) => (
                        <div key={r.id} className="space-y-1.5">
                          <div className="flex gap-2 pl-6">
                            <div className="flex-1 min-w-0 bg-white rounded-xl px-3 py-2 border border-slate-100 border-l-2 border-l-indigo-200">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <img
                                  src={resolveAvatarUrl({ avatar: r.authorAvatar, role: r.authorRole })}
                                  alt=""
                                  className="w-6 h-6 rounded-full object-cover flex-shrink-0"
                                />
                                <span className="text-xs font-black text-slate-800">{r.authorName}</span>
                                <span className={'text-[8px] font-black px-1 py-0.5 rounded ' + (ROLE_BADGE[r.authorRole] || '')}>{ROLE_LABEL[r.authorRole] || ''}</span>
                                <span className="text-[10px] text-slate-400">{formatTime(r.createdAt)}</span>
                                {canDeleteComment(post, r) ? (
                                  <button type="button" onClick={() => handleDeleteComment(post.id, r.id)} className="ml-auto text-slate-300 hover:text-red-500" title="Xóa"><Trash2 size={12} /></button>
                                ) : null}
                              </div>
                              {r.content ? <p className="text-xs text-slate-600 mt-0.5 whitespace-pre-wrap">{r.content}</p> : null}
                              {(r.images || []).length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {r.images.map((url) => {
                                    const src = resolveMediaUrl(url) || url;
                                    return (
                                    <button key={url} type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(src); }} className="block w-14 h-14 rounded-lg overflow-hidden border border-slate-100 cursor-zoom-in">
                                      <img src={src} alt="" className="w-full h-full object-cover" />
                                    </button>
                                  );})}
                                </div>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setReplyTo((d) => ({ ...d, [post.id]: { id: c.id, name: r.authorName, focusId: r.id } }))}
                                className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600"
                              >
                                <Reply size={11} /> Trả lời
                              </button>
                            </div>
                          </div>

                          {replyTo[post.id]?.focusId === r.id ? (
                            <div className="pl-6 pt-1 space-y-1.5">
                              <div className="flex items-center gap-2 text-[11px] text-indigo-600 font-semibold px-1">
                                <Reply size={12} />
                                Đang trả lời {replyTo[post.id].name}
                                <button type="button" onClick={() => setReplyTo((d) => ({ ...d, [post.id]: null }))} className="text-slate-400 hover:text-slate-600 ml-1" title="Hủy"><X size={12} /></button>
                              </div>
                              {(commentPreviews[post.id] || []).length > 0 ? (
                                <div className="flex flex-wrap gap-2 px-1">
                                  {(commentPreviews[post.id] || []).map((src) => (
                                    <div key={src} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100">
                                      <img src={src} alt="" className="w-full h-full object-cover" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCommentFiles((d) => ({ ...d, [post.id]: [] }));
                                          setCommentPreviews((d) => ({ ...d, [post.id]: [] }));
                                        }}
                                        className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex gap-2 items-center">
                                <input
                                  value={commentDrafts[post.id] || ''}
                                  onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                                  placeholder={'Trả lời ' + replyTo[post.id]?.name + '...'}
                                  className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                                <label className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1.5" title="Thêm ảnh">
                                  <ImagePlus size={16} />
                                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickCommentFiles(post.id, e)} />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleComment(post.id)}
                                  disabled={busyId === ('c-' + post.id)}
                                  className="text-indigo-600 hover:text-indigo-800 p-1.5 disabled:opacity-40"
                                  title="Gửi"
                                >
                                  {busyId === ('c-' + post.id) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {!replyTo[post.id] ? (
                  <>
                    {(commentPreviews[post.id] || []).length > 0 ? (
                      <div className="flex flex-wrap gap-2 px-1">
                        {(commentPreviews[post.id] || []).map((src, i) => (
                          <div key={src} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-100">
                            <img src={src} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setCommentFiles((d) => ({ ...d, [post.id]: [] }));
                                setCommentPreviews((d) => ({ ...d, [post.id]: [] }));
                              }}
                              className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white flex items-center justify-center"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    <div className="flex gap-2 pt-1 pb-1 items-center">
                      <input
                        value={commentDrafts[post.id] || ''}
                        onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                        placeholder="Viết bình luận..."
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-100"
                      />
                      <label className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1.5" title="Thêm ảnh">
                        <ImagePlus size={16} />
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickCommentFiles(post.id, e)} />
                      </label>
                      <button
                        type="button"
                        onClick={() => handleComment(post.id)}
                        disabled={busyId === ('c-' + post.id)}
                        className="text-indigo-600 hover:text-indigo-800 p-1.5 disabled:opacity-40"
                        title="Gửi"
                      >
                        {busyId === ('c-' + post.id) ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
              ) : null}
            </article>
          ))}

          {page < totalPages ? (
            <button type="button" onClick={() => load(page + 1, true)} disabled={loadingMore} className="cms-btn cms-btn-outline cms-btn--block">
              {loadingMore ? 'Đang tải...' : 'Xem thêm bài cũ'}
            </button>
          ) : null}
        </div>
      )}

      {lightbox ? createPortal(
        <div
          className="fixed inset-0 z-[130000] flex items-center justify-center p-4 bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-[130002] flex items-center gap-2 rounded-full bg-black/70 hover:bg-black text-white px-3 py-2 text-sm font-bold border-2 border-white/40 shadow-lg"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
            aria-label="Đóng"
          >
            <X size={22} />
            <span className="inline">Đóng (Esc)</span>
          </button>
          <img
            src={lightbox}
            alt=""
            className="relative z-[130001] max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
