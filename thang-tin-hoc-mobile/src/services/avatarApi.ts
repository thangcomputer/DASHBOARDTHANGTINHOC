import { mobileApiRequest, resolveMobilePublicUrl } from './apiClient';

export type AvatarUpload = {
  uri: string;
  name: string;
  mimeType?: string | null;
  size?: number | null;
  file?: Blob | null;
};

export async function uploadAndUpdateAvatar(image: AvatarUpload) {
  if (image.size != null && image.size > 5 * 1024 * 1024) {
    throw new Error('Ảnh đại diện tối đa 5MB.');
  }
  if (image.mimeType && !image.mimeType.toLowerCase().startsWith('image/')) {
    throw new Error('Vui lòng chọn tệp hình ảnh JPG, PNG hoặc WEBP.');
  }

  const formData = new FormData();
  if (image.file) {
    formData.append('file', image.file, image.name);
  } else {
    const filePart = {
      uri: image.uri,
      name: image.name,
      type: image.mimeType || 'image/jpeg',
    } as unknown as Blob;
    formData.append('file', filePart);
  }
  const upload = await mobileApiRequest<{
    success?: boolean;
    data?: { url?: string; fileUrl?: string };
    message?: string;
  }>('/files/upload?category=avatars', { method: 'POST', body: formData });
  const avatarPath = upload.data?.url || upload.data?.fileUrl;
  if (!upload.success || !avatarPath) {
    throw new Error(upload.message || 'Máy chủ không trả về ảnh đã tải lên.');
  }

  const updated = await mobileApiRequest<{ success?: boolean; avatar?: string; message?: string }>('/auth/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ avatar: avatarPath }),
  });
  if (!updated.success || !updated.avatar) {
    throw new Error(updated.message || 'Máy chủ không xác nhận đã cập nhật ảnh đại diện.');
  }
  return resolveMobilePublicUrl(updated.avatar);
}
