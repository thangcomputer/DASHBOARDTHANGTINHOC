import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Play } from 'lucide-react';
import { gameSounds } from '../../../utils/sound';
import { dewClass, getDewSkillThemeAttr } from '../../../utils/dewskillTheme';

/**
 * Popup cảnh báo thoát bài luyện tập theo phong cách Giọt Nước 3D (Dewdrop Glossy).
 */
export default function ExitPracticeWarningModal({
  answered = 0,
  total = 0,
  remainingCount,
  stakeXp = 0,
  quitLossXp = 0,
  maxPenaltyXP,
  mandatory = false,
  quitting = false,
  mode = 'quit',
  onStay,
  onQuit,
}) {
  const remaining = typeof remainingCount === 'number'
    ? Math.max(0, remainingCount)
    : Math.max(0, (Number(total) || 0) - (Number(answered) || 0));
  const maxPenalty = typeof maxPenaltyXP === 'number'
    ? Math.max(0, maxPenaltyXP)
    : Math.max(0, Number(stakeXp) || 0, Number(quitLossXp) || 0);
  const loseXp = maxPenalty > 0;
  const isReload = mode === 'reload';

  useEffect(() => {
    gameSounds.sad();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !quitting) {
        event.preventDefault();
        onStay?.();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [quitting, onStay]);

  if (typeof document === 'undefined') return null;

  const titleText = isReload
    ? (loseXp ? 'Tải lại trang sẽ mất XP!' : 'Tải lại trang lúc này?')
    : (loseXp ? 'Bạn sẽ mất chuỗi hôm nay!' : 'Thoát lượt luyện tập này?');

  const descText = isReload
    ? (loseXp
      ? (mandatory
        ? `Đây là lượt bắt buộc. Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP còn lại (tối đa -${maxPenalty} XP cho các câu chưa làm).`
        : `Tải lại trang lúc này sẽ hủy lượt luyện tập và mất thêm XP còn lại (tối đa -${maxPenalty} XP cho các câu chưa làm).`)
      : 'Tải lại trang lúc này sẽ hủy tiến độ lượt luyện tập hiện tại. Bạn nên hoàn thành để nhận XP nhé.')
    : (loseXp
      ? (mandatory
        ? `Đây là lượt bắt buộc. Thoát bây giờ bạn mất thêm XP còn lại (tối đa -${maxPenalty} XP cho các câu chưa làm).`
        : `Thoát bây giờ bạn mất thêm XP còn lại (tối đa -${maxPenalty} XP cho các câu chưa làm).`)
      : 'Lượt phục hồi này không trừ XP ví nếu thoát. Bạn vẫn nên hoàn thành để nhận XP nhé.');

  return createPortal(
    <div
      data-theme={getDewSkillThemeAttr()}
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !quitting) onStay?.();
      }}
    >
      <div className="relative w-full max-w-md">
        {/* Giọt nước 3D trang trí quanh popup */}
        <div className="pointer-events-none absolute -left-5 top-10 z-20 h-11 w-11 dew-water-orb opacity-85" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-4 bottom-16 z-20 h-10 w-10 dew-water-orb opacity-80" aria-hidden="true" />

        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dp-exit-practice-title"
          className="dew-modal dew-student-theme cms-goal-in relative w-full max-w-md overflow-hidden rounded-[32px] border border-white bg-white/95 text-center shadow-[0_28px_70px_-12px_rgba(244,63,94,0.22),inset_0_2px_0_#fff] backdrop-blur-2xl"
        >
          {/* Thanh nhấn 4px trên cùng */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-[#FB7185] to-[#F59E0B]"
            aria-hidden="true"
          />

          {/* Vòm đầu cảnh báo dịu (Warm Peach–Coral Arc) */}
          <div className="relative overflow-hidden bg-gradient-to-b from-[#FDA4AF]/45 via-[#FED7AA]/40 to-transparent pb-4 pt-7">
            <div
              className="pointer-events-none absolute -bottom-10 left-1/2 h-20 w-[135%] -translate-x-1/2 rounded-[100%] bg-white/95"
              aria-hidden="true"
            />
            <div className="relative z-10 mx-auto flex h-28 w-28 items-center justify-center rounded-full border-2 border-white bg-white/80 shadow-lg backdrop-blur-md">
              <img
                src="/mascot/Buon_Wifi.gif"
                alt="Linh vật DewSkill đang mếu ôm máy tính"
                className="h-20 w-20 object-contain"
              />
            </div>
          </div>

          {/* Nội dung */}
          <div className="px-6 pb-6">
            <h3 id="dp-exit-practice-title" className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900">
              {titleText}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {descText}
            </p>

            {/* 2 pill tóm tắt ngắn gọn */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50/95 px-3.5 py-1.5 text-xs font-bold text-rose-700">
                {loseXp ? `Mất tối đa -${maxPenalty} XP` : 'Không trừ XP ví'}
              </span>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50/95 px-3.5 py-1.5 text-xs font-bold text-amber-800">
                {remaining > 0 ? `Còn ${remaining} câu nữa thôi!` : 'Đã ở câu cuối cùng!'}
              </span>
            </div>

            {/* Cụm nút đáy */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={quitting}
                onClick={() => {
                  gameSounds.tap();
                  onStay?.();
                }}
                className={dewClass(
                  'dew-btn-primary inline-flex w-full items-center justify-center gap-2 py-3.5 text-base font-extrabold cursor-pointer disabled:opacity-60',
                  'inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 text-base font-extrabold shadow-md cursor-pointer disabled:opacity-60',
                )}
              >
                <Play size={16} fill="currentColor" aria-hidden="true" />
                <span>Ở lại luyện tiếp</span>
              </button>

              <button
                type="button"
                disabled={quitting}
                onClick={onQuit}
                className={dewClass(
                  'dew-btn-ghost-danger inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold text-rose-600/85 transition hover:bg-rose-50/80 hover:text-rose-700 cursor-pointer disabled:opacity-50 !shadow-none',
                  'inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-sm font-bold text-rose-600/85 transition hover:bg-rose-50/80 hover:text-rose-700 cursor-pointer disabled:opacity-50 !shadow-none',
                )}
              >
                {quitting ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : null}
                <span>
                  {isReload
                    ? (loseXp ? `Tải lại trang và mất tối đa ${maxPenalty} XP` : 'Vẫn tải lại trang')
                    : (loseXp ? `Thoát và mất tối đa ${maxPenalty} XP` : 'Vẫn thoát')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
