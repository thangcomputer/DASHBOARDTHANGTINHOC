import { useNavigate } from 'react-router-dom';
import { Gamepad2, X } from 'lucide-react';

const STEPS = [
  'Mở Luyện tập hằng ngày, mục này nằm ngay dưới Tổng quan.',
  'Bấm Tiếp tục học trên lộ trình đang mở.',
  'Đi lần lượt Học bài, Luyện tập, rồi Thử thách.',
  'Mỗi ngày có XP luyện mới. Làm đúng thì giữ XP, làm chưa đúng thì mất một ít XP luyện.',
];

export default function FreeUnlockGuide({ open, onClose }) {
  const navigate = useNavigate();
  if (!open) return null;

  const goPractice = () => {
    onClose();
    navigate('/student/daily-practice');
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[10120] flex items-center justify-center p-4">
      <div className="pointer-events-auto w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="free-unlock-guide-title">
        <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 px-6 py-5 text-white">
          <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 !shadow-none">
            <X size={16} />
          </button>
          <p className="text-xs font-bold uppercase tracking-wide text-amber-200">Đã mở khóa</p>
          <h2 id="free-unlock-guide-title" className="mt-1 text-xl font-black">Cách dùng Luyện tập hằng ngày</h2>
        </div>
        <ol className="space-y-3 px-6 py-5">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm font-semibold text-slate-700">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-50 text-xs font-black text-red-700">{index + 1}</span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
        <div className="flex items-center justify-end gap-3 px-6 pb-5">
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-800 !shadow-none">
            Để sau
          </button>
          <button type="button" onClick={goPractice} className="flex items-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-4 py-3 text-sm font-black text-white !shadow-none">
            <Gamepad2 size={16} aria-hidden="true" />
            Vào luyện tập
          </button>
        </div>
      </div>
    </div>
  );
}
