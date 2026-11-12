import { useState } from 'react';
import { BookOpen, Check, ChevronRight, Loader2, Sparkles, Star, X, Zap } from 'lucide-react';
import MascotEmotion from './MascotEmotion';
import XPRewardAnimation from './XPRewardAnimation';
import { gameSounds } from '../../../utils/sound';

/**
 * Tạo dòng tóm tắt ngắn gọn kiểu "Restart = Khởi động lại máy." như hình tham chiếu
 * mà không làm thay đổi dữ liệu gốc từ API.
 */
export function buildConciseAnswerSummary(question, result) {
  const answerText = String(result?.correctAnswer?.text || '').trim();
  const promptText = String(question?.prompt || '').trim();
  const explanationText = String(result?.explanation || '').trim();

  if (result?.correct) {
    if (promptText && answerText) {
      const cleanedPrompt = promptText
        .replace(/\s*(nghĩa là gì|là gì|dùng để làm gì|có tác dụng gì|viết tắt của từ gì)\s*\??$/i, '')
        .replace(/\?+$/, '')
        .trim();
      if (cleanedPrompt && cleanedPrompt.length <= 42 && cleanedPrompt.toLowerCase() !== promptText.toLowerCase()) {
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanedPrompt} = ${cleanAns}.`;
      }
      if (answerText.length <= 80) {
        const cleanAns = answerText.replace(/\.+$/, '');
        return `${cleanAns}.`;
      }
    }
    if (explanationText) return explanationText;
    return 'Bạn đã nắm vững kiến thức câu hỏi này.';
  }

  if (answerText) {
    return `Đáp án đúng: ${answerText}`;
  }
  if (explanationText) {
    return explanationText;
  }
  return 'Hãy xem phần giải thích để nhớ kỹ kiến thức nhé!';
}

/**
 * QuizActionButtons - Cụm 2 nút hành động trong bảng phản hồi DewSkill:
 * 1. Nút "Giải thích" (nền trắng, viền xanh nhạt/xám, chữ đậm) -> mở/đóng giải thích chi tiết.
 * 2. Nút "Tiếp tục >" (màu xanh lá DewSkill, chữ trắng đậm, hiệu ứng 3D) -> sang câu tiếp theo.
 * - Trên Desktop: xếp dọc bên phải.
 * - Trên Mobile: xếp ngang 2 cột ở dưới bảng.
 */
export function QuizActionButtons({
  isCorrect = true,
  explainOpen = false,
  onToggleExplain,
  onNext,
  busy = false,
  isLastQuestion = false,
}) {
  return (
    <div className="grid w-full shrink-0 grid-cols-2 gap-2.5 sm:flex sm:w-[172px] sm:flex-col">
      <button
        type="button"
        onClick={() => {
          gameSounds.tap();
          onToggleExplain?.();
        }}
        aria-expanded={explainOpen}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-2xl border-[1.5px] bg-white px-4 py-2.5 text-sm font-extrabold transition-all duration-150 active:translate-y-[2px] ${
          isCorrect
            ? 'border-emerald-200/90 text-slate-700 shadow-[0_3px_0_#A7F3D0] hover:border-emerald-300 hover:bg-emerald-50/40'
            : 'border-red-200 text-slate-700 shadow-[0_3px_0_#FECACA] hover:border-red-300 hover:bg-red-50/40'
        }`}
      >
        <span>{explainOpen ? 'Ẩn giải thích' : 'Giải thích'}</span>
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          gameSounds.tap();
          onNext?.();
        }}
        className="inline-flex min-h-[46px] items-center justify-center gap-1.5 rounded-2xl border-b-[4px] border-emerald-700 bg-gradient-to-b from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-[0_6px_16px_-4px_rgba(5,150,105,0.45)] transition-all duration-150 hover:brightness-[1.03] active:translate-y-[2px] active:border-b-[2px] disabled:opacity-60"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : null}
        <span>{isLastQuestion ? 'Tiếp tục' : 'Tiếp tục'}</span>
        <ChevronRight size={18} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * AnswerFeedback - Bảng thông báo kết quả trả lời câu hỏi trắc nghiệm chuẩn Game UI DewSkill:
 * - Đặt ngay bên dưới các đáp án trong khung câu hỏi.
 * - Khi đúng: nền xanh mint nhạt, bo góc 24px, Mascot giọt nước vui mừng kèm sao & pháo giấy nhẹ,
 *   tiêu đề "Chính xác!", dòng tóm tắt ngắn gọn, huy hiệu ⚡ +XP và 2 nút "Giải thích" / "Tiếp tục >".
 * - Khi sai: nền đỏ hồng nhạt, rung ngang nhẹ 1 lần, Mascot suy nghĩ/động viên,
 *   tiêu đề "Chưa chính xác, thử lại nhé!", hiển thị đáp án đúng và 2 nút "Giải thích" / "Tiếp tục >".
 */
