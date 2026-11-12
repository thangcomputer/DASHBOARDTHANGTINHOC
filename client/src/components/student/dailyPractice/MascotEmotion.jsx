import Mascot, { MOOD_LABEL, MOOD_SRC } from './Mascot';

const EMOTION_AURA = {
  idle: 'from-emerald-50/90 via-teal-50/50 to-white ring-emerald-200/80',
  correct: 'from-emerald-100/95 via-teal-50/80 to-white ring-emerald-300',
  incorrect: 'from-amber-50/95 via-orange-50/60 to-white ring-amber-200',
  learning: 'from-emerald-50/90 via-sky-50/50 to-white ring-emerald-200/80',
  loading: 'from-sky-50/90 via-emerald-50/50 to-white ring-sky-200/80',
  completed: 'from-amber-100/90 via-emerald-50/70 to-white ring-amber-300',
  unlocked: 'from-amber-100/95 via-yellow-50/80 to-white ring-amber-300',
  streak: 'from-orange-100/95 via-amber-50/80 to-white ring-orange-300',
  error: 'from-rose-50/90 via-slate-50 to-white ring-rose-200',
};

const EMOTION_DEFAULT_SPEECH = {
  idle: 'Sẵn sàng chinh phục bài học hôm nay!',
  correct: 'Chính xác! Bạn làm tốt lắm!',
  incorrect: 'Đừng nản nhé, xem gợi ý để nhớ lâu hơn!',
  learning: 'Tập trung từng bước một nhé!',
  loading: 'Đang chuẩn bị bài tập cho bạn…',
  completed: 'Tuyệt vời! Bạn đã hoàn thành bài học!',
  unlocked: 'Chúc mừng! Chặng mới đã mở khóa!',
  streak: 'Giữ vững ngọn lửa học tập mỗi ngày!',
  error: 'Có chút trục trặc nhỏ, thử lại nhé!',
};

/**
 * MascotEmotion - Hệ thống cảm xúc linh vật giọt nước xanh lá DewSkill:
 * - idle: đứng chờ, vui vẻ
 * - correct: giơ ngón cái, mỉm cười
 * - incorrect: suy nghĩ, động viên
 * - learning: đọc sách hoặc sử dụng laptop
 * - loading: tập trung làm việc
 * - completed: nhảy vui ăn mừng
 * - unlocked: vui mừng khi mở chặng
 * - streak: quyết tâm, cổ vũ
 * - error: hơi buồn khi gặp lỗi
 */
export default function MascotEmotion({
  emotion = 'idle',
  mood,
  size = 64,
  speech = '',
  showDefaultSpeech = false,
  withFrame = false,
  className = '',
}) {
  const activeEmotion = emotion || mood || 'idle';
  const auraClass = EMOTION_AURA[activeEmotion] || EMOTION_AURA.idle;
  const bubbleText = speech || (showDefaultSpeech ? EMOTION_DEFAULT_SPEECH[activeEmotion] : '');

  if (!withFrame && !bubbleText) {
    return <Mascot emotion={activeEmotion} size={size} className={className} />;
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`} data-mascot-state={activeEmotion}>
      <div
        className={`relative flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br p-1.5 shadow-xs ring-1 ${auraClass}`}
        style={{ width: size + 14, height: size + 14 }}
      >
        <Mascot emotion={activeEmotion} size={size} />
      </div>
      {bubbleText ? (
        <div className="relative rounded-2xl border border-emerald-200/80 bg-white px-3.5 py-2 text-left text-xs font-bold leading-snug text-slate-700 shadow-xs">
          <span
            className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-emerald-200/80 bg-white"
            aria-hidden="true"
          />
          <span>{bubbleText}</span>
        </div>
      ) : null}
    </div>
  );
}

export { MOOD_SRC, MOOD_LABEL, EMOTION_DEFAULT_SPEECH };
