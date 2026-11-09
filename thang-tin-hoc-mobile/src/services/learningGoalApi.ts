import { mobileApiRequest } from './apiClient';

export type LearningGoalPeriod = 'week' | 'month' | 'quarter';

export type LearningGoal = {
  period: LearningGoalPeriod;
  hoursPerDay: number;
  startedAt: string;
  endsAt: string;
  expired: boolean;
};

export type LearningGoalProgress = {
  todayMinutes: number;
  todayQuestions?: number;
  todayVideos?: number;
  dailyTargetMinutes?: number;
  periodMinutes?: number;
  periodQuestions?: number;
  periodVideos?: number;
  periodTargetMinutes?: number;
  daysElapsed?: number;
  totalDays?: number;
  daysLeft?: number;
};

export type LearningGoalData = { goal: LearningGoal | null; progress: LearningGoalProgress };

export const LEARNING_GOAL_PERIODS: Array<{ id: LearningGoalPeriod; label: string; days: number; popular?: boolean }> = [
  { id: 'week', label: '1 tuần', days: 7 },
  { id: 'month', label: '1 tháng', days: 30, popular: true },
  { id: 'quarter', label: '3 tháng', days: 90 },
];
export const LEARNING_GOAL_HOURS = [1, 2, 3, 4, 5];

/** Mức độ theo số giờ/ngày - đồng bộ màu với web. */
export const LEARNING_GOAL_LEVELS: Record<number, { label: string; color: string; soft: string }> = {
  1: { label: 'Nhẹ nhàng', color: '#10B981', soft: '#ECFDF5' },
  2: { label: 'Vừa sức', color: '#0EA5E9', soft: '#F0F9FF' },
  3: { label: 'Tập trung', color: '#F59E0B', soft: '#FFFBEB' },
  4: { label: 'Chuyên sâu', color: '#F97316', soft: '#FFF7ED' },
  5: { label: 'Bứt phá', color: '#DC2626', soft: '#FEF2F2' },
};

const MOTIVATION: Record<number, string> = {
  1: 'Mỗi ngày một chút - đều đặn là chìa khóa.',
  2: 'Nhịp học vừa sức, dễ duy trì lâu dài.',
  3: 'Tập trung tốt - bạn sẽ thấy tiến bộ rõ rệt.',
  4: 'Cam kết cao - hãy chia nhỏ thành nhiều buổi.',
  5: 'Thử thách bứt phá - nhớ nghỉ ngơi hợp lý nhé!',
};

export function goalMotivation(hours: number) {
  return MOTIVATION[hours] || MOTIVATION[2];
}

/** Ngày hoàn thành dự kiến (dd/mm/yyyy, giờ Việt Nam) nếu bắt đầu từ hôm nay. */
export function goalEndDateLabel(days: number, from = new Date()) {
  const vn = new Date(from.getTime() + days * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}/${vn.getUTCFullYear()}`;
}

export const OPEN_LEARNING_GOAL_EVENT = 'mobile:open-learning-goal';
export const LEARNING_GOAL_CHANGED_EVENT = 'mobile:learning-goal-changed';
export const STUDY_MINUTE_EVENT = 'mobile:study-minute';

export function periodLabel(period?: string) {
  return LEARNING_GOAL_PERIODS.find((option) => option.id === period)?.label || '';
}

export function formatStudyMinutes(minutes?: number) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest} phút`;
  return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
}

function normalize(data: unknown): LearningGoalData {
  const raw = (data && typeof data === 'object' ? data : {}) as Partial<LearningGoalData>;
  return { goal: raw.goal || null, progress: raw.progress || { todayMinutes: 0 } };
}

/** Dùng chung API với web: /api/lesson-practice/my/learning-goal + study-heartbeat. */
export async function getLearningGoal() {
  const payload = await mobileApiRequest<{ data?: unknown }>('/lesson-practice/my/learning-goal');
  return normalize(payload.data);
}

export async function saveLearningGoal(period: LearningGoalPeriod, hoursPerDay: number) {
  const payload = await mobileApiRequest<{ data?: unknown }>('/lesson-practice/my/learning-goal', {
    method: 'PUT',
    body: JSON.stringify({ period, hoursPerDay }),
  });
  return normalize(payload.data);
}

export type LeaderboardRow = {
  rank: number;
  name: string;
  avatar: string;
  goalDays: number;
  minutes: number;
  xp: number;
  hoursPerDay: number;
  isMe: boolean;
};

export type LearningLeaderboard = {
  weekStart: string;
  weekEnd: string;
  daysSoFar: number;
  participants: number;
  top: LeaderboardRow[];
  me: {
    hasGoal: boolean;
    rank: number | null;
    goalDays: number;
    minutes: number;
    xp: number;
    hoursPerDay: number;
    ahead: { rank: number; goalDays: number; minutes: number } | null;
  };
};

/** Bảng xếp hạng tuần (toàn trung tâm) - cùng API với web. */
export async function getLearningLeaderboard() {
  const payload = await mobileApiRequest<{ data?: LearningLeaderboard }>('/lesson-practice/my/learning-leaderboard');
  if (!payload.data) throw new Error('Không tải được bảng xếp hạng');
  return payload.data;
}

export async function sendStudyHeartbeat() {
  const payload = await mobileApiRequest<{ data?: { todayMinutes?: number } }>('/lesson-practice/my/study-heartbeat', {
    method: 'POST',
    body: '{}',
  });
  return { todayMinutes: Number(payload.data?.todayMinutes) || 0 };
}
