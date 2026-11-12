/**
 * Bang tin chung - HV / GV / Admin hoi bai, binh luan, thich, anh, sua bai, quyen rieng tu.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import {
  Headphones, ImagePlus, Send, Trash2, MessageCircle, Flag, Pin, PinOff,
  Loader2, X, Newspaper, RefreshCw, Reply, Sparkles, Heart, ThumbsUp, Laugh, Frown,
  Globe, GraduationCap, Users, Lock, Edit3, Check, ChevronDown, Eye, AlertCircle,
  Play, ExternalLink, MoreVertical,
} from 'lucide-react';
import api, { resolveMediaUrl } from '../services/api';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { useToast } from '../utils/useToast';
import { useSocket } from '../context/SocketContext';
import SupportMascot from './SupportMascot';
import { extractYouTubeId } from '../utils/youtubeDuration';
import { useStudentSubscription } from './student/subscription/subscriptionContext';
import { isFeedPostLocked } from '../utils/subscription';

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

function readPersonalPins(storageKey) {
  try {
    const stored = window.localStorage.getItem(storageKey);
    const ids = stored ? JSON.parse(stored) : [];
    return {
      ids: Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [],
      error: '',
    };
  } catch (error) {
    return { ids: [], error: error?.message || 'Không thể tải danh sách bài viết đã ghim' };
  }
}

const REACTIONS = [
  { type: 'heart', label: 'Tim', emoji: '❤️', Icon: Heart, active: 'text-rose-600', fill: 'fill-rose-600', bg: 'bg-rose-50 border-rose-200' },
  { type: 'like', label: 'Like', emoji: '👍', Icon: ThumbsUp, active: 'text-blue-600', fill: 'fill-blue-600', bg: 'bg-blue-50 border-blue-200' },
  { type: 'haha', label: 'Haha', emoji: '😄', Icon: Laugh, active: 'text-amber-500', fill: 'fill-amber-500', bg: 'bg-amber-50 border-amber-200' },
  { type: 'wow', label: 'Wow', emoji: '😮', Icon: Sparkles, active: 'text-violet-600', fill: 'fill-violet-600', bg: 'bg-violet-50 border-violet-200' },
  { type: 'sad', label: 'Buồn', emoji: '😢', Icon: Frown, active: 'text-slate-600', fill: 'fill-slate-600', bg: 'bg-slate-50 border-slate-200' },
];

const PRIVACY_OPTIONS = [
  { value: 'public', label: 'Công khai', icon: Globe, desc: 'Tất cả mọi người đều xem được', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'teachers', label: 'Chỉ Giảng viên & Admin', icon: GraduationCap, desc: 'Học viên không xem được', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'students', label: 'Chỉ Học viên & Admin', icon: Users, desc: 'Giảng viên không xem được', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'admin_only', label: 'Chỉ Ban Quản trị', icon: Lock, desc: 'Chỉ Super Admin, High Admin & Staff xem được', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' },
];

/** URL YouTube trong text bài viết / bình luận */
const YOUTUBE_URL_RE = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?[^\s]*v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w\-?=&%.]+/gi;

function collectYouTubeFromText(text) {
  const raw = String(text || '');
  if (!raw) return [];
  const seen = new Set();
  const items = [];
  const re = new RegExp(YOUTUBE_URL_RE.source, 'gi');
  let m;
  while ((m = re.exec(raw)) !== null) {
    const url = m[0];
    const id = extractYouTubeId(url);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    items.push({ id, url });
  }
  return items;
}

function FeedYouTubePreviews({ text, onOpen, compact = false }) {
  const items = useMemo(() => collectYouTubeFromText(text), [text]);
  if (!items.length) return null;
  return (
    <div className={compact ? 'mt-1.5 space-y-1.5' : 'mt-3 space-y-2'}>
      {items.map(({ id, url }) => (
        <button
          key={id}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onOpen?.({ id, url });
          }}
          className={`group relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-900 text-left shadow-sm hover:border-red-300 hover:shadow-md transition-all ${compact ? 'aspect-video max-h-36' : 'aspect-video max-h-64'
            }`}
          title="Xem video YouTube"
        >
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt="YouTube"
            className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            loading="lazy"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center w-12 h-12 rounded-full bg-red-600 text-white shadow-lg group-hover:scale-105 transition-transform">
              <Play size={compact ? 18 : 22} className="ml-0.5 fill-white" aria-hidden="true" />
            </span>
          </span>
          <span className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 text-white text-[11px] font-bold drop-shadow">
            <span className="px-1.5 py-0.5 rounded bg-red-600/90">YouTube</span>
            <span className="truncate opacity-90">Bấm để xem</span>
          </span>
        </button>
      ))}
    </div>
  );
}

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

function fallbackFeedAvatar(event, person) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied) return;
  image.dataset.fallbackApplied = '1';
  image.src = resolveAvatarUrl({ ...person, avatar: '' });
}

