import type { DemoFeedPost } from '../types';
import { mobileApiRequest } from './apiClient';

type Raw = Record<string, any>;

const ROLE_LABEL: Record<string, string> = {
  student: 'Học viên', teacher: 'Giảng viên', admin: 'Quản trị', staff: 'Nhân viên',
};
const AUDIENCE_LABEL: Record<string, string> = {
  public: 'Công khai', teachers: 'Chỉ Giảng viên', students: 'Chỉ Học viên', admin_only: 'Chỉ Admin',
};
const AUDIENCE_VALUE: Record<string, string> = {
  'Công khai': 'public', 'Chỉ Giảng viên': 'teachers', 'Chỉ Học viên': 'students',
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
  return {
    id: String(raw.id || raw._id),
    authorId: String(raw.authorId || ''),
    author: String(raw.authorName || 'Người dùng'),
    role: ROLE_LABEL[String(raw.authorRole)] || 'Học viên',
    time: relTime(raw.createdAt),
    content: String(raw.content || ''),
    audience: AUDIENCE_LABEL[String(raw.visibility)] || 'Công khai',
    mediaType: Array.isArray(raw.images) && raw.images.length ? 'image' : undefined,
    reactionCount: Number(raw.reactionsCount ?? raw.likesCount ?? 0),
    comments: all.filter((c) => !c.parentId).map((c) => ({
      id: String(c.id || c._id), author: String(c.authorName || 'Người dùng'), text: String(c.content || ''),
    })),
    replies: all.filter((c) => c.parentId).map((c) => ({
      id: String(c.id || c._id), parentId: String(c.parentId),
      author: String(c.authorName || 'Người dùng'), text: String(c.content || ''),
    })),
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

export const createFeedPost = (content: string, audience: string) => unwrap(
  mobileApiRequest('/feed', { method: 'POST', headers: json, body: JSON.stringify({ content, visibility: AUDIENCE_VALUE[audience] || 'public' }) }),
);
export const updateFeedPost = (id: string, content: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}`, { method: 'PUT', headers: json, body: JSON.stringify({ content }) }),
);
export const deleteFeedPost = async (id: string) => {
  await mobileApiRequest(`/feed/${encodeURIComponent(id)}`, { method: 'DELETE' });
};
export const reactFeedPost = (id: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}/react`, { method: 'POST', headers: json, body: JSON.stringify({ type: 'heart' }) }),
);
export const commentFeedPost = (id: string, content: string, parentId?: string) => unwrap(
  mobileApiRequest(`/feed/${encodeURIComponent(id)}/comments`, { method: 'POST', headers: json, body: JSON.stringify({ content, parentId }) }),
);
