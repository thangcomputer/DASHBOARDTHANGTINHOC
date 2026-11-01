import type { DemoFeedPost } from '../types';
import { Platform } from 'react-native';
import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

type Raw = Record<string, any>;

const ROLE_LABEL: Record<string, string> = {
  student: 'Học viên', teacher: 'Giảng viên', admin: 'Quản trị', staff: 'Nhân viên',
};
const AUDIENCE_LABEL: Record<string, string> = {
  public: 'Công khai',
  teachers: 'Chỉ Giảng viên & Admin',
  students: 'Chỉ Học viên & Admin',
  admin_only: 'Chỉ Ban Quản trị',
};
const AUDIENCE_VALUE: Record<string, string> = {
  'Công khai': 'public',
  'Chỉ Giảng viên': 'teachers',
  'Chỉ Giảng viên & Admin': 'teachers',
  'Chỉ Học viên': 'students',
  'Chỉ Học viên & Admin': 'students',
  'Chỉ Ban Quản trị': 'admin_only',
};

function relTime(value: unknown) {
  const d = value ? new Date(String(value)) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const min = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  if (min < 1440) return `${Math.floor(min / 60)} giờ trước`;
  return d.toLocaleDateString('vi-VN');
}

export function mapFeedPost(raw: Raw): DemoFeedPost {
  const all: Raw[] = Array.isArray(raw.comments) ? raw.comments : [];
  const mapComment = (comment: Raw) => ({
    id: String(comment.id || comment._id),
    authorId: String(comment.authorId || ''),
    authorAdminRole: typeof comment.authorAdminRole === 'string' ? comment.authorAdminRole : null,
    author: String(comment.authorName || 'Người dùng'),
    avatar: comment.authorAvatar ? resolveMobilePublicUrl(String(comment.authorAvatar)) : undefined,
    role: ROLE_LABEL[String(comment.authorRole)] || '',
    time: relTime(comment.createdAt),
    text: String(comment.content || ''),
  });
  const images = Array.isArray(raw.images)
    ? raw.images.map((image: unknown) => String(image || '').trim()).filter(Boolean).map(resolveMobilePublicUrl)
    : [];
  const reactions = raw.reactions && typeof raw.reactions === 'object' ? {
    heart: Number(raw.reactions.heart) || 0,
    like: Number(raw.reactions.like) || 0,
    haha: Number(raw.reactions.haha) || 0,
    wow: Number(raw.reactions.wow) || 0,
    sad: Number(raw.reactions.sad) || 0,
  } : undefined;
  return {
    id: String(raw.id || raw._id),
    authorId: String(raw.authorId || ''),
    authorAvatar: raw.authorAvatar ? resolveMobilePublicUrl(String(raw.authorAvatar)) : undefined,
    author: String(raw.authorName || 'Người dùng'),
    role: ROLE_LABEL[String(raw.authorRole)] || 'Học viên',
    time: relTime(raw.createdAt),
    content: String(raw.content || ''),
    audience: AUDIENCE_LABEL[String(raw.visibility)] || 'Công khai',
    mediaType: images.length ? 'image' : undefined,
    images,
    reactionCount: Number(raw.reactionsCount ?? raw.likesCount ?? 0),
    reactions,
    myReaction: ['heart', 'like', 'haha', 'wow', 'sad'].includes(raw.myReaction) ? raw.myReaction : null,
    comments: all.filter((c) => !c.parentId).map(mapComment),
    commentsCount: Number(raw.commentsCount ?? all.length) || 0,
    replies: all.filter((c) => c.parentId).map((c) => ({ ...mapComment(c), parentId: String(c.parentId) })),
  };
}

const json = { 'Content-Type': 'application/json' };

async function unwrap(p: Promise<{ data?: Raw }>) {
  const res = await p;
  if (!res.data) throw new Error('Máy chủ không trả về dữ liệu bảng tin.');
  return mapFeedPost(res.data);
}

export async function fetchFeedPosts(): Promise<DemoFeedPost[]> {
  const res = await mobileApiRequest<{ data?: Raw[] }>('/feed?page=1&limit=50');
  if (!Array.isArray(res.data)) throw new Error('Phản hồi bảng tin không hợp lệ.');
  return res.data.map(mapFeedPost);
}

export async function uploadFeedImages(files: Array<{ uri: string; name: string; mimeType?: string; file?: File }>) {
  if (!files.length) return [];
  if (files.length > 6) throw new Error('Mỗi bài đăng tối đa 6 ảnh.');
  const formData = new FormData();
  files.forEach((file) => {
    if (Platform.OS === 'web' && !file.file) {
      throw new Error('Không đọc được ảnh đã chọn trên trình duyệt. Vui lòng chọn lại ảnh.');
    }
    const filePart = Platform.OS === 'web' ? file.file : {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'image/jpeg',
    };
    formData.append('images', filePart as unknown as Blob);
  });
  const response = await mobileApiRequest<{ urls?: string[]; message?: string }>('/feed/upload', {
    method: 'POST',
    body: formData,
  });
  if (!Array.isArray(response.urls) || response.urls.length !== files.length) {
    throw new Error(response.message || 'Máy chủ không trả về đủ ảnh đã tải lên.');
  }
  if (response.urls.some((url) => typeof url !== 'string' || !url.trim())) {
    throw new Error('Máy chủ trả về liên kết ảnh không hợp lệ.');
  }
  return response.urls.map((url) => url.trim());
}

export const createFeedPost = (content: string, audience: string, images: string[] = []) => unwrap(
  mobileApiRequest('/feed', { method: 'POST', headers: json, body: JSON.stringify({ content, images, visibility: AUDIENCE_VALUE[audience] || 'public' }) }),
);
export const updateFeedPost = (id: string, content: string, images?: string[], audience?: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: json,
    body: JSON.stringify({
      content,
      ...(images ? { images } : {}),
      ...(audience ? { visibility: AUDIENCE_VALUE[audience] || 'public' } : {}),
    }),
  }),
);
export const deleteFeedPost = async (id: string) => {
  await mobileApiRequest(`/feed/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
export const reactFeedPost = (id: string, type: 'heart' | 'like' | 'haha' | 'wow' | 'sad' = 'heart') => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}/react`, { method: 'POST', headers: json, body: JSON.stringify({ type }) }),
);
export const commentFeedPost = (id: string, content: string, parentId?: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}/comments`, { method: 'POST', headers: json, body: JSON.stringify({ content, parentId }) }),
);
export const deleteFeedComment = (postId: string, commentId: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' }),
);
