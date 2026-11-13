/**
 * Linh vật cảm xúc giọt nước xanh lá DewSkill (chiếc mũ tốt nghiệp ôm sát đầu).
 * Asset: /mascot/*.gif & .webp đã có trong thư mục public/mascot.
 * Hỗ trợ đầy đủ 9 trạng thái Mascot Emotion System chuẩn:
 * idle, correct, incorrect, learning, loading, completed, unlocked, streak, error
 * cùng toàn bộ các mood hiện có để tương thích ngược 100%.
 */
const MOOD_SRC = {
  // 9 trạng thái chuẩn Mascot Emotion System
  idle: '/mascot/cam-xuc-hoc-bai.gif',
  correct: '/mascot/cam-xuc-vui.gif',
  incorrect: '/mascot/cam-xuc-suy-nghi.gif',
  learning: '/mascot/doc-sach.gif',
  loading: '/mascot/nang-dong.gif',
  completed: '/mascot/om-trai-tim-vui.gif',
  unlocked: '/mascot/tot-nghiep-vui-ve.gif',
  streak: '/mascot/quyet-tam.gif',
  error: '/mascot/cam-xuc-buon.gif',

  // Tương thích ngược các khóa mood hiện có
  studying: '/mascot/doc-sach.gif',
  happy: '/mascot/cam-xuc-vui.gif',
  celebrate: '/mascot/om-trai-tim-vui.gif',
  graduate: '/mascot/tot-nghiep-vui-ve.gif',
  done: '/mascot/hoan-thanh-checklish.gif',
  sad: '/mascot/cam-xuc-buon.gif',
  quit: '/mascot/cam-xuc-khoc.gif',
  offline: '/mascot/Buon_Wifi.gif',
  thinking: '/mascot/cam-xuc-suy-nghi.gif',
  idea: '/mascot/y-tuong.gif',
  determined: '/mascot/quyet-tam.gif',
  determinedSoft: '/mascot/cam-xuc-quyet-tam.gif',
  energy: '/mascot/nang-dong.gif',
  sleepy: '/mascot/ngu-gat.gif',
  connected: '/mascot/ket-noi-thanh-cong.gif',
  cursor: '/mascot/con-tro.webp',
  pointer: '/mascot/con-tro.webp',
  'con-tro': '/mascot/con-tro.webp',

  // Game feedback aliases (cùng asset, trạng thái chuyển động riêng)
  wrong: '/mascot/cam-xuc-suy-nghi.gif',
  hint: '/mascot/y-tuong.gif',
  combo3: '/mascot/cam-xuc-vui.gif',
  combo5: '/mascot/wor-excel-powerpoint-mascot.gif',
  combo10: '/mascot/tot-nghiep-vui-ve.gif',
  victory: '/mascot/hoan-thanh-checklish.gif',
};

const MOOD_LABEL = {
  idle: 'Linh vật DewSkill đứng chờ vui vẻ',
  correct: 'Linh vật DewSkill giơ ngón cái mỉm cười',
  incorrect: 'Linh vật DewSkill suy nghĩ động viên',
  learning: 'Linh vật DewSkill đang đọc sách học bài',
  loading: 'Linh vật DewSkill tập trung làm việc',
  completed: 'Linh vật DewSkill nhảy vui ăn mừng',
  unlocked: 'Linh vật DewSkill vui mừng mở khóa chặng mới',
  streak: 'Linh vật DewSkill quyết tâm giữ chuỗi ngày',
  error: 'Linh vật DewSkill hơi buồn khi gặp lỗi',

  studying: 'Linh vật đang học',
  happy: 'Linh vật vui mừng',
  celebrate: 'Linh vật ăn mừng',
  graduate: 'Linh vật tốt nghiệp',
  done: 'Linh vật hoàn thành',
  sad: 'Linh vật buồn',
  quit: 'Linh vật tiếc nuối',
  offline: 'Linh vật mất kết nối',
  thinking: 'Linh vật đang suy nghĩ',
  idea: 'Linh vật có ý tưởng',
  determined: 'Linh vật quyết tâm',
  determinedSoft: 'Linh vật quyết tâm',
  energy: 'Linh vật năng động',
  sleepy: 'Linh vật buồn ngủ',
  connected: 'Linh vật kết nối thành công',
  cursor: 'Linh vật con trỏ cử nhân',
  pointer: 'Linh vật con trỏ cử nhân',
  'con-tro': 'Linh vật con trỏ cử nhân',
};

const MOTION = {
  correct: 'dp-bounce',
  completed: 'dp-bounce',
  unlocked: 'dp-bounce',
  streak: 'dp-bounce',
  loading: 'dp-float',
  learning: 'dp-float',
  incorrect: 'dp-float',
  error: 'dp-droop',
  happy: 'dp-bounce',
  celebrate: 'dp-bounce',
  graduate: 'dp-bounce',
  done: 'dp-bounce',
  energy: 'dp-bounce',
  determined: 'dp-bounce',
  determinedSoft: 'dp-bounce',
  sad: 'dp-droop',
  quit: 'dp-droop',
  offline: 'dp-droop',
  sleepy: 'dp-droop',
  combo3: 'dp-bounce',
  combo5: 'dp-bounce',
  combo10: 'dp-bounce',
  studying: 'dp-float',
  victory: 'dp-bounce',
  hint: 'dp-float',
  wrong: 'dp-float',
};

export default function Mascot({ mood = 'idle', emotion, size = 96, className = '' }) {
  const requested = emotion || mood || 'idle';
  const key = MOOD_SRC[requested] ? requested : 'idle';
  const src = MOOD_SRC[key];
  const motion = MOTION[key] || 'dp-float';
  return (
    <img
      src={src}
      alt={MOOD_LABEL[key] || 'Linh vật DewSkill'}
      width={size}
      height={size}
      data-mascot-emotion={key}
      className={`object-contain select-none ${motion} ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      decoding="async"
    />
  );
}

export { MOOD_SRC, MOOD_LABEL };
