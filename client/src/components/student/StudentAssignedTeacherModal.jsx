import { createPortal } from 'react-dom';
import { X, Star, Award, Mic2, User } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import { voiceRegionLabel } from '../../constants/voiceRegions';

/**
 * Modal thẻ GV khi HV bấm thông báo phân công.
 */
export default function StudentAssignedTeacherModal({ open, teacher, loading = false, onClose }) {
  if (!open) return null;

  const name = teacher?.name || 'Giảng viên';
  const specialty = teacher?.specialty || '';
  const avg = Number(teacher?.averageRating) || 0;
  const count = Number(teacher?.ratingCount) || 0;
  const region = voiceRegionLabel(teacher?.voiceRegion) || 'Chưa cập nhật';
  const avatarSrc = resolveAvatarUrl({
    avatar: teacher?.avatar,
    name,
    role: 'teacher',
    id: teacher?.id || teacher?._id,
  });

  const node = (
    <div
      className="fixed inset-0 z-[280] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assigned-teacher-title"
    >
      <div className="absolute inset-0 bg-slate-950/55" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-sky-50">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-sky-100 shrink-0 border border-sky-100">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sky-600">
                <User size={22} />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">Giảng viên phụ trách</p>
            <h2 id="assigned-teacher-title" className="font-bold text-slate-900 text-base truncate">
              {loading ? 'Đang tải…' : name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sky-100 text-slate-500"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3 text-sm text-slate-700">
          <div className="flex items-start gap-2.5">
            <Award size={16} className="text-sky-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Chuyên môn</p>
              <p className="font-semibold text-slate-900 break-words">{specialty || 'Chưa cập nhật'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Star size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Đánh giá</p>
              <p className="font-semibold text-slate-900">
                {count > 0
                  ? `${avg.toFixed(1)} / 5 · ${count} lượt`
                  : 'Chưa có đánh giá'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Mic2 size={16} className="text-violet-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Giọng</p>
              <p className="font-semibold text-slate-900">{region}</p>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-10 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return node;
  return createPortal(node, document.body);
}