export default function FeedBoard({ session, role }) {
  const location = useLocation();
  const toast = useToast();
  const { socket, onlineUsers } = useSocket() || {};
  const fileRef = useRef(null);
  const editFileRef = useRef(null);
  const meId = String(session?.id || session?._id || '');
  const meRole = role || session?.role || 'student';
  const currentAvatar = session?.avatar || session?.avatarUrl || '';
  const resolveFeedAvatar = useCallback((person = {}) => {
    const personId = String(person.authorId || person.userId || person.id || '');
    const isCurrentUser = personId && meId && personId === meId;
    const presenceAvatar = (onlineUsers || []).find(
      (user) => String(user.userId || user.id || '') === personId,
    )?.avatar;
    return resolveAvatarUrl({
      avatar: isCurrentUser && currentAvatar
        ? currentAvatar
        : presenceAvatar || person.authorAvatar || person.avatar,
      role: person.authorRole || person.role || meRole,
      gender: person.authorGender || person.gender || (isCurrentUser ? session?.gender : ''),
      name: person.authorName || person.userName || session?.name,
      id: personId,
      adminRole: person.authorAdminRole || person.adminRole || (isCurrentUser ? session?.adminRole : null),
    });
  }, [currentAvatar, meId, meRole, onlineUsers, session?.adminRole, session?.name]);
  const meAdminRole = String(session?.adminRole || '').toUpperCase();
  const isSuperAdminViewerUser = meId === 'admin' || meAdminRole === 'SUPER_ADMIN';
  const isHighAdminViewerUser = meAdminRole === 'HIGH_ADMIN';
  const canModerateFeed = meRole === 'admin' || meRole === 'staff' || isSuperAdminViewerUser || isHighAdminViewerUser;
  const studentSubscription = useStudentSubscription();
  const isFreePortalStudent = meRole === 'student' && (
    session?.freePortal === true
    || (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'))
  );
  const isGreenTone = meRole === 'teacher' || isFreePortalStudent;
  const postLocked = useMemo(
    () => isFeedPostLocked({
      role: meRole,
      session,
      subscription: studentSubscription?.subscription,
    }),
    [meRole, session, studentSubscription?.subscription],
  );

  const isAuthorSuperAdmin = (authorId, authorAdminRole) => {
    const uid = String(authorId || '');
    const ar = String(authorAdminRole || '').toUpperCase();
    return uid === 'admin' || ar === 'SUPER_ADMIN';
  };

  const canDeletePost = (post) => {
    if (!post) return false;
    const isPostAuthor = String(post.authorId) === meId;
    const isFromSuper = isAuthorSuperAdmin(post.authorId, post.authorAdminRole);

    // 1. Bài của Super Admin: CHỈ Super Admin mới xóa được
    if (isFromSuper) {
      return isSuperAdminViewerUser;
    }

    // 2. Tác giả tự xóa bài của mình
    if (isPostAuthor) return true;

    // 3. Super Admin và High Admin xóa được bài của người khác
    if (isSuperAdminViewerUser || isHighAdminViewerUser) return true;

    // 4. Người khác không được xóa bài của người khác
    return false;
  };

  const canEditPost = (post) => {
    if (!post) return false;
    if (isSuperAdminViewerUser) return true;
    return String(post.authorId) === meId;
  };

  const canDeleteComment = (post, c) => {
    if (!c) return false;
    const isCommentAuthor = String(c.authorId) === meId;
    const isFromSuper = isAuthorSuperAdmin(c.authorId, c.authorAdminRole);

    // 1. Bình luận của Super Admin: CHỈ Super Admin mới xóa được
    if (isFromSuper) {
      return isSuperAdminViewerUser;
    }

    // 2. Tác giả tự xóa bình luận của chính mình
    if (isCommentAuthor) return true;

    // 3. Super Admin và High Admin xóa được bình luận của tất cả mọi người
    if (isSuperAdminViewerUser || isHighAdminViewerUser) return true;

    // 4. Chủ bài viết (nếu không phải comment của Super Admin) có thể xóa comment trong bài mình
    if (post && String(post.authorId) === meId) return true;

    return false;
  };

  const canViewPost = useCallback((post) => {
    if (!post) return false;
    const vis = post.visibility || 'public';
    if (vis === 'public') return true;
    if (isSuperAdminViewerUser || isHighAdminViewerUser || meRole === 'admin' || meRole === 'staff') return true;
    if (String(post.authorId) === meId) return true;
    if (vis === 'teachers' && meRole === 'teacher') return true;
    if (vis === 'students' && meRole === 'student') return true;
    return false;
  }, [isSuperAdminViewerUser, isHighAdminViewerUser, meRole, meId]);

  const availablePrivacyOptions = useMemo(() => {
    if (isSuperAdminViewerUser || isHighAdminViewerUser || meRole === 'admin' || meRole === 'staff') {
      return PRIVACY_OPTIONS;
    }
    if (meRole === 'teacher') {
      return PRIVACY_OPTIONS.filter((p) => p.value !== 'admin_only');
    }
    return PRIVACY_OPTIONS.filter((p) => p.value === 'public' || p.value === 'students');
  }, [isSuperAdminViewerUser, isHighAdminViewerUser, meRole]);

  const [posts, setPosts] = useState([]);
  const visiblePosts = useMemo(() => posts.filter(canViewPost), [posts, canViewPost]);
  const personalPinsStorageKey = `feed-personal-pins:${meId || 'preview'}`;
  const [personalPinsState, setPersonalPinsState] = useState(() => ({
    storageKey: personalPinsStorageKey,
    ...readPersonalPins(personalPinsStorageKey),
  }));
  const personalPinnedIds = personalPinsState.storageKey === personalPinsStorageKey
    ? personalPinsState.ids
    : [];
  const personalPinsError = personalPinsState.storageKey === personalPinsStorageKey
    ? personalPinsState.error
    : '';
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const focusRequestKey = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const postId = params.get('postId') || '';
    const commentId = params.get('commentId') || '';
    const parentCommentId = params.get('parentCommentId') || '';
    return postId ? { key: `${postId}:${commentId}:${parentCommentId}`, postId, commentId, parentCommentId } : null;
  }, [location.search]);
  const handledFocusRequest = useRef('');
  const [focusTarget, setFocusTarget] = useState(null);
  const [content, setContent] = useState('');
  const [postVisibility, setPostVisibility] = useState('public');
  const [showVisibilityMenu, setShowVisibilityMenu] = useState(false);
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
  const [lightbox, setLightbox] = useState(null);
  const [youtubeModal, setYoutubeModal] = useState(null); // { id, url } | null

  // Edit Post State
  const [editingPost, setEditingPost] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [editExistingImages, setEditExistingImages] = useState([]);
  const [editPendingFiles, setEditPendingFiles] = useState([]);
  const [editPreviews, setEditPreviews] = useState([]);
  const [editVisibility, setEditVisibility] = useState('public');
  const [editSaving, setEditSaving] = useState(false);

  // Reaction Details Modal State
  const [reactionModalPost, setReactionModalPost] = useState(null);
  const [reactionModalTab, setReactionModalTab] = useState('all');
  const [pendingReports, setPendingReports] = useState([]);
  const [reportQueueError, setReportQueueError] = useState('');
  const [reportingPost, setReportingPost] = useState(null);
  const [postMenuOpenId, setPostMenuOpenId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [resolvingReportId, setResolvingReportId] = useState(null);

  useEffect(() => {
    if (personalPinsState.storageKey === personalPinsStorageKey) return undefined;
    let active = true;
    void Promise.resolve().then(() => {
      const nextState = readPersonalPins(personalPinsStorageKey);
      if (active) setPersonalPinsState({ storageKey: personalPinsStorageKey, ...nextState });
    });
    return () => {
      active = false;
    };
  }, [personalPinsStorageKey, personalPinsState.storageKey]);

  useEffect(() => {
    if (personalPinsError) toast.error(personalPinsError);
  }, [personalPinsError, toast]);

  const orderedVisiblePosts = useMemo(() => visiblePosts
    .map((post, index) => ({ post, index }))
    .sort((a, b) => Number(personalPinnedIds.includes(String(b.post.id))) - Number(personalPinnedIds.includes(String(a.post.id))) || a.index - b.index)
    .map(({ post }) => post), [visiblePosts, personalPinnedIds]);

  const anyCommentsOpen = Object.values(commentsOpen).some(Boolean);

  useEffect(() => {
    if (!anyCommentsOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest('[data-feed-comments]')) return;
      const trigger = event.target.closest('[data-feed-comments-trigger]');
      const triggerPostId = trigger?.getAttribute('data-feed-comments-trigger');
      setCommentsOpen((open) => Object.fromEntries(
        Object.entries(open).filter(([id, isOpen]) => isOpen && id === triggerPostId)
      ));
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setCommentsOpen({});
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [anyCommentsOpen]);

  useEffect(() => {
    if (!reactOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (event.target instanceof Element && event.target.closest('.cms-feed-reaction')) return;
      setReactOpen(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setReactOpen(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [reactOpen]);

  useEffect(() => {
    if (!postMenuOpenId) return undefined;
    const closeOnOutsidePointer = (event) => {
      if (event.target instanceof Element && event.target.closest('.cms-feed-post-menu')) return;
      setPostMenuOpenId(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setPostMenuOpenId(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [postMenuOpenId]);

  const reportReasons = [
    { value: 'spam', label: 'Spam hoặc quảng cáo' },
    { value: 'harassment', label: 'Quấy rối hoặc xúc phạm' },
    { value: 'inappropriate', label: 'Nội dung không phù hợp' },
    { value: 'misinformation', label: 'Thông tin sai lệch' },
    { value: 'other', label: 'Lý do khác' },
  ];

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
        const loadPromise = new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = (e) => reject(e);
        });
        img.src = url;
        await loadPromise;

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(img, 0, 0);

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
        if (!blob) return file;

        const newName = name.replace(/\.png$/i, '.webp');
        return new File([blob], newName, { type: 'image/webp' });
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch {
      return file;
    }
  };

  const load = useCallback(async (p = 1, append = false) => {
    if (append) setLoadingMore(true);
    try {
      const res = await api.feed.list({ page: p, limit: 20 });
      if (res.success) {
        const list = res.data || [];
        setPosts((prev) => (append ? [...prev, ...list] : list));
        setPage(res.pagination?.page || 1);
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

  useEffect(() => {
    void Promise.resolve().then(() => load(1, false));
  }, [load]);

  useEffect(() => {
    if (!focusRequestKey || loading || handledFocusRequest.current === focusRequestKey.key) return undefined;
    handledFocusRequest.current = focusRequestKey.key;
    let active = true;
    const loadTargetPost = async () => {
      try {
        const foundPosts = [];
        let targetPage = 1;
        let pages = 1;
        for (let currentPage = 1; currentPage <= pages; currentPage += 1) {
          const response = await api.feed.list({ page: currentPage, limit: 20 });
          if (!response.success) throw new Error(response.message || 'Không thể tìm bài viết được thông báo.');
          const pagePosts = Array.isArray(response.data) ? response.data : [];
          foundPosts.push(...pagePosts);
          pages = response.pagination?.totalPages || pages;
          if (pagePosts.some((post) => String(post.id) === focusRequestKey.postId)) {
            targetPage = currentPage;
            break;
          }
        }
        if (!foundPosts.some((post) => String(post.id) === focusRequestKey.postId)) {
          throw new Error('Bài viết trong thông báo không còn tồn tại hoặc bạn không có quyền xem.');
        }
        if (!active) return;
        setPosts(foundPosts);
        setPage(targetPage);
        setTotalPages(pages);
        setCommentsOpen({ [focusRequestKey.postId]: true });
        setFocusTarget(focusRequestKey);
      } catch (error) {
        if (active) toast.error(error?.message || 'Không thể mở vị trí bình luận.');
      }
    };
    void loadTargetPost();
    return () => { active = false; };
  }, [focusRequestKey, loading, toast]);

  useEffect(() => {
    if (!focusTarget || !commentsOpen[focusTarget.postId]) return undefined;
    const frame = window.requestAnimationFrame(() => {
      const target = focusTarget.commentId
        ? document.getElementById(`feed-comment-${focusTarget.commentId}`)
        : document.getElementById(`feed-post-${focusTarget.postId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commentsOpen, focusTarget, posts]);

  useEffect(() => {
    if (!canModerateFeed) return undefined;
    let active = true;
    api.feed.reports()
      .then((res) => {
        if (!active) return;
        if (res.success) {
          setPendingReports(Array.isArray(res.data) ? res.data : []);
          setReportQueueError('');
        } else {
          setReportQueueError(res.message || 'Không thể tải báo cáo bài viết.');
        }
      })
      .catch((error) => {
        if (active) setReportQueueError(error?.message || 'Không thể tải báo cáo bài viết.');
      });
    return () => { active = false; };
  }, [canModerateFeed]);

  useEffect(() => {
    if (!youtubeModal) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setYoutubeModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [youtubeModal]);

  // Realtime Socket listeners
  useEffect(() => {
    if (!socket) return;

    socket.emit('feed:join');

    const onNew = (post) => {
      if (!post?.id || !canViewPost(post)) return;
      setPosts((prev) => (prev.some((x) => x.id === post.id) ? prev : [{ ...post, likedByMe: false }, ...prev]));
    };
    const onDeleted = ({ id }) => {
      setPosts((prev) => prev.filter((x) => x.id !== id));
      if (editingPost?.id === id) setEditingPost(null);
      if (reactionModalPost?.id === id) setReactionModalPost(null);
    };
    const onUpdated = (updatedPost) => {
      if (!updatedPost?.id) return;
      if (!canViewPost(updatedPost)) {
        setPosts((prev) => prev.filter((p) => p.id !== updatedPost.id));
        if (editingPost?.id === updatedPost.id) setEditingPost(null);
        if (reactionModalPost?.id === updatedPost.id) setReactionModalPost(null);
        return;
      }
      setPosts((prev) => prev.map((p) => (p.id === updatedPost.id ? { ...p, ...updatedPost } : p)));
      if (reactionModalPost?.id === updatedPost.id) {
        setReactionModalPost((prev) => ({ ...prev, ...updatedPost }));
      }
    };
    const onLike = ({ id, likesCount, reactions, reactionsCount, reactionsList }) => {
      setPosts((prev) => prev.map((post) => {
        if (post.id !== id) return post;
        return {
          ...post,
          likesCount: typeof likesCount === 'number' ? likesCount : post.likesCount,
          reactions: reactions || post.reactions,
          reactionsCount: typeof reactionsCount === 'number' ? reactionsCount : post.reactionsCount,
          reactionsList: Array.isArray(reactionsList) ? reactionsList : post.reactionsList,
        };
      }));
      if (reactionModalPost?.id === id) {
        setReactionModalPost((prev) => ({
          ...prev,
          reactions: reactions || prev.reactions,
          reactionsCount: typeof reactionsCount === 'number' ? reactionsCount : prev.reactionsCount,
          reactionsList: Array.isArray(reactionsList) ? reactionsList : prev.reactionsList,
        }));
      }
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
    socket.on('feed:updated', onUpdated);
    socket.on('feed:like', onLike);
    socket.on('feed:comment', onComment);
    return () => {
      socket.off('feed:new', onNew);
      socket.off('feed:deleted', onDeleted);
      socket.off('feed:updated', onUpdated);
      socket.off('feed:like', onLike);
      socket.off('feed:comment', onComment);
    };
  }, [socket, editingPost, reactionModalPost, canViewPost]);

  useEffect(() => () => {
    previews.forEach((u) => URL.revokeObjectURL(u));
    editPreviews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews, editPreviews]);

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

  const handlePastePost = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          const ext = file.type.split('/')[1] || 'png';
          const pastedFile = new File([file], `paste_${Date.now()}_${i}.${ext}`, { type: file.type });
          files.push(pastedFile);
        }
      }
    }
    if (files.length > 0) {
      e.preventDefault();
      setPendingFiles((prev) => {
        const next = [...prev, ...files].slice(0, 6);
        setPreviews(next.map((f) => URL.createObjectURL(f)));
        return next;
      });
      toast.success(`Đã dán ${files.length} ảnh xem trước.`);
    }
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
    if (postLocked) return;
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
        visibility: postVisibility,
        authorAvatar: session?.avatar || '',
      });
      if (res.success) {
        setContent('');
        setPendingFiles([]);
        setPreviews([]);
        setPosts((prev) => [res.data, ...prev.filter((p) => p.id !== res.data.id)]);
        toast.success('Đã đăng bài viết');
      } else {
        toast.error(res.message || 'Không đăng được');
      }
    } catch {
      toast.error('Lỗi đăng bài');
    } finally {
      setPosting(false);
    }
  };

  // Edit Post Handlers
  const startEditPost = (post) => {
    setEditingPost(post);
    setEditContent(post.content || '');
    setEditExistingImages(Array.isArray(post.images) ? [...post.images] : []);
    setEditPendingFiles([]);
    setEditPreviews([]);
    setEditVisibility(post.visibility || 'public');
  };

  const onPickEditFiles = (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const maxCanAdd = 6 - editExistingImages.length;
    if (maxCanAdd <= 0) {
      toast.warning('Bài viết tối đa 6 ảnh');
      return;
    }
    setEditPendingFiles((prev) => {
      const next = [...prev, ...files].slice(0, maxCanAdd);
      setEditPreviews(next.map((f) => URL.createObjectURL(f)));
      return next;
    });
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    const text = editContent.trim();
    if (!text && editExistingImages.length === 0 && editPendingFiles.length === 0) {
      toast.error('Nội dung hoặc ảnh không được để trống');
      return;
    }
    setEditSaving(true);
    try {
      let finalImages = [...editExistingImages];
      if (editPendingFiles.length) {
        const uploadFiles = await Promise.all(editPendingFiles.map((f) => convertImageFileToWebp(f)));
        const up = await api.feed.uploadImages(uploadFiles);
        if (!up.success) {
          toast.error(up.message || 'Upload ảnh thất bại');
          return;
        }
        finalImages = [...finalImages, ...(up.urls || [])];
      }
      const res = await api.feed.update(editingPost.id, {
        content: text,
        images: finalImages,
        visibility: editVisibility,
      });
      if (res.success) {
        setPosts((prev) => prev.map((p) => (p.id === editingPost.id ? res.data : p)));
        setEditingPost(null);
        toast.success('Đã cập nhật bài viết');
      } else {
        toast.error(res.message || 'Không thể sửa bài viết');
      }
    } catch {
      toast.error('Lỗi cập nhật bài viết');
    } finally {
      setEditSaving(false);
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
    if (!(await window.cmsConfirm('Xóa bài viết này?'))) return;
    setBusyId(postId);
    try {
      const res = await api.feed.remove(postId);
      if (res.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        toast.success('Đã xóa bài viết');
      } else toast.error(res.message || 'Không xóa được');
    } catch {
      toast.error('Lỗi xóa bài');
    } finally {
      setBusyId(null);
    }
  };

  const handleTogglePersonalPin = (post) => {
    const id = String(post.id);
    const next = personalPinnedIds.includes(id)
      ? personalPinnedIds.filter((pinnedId) => pinnedId !== id)
      : [...personalPinnedIds, id];
    try {
      window.localStorage.setItem(personalPinsStorageKey, JSON.stringify(next));
      setPersonalPinsState({ storageKey: personalPinsStorageKey, ids: next, error: '' });
      toast.success(next.includes(id) ? 'Đã ghim bài viết riêng tư trên thiết bị này' : 'Đã bỏ ghim bài viết');
    } catch (error) {
      toast.error(error?.message || 'Không thể lưu bài viết đã ghim');
    }
  };

  const submitPostReport = async () => {
    if (!reportingPost || !reportReason || reportBusy) return;
    setReportBusy(true);
    try {
      const res = await api.feed.report(reportingPost.id, { reason: reportReason, details: reportDetails.trim() });
      if (!res.success) {
        toast.error(res.message || 'Không thể gửi báo cáo bài viết');
        return;
      }
      setReportingPost(null);
      setReportReason('');
      setReportDetails('');
      toast.success(res.message || 'Đã gửi báo cáo để trung tâm xem xét');
      if (canModerateFeed) {
        const reports = await api.feed.reports();
        if (reports.success) setPendingReports(Array.isArray(reports.data) ? reports.data : []);
      }
    } catch (error) {
      toast.error(error?.message || 'Không thể gửi báo cáo bài viết');
    } finally {
      setReportBusy(false);
    }
  };

  const resolvePostReport = async (report, action = 'keep') => {
    if (resolvingReportId) return;
    if (action === 'delete' && !(await window.cmsConfirm('Xóa bài viết này và đóng tất cả báo cáo liên quan?'))) return;
    setResolvingReportId(report.id);
    try {
      const res = await api.feed.resolveReport(report.id, action);
      if (!res.success) {
        toast.error(res.message || 'Không thể xử lý báo cáo');
        return;
      }
      setPendingReports((prev) => prev.filter((item) => action === 'delete' ? item.postId !== report.postId : item.id !== report.id));
      if (action === 'delete') setPosts((prev) => prev.filter((post) => String(post.id) !== String(report.postId)));
      toast.success(res.message || (action === 'delete' ? 'Đã xóa bài viết' : 'Đã giữ lại bài viết'));
    } catch (error) {
      toast.error(error?.message || 'Không thể xử lý báo cáo');
    } finally {
      setResolvingReportId(null);
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
    if (postLocked) return;
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

  const currentPrivacyOpt = PRIVACY_OPTIONS.find((p) => p.value === postVisibility) || PRIVACY_OPTIONS[0];
  const CurrentPrivacyIcon = currentPrivacyOpt.icon;

  return (
    <div className="cms-feed-column pt-4 pb-8 space-y-4">
      {/* Header */}

      {canModerateFeed && reportQueueError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {reportQueueError}
        </div>
      )}
      {canModerateFeed && pendingReports.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Flag size={17} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900">Báo cáo cần xem xét</h2>
              <p className="text-xs text-slate-500">{pendingReports.length} bài viết đang chờ xử lý</p>
            </div>
          </div>
          <div className="space-y-2">
            {pendingReports.map((report) => (
              <div key={report.id} className="rounded-xl border border-amber-100 bg-white p-3">
                <p className="text-xs font-bold text-amber-800">{reportReasons.find((reason) => reason.value === report.reason)?.label || 'Lý do khác'}</p>
                <p className="mt-1 line-clamp-2 text-sm text-slate-800">{report.post?.content || 'Bài viết không còn tồn tại.'}</p>
                <p className="mt-1 text-[11px] text-slate-500">Báo cáo bởi {report.reporterName} · {report.reporterRole}</p>
                {report.details && <p className="mt-1 text-xs italic text-slate-500">{report.details}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={resolvingReportId === report.id}
                    onClick={() => resolvePostReport(report, 'delete')}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={14} />{resolvingReportId === report.id ? 'Đang xử lý…' : 'Xóa bài viết'}
                  </button>
                  <button
                    type="button"
                    disabled={resolvingReportId === report.id}
                    onClick={() => resolvePostReport(report, 'keep')}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 text-xs font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Check size={14} />{resolvingReportId === report.id ? 'Đang xử lý…' : 'Giữ lại bài viết'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-3 md:space-y-4 min-w-0">
        {/* Post Composer */}
        <div className="cms-feed-composer bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
          {postLocked ? (
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3.5 shadow-2xs">
              <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                <Send size={18} />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white">
                  <Lock size={9} strokeWidth={2.5} />
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">Chức năng đăng bài bị khóa</p>
                <p className="text-xs font-medium text-slate-500">Tài khoản chưa đăng ký gói hoặc đã hết hạn chỉ xem bảng tin. Mua gói để mở quyền đăng bài.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <img
                    src={resolveAvatarUrl({ ...session, role: meRole })}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-800 leading-tight">{session?.name || 'Tôi'}</p>
                    <span className={'text-[10px] font-semibold px-1.5 py-0.2 rounded-full inline-block mt-0.5 ' + (ROLE_BADGE[meRole] || ROLE_BADGE.student)}>
                      {ROLE_LABEL[meRole] || meRole}
                    </span>
                  </div>
                </div>

                {/* Privacy Selector Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowVisibilityMenu((v) => !v)}
                    className={'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ' + currentPrivacyOpt.badgeClass}
                    title="Chọn quyền riêng tư / Đối tượng xem"
                  >
                    <CurrentPrivacyIcon size={13} />
                    <span>{currentPrivacyOpt.label}</span>
                    <ChevronDown size={12} className="opacity-70" />
                  </button>

                  {showVisibilityMenu && (
                    <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <p className="text-[11px] font-bold text-slate-400 px-2 py-1  tracking-wider">Ai có thể xem bài viết?</p>
                      {availablePrivacyOptions.map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = postVisibility === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => { setPostVisibility(opt.value); setShowVisibilityMenu(false); }}
                            className={'w-full text-left flex items-start gap-2.5 p-2 rounded-lg text-xs transition-colors ' + (isSelected ? 'bg-indigo-50/80 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700')}
                          >
                            <Icon size={16} className={'shrink-0 mt-0.5 ' + (isSelected ? 'text-indigo-600' : 'text-slate-400')} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span>{opt.label}</span>
                                {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                              </div>
                              <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">{opt.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onPaste={handlePastePost}
                rows={3}
                maxLength={5000}
                placeholder="Bạn muốn hỏi gì hoặc chia sẻ điều gì?"
                className="w-full text-sm text-slate-800 placeholder:text-slate-400 border-0 focus:ring-0 focus:outline-none resize-none p-1"
              />

              {previews.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
                  {previews.map((src, i) => (
                    <div key={src} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group shadow-xs">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePending(i)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={pendingFiles.length >= 6}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50"
                  >
                    <ImagePlus size={15} className="text-emerald-600" />
                    Thêm ảnh ({pendingFiles.length}/6)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handlePost}
                  disabled={posting}
                  className={`duo-btn cms-feed-post-btn inline-flex items-center gap-1.5 text-xs font-extrabold px-5 py-2.5 rounded-2xl shadow-xs transition-all disabled:opacity-50 cursor-pointer ${
                    isGreenTone
                      ? 'cms-feed-post-btn--emerald bg-[#10B981] border-[1.5px] border-[#34D399] border-b-4 border-b-[#059669] text-white hover:brightness-105 active:translate-y-[2px] active:border-b-2'
                      : 'cms-feed-post-btn--danger bg-[#DC2626] border-[1.5px] border-[#F87171] border-b-4 border-b-[#991B1B] text-white hover:brightness-105 active:translate-y-[2px] active:border-b-2'
                  }`}
                >
                  {posting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  Đăng bài
                </button>
              </div>
            </>
          )}
        </div>
        {/* Post Feed List */}
        {!loading && (
          <div className="cms-feed-list-heading flex items-center justify-between gap-2 px-1 pt-1">
            <h2 className="text-base font-extrabold text-slate-900">Bài viết mới nhất</h2>
            <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-sm font-extrabold ${
              isGreenTone
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-indigo-50 text-red-600'
            }`}>
              <Newspaper size={14} />
              {visiblePosts.length} bài
            </span>
          </div>
        )}
        {loading ? (
          <div className="cms-feed-skeleton-list space-y-4" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="cms-feed-card cms-feed-skeleton-card p-4 bg-white rounded-2xl border border-slate-100 animate-pulse space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="space-y-1.5 flex-1">
                    <div className="w-24 h-3.5 bg-slate-200 rounded" />
                    <div className="w-16 h-2.5 bg-slate-100 rounded" />
                  </div>
                </div>
                <div className="w-full h-12 bg-slate-100 rounded-lg" />
              </div>
            ))}
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
            <Newspaper className="mx-auto text-slate-300 mb-2" size={36} />
            <p className="text-sm font-semibold text-slate-500">Chưa có bài nào</p>
            <p className="cms-feed-page-desc mt-1">Hãy là người đầu tiên đặt câu hỏi!</p>
          </div>
        ) : (
          <div className="cms-feed-list space-y-4">
            {orderedVisiblePosts.map((post) => {
              const postPrivacy = PRIVACY_OPTIONS.find((p) => p.value === post.visibility) || PRIVACY_OPTIONS[0];
              const PostPrivacyIcon = postPrivacy.icon;
              const reactionsObj = post.reactions || {};
              const hasAnyReaction = (post.reactionsCount || post.likesCount || 0) > 0;

              // Filter reaction types with count > 0
              const activeReactionTypes = REACTIONS.filter((r) => (reactionsObj[r.type] || 0) > 0);

              return (
                <article id={`feed-post-${post.id}`} key={post.id} className="cms-feed-card bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-slate-300 transition-all">
                  {/* Card Head */}
                  <div className="cms-feed-card__head flex items-start gap-3">
                    <img
                      src={resolveFeedAvatar(post)}
                      onError={(event) => fallbackFeedAvatar(event, post)}
                      alt=""
                      width={44}
                      height={44}
                      className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">{post.authorName || 'Người dùng'}</span>
                        <span className="text-xs text-slate-500">
                          {ROLE_LABEL[post.authorRole] || post.authorRole} · {formatTime(post.createdAt)}
                        </span>
                        {post.isEdited && (
                          <span
                            className="text-[11px] text-slate-400 italic font-medium cursor-help"
                            title={post.editedAt ? `Đã chỉnh sửa lúc ${new Date(post.editedAt).toLocaleString('vi-VN')}` : 'Đã chỉnh sửa'}
                          >
                            (Đã chỉnh sửa)
                          </span>
                        )}
                      </div>

                      {/* Privacy Badge on Post */}
                      <div className="flex items-center gap-1.5 mt-1">
                        {personalPinnedIds.includes(String(post.id)) && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800">
                            <Pin size={11} />Đã ghim
                          </span>
                        )}
                        <span className={'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ' + postPrivacy.badgeClass}>
                          <PostPrivacyIcon size={11} />
                          {postPrivacy.label}
                        </span>
                      </div>
                    </div>

                    {/* Post Action Buttons (Edit / Delete) */}
                    <div className="cms-feed-post-menu relative shrink-0">
                      <button
                        type="button"
                        onClick={() => setPostMenuOpenId((current) => current === post.id ? null : post.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100"
                        aria-label="Tùy chọn bài viết"
                        aria-expanded={postMenuOpenId === post.id}
                      >
                        <MoreVertical size={18} />
                      </button>
                      {postMenuOpenId === post.id && (
                        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                          {canEditPost(post) && (
                            <button
                              type="button"
                              onClick={() => { setPostMenuOpenId(null); startEditPost(post); }}
                              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Edit3 size={16} className="text-blue-600" /> Chỉnh sửa
                            </button>
                          )}
                          {canDeletePost(post) && (
                            <button
                              type="button"
                              onClick={() => { setPostMenuOpenId(null); handleDelete(post.id); }}
                              disabled={busyId === post.id}
                              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              <Trash2 size={16} /> Xóa
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => { setPostMenuOpenId(null); handleTogglePersonalPin(post); }}
                            className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {personalPinnedIds.includes(String(post.id)) ? <PinOff size={16} /> : <Pin size={16} />}
                            {personalPinnedIds.includes(String(post.id)) ? 'Bỏ ghim bài viết' : 'Ghim bài viết'}
                          </button>
                          {String(post.authorId || '') !== meId && (
                            <button
                              type="button"
                              onClick={() => {
                                setPostMenuOpenId(null);
                                setReportingPost(post);
                                setReportReason('');
                                setReportDetails('');
                              }}
                              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Flag size={16} /> Báo cáo bài viết
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  {post.content && (
                    <p className="cms-feed-card__body mt-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {post.content}
                    </p>
                  )}
                  <FeedYouTubePreviews
                    text={post.content}
                    onOpen={setYoutubeModal}
                  />

                  {/* Card Media */}
                  {post.images?.length > 0 && (
                    <div className={'cms-feed-card__media mt-3 grid gap-2 ' + (post.images.length === 1 ? 'grid-cols-1' : post.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3')}>
                      {post.images.map((url) => {
                        const src = resolveMediaUrl(url) || url;
                        return (
                          <button
                            key={url}
                            type="button"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(src); }}
                            className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-100 cursor-zoom-in group"
                          >
                            <img src={src} alt="" className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-200" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Reaction Summary & Counts Breakdown */}
                  {hasAnyReaction && (
                    <div className="cms-feed-card__stats flex items-center justify-between gap-3 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => { setReactionModalPost(post); setReactionModalTab('all'); }}
                        className="flex items-center gap-1.5 hover:underline cursor-pointer group min-w-0"
                        title="Bấm để xem ai đã thả cảm xúc"
                      >
                        {/* Stacked Emojis */}
                        <span className="flex items-center -space-x-1">
                          {activeReactionTypes.slice(0, 3).map((r) => (
                            <span key={r.type} className="text-sm shrink-0 drop-shadow-xs">{r.emoji}</span>
                          ))}
                        </span>
                        <span className="font-semibold text-slate-700 group-hover:text-indigo-600">
                          {post.reactionsCount || post.likesCount || 0}
                        </span>

                        {/* Breakdown Pills */}
                        <div className="flex items-center gap-1 ml-1.5 flex-wrap">
                          {activeReactionTypes.map((r) => (
                            <span key={r.type} className={'text-[11px] font-medium px-1.5 py-0.2 rounded-full border ' + r.bg}>
                              {r.emoji} {reactionsObj[r.type]}
                            </span>
                          ))}
                        </div>
                      </button>

                      <span className="text-[11px] text-slate-400 shrink-0">
                        {(post.commentsCount || 0)} bình luận
                      </span>
                    </div>
                  )}

                  {/* Card Action Bar */}
                  <div className="cms-feed-action mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div className="cms-feed-reaction relative">
                      <button
                        type="button"
                        onClick={() => setReactOpen((id) => (id === post.id ? null : post.id))}
                        className={'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ' + (post.myReaction ? (REACTIONS.find((r) => r.type === post.myReaction)?.bg || 'text-rose-600 bg-rose-50 border-rose-200') : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100')}
                      >
                        {(() => {
                          const cur = REACTIONS.find((r) => r.type === post.myReaction) || REACTIONS[0];
                          const Icon = cur.Icon;
                          return <Icon size={16} className={reactionIconClass(cur, !!post.myReaction)} />;
                        })()}
                        <span>{post.myReaction ? REACTIONS.find((r) => r.type === post.myReaction)?.label : 'Thả cảm xúc'}</span>
                      </button>

                      {/* Reaction Picker Popup */}
                      {reactOpen === post.id && (
                        <div className="absolute bottom-full left-0 mb-2 z-30 flex items-center gap-1 bg-white border border-slate-200 shadow-xl rounded-full px-2 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
                          {REACTIONS.map((r) => {
                            const Icon = r.Icon;
                            const active = post.myReaction === r.type;
                            return (
                              <button
                                key={r.type}
                                type="button"
                                title={r.label}
                                onClick={() => handleReact(post.id, r.type)}
                                className={'w-9 h-9 rounded-full flex items-center justify-center hover:scale-120 hover:bg-slate-100 transition-all ' + (active ? r.active : 'text-slate-500')}
                              >
                                <span className="text-lg">{r.emoji}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      data-feed-comments-trigger={post.id}
                      onClick={() => setCommentsOpen((d) => ({ ...d, [post.id]: !d[post.id] }))}
                      className={'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ' + (commentsOpen[post.id] ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100')}
                    >
                      <MessageCircle size={15} />
                      {commentsOpen[post.id]
                        ? ('Ẩn bình luận' + ((post.commentsCount || 0) > 0 ? ` (${post.commentsCount})` : ''))
                        : ((post.commentsCount || 0) > 0 ? `Bình luận (${post.commentsCount})` : 'Viết bình luận')}
                    </button>
                  </div>

                  {/* Comments Section */}
                  {commentsOpen[post.id] && (
                    <div id={`feed-comments-${post.id}`} data-feed-comments={post.id} className="mt-3 pt-3 border-t border-slate-100 space-y-2 bg-slate-50/70 -mx-4 -mb-4 p-4 rounded-b-2xl">
                      {(() => {
                        const allComments = Array.isArray(post.comments) ? post.comments : [];
                        const commentIdSet = new Set(allComments.map((item) => String(item.id)));
                        const rootComments = allComments.filter((c) => !c.parentId || !commentIdSet.has(String(c.parentId)));
                        const renderCommentNode = (c, depth = 0, parentAuthor = '', isLastSibling = true) => {
                          const replies = allComments.filter((r) => String(r.parentId || '') === String(c.id));
                          const isReplyingHere = replyTo[post.id]?.focusId === c.id && !postLocked;
                          const isReplyNode = depth > 0;
                          const indentClass = depth === 0
                            ? 'pt-2 space-y-1.5'
                            : depth <= 4
                              ? 'relative space-y-1.5 pl-5 sm:pl-6 mt-2'
                              : 'relative space-y-1.5 pl-4 mt-2';
                          return (
                            <div
                              id={`feed-comment-${c.id}`}
                              key={c.id}
                              className={indentClass + ' scroll-mt-24 ' + (focusTarget?.commentId === c.id ? 'rounded-xl bg-indigo-50 ring-2 ring-indigo-300' : '')}
                            >
                              {isReplyNode && !isLastSibling && (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute left-0 -top-2 -bottom-2 w-[2px] bg-indigo-300/80"
                                />
                              )}
                              {isReplyNode && (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute left-0 -top-2 h-5 w-4 sm:w-5 rounded-bl-xl border-b-2 border-l-2 border-indigo-400"
                                >
                                  <span className="absolute -right-[3px] -bottom-[4px] h-1.5 w-1.5 rounded-full bg-indigo-600" />
                                </span>
                              )}
                              <div className="flex gap-2">
                                <div className={'flex-1 min-w-0 bg-white rounded-xl px-3 py-2 border shadow-xs ' + (isReplyNode ? 'border-slate-200 border-l-2 border-l-indigo-300' : 'border-slate-200/80')}>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <img
                                      src={resolveFeedAvatar(c)}
                                      onError={(event) => fallbackFeedAvatar(event, c)}
                                      alt=""
                                      className={(isReplyNode ? 'w-5 h-5 ' : 'w-6 h-6 ') + 'rounded-full object-cover shrink-0 border border-slate-100'}
                                    />
                                    <span className="font-bold text-xs text-slate-900">{c.authorName}</span>
                                    <span className={'text-[9px] font-bold px-1.5 py-0.2 rounded-full ' + (ROLE_BADGE[c.authorRole] || '')}>
                                      {ROLE_LABEL[c.authorRole] || ''}
                                    </span>
                                    <span className="text-[11px] text-slate-400">{formatTime(c.createdAt)}</span>
                                    {canDeleteComment(post, c) && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteComment(post.id, c.id)}
                                        className="ml-auto text-slate-300 hover:text-red-500 p-0.5 transition-colors"
                                        title="Xóa bình luận"
                                      >
                                        <Trash2 size={isReplyNode ? 11 : 12} />
                                      </button>
                                    )}
                                  </div>
                                  {isReplyNode && parentAuthor && (
                                    <p className="text-[10px] font-semibold text-indigo-600/80 mt-0.5">
                                      ↳ Trả lời {parentAuthor}
                                    </p>
                                  )}
                                  {c.content && <p className="text-xs text-slate-800 whitespace-pre-wrap mt-1 leading-relaxed">{c.content}</p>}
                                  <FeedYouTubePreviews
                                    text={c.content}
                                    compact
                                    onOpen={setYoutubeModal}
                                  />
                                  {(c.images || []).length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {c.images.map((url) => {
                                        const src = resolveMediaUrl(url) || url;
                                        return (
                                          <button
                                            key={url}
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLightbox(src); }}
                                            className={(isReplyNode ? 'w-14 h-14 ' : 'w-16 h-16 ') + 'block rounded-lg overflow-hidden border border-slate-200 cursor-zoom-in'}
                                          >
                                            <img src={src} alt="" className="w-full h-full object-cover" />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => setReplyTo((d) => ({ ...d, [post.id]: { id: c.id, name: c.authorName, focusId: c.id } }))}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 mt-1.5"
                                  >
                                    <Reply size={11} /> Trả lời
                                  </button>
                                </div>
                              </div>

                              {/* Reply box attached directly under the target comment at any level */}
                              {isReplyingHere && (
                                <div className="pl-2 sm:pl-4 space-y-1.5 pt-1">
                                  <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                                    <Reply size={11} /> Đang trả lời <span className="font-bold text-slate-800">{replyTo[post.id].name}</span>
                                    <button type="button" onClick={() => setReplyTo((d) => ({ ...d, [post.id]: null }))} className="text-slate-400 hover:text-slate-600 ml-1">
                                      <X size={12} />
                                    </button>
                                  </div>
                                  {(commentPreviews[post.id] || []).length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {(commentPreviews[post.id] || []).map((src) => (
                                        <div key={src} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200">
                                          <img src={src} alt="" className="w-full h-full object-cover" />
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setCommentFiles((d) => ({ ...d, [post.id]: [] }));
                                              setCommentPreviews((d) => ({ ...d, [post.id]: [] }));
                                            }}
                                            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                                          >
                                            <X size={10} />
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="flex gap-2 items-center bg-white p-1.5 rounded-xl border border-indigo-200 shadow-2xs">
                                    <input
                                      autoFocus
                                      value={commentDrafts[post.id] || ''}
                                      onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                                      placeholder={'Trả lời ' + replyTo[post.id]?.name + '...'}
                                      className="w-full text-xs text-slate-800 placeholder:text-slate-400 border-0 focus:ring-0 focus:outline-none p-1"
                                    />
                                    <label className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1" title="Thêm ảnh">
                                      <ImagePlus size={15} />
                                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickCommentFiles(post.id, e)} />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={() => handleComment(post.id)}
                                      disabled={busyId === ('c-' + post.id)}
                                      className="text-indigo-600 hover:text-indigo-800 p-1 disabled:opacity-40"
                                    >
                                      {busyId === ('c-' + post.id) ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Recursive nested replies */}
                              {replies.map((r, idx) => renderCommentNode(r, depth + 1, c.authorName, idx === replies.length - 1))}
                            </div>
                          );
                        };
                        return rootComments.map((c, idx) => renderCommentNode(c, 0, '', idx === rootComments.length - 1));
                      })()}

                      {/* New root comment input */}
                      {!postLocked && !replyTo[post.id] && (
                        <>
                          {(commentPreviews[post.id] || []).length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {(commentPreviews[post.id] || []).map((src) => (
                                <div key={src} className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200">
                                  <img src={src} alt="" className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCommentFiles((d) => ({ ...d, [post.id]: [] }));
                                      setCommentPreviews((d) => ({ ...d, [post.id]: [] }));
                                    }}
                                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 text-white flex items-center justify-center"
                                  >
                                    <X size={10} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-xs">
                            <input
                              value={commentDrafts[post.id] || ''}
                              onChange={(e) => setCommentDrafts((d) => ({ ...d, [post.id]: e.target.value }))}
                              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(post.id); } }}
                              placeholder="Viết bình luận thảo luận..."
                              className="w-full text-xs text-slate-800 placeholder:text-slate-400 border-0 focus:ring-0 focus:outline-none p-1"
                            />
                            <label className="cursor-pointer text-slate-400 hover:text-indigo-600 p-1" title="Thêm ảnh">
                              <ImagePlus size={15} />
                              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => pickCommentFiles(post.id, e)} />
                            </label>
                            <button
                              type="button"
                              onClick={() => handleComment(post.id)}
                              disabled={busyId === ('c-' + post.id)}
                              className={`${isGreenTone ? 'text-emerald-600 hover:text-emerald-700' : 'text-red-600 hover:text-red-700'} p-1 font-bold disabled:opacity-40`}
                              title="Gửi bình luận"
                            >
                              {busyId === ('c-' + post.id) ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </article>
              );
            })}

            {page < totalPages && (
              <button
                type="button"
                onClick={() => load(page + 1, true)}
                disabled={loadingMore}
                className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
              >
                {loadingMore ? 'Đang tải thêm bài viết...' : 'Xem thêm bài cũ hơn'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Edit Post Modal */}
      {editingPost && createPortal(
        <div className="fixed inset-0 z-[120000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Edit3 size={18} className="text-indigo-600" />
                Chỉnh sửa bài viết
              </h3>
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Privacy Selector in Edit */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Quyền riêng tư / Đối tượng xem</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availablePrivacyOptions.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = editVisibility === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setEditVisibility(opt.value)}
                      className={'text-left flex items-start gap-2 p-2.5 rounded-xl border text-xs transition-all ' + (isSelected ? 'border-indigo-600 bg-indigo-50/60 text-indigo-900 font-bold shadow-xs' : 'border-slate-200 hover:bg-slate-50 text-slate-700')}
                    >
                      <Icon size={16} className={'shrink-0 mt-0.5 ' + (isSelected ? 'text-indigo-600' : 'text-slate-400')} />
                      <div className="min-w-0">
                        <p className="truncate">{opt.label}</p>
                        <p className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nội dung bài viết</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                maxLength={5000}
                placeholder="Nhập nội dung chỉnh sửa..."
                className="w-full text-sm text-slate-800 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
            </div>

            {/* Existing and New Images */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Ảnh đính kèm ({editExistingImages.length + editPendingFiles.length}/6)
                </label>
                <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickEditFiles} />
                <button
                  type="button"
                  onClick={() => editFileRef.current?.click()}
                  disabled={(editExistingImages.length + editPendingFiles.length) >= 6}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <ImagePlus size={14} /> Thêm ảnh
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {editExistingImages.map((url, i) => {
                  const src = resolveMediaUrl(url) || url;
                  return (
                    <div key={url} className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditExistingImages((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                        title="Xóa ảnh này"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}

                {editPreviews.map((src, i) => (
                  <div key={src} className="relative w-16 h-16 rounded-xl overflow-hidden border border-indigo-300 group ring-2 ring-indigo-400">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        setEditPendingFiles((prev) => prev.filter((_, idx) => idx !== i));
                        setEditPreviews((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white flex items-center justify-center transition-colors"
                      title="Bỏ ảnh mới này"
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingPost(null)}
                disabled={editSaving}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm transition-colors disabled:opacity-50"
              >
                {editSaving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Reaction Details Modal */}
      {reactionModalPost && createPortal(
        <div className="fixed inset-0 z-[120000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Heart size={18} className="text-rose-600 fill-rose-600" />
                Người đã thả cảm xúc ({reactionModalPost.reactionsCount || reactionModalPost.likesCount || 0})
              </h3>
              <button
                type="button"
                onClick={() => setReactionModalPost(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Reaction Tabs */}
            <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-100 overflow-x-auto">
              <button
                type="button"
                onClick={() => setReactionModalTab('all')}
                className={'px-3 py-1.5 rounded-lg text-xs font-bold transition-all ' + (reactionModalTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')}
              >
                Tất cả ({reactionModalPost.reactionsCount || reactionModalPost.likesCount || 0})
              </button>

              {REACTIONS.map((r) => {
                const count = (reactionModalPost.reactions || {})[r.type] || 0;
                if (count === 0) return null;
                const isSelected = reactionModalTab === r.type;
                return (
                  <button
                    key={r.type}
                    type="button"
                    onClick={() => setReactionModalTab(r.type)}
                    className={'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ' + (isSelected ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800')}
                  >
                    <span>{r.emoji}</span>
                    <span>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* User List */}
            <div className="p-3 max-h-80 overflow-y-auto divide-y divide-slate-100">
              {(() => {
                const list = (reactionModalPost.reactionsList || []).filter((r) => {
                  if (reactionModalTab === 'all') return true;
                  return r.type === reactionModalTab;
                });

                if (list.length === 0) {
                  return (
                    <div className="py-8 text-center text-xs text-slate-400">
                      Chưa có ai thả cảm xúc này.
                    </div>
                  );
                }

                return list.map((item, idx) => {
                  const matchReaction = REACTIONS.find((r) => r.type === item.type) || REACTIONS[0];
                  return (
                    <div key={idx} className="flex items-center justify-between py-2.5 px-2 hover:bg-slate-50 rounded-xl transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <img
                            src={resolveAvatarUrl({ role: item.role, gender: item.gender, name: item.userName, id: item.userId })}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-slate-200"
                          />
                          <span className="absolute -bottom-1 -right-1 text-sm drop-shadow-xs">{matchReaction.emoji}</span>
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.userName || 'Người dùng'}</p>
                          <span className={'text-[9px] font-bold px-1.5 py-0.2 rounded-full inline-block mt-0.5 ' + (ROLE_BADGE[item.role] || ROLE_BADGE.student)}>
                            {ROLE_LABEL[item.role] || item.role}
                          </span>
                        </div>
                      </div>

                      <span className={'text-xs font-semibold px-2 py-0.5 rounded-full border ' + matchReaction.bg}>
                        {matchReaction.emoji} {matchReaction.label}
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {reportingPost && createPortal(
        <div
          className="fixed inset-0 z-[120000] flex items-center justify-center p-4 bg-black/55 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feed-report-title"
          onClick={() => setReportingPost(null)}
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Flag size={18} /></span>
              <div className="min-w-0 flex-1">
                <h2 id="feed-report-title" className="text-sm font-bold text-slate-900">Báo cáo bài viết</h2>
                <p className="text-xs text-slate-500">Chọn lý do để trung tâm xem xét</p>
              </div>
              <button type="button" onClick={() => setReportingPost(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200" aria-label="Đóng">
                <X size={16} />
              </button>
            </div>
            <p className="max-h-16 overflow-hidden rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">{reportingPost.content || 'Bài viết có hình ảnh đính kèm'}</p>
            <div className="space-y-2">
              {reportReasons.map((reason) => (
                <label key={reason.value} className={'flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors ' + (reportReason === reason.value ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-700 hover:bg-slate-50')}>
                  <input type="radio" name="feed-report-reason" value={reason.value} checked={reportReason === reason.value} onChange={() => setReportReason(reason.value)} />
                  {reason.label}
                </label>
              ))}
            </div>
            <textarea
              value={reportDetails}
              onChange={(event) => setReportDetails(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Thông tin bổ sung (không bắt buộc)"
              className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReportingPost(null)} className="min-h-10 rounded-xl bg-slate-100 px-4 text-xs font-bold text-slate-600 hover:bg-slate-200">Hủy</button>
              <button
                type="button"
                disabled={!reportReason || reportBusy}
                onClick={submitPostReport}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-red-700 disabled:opacity-45"
              >
                {reportBusy ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                {reportBusy ? 'Đang gửi…' : 'Gửi báo cáo'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Lightbox Modal */}
      {lightbox && createPortal(
        <div
          className="fixed inset-0 z-[130000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-[130002] flex items-center gap-2 rounded-full bg-black/70 hover:bg-black text-white px-3 py-2 text-sm font-bold border-2 border-white/40 shadow-lg cursor-pointer"
            onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
          >
            <X size={20} />
            <span>Đóng (Esc)</span>
          </button>
          <img
            src={lightbox}
            alt=""
            className="relative z-[130001] max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body,
      )}

      {/* YouTube Modal */}
      {youtubeModal?.id && createPortal(
        <div
          className="fixed inset-0 z-[130000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Xem video YouTube"
          onClick={() => setYoutubeModal(null)}
        >
          <div
            className="relative z-[130001] w-full max-w-3xl rounded-2xl overflow-hidden bg-black shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-950 border-b border-white/10">
              <span className="text-white text-sm font-bold truncate">YouTube</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={youtubeModal.url || `https://www.youtube.com/watch?v=${youtubeModal.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-bold"
                >
                  <ExternalLink size={14} />
                  Mở YouTube
                </a>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 text-xs font-bold"
                  onClick={() => setYoutubeModal(null)}
                >
                  <X size={16} />
                  Đóng
                </button>
              </div>
            </div>
            <div className="relative w-full aspect-video bg-black">
              <iframe
                title="YouTube video"
                src={`https://www.youtube.com/embed/${youtubeModal.id}?autoplay=1&rel=0`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
