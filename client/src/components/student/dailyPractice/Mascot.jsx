/**
 * Linh vật cảm xúc — chỉ dùng trong Luyện tập hằng ngày.
 * Asset: /mascot/*.gif (từ cam-xuc-animation). Mood cũ idle/happy/sad/thinking vẫn hoạt động.
 */
const MOOD_SRC = {
  idle: '/mascot/cam-xuc-hoc-bai.gif',
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
};

const MOOD_LABEL = {
  idle: 'Linh vật sẵn sàng học',
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
};

const MOTION = {
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
};

export default function Mascot({ mood = 'idle', size = 96, className = '' }) {
  const key = MOOD_SRC[mood] ? mood : 'idle';
  const src = MOOD_SRC[key];
  const motion = MOTION[key] || 'dp-float';
  return (
    <img
      src={src}
      alt={MOOD_LABEL[key] || 'Linh vật'}
      width={size}
      height={size}
      className={`object-contain ${motion} ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      decoding="async"
    />
  );
}

export { MOOD_SRC };