export function AnswerFeedback({
  question = null,
  result,
  feedbackTitle = '',
  confirmedXp = 0,
  rewardKey = '',
  isLastQuestion = false,
  busy = false,
  onNext,
}) {
  const [explainOpen, setExplainOpen] = useState(false);

  if (!result) return null;

  const isCorrect = Boolean(result.correct);
  const bannerLabel = isCorrect ? 'Chính xác!' : 'Chưa chính xác, thử lại nhé!';
  const conciseLine = buildConciseAnswerSummary(question, result);
  const detailExplanation = result.explanation
    || (result.correctAnswer?.text
      ? `Đáp án chính xác của câu hỏi này là: "${result.correctAnswer.text}". Hãy ghi nhớ khái niệm này để áp dụng nhanh trong các bài thực hành tiếp theo.`
      : 'Hãy đọc kỹ lại đề bài và các phương án để nắm vững kiến thức trọng tâm của bài học.');

  return (
    <div
      data-answer-feedback={isCorrect ? 'correct' : 'incorrect'}
      className={`dp-feedback-card-in relative mt-5 overflow-hidden rounded-[24px] border-[1.5px] p-5 transition-all sm:px-6 sm:py-5 ${
        isCorrect
          ? 'border-emerald-200/90 bg-gradient-to-br from-[#ECFDF5] via-[#E6F9EF] to-[#D1FAE5]/75 shadow-[0_10px_28px_-12px_rgba(16,185,129,0.22)]'
          : 'dp-shake border-red-200/90 bg-gradient-to-br from-[#FFF1F2] via-[#FFE4E6]/65 to-[#FEF2F2] shadow-[0_10px_28px_-12px_rgba(239,68,68,0.16)]'
      }`}
    >
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:gap-5 sm:text-left">
        {/* Khu vực Mascot DewSkill + ngôi sao & pháo giấy trang trí */}
        <div className="relative flex h-24 w-28 shrink-0 items-center justify-center sm:h-26 sm:w-32">
          {isCorrect && (
            <>
              {/* Các ngôi sao nhỏ & pháo giấy pastel xung quanh Mascot đúng theo hình tham chiếu */}
              <Star
                size={14}
                className="dp-twinkle pointer-events-none absolute left-1 top-1 fill-amber-400 text-amber-400"
                aria-hidden="true"
              />
              <Star
                size={12}
                className="dp-twinkle dp-twinkle-late pointer-events-none absolute right-1 top-2 fill-amber-300 text-amber-400"
                aria-hidden="true"
              />
              <Sparkles
                size={13}
                className="dp-twinkle pointer-events-none absolute bottom-2 left-0 text-amber-400"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute -left-1 top-9 h-2 w-3.5 -rotate-18 rounded-xs bg-sky-400/85"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute right-0 top-9 h-2 w-3.5 rotate-15 rounded-xs bg-pink-400/85"
                aria-hidden="true"
              />
              <span
                className="pointer-events-none absolute bottom-3 right-2 h-1.5 w-3 -rotate-12 rounded-xs bg-emerald-400/90"
                aria-hidden="true"
              />
            </>
          )}
          <MascotEmotion
            emotion={isCorrect ? 'correct' : 'incorrect'}
            size={92}
            className="relative z-[1] drop-shadow-[0_8px_12px_rgba(16,185,129,0.18)]"
          />
        </div>

        {/* Nội dung chính ở giữa: Tiêu đề + giải thích ngắn + huy hiệu XP */}
        <div className="flex min-w-0 flex-1 flex-col items-center sm:items-start">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <span
              className={`dp-check-pop flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-xs ${
                isCorrect ? 'bg-emerald-500' : 'bg-red-500'
              }`}
              aria-hidden="true"
            >
              {isCorrect ? <Check size={17} strokeWidth={3.4} /> : <X size={17} strokeWidth={3.2} />}
            </span>
            <h3
              className={`text-xl font-black tracking-tight sm:text-2xl ${
                isCorrect ? 'text-emerald-800' : 'text-red-700'
              }`}
            >
              {bannerLabel}
            </h3>
          </div>

          <p className="mt-1.5 text-sm font-bold leading-snug text-slate-800 sm:text-[15px]">
            {conciseLine}
          </p>

          {/* Huy hiệu XP xác nhận từ hệ thống */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            {isCorrect ? (
              confirmedXp > 0 ? (
                <XPRewardAnimation
                  xpAmount={confirmedXp}
                  rewardKey={rewardKey}
                  playSound={false}
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-gradient-to-r from-[#FFF3C4] via-[#FDE68A]/80 to-[#FFF3C4] px-3.5 py-1 text-xs font-black text-amber-900 shadow-2xs ring-2 ring-white/80">
                  <Zap size={13} className="fill-amber-400 text-amber-500" aria-hidden="true" />
                  <span>{feedbackTitle || 'Ôn tập · 0 XP'}</span>
                </span>
              )
            ) : result.wrongPenaltyXp > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-white/90 px-3 py-1 text-xs font-black text-red-600 shadow-2xs">
                <Zap size={13} className="fill-red-400 text-red-500" aria-hidden="true" />
                <span>−{result.wrongPenaltyXp} XP</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200/80 bg-white/85 px-3 py-1 text-xs font-extrabold text-red-700">
                <span>{feedbackTitle || 'Đừng nản, cố lên nhé!'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Cụm 2 nút hành động: Giải thích & Tiếp tục > */}
        <QuizActionButtons
          isCorrect={isCorrect}
          explainOpen={explainOpen}
          onToggleExplain={() => setExplainOpen((prev) => !prev)}
          onNext={onNext}
          busy={busy}
          isLastQuestion={isLastQuestion}
        />
      </div>

      {/* Khung giải thích chi tiết mở ra khi học viên nhấn "Giải thích" */}
      {explainOpen && (
        <div
          className={`dp-slide-up mt-4 rounded-2xl border bg-white/95 p-4 text-left shadow-xs ${
            isCorrect ? 'border-emerald-200/90' : 'border-red-200/90'
          }`}
        >
          <div className="flex items-start gap-2.5">
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${
                isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
              }`}
            >
              <BookOpen size={15} />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                Giải thích chi tiết
              </p>
              {result.correctAnswer?.text && (
                <p className="text-sm font-extrabold text-emerald-800">
                  Đáp án đúng: {result.correctAnswer.text}
                </p>
              )}
              <p className="text-sm font-medium leading-relaxed text-slate-700">
                {detailExplanation}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnswerFeedback;
