import { ArrowRight, Check, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import XPRewardAnimation from './XPRewardAnimation';
import GameButton from './GameButton';

/**
 * AnswerFeedback - Khung phản hồi câu trả lời chuẩn Game Hóa DewSkill:
 * - Khi đúng: nền xanh ngọc, dấu tích pop, thông báo "Chính xác!", Mascot vui vẻ (correct), XP bay lên nếu được xác nhận.
 * - Khi sai: nền đỏ nhạt, rung ngang nhẹ 1 lần, Mascot suy nghĩ/động viên (incorrect), hiển thị đáp án/giải thích hiện tại.
 */
export default function AnswerFeedback({
  result,
  feedbackTitle = '',
  confirmedXp = 0,
  rewardKey = '',
  isLastQuestion = false,
  busy = false,
  onNext,
}) {
  if (!result) return null;

  const isCorrect = Boolean(result.correct);
  const bannerLabel = isCorrect ? 'Chính xác!' : 'Chưa chính xác';
  const subPraise = feedbackTitle && feedbackTitle !== 'Chính xác!' ? feedbackTitle : '';

  return (
    <div
      data-answer-feedback={isCorrect ? 'correct' : 'incorrect'}
      className={`dp-slide-up relative flex flex-col gap-3.5 rounded-[24px] border-2 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
        isCorrect
          ? 'border-emerald-300 bg-gradient-to-r from-emerald-50 via-teal-50/70 to-emerald-50/90'
          : 'dp-shake border-red-200 bg-gradient-to-r from-red-50/95 via-rose-50/70 to-red-50/90'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5 sm:items-center">
        {/* Dấu tích pop khi đúng / icon báo sai + Mascot Emotion */}
        <div className="relative shrink-0">
          <div
            className={`flex h-13 w-13 items-center justify-center rounded-2xl bg-white shadow-xs ring-1 ${
              isCorrect ? 'ring-emerald-200' : 'ring-red-200'
            }`}
          >
            <MascotEmotion emotion={isCorrect ? 'correct' : 'incorrect'} size={46} />
          </div>
          <span
            className={`dp-pop absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-white shadow-xs ring-2 ring-white ${
              isCorrect ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            aria-hidden="true"
          >
            {isCorrect ? <Check size={14} strokeWidth={3.2} /> : <XCircle size={14} strokeWidth={2.6} />}
          </span>
        </div>

        {/* Nội dung phản hồi */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={`flex items-center gap-1.5 text-base font-black sm:text-lg ${
                isCorrect ? 'text-emerald-800' : 'text-red-700'
              }`}
            >
              {isCorrect ? (
                <CheckCircle2 size={19} className="dp-pop shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <XCircle size={19} className="shrink-0 text-red-600" aria-hidden="true" />
              )}
              <span>{bannerLabel}</span>
            </p>

            {subPraise && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                  isCorrect ? 'bg-emerald-100/90 text-emerald-800' : 'bg-red-100/80 text-red-700'
                }`}
              >
                {subPraise}
              </span>
            )}

            {/* Điểm XP bay lên khi hệ thống xác nhận */}
            {isCorrect && confirmedXp > 0 && (
              <XPRewardAnimation
                xpAmount={confirmedXp}
                rewardKey={rewardKey}
                playSound={false}
              />
            )}
          </div>

          {!isCorrect && result.correctAnswer?.text && (
            <p className="mt-1 text-sm font-bold text-slate-800">
              Đáp án đúng: <span className="text-emerald-700">{result.correctAnswer.text}</span>
            </p>
          )}

          {result.explanation && (
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-relaxed text-slate-600">
              {result.explanation}
            </p>
          )}
        </div>
      </div>

      {/* Nút điều hướng sang câu tiếp theo hoặc màn kết quả */}
      <GameButton
        variant={isCorrect ? 'primary' : 'danger'}
        disabled={busy}
        onClick={onNext}
        className="w-full shrink-0 sm:w-auto sm:min-w-[148px] !py-3"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        <span>{isLastQuestion ? 'Kết quả' : 'Tiếp theo'}</span>
        <ArrowRight size={16} />
      </GameButton>
    </div>
  );
}
