/**
 * Tin tức trung tâm — danh sách Card + chi tiết + soạn bài (manage_blog).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import {
  Newspaper, Search, Plus, Loader2, Eye, Calendar, User, ChevronLeft,
  ImagePlus, Paperclip, Send, Save, EyeOff, Trash2, RefreshCw, X, FileText,
} from 'lucide-react';
import { resolveMediaUrl, blogAPI } from '../services/api';
import { useToast } from '../utils/toast';
import { useSocket } from '../context/SocketContext';
import { hasPermission, PERMISSIONS } from '../constants/permissions';
import NewsRichEditor from './NewsRichEditor';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusLabel(s) {
  if (s === 'published') return 'Đã đăng';
  if (s === 'hidden') return 'Đã ẩn';
  return 'Nháp';
}

function statusClass(s) {
  if (s === 'published') return 'bg-emerald-50 text-emerald-700';
  if (s === 'hidden') return 'bg-slate-100 text-slate-600';
  return 'bg-amber-50 text-amber-700';
}

function NewsCard({ post, basePath, onOpen }) {
  const thumb = post.thumbnailUrl ? resolveMediaUrl(post.thumbnailUrl) : null;
  return (
    <button
      type="button"
      onClick={() => onOpen(post)}
      className="group text-left bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden hover:shadow-md hover:border-red-100 transition-all duration-200 flex flex-col h-full w-full"
    >
      <div className="relative aspect-video bg-slate-100 overflow-hidden w-full">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 bg-slate-50/80 p-4">
            <Newspaper size={36} strokeWidth={1.5} />
          </div>
        )}
        {post.isNew && (
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black tracking-wide shadow-sm">
            NEW
          </span>
        )}
      </div>
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 gap-2 min-w-0">
        <h3 className="text-sm sm:text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-red-600 transition-colors">
          {post.title}
        </h3>
        {post.excerpt ? (
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2 leading-relaxed flex-1">{post.excerpt}</p>
        ) : (
          <div className="flex-1" />
        )}
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100 min-w-0 mt-auto">
          <span className="truncate flex items-center gap-1 min-w-0 flex-1">
            <User size={12} className="shrink-0 text-slate-400" />
            <span className="truncate">{post.authorName || 'Admin'}</span>
          </span>
          <span className="shrink-0 flex items-center gap-2">
            <span className="inline-flex items-center gap-1"><Eye size={12} />{post.viewCount || 0}</span>
            <span>{formatDate(post.publishedAt || post.createdAt).slice(0, 8)}</span>
          </span>
        </div>
      </div>
    </button>
  );
}

/** Sanitize + gắn token media trong HTML nội dung bài (nội bộ, không SEO) */
function resolveContentHtml(html) {
  const resolved = String(html || '').replace(
    /(<img\b[^>]*\bsrc=["'])([^"']+)(["'])/gi,
    (_, pre, src, post) => `${pre}${resolveMediaUrl(src)}${post}`,
  );
  return DOMPurify.sanitize(resolved, {
    ADD_ATTR: ['target', 'style'],
    ADD_TAGS: ['h2', 'h3', 'blockquote'],
  });
}

function isHtmlEmpty(html) {
  const text = String(html || '')
    .replace(/<img\b[^>]*>/gi, 'img')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  return !text;
}

function wordCountFromHtml(html) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

