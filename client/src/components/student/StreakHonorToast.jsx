import { useCallback, useEffect, useRef, useState } from 'react';
import { Flame, Trophy, X, Zap } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { resolveMediaUrl } from '../../services/api';
import { isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import { GameSoundManager, isSoundMuted, playNotifySound } from '../../utils/sound';

const AUTO_HIDE_MS = 3000;

function isCenterStudentSession(session) {
  if (!session || session.role !== 'student') return false;
  if (session.accountType === 'dewskill' || session.freePortal === true) return false;
  if (isFreePortalSelfRegistrationStudent(session)) return false;
  return true;
}

function playHonorSound() {
  if (isSoundMuted()) return;
  const hasUserActivation = typeof navigator !== 'undefined' && navigator.userActivation
    ? navigator.userActivation.hasBeenActive
    : true;
  if (hasUserActivation) {
    GameSoundManager.play('mascotVictory');
  } else {
    playNotifySound();
  }
}

export default function StreakHonorToast({ session }) {
  const { socket } = useSocket();
  const [queue, setQueue] = useState([]);
  const seenIdsRef = useRef(new Set());
  const timerRef = useRef(null);
  const enabled = isCenterStudentSession(session);
  const current = queue[0] || null;

  const enqueue = useCallback((raw) => {
    if (!enabled || !raw || !raw.studentName) return;
    const key = String(raw.id || `${raw.studentId || raw.studentName}:${raw.streak}:${raw.achievedAt || ''}`);
    if (seenIdsRef.current.has(key)) return;
    seenIdsRef.current.add(key);
    setQueue((prev) => [...prev, { ...raw, _key: key }]);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setQueue([]);
      return undefined;
    }
    const onWindowHonor = (ev) => enqueue(ev?.detail);
    window.addEventListener('cms:streak-honor', onWindowHonor);
    socket?.on('streak:honor', onWindowHonor);
    return () => {
      window.removeEventListener('cms:streak-honor', onWindowHonor);
      socket?.off('streak:honor', onWindowHonor);
    };
  }, [enabled, socket, enqueue]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!current) return undefined;
    playHonorSound();
    timerRef.current = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, AUTO_HIDE_MS);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [current?._key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !current) return null;

  const avatarUrl = current.studentAvatar ? resolveMediaUrl(current.studentAvatar) : '';
  const initial = String(current.studentName || 'H').trim().charAt(0).toUpperCase();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[9900] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto relative w-full max-w-md overflow-hidden rounded-[22px] border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-white to-emerald-50 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.22)] animate-in fade-in slide-in-from-top-3 duration-200"
      >
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-md">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <span className="text-lg font-black">{initial}</span>
            )}
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white ring-2 ring-white">
              <Trophy size={11} />
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-orange-700">
                <Flame size={11} className="fill-orange-500 text-orange-500" />
                Vinh danh chuỗi {current.streak || 7} ngày liên tục
              </span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-black text-white">
                <Zap size={10} className="fill-current" />+{current.rewardXp || 100} XP
              </span>
            </div>
            <p className="mt-1 truncate text-sm font-black text-slate-900">
              {current.studentName}
            </p>
            <p className="text-xs font-semibold text-slate-600">
              Vừa hoàn thành chuỗi {current.streak || 7} ngày học liên tiếp!
            </p>
          </div>

          <button
            type="button"
            onClick={() => setQueue((prev) => prev.slice(1))}
            aria-label="Đóng"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        </div>
        <div
          key={current._key}
          className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-amber-100"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500"
            style={{
              width: '100%',
              animation: `streakHonorShrink ${AUTO_HIDE_MS}ms linear forwards`,
            }}
          />
        </div>
        <style>{`@keyframes streakHonorShrink { from { width: 100%; } to { width: 0%; } }`}</style>
      </div>
    </div>
  );
}
