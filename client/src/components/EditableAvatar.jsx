import React, { useRef, useState, useEffect } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { resolveAvatarUrl } from '../utils/defaultAvatars';
import { authAPI } from '../services/api';
import { useToast } from '../utils/toast';
import { useData } from '../context/DataContext';

export default function EditableAvatar({
  avatar,
  name,
  role,
  adminRole,
  gender = '',
  className = '',
  imgClassName = '',
  onSuccess,
  editable = true,
}) {
  const toast = useToast();
  const dataCtx = useData();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [localAvatar, setLocalAvatar] = useState(avatar);

  useEffect(() => {
    setLocalAvatar(avatar);
  }, [avatar]);

  const resolved = resolveAvatarUrl({
    avatar: localAvatar || avatar,
    role,
    adminRole,
    gender,
    name,
  });
  // Cache-bust /uploads để tránh browser giữ bản 401 cũ sau khi đổi quyền public
  const displayAvatar = resolved.startsWith('/uploads/')
    ? `${resolved}${resolved.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(localAvatar || avatar || '').slice(-24))}`
    : resolved;

  const handleClick = (e) => {
    e.stopPropagation();
    if (!editable || loading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP...)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh tối đa là 5MB');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.updateAvatar(file);
      if (res.success && res.avatar) {
        setLocalAvatar(res.avatar);
        dataCtx?.updateUserAvatar?.(res.avatar);
        if (onSuccess) onSuccess(res.avatar);
        toast.success('Đã thay đổi ảnh đại diện thành công!');
      }
    } catch (err) {
      const isNet = !!err?.isNetworkError || err?.name === 'NetworkOfflineError';
      toast.error(
        isNet
          ? 'Không tải được ảnh đại diện — mất kết nối máy chủ. Thử lại hoặc chọn ảnh nhỏ hơn (tối đa 5MB).'
          : (err.message || 'Thay đổi ảnh đại diện thất bại'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`group relative ${editable ? 'cursor-pointer' : ''} overflow-hidden select-none ${className}`}
      title={editable ? 'Rê vào và bấm để đổi ảnh đại diện' : name || 'Avatar'}
    >
      {editable && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      )}
      <img
        key={displayAvatar}
        src={displayAvatar}
        alt={name || 'Avatar'}
        className={`w-full h-full object-cover transition-transform duration-300 ${editable ? 'group-hover:scale-105' : ''} ${imgClassName}`}
      />
      {editable && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-center text-white z-10 p-0.5 pointer-events-none">
          {loading ? (
            <Loader2 size={16} className="animate-spin text-white shrink-0" />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-center leading-none gap-0.5">
              <Camera size={15} className="drop-shadow text-white shrink-0" />
              <span className="text-[9px] font-extrabold tracking-tight text-white drop-shadow text-center block w-full whitespace-nowrap leading-none">Đổi ảnh</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
