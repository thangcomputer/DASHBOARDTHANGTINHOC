import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { FileBox, Headphones, Lock, MessageSquare, Sparkles, Trophy, X } from 'lucide-react';
import { useData } from '../../../context/DataContext';
import { hasRealCourseEnrollment } from '../../../utils/enrollments';
import FreeMeetPlanModal from './FreeMeetPlanModal';

const MASCOT = `/cam-xuc-animation/${encodeURI('vui tươi.webp')}`;

const LOCKED_ITEMS = [
  { icon: Headphones, label: 'Hỗ trợ' },
  { icon: MessageSquare, label: 'Tin nhắn' },
  { icon: Trophy, label: 'Phòng thi' },
  { icon: FileBox, label: 'Bài tập' },
];

export const FREE_HIDDEN_KEYS = new Set(['news', 'evaluation', 'center-info', 'schedule', 'lesson-practice']);

export function isFreePortalLocked(session) {
  return session?.role === 'student' && session?.freePortal === true && session?.freeUnlocked !== true;
}

/** HV miễn phí: session React hoặc `student_user` trong localStorage. */
export function resolveStudentSession(session) {
  if (session?.freePortal === true) return session;
  const stored = readStudentSession();
  return stored?.role === 'student' ? (stored || session) : session;
}

/** Khớp middleware - freePortal chưa có khóa 1 kèm 1 thì `/api/schedules` luôn 403. */
export function isStudentSchedulesApiBlocked(session) {
  const source = resolveStudentSession(session);
  if (source?.role !== 'student' || source?.freePortal !== true) return false;
  return !hasRealCourseEnrollment(source);
}

function readStudentSession() {
  try {
    return JSON.parse(localStorage.getItem('student_user') || 'null');
  } catch {
    return null;
  }
}

export function useFreePortalLock(session) {
  const [stored, setStored] = useState(readStudentSession);
  useEffect(() => {
    const sync = () => setStored(readStudentSession());
    window.addEventListener('free-portal-unlocked', sync);
    return () => window.removeEventListener('free-portal-unlocked', sync);
  }, []);
  useEffect(() => {
    setStored(readStudentSession());
  }, [session?.freePortal, session?.freeUnlocked]);
  const source = session?.freePortal === true ? session : (stored || session);
  return isFreePortalLocked(source);
}

/** Tài khoản miễn phí chưa được admin thêm khóa 1 kèm 1. */
export function useFreePortalMenu(session) {
  const { students } = useData();
  const stored = readStudentSession();
  const source = session?.freePortal === true ? session : (stored || session);
  const sid = source?.id || source?._id;
  const me = sid && Array.isArray(students)
    ? students.find((student) => String(student?.id || student?._id) === String(sid))
    : null;
  const target = me || source;
  if (source?.freePortal !== true && me?.freePortal !== true) return false;
  return !hasRealCourseEnrollment(target);
}

export function FreeHiddenRoute({ session, children }) {
  const hidden = useFreePortalMenu(session);
  if (hidden) return <Navigate to="/student" replace />;
  return children;
}

function LockCard({ onClose, onBuy }) {
  return (
    <div className="relative w-[min(100vw-2rem,24rem)] overflow-hidden rounded-[28px] bg-white text-left shadow-[0_24px_80px_rgba(15,23,42,0.28)] ring-1 ring-white/70">
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-[#1a1030] to-red-800 px-6 pb-6 pt-5 text-center text-white">
        <span className="pointer-events-none absolute -left-6 top-8 h-24 w-24 rounded-full bg-fuchsia-400/30 blur-2xl" aria-hidden="true" />
        <span className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-amber-300/25 blur-2xl" aria-hidden="true" />
        <Sparkles size={14} className="absolute left-5 top-5 text-amber-200" aria-hidden="true" />
        <Sparkles size={12} className="absolute bottom-5 right-6 text-rose-200" aria-hidden="true" />
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 !shadow-none">
            <X size={16} />
          </button>
        )}
        <div className="relative mx-auto h-24 w-24">
          <img src={MASCOT} alt="" className="h-24 w-24 object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]" />
          <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-lg ring-4 ring-slate-950/40">
            <Lock size={16} aria-hidden="true" />
          </span>
        </div>
        <h1 className="relative mt-3 text-xl font-black tracking-tight">Mục này đang khóa</h1>
        <p className="relative mt-1 text-sm text-white/75">Đăng ký gói Meet để mở các mục đang khóa</p>
      </div>
      <div className="px-5 py-5">
        <div className="grid grid-cols-2 gap-2">
          {LOCKED_ITEMS.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <Icon size={14} aria-hidden="true" />
              </span>
              <span className="min-w-0 truncate text-xs font-bold text-slate-700">{label}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onBuy}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-500 to-emerald-700 px-4 py-3 text-sm font-black text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_rgba(5,150,105,0.35)] hover:from-emerald-600 hover:to-emerald-800 transition-all"
        >
          <Sparkles size={16} aria-hidden="true" />
          Đăng ký gói Meet
        </button>
      </div>
    </div>
  );
}

export default function FreeFeatureLock({ session, children, onClose }) {
  const restricted = useFreePortalMenu(session);
  const locked = useFreePortalLock(session) && restricted;
  const [openMeet, setOpenMeet] = useState(false);
  if (!locked) return children || null;

  const card = openMeet ? null : <LockCard onClose={onClose} onBuy={() => setOpenMeet(true)} />;

  return (
    <>
      {card && (onClose ? card : (
        <div className="flex min-h-[60vh] items-center justify-center px-4 py-10">{card}</div>
      ))}
      <FreeMeetPlanModal open={openMeet} onClose={() => setOpenMeet(false)} />
    </>
  );
}
