/** Mục tiêu học của học viên — dùng chung popup, thẻ tiến độ và bộ đếm phút học. */
export const LEARNING_GOAL_PERIODS = [
  { id: 'week', label: '1 tuần', days: 7 },
  { id: 'month', label: '1 tháng', days: 30, popular: true },
  { id: 'quarter', label: '3 tháng', days: 90 },
];
export const LEARNING_GOAL_HOURS = [1, 2, 3, 4, 5];

/** Mức độ theo số giờ/ngày — màu chuyển dần từ xanh (nhẹ) sang đỏ (cao). */
export const LEARNING_GOAL_LEVELS = {
  1: { label: 'Người mới bắt đầu', color: '#10B981', soft: '#ECFDF5' },
  2: { label: 'Biết cơ bản', color: '#0EA5E9', soft: '#F0F9FF' },
  3: { label: 'Tập trung', color: '#F59E0B', soft: '#FFFBEB' },
  4: { label: 'Chuyên sâu', color: '#F97316', soft: '#FFF7ED' },
  5: { label: 'Bứt phá', color: '#DC2626', soft: '#FEF2F2' },
};

const MOTIVATION = {
  1: 'Người mới bắt đầu: mỗi ngày một giờ, dễ vào nhịp.',
  2: 'Biết cơ bản: hai giờ mỗi ngày, vừa sức để tiến đều.',
  3: 'Tập trung tốt — bạn sẽ thấy tiến bộ rõ rệt.',
  4: 'Cam kết cao — hãy chia nhỏ thành nhiều buổi.',
  5: 'Thử thách bứt phá — nhớ nghỉ ngơi hợp lý nhé!',
};

export function goalMotivation(hours) {
  return MOTIVATION[hours] || MOTIVATION[2];
}

/** Ngày hoàn thành dự kiến (dd/mm/yyyy, giờ Việt Nam) nếu bắt đầu từ hôm nay. */
export function goalEndDateLabel(days, from = new Date()) {
  const end = new Date(from.getTime() + (Number(days) || 0) * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(end);
}

export const OPEN_LEARNING_GOAL_EVENT = 'cms:open-learning-goal';
export const LEARNING_GOAL_CHANGED_EVENT = 'cms:learning-goal-changed';
export const STUDY_MINUTE_EVENT = 'cms:study-minute';

export function openLearningGoal() {
  window.dispatchEvent(new CustomEvent(OPEN_LEARNING_GOAL_EVENT));
}

/** Link mở đúng môn → buổi → mục (video) từ một điểm học tiếp / video liên quan. */
export function lessonResumeUrl(point) {
  const params = new URLSearchParams();
  if (point.courseId) params.set('courseId', point.courseId);
  params.set('unitId', point.unitId);
  if (point.sectionId) params.set('section', point.sectionId);
  return `/student/lesson-practice/subjects/${encodeURIComponent(point.subjectId)}?${params.toString()}`;
}

export function periodLabel(period) {
  return LEARNING_GOAL_PERIODS.find((p) => p.id === period)?.label || '';
}

export function formatStudyMinutes(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} phút`;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

const playingMedia = new Set();

/** Trình phát video (YouTube API…) báo đang phát / dừng để bộ đếm vẫn tính khi HV chỉ xem, không thao tác. */
export function setStudyMediaPlaying(key, playing) {
  if (playing) playingMedia.add(key);
  else playingMedia.delete(key);
}

/** Có video đang phát thật (không tạm dừng, chưa hết) trên trang hay không. */
export function isStudyMediaPlaying() {
  if (playingMedia.size) return true;
  return Array.from(document.querySelectorAll('video'))
    .some((video) => !video.paused && !video.ended && video.readyState > 2);
}

/** Trang được tính là "đang học". */
export function isStudyLocation(pathname = '', hash = '') {
  if (/^\/student\/(lesson-practice|daily-practice|cert-prep|exam)(\/|$)/.test(pathname)) return true;
  return pathname === '/student' && /^#materials-(files|software|videos)/.test(hash);
}
