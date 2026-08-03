import React from 'react';
import { resolveAvatarUrl, DEFAULT_AVATARS } from '../../../utils/defaultAvatars';

const ROLE_BADGE = {
  teacher: { label: 'GV', className: 'bg-amber-500 text-white' },
  student: { label: 'HV', className: 'bg-sky-500 text-white' },
  admin: { label: 'AD', className: 'bg-rose-600 text-white' },
  staff: { label: 'NV', className: 'bg-slate-600 text-white' },
};

const ROLE_RING = {
  teacher: 'ring-2 ring-amber-400/80',
  student: 'ring-2 ring-sky-400/80',
  admin: 'ring-2 ring-rose-400/80',
  staff: 'ring-2 ring-slate-400/80',
};

/**
 * Avatar dung chung — anh cartoon mac dinh theo role
 * + badge GV/HV de phan biet nhanh khi danh sach dai.
 */
export default function Avatar({
  initials,
  color = 'bg-red-500',
  src,
  role = 'student',
  adminRole = null,
  name = '',
  gender = '',
  size = 'md',
  className = '',
  showRoleBadge = true,
}) {
  const normalized =
    adminRole === 'SUPER_ADMIN' ? 'admin'
      : adminRole === 'STAFF' ? 'staff'
        : String(role || 'student').toLowerCase();

  const url = resolveAvatarUrl({ avatar: src, role, adminRole, name, gender });
  const sizeClass =
    size === 'sm' ? 'w-8 h-8'
      : size === 'card' ? 'w-[52px] h-[52px]'
        : size === 'lg' ? 'w-14 h-14'
          : size === 'xl' ? 'w-20 h-20'
            : 'w-10 h-10';

  const badge = ROLE_BADGE[normalized] || ROLE_BADGE.student;
  const ring = ROLE_RING[normalized] || ROLE_RING.student;
  const badgeSize = size === 'sm' ? 'text-[7px] px-0.5 min-w-[14px] h-3.5' : 'text-[8px] px-1 min-w-[18px] h-4';

  return (
    <div className={`relative flex-shrink-0 ${sizeClass}`}>
      <img
        src={url}
        alt={name || initials || 'Avatar'}
        title={name || initials || undefined}
        className={`${sizeClass} rounded-2xl object-cover shadow-sm border-2 border-white bg-white ${ring} ${className}`}
        onError={(e) => {
          const el = e.currentTarget;
          if (el.dataset.fallback === '1') return;
          el.dataset.fallback = '1';
          el.src = DEFAULT_AVATARS[normalized] || DEFAULT_AVATARS.student;
        }}
      />
      {showRoleBadge && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 ${badgeSize} rounded-md font-black leading-none flex items-center justify-center shadow-sm border border-white ${badge.className}`}
          title={
            normalized === 'teacher' ? 'Giang vien'
              : normalized === 'student' ? 'Hoc vien'
                : normalized === 'admin' ? 'Admin'
                  : 'Nhan vien'
          }
        >
          {badge.label}
        </span>
      )}
    </div>
  );
}