function EditorForm({ initial, onSaved, onCancel }) {
  const toast = useToast();
  const editorRef = useRef(null);
  const coverRef = useRef(null);
  const inlineImgRef = useRef(null);
  const fileRef = useRef(null);

  const [title, setTitle] = useState(() => initial?.title || '');
  const [excerpt, setExcerpt] = useState(() => initial?.excerpt || '');
  const [contentHtml, setContentHtml] = useState(() => initial?.contentHtml || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(() => initial?.thumbnailUrl || '');
  const [attachments, setAttachments] = useState(() => (
    Array.isArray(initial?.attachments) ? initial.attachments : []
  ));
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);

  const words = useMemo(() => wordCountFromHtml(contentHtml), [contentHtml]);
  const readMins = Math.max(1, Math.ceil(words / 200));

  const uploadRaw = async (files) => {
    const list = Array.isArray(files) ? files : Array.from(files || []);
    if (!list.length) throw new Error('Không có file để tải lên');
    const res = await blogAPI.upload(list);
    if (!res?.success) throw new Error(res?.message || 'Upload lỗi');
    const items = res.data || [];
    if (!items.length) throw new Error('Server không nhận được file');
    return items;
  };

  const onCoverPick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setBusy(true);
    try {
      const items = await uploadRaw(list.slice(0, 1));
      const img = items.find((i) => i.kind === 'image') || items[0];
      if (!img?.url) throw new Error('File không hợp lệ cho ảnh bìa');
      setThumbnailUrl(img.url);
      toast.success('Đã đặt ảnh bìa');
    } catch (err) {
      toast.error(err.message || 'Upload ảnh bìa thất bại');
    } finally {
      setBusy(false);
    }
  };

  const onInlineImagePick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setBusy(true);
    try {
      const items = await uploadRaw(list);
      const imgs = items.filter((i) => i.kind === 'image');
      if (!imgs.length) throw new Error('Chỉ hỗ trợ ảnh để chèn vào bài');
      imgs.forEach((img) => editorRef.current?.insertImage(img.url, img.name || ''));
      toast.success(`Đã chèn ${imgs.length} ảnh vào bài`);
    } catch (err) {
      toast.error(err.message || 'Chèn ảnh thất bại');
    } finally {
      setBusy(false);
    }
  };

  const onAttachPick = async (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = '';
    if (!list.length) return;
    setBusy(true);
    try {
      const items = await uploadRaw(list);
      setAttachments((prev) => [...prev, ...items]);
      toast.success(`Đã đính kèm ${items.length} tệp`);
    } catch (err) {
      toast.error(err.message || 'Đính kèm thất bại');
    } finally {
      setBusy(false);
    }
  };

  const save = async (status) => {
    if (!title.trim()) {
      toast.error('Nhập tiêu đề');
      return;
    }
    const html = editorRef.current?.getHtml?.() || contentHtml;
    if (isHtmlEmpty(html) && status === 'published') {
      toast.error('Bài đăng cần có nội dung');
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        excerpt: excerpt.trim(),
        contentHtml: html,
        thumbnailUrl,
        attachments,
        status,
      };
      let res;
      if (initial?.id) res = await blogAPI.update(initial.id, payload);
      else res = await blogAPI.create(payload);
      if (!res.success) throw new Error(res.message || 'Lưu thất bại');
      toast.success(status === 'published' ? 'Đã đăng bài' : 'Đã lưu nháp');
      onSaved?.(res.data);
    } catch (e) {
      toast.error(e.message || 'Lỗi lưu bài');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900">{initial?.id ? 'Sửa bài viết' : 'Soạn bài mới'}</h2>
          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
            Tin nội bộ · {words} từ · ~{readMins} phút đọc
            {initial?.status ? ` · ${statusLabel(initial.status)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreview((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${preview ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            <span className="inline-flex items-center gap-1"><Eye size={13} /> {preview ? 'Soạn thảo' : 'Xem trước'}</span>
          </button>
          <button type="button" onClick={onCancel} className="p-2 rounded-xl hover:bg-slate-50 text-slate-400">
            <X size={18} />
          </button>
        </div>
      </div>

      {preview ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-6 space-y-4">
          {thumbnailUrl && (
            <div className="rounded-xl overflow-hidden aspect-[21/9] bg-slate-100">
              <img src={resolveMediaUrl(thumbnailUrl)} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <h1 className="text-2xl font-black text-slate-900">{title || 'Chưa có tiêu đề'}</h1>
          {excerpt && (
            <p className="text-base text-slate-600 font-medium border-l-4 border-red-500 pl-4">{excerpt}</p>
          )}
          <div
            className="prose prose-slate max-w-none text-slate-800 text-[15px] leading-relaxed
              [&_h2]:text-xl [&_h2]:font-black [&_h3]:text-lg [&_h3]:font-bold
              [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
              [&_img]:rounded-xl [&_img]:max-w-full [&_blockquote]:border-l-4 [&_blockquote]:border-red-400 [&_blockquote]:pl-3"
            dangerouslySetInnerHTML={{ __html: resolveContentHtml(contentHtml) }}
          />
        </div>
      ) : (
        <>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Tiêu đề bài viết"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base font-bold outline-none focus:border-red-300"
          />
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            placeholder="Mô tả ngắn (hiện trên card danh sách)"
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-300 resize-y"
          />

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Ảnh bìa (card / đầu bài)</p>
            {thumbnailUrl ? (
              <div className="relative w-full max-w-md aspect-video rounded-xl overflow-hidden bg-slate-100">
                <img src={resolveMediaUrl(thumbnailUrl)} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setThumbnailUrl('')}
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => coverRef.current?.click()}
                className="w-full max-w-md aspect-video rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold hover:border-red-300 hover:text-red-500 flex flex-col items-center justify-center gap-2"
              >
                <ImagePlus size={22} /> Chọn ảnh bìa
              </button>
            )}
            {thumbnailUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() => coverRef.current?.click()}
                className="text-xs font-bold text-red-600 hover:underline"
              >
                Đổi ảnh bìa
              </button>
            )}
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={onCoverPick} />
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Nội dung</p>
            <NewsRichEditor
              ref={editorRef}
              value={contentHtml}
              onChange={setContentHtml}
              disabled={busy}
              onRequestImage={() => inlineImgRef.current?.click()}
            />
            <input ref={inlineImgRef} type="file" accept="image/*" multiple className="hidden" onChange={onInlineImagePick} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Tệp đính kèm (PDF, Word…)</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="text-xs font-bold text-slate-600 hover:text-red-600 inline-flex items-center gap-1"
              >
                <Paperclip size={13} /> Thêm tệp
              </button>
            </div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar"
              className="hidden"
              onChange={onAttachPick}
            />
            {attachments.length > 0 ? (
              <ul className="space-y-1.5">
                {attachments.map((a, i) => (
                  <li key={`${a.url}-${i}`} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    {a.kind === 'image' ? (
                      <img src={resolveMediaUrl(a.url)} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <FileText size={14} className="text-slate-400 shrink-0" />
                    )}
                    <span className="truncate flex-1">{a.name || a.url}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">{a.kind}</span>
                    <button
                      type="button"
                      className="text-red-500 hover:underline"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                    >
                      Xóa
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">Không bắt buộc — dùng khi cần tải file, không phải ảnh trong bài.</p>
            )}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-100">
        <button
          type="button"
          disabled={busy}
          onClick={() => save('draft')}
          className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Lưu nháp
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save('published')}
          className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5"
        >
          <Send size={14} /> Đăng bài
        </button>
      </div>
    </div>
  );
}

export default function NewsPage({ session, role = 'admin' }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket } = useSocket() || {};
  const base = `/${role}/news`;
  const canManage = hasPermission(session, PERMISSIONS.MANAGE_BLOG);

  const mode = searchParams.get('mode'); // edit | manage
  const editId = searchParams.get('id');

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [q, setQ] = useState('');
  const [qInput, setQInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [related, setRelated] = useState([]);
  const [manageStatus, setManageStatus] = useState('');
  const [editing, setEditing] = useState(null);

  const loadList = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = canManage && mode === 'manage'
        ? await blogAPI.manageList({ page: p, limit: 20, status: manageStatus || undefined, q: q || undefined })
        : await blogAPI.list({ page: p, limit: 12, q: q || undefined });
      if (res.success) {
        setItems(res.data || []);
        setPages(res.pagination?.pages || 1);
        setPage(res.pagination?.page || p);
      }
    } catch {
      toast.error('Không tải được tin tức');
    } finally {
      setLoading(false);
    }
  }, [canManage, mode, manageStatus, q, toast]);

  const loadDetail = useCallback(async (s) => {
    setLoading(true);
    try {
      const res = await blogAPI.get(s, { manage: canManage });
      if (res.success) {
        setDetail(res.data);
        setRelated(res.related || []);
      } else {
        toast.error(res.message || 'Không tìm thấy bài');
        navigate(base);
      }
    } catch {
      toast.error('Lỗi tải bài viết');
    } finally {
      setLoading(false);
    }
  }, [canManage, navigate, base, toast]);

  useEffect(() => {
    if (slug) loadDetail(slug);
    else if (mode === 'edit') {
      if (!canManage) {
        toast.error('Bạn không có quyền sửa tin tức');
        navigate(base, { replace: true });
        return;
      }
      setDetail(null);
      if (editId) {
        // Chỉ prefill khi đã có contentHtml (từ trang chi tiết). Card manage list thiếu field này.
        const cached = location.state?.post;
        if (
          cached?.id
          && String(cached.id) === String(editId)
          && typeof cached.contentHtml === 'string'
        ) {
          setEditing(cached);
        } else {
          setEditing(null);
        }
        setLoading(true);
        blogAPI.getManage(editId)
          .then((res) => {
            if (res?.success && res.data?.id) setEditing(res.data);
            else {
              setEditing(null);
              toast.error(res?.message || 'Không tải được bài để sửa');
            }
          })
          .catch(() => {
            setEditing(null);
            toast.error('Lỗi tải bài để sửa');
          })
          .finally(() => setLoading(false));
      } else {
        setEditing({});
        setLoading(false);
      }
    } else {
      setDetail(null);
      setEditing(null);
      loadList(1);
    }
  }, [slug, mode, editId, loadDetail, loadList, toast, location.state, canManage, navigate, base]);

  useEffect(() => {
    if (!socket) return undefined;
    const onPub = () => {
      if (!slug && mode !== 'edit') loadList(page);
    };
    socket.on('blog:published', onPub);
    return () => socket.off('blog:published', onPub);
  }, [socket, slug, mode, page, loadList]);

  const openPost = (post) => {
    const manageQs = (canManage && post.status !== 'published') ? '?manage=1' : '';
    navigate(`${base}/${post.slug}${manageQs}`);
  };

  if (mode === 'edit' && canManage) {
    if (editId && loading && !editing?.id) {
      return (
        <div className="cms-viewport-fill flex items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }
    if (editId && !loading && !editing?.id) {
      return (
        <div className="cms-viewport-fill flex flex-col items-center justify-center gap-3 text-slate-500">
          <p className="text-sm font-semibold">Không tải được bài viết để sửa</p>
          <button
            type="button"
            onClick={() => navigate(base)}
            className="px-3 py-2 rounded-xl border text-xs font-bold"
          >
            Quay lại
          </button>
        </div>
      );
    }
    return (
      <div className="cms-viewport-fill w-full space-y-4">
        <EditorForm
          key={`${editing?.id || 'new'}:${String(editing?.updatedAt || editing?.contentHtml?.length || 0)}`}
          initial={editing}
          onCancel={() => {
            setSearchParams({});
            navigate(base);
          }}
          onSaved={(data) => {
            if (data?.status === 'draft' || data?.status === 'hidden') {
              setSearchParams({ mode: 'manage' });
              navigate(`${base}?mode=manage`);
            } else if (data?.slug) {
              setSearchParams({});
              navigate(`${base}/${data.slug}`);
            } else {
              setSearchParams({});
              navigate(base);
            }
          }}
        />
      </div>
    );
  }


  if (slug) {
    if (loading && !detail) {
      return (
        <div className="cms-viewport-fill flex items-center justify-center text-slate-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      );
    }
    if (!detail) return null;
    const thumb = detail.thumbnailUrl ? resolveMediaUrl(detail.thumbnailUrl) : null;
    return (
      <div className="cms-viewport-fill w-full p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-100 p-6 sm:p-8 shadow-sm space-y-6">

          <button
            type="button"
            onClick={() => navigate(base)}
            className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-red-600"
          >
            <ChevronLeft size={16} /> Tin tức
          </button>
          {thumb && (
            <div className="rounded-2xl overflow-hidden aspect-[21/9] bg-slate-100">
              <img src={thumb} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div>
            {detail.isNew && (
              <span className="inline-block mb-2 px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-black">NEW</span>
            )}
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight">{detail.title}</h1>
            <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1"><User size={13} />{detail.authorName}</span>
              <span className="inline-flex items-center gap-1"><Calendar size={13} />{formatDate(detail.publishedAt || detail.createdAt)}</span>
              <span className="inline-flex items-center gap-1"><Eye size={13} />{detail.viewCount || 0} lượt xem</span>
              {canManage && (
                <span className={`px-2 py-0.5 rounded-md ${statusClass(detail.status)}`}>{statusLabel(detail.status)}</span>
              )}
            </div>
          </div>
          {detail.excerpt && (
            <p className="text-base text-slate-600 font-medium border-l-4 border-red-500 pl-4">{detail.excerpt}</p>
          )}
          <div
            className="prose prose-slate max-w-none text-slate-800 leading-relaxed text-[15px]
              [&_h2]:text-xl [&_h2]:font-black [&_h2]:mt-5 [&_h2]:mb-2
              [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1.5
              [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5
              [&_blockquote]:border-l-4 [&_blockquote]:border-red-400 [&_blockquote]:pl-3 [&_blockquote]:italic
              [&_a]:text-red-600 [&_a]:underline
              [&_img]:rounded-xl [&_img]:max-w-full [&_img]:my-3"
            dangerouslySetInnerHTML={{ __html: resolveContentHtml(detail.contentHtml || '') }}
          />
          {(() => {
            const attachList = (Array.isArray(detail.attachments) ? detail.attachments : [])
              .filter((a) => a?.url && a.url !== detail.thumbnailUrl);
            if (!attachList.length) return null;
            return (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-wide text-slate-400">Tệp đính kèm</p>
                <ul className="space-y-1.5">
                  {attachList.map((a, i) => (
                    <li key={`${a.url}-${i}`}>
                      {a.kind === 'image' ? (
                        <img src={resolveMediaUrl(a.url)} alt={a.name || ''} className="rounded-xl max-h-80 object-contain" />
                      ) : a.kind === 'video' ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={resolveMediaUrl(a.url)} controls className="rounded-xl w-full max-h-96 bg-black" />
                      ) : (
                        <a
                          href={resolveMediaUrl(a.url)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 text-sm font-bold text-red-600 hover:underline"
                        >
                          <Paperclip size={14} /> {a.name || 'Tải file'}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
          {canManage && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="px-3 py-2 rounded-xl border text-xs font-bold"
                onClick={() => navigate(`${base}?mode=edit&id=${detail.id}`, { state: { post: detail } })}
              >
                Sửa
              </button>
              {detail.status !== 'published' && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold"
                  onClick={async () => {
                    const res = await blogAPI.publish(detail.id);
                    if (res.success) {
                      toast.success('Đã đăng');
                      setDetail(res.data);
                    }
                  }}
                >
                  Đăng bài
                </button>
              )}
              {detail.status === 'published' && (
                <button
                  type="button"
                  className="px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1"
                  onClick={async () => {
                    const res = await blogAPI.hide(detail.id);
                    if (res.success) {
                      toast.success('Đã ẩn');
                      setDetail(res.data);
                    }
                  }}
                >
                  <EyeOff size={14} /> Ẩn
                </button>
              )}
              <button
                type="button"
                className="px-3 py-2 rounded-xl border border-red-200 text-red-600 text-xs font-bold flex items-center gap-1 hover:bg-red-50"
                onClick={async () => {
                  if (!window.confirm('Xóa bài viết này?')) return;
                  const res = await blogAPI.remove(detail.id);
                  if (res?.success) {
                    toast.success('Đã xóa bài viết');
                    if (canManage) {
                      setSearchParams({ mode: 'manage' });
                      navigate(`${base}?mode=manage`);
                    } else {
                      navigate(base);
                    }
                  } else {
                    toast.error(res?.message || 'Không thể xóa bài viết');
                  }
                }}
              >
                <Trash2 size={14} /> Xóa
              </button>

            </div>
          )}
          {related.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-400 mb-3">Bài liên quan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {related.map((p) => (
                  <NewsCard key={p.id} post={p} basePath={base} onOpen={openPost} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cms-viewport-fill w-full space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2 truncate">
            <Newspaper className="text-red-600 shrink-0" size={22} /> Tin tức
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">Tin tức &amp; thông báo từ trung tâm</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadList(page)}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
            title="Làm mới"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setSearchParams(mode === 'manage' ? {} : { mode: 'manage' })}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all ${mode === 'manage' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}`}
              >
                Quản lý
              </button>
              <button
                type="button"
                onClick={() => navigate(`${base}?mode=edit`)}
                className="px-3.5 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={14} /> Viết bài
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 w-full">
        <div className="relative flex-1 min-w-0">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQ(qInput.trim());
            }}
            placeholder="Tìm bài viết…"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100 bg-white transition-all"
          />
        </div>
        <button
          type="button"
          onClick={() => setQ(qInput.trim())}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 transition-colors"
        >
          Tìm
        </button>
        {canManage && mode === 'manage' && (
          <select
            value={manageStatus}
            onChange={(e) => setManageStatus(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold bg-white shrink-0 outline-none focus:border-red-500"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="published">Đã đăng</option>
            <option value="draft">Nháp</option>
            <option value="hidden">Đã ẩn</option>
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-slate-400 bg-white rounded-2xl border border-slate-100">
          Chưa có bài viết
        </div>
      ) : mode === 'manage' && canManage ? (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <ul className="divide-y divide-slate-50">
            {items.map((p) => (
              <li key={p.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-3 hover:bg-slate-50">
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openPost(p)}>
                  <p className="font-bold text-slate-900 truncate">{p.title}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(p.updatedAt)} · {p.viewCount || 0} xem</p>
                </button>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${statusClass(p.status)}`}>
                  {statusLabel(p.status)}
                </span>
                <button
                  type="button"
                  className="text-xs font-bold text-slate-600 hover:text-red-600"
                  onClick={() => navigate(`${base}?mode=edit&id=${p.id}`, { state: { post: p } })}
                >
                  Sửa
                </button>
                <button
                  type="button"
                  className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1"
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!window.confirm(`Xóa bài viết "${p.title}"?`)) return;
                    try {
                      const res = await blogAPI.remove(p.id);
                      if (res?.success) {
                        toast.success('Đã xóa bài viết');
                        loadList(page);
                      } else {
                        toast.error(res?.message || 'Không thể xóa bài viết');
                      }
                    } catch (err) {
                      toast.error('Lỗi kết nối khi xóa bài viết');
                    }
                  }}
                >
                  <Trash2 size={13} /> Xóa
                </button>

              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((p) => (
            <NewsCard key={p.id} post={p} basePath={base} onOpen={openPost} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => loadList(page - 1)}
            className="px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-40"
          >
            Trước
          </button>
          <span className="px-3 py-2 text-xs font-bold text-slate-500">{page}/{pages}</span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => loadList(page + 1)}
            className="px-3 py-2 rounded-xl border text-xs font-bold disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}
