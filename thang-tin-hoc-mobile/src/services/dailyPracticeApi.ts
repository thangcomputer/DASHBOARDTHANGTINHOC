import { mobileApiRequest } from './apiClient';

export type DpDifficulty = 'easy' | 'medium' | 'hard';
export type DpType = 'mcq' | 'truefalse' | 'order' | 'match' | 'fill' | 'sort';

export type DpTopic = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  counts: { easy: number; medium: number; hard: number };
};

export type DpStats = {
  xpTotal: number;
  streak: number;
  bestStreak: number;
  playedToday: boolean;
  sessionsCount: number;
  todaySessions?: number;
  todayXp?: number;
  todayPlayers?: number;
  streakState?: 'new' | 'active' | 'at_risk' | 'lost';
  lostStreak?: number;
  missedDays?: number;
};

export type DpQuestion = {
  id: string;
  type: DpType;
  difficulty: DpDifficulty;
  prompt: string;
  imageUrl: string;
  options?: string[];
  items?: string[];
  lefts?: string[];
  rights?: string[];
  segments?: Array<{ text?: string; blank?: number }>;
  bank?: string[];
  groups?: string[];
};

export type DpAnswer =
  | { index: number }
  | { value: boolean }
  | { items: string[] }
  | { pairs: Array<{ left: string; right: string }> }
  | { blanks: string[] }
  | { placements: Record<string, string> };

export type DpCorrectAnswer = {
  text: string;
  correctIndex?: number;
  answerBool?: boolean;
  items?: string[];
  pairs?: Array<{ left: string; right: string }>;
  answers?: string[];
  groups?: Array<{ name: string; items: string[] }>;
};

export type DpAnswerResult = {
  correct: boolean;
  xp: number;
  sessionXp: number;
  correctCount: number;
  answered: number;
  correctAnswer: DpCorrectAnswer;
  explanation: string;
};

export type DpReveal = {
  eliminate?: number[];
  first?: string;
  pair?: { left: string; right: string };
  blank?: { index: number; word: string };
  item?: { name: string; group: string };
};

export type DpSession = { id: string; difficulty: DpDifficulty; total: number; questions: DpQuestion[] };

export type DpSummary = {
  total: number;
  correctCount: number;
  stars: number;
  xp: number;
  bonusXp: number;
  gainedXp: number;
  streakIncreased: boolean;
  stats: DpStats;
  review: Array<{ id: string; prompt: string; correctAnswer: DpCorrectAnswer; explanation: string }>;
  relatedLesson?: DpRelatedLesson | null;
};

/** Video bài giảng admin gắn với chủ đề — mở đúng môn → buổi → mục. */
export type DpRelatedLesson = {
  subjectId: string;
  subjectName: string;
  courseId: string;
  unitId: string;
  unitTitle: string;
  sectionId: string;
  kind: 'video' | 'note' | 'practice' | '';
  itemTitle: string;
  completed?: boolean;
};

async function call<T>(path: string, body?: unknown): Promise<T> {
  const payload = await mobileApiRequest<{ data?: T }>(
    `/daily-practice/my${path}`,
    body === undefined ? undefined : { method: 'POST', body: JSON.stringify(body) },
  );
  if (payload.data === undefined) throw new Error('Máy chủ không trả dữ liệu luyện tập');
  return payload.data;
}

/** Luyện tập hằng ngày — cùng API với web. */
export const dailyPracticeApi = {
  overview: () => call<{ topics: DpTopic[]; stats: DpStats }>('/overview'),
  start: (topicId: string, difficulty: DpDifficulty) => call<DpSession>('/sessions', { topicId, difficulty }),
  answer: (sessionId: string, questionId: string, answer: DpAnswer) => call<DpAnswerResult>(`/sessions/${sessionId}/answer`, { questionId, answer }),
  hint: (sessionId: string, questionId: string) => call<{ hint: string; reveal: DpReveal }>(`/sessions/${sessionId}/hint`, { questionId }),
  finish: (sessionId: string) => call<DpSummary>(`/sessions/${sessionId}/finish`, {}),
  relatedTopics: (subjectId: string, unitId = '') => call<DpTopic[]>(
    `/related-topics?subjectId=${encodeURIComponent(subjectId)}${unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''}`,
  ),
};

export const DP_DIFFICULTIES: Array<{ id: DpDifficulty; label: string; stars: number; color: string; soft: string; xp: number }> = [
  { id: 'easy', label: 'Dễ', stars: 1, color: '#10B981', soft: '#ECFDF5', xp: 10 },
  { id: 'medium', label: 'Vừa', stars: 2, color: '#F59E0B', soft: '#FFFBEB', xp: 15 },
  { id: 'hard', label: 'Khó', stars: 3, color: '#EF4444', soft: '#FEF2F2', xp: 20 },
];

export const DP_TYPES: Record<DpType, { label: string; instruction: string }> = {
  mcq: { label: 'Trắc nghiệm', instruction: 'Chọn đáp án đúng' },
  truefalse: { label: 'Đúng hay Sai', instruction: 'Phát biểu này đúng hay sai?' },
  order: { label: 'Sắp xếp', instruction: 'Kéo thả để sắp xếp đúng thứ tự' },
  match: { label: 'Ghép cặp', instruction: 'Kéo mỗi thẻ vào đúng ô bên trái' },
  fill: { label: 'Điền vào chỗ trống', instruction: 'Kéo từ vào đúng chỗ trống' },
  sort: { label: 'Phân loại', instruction: 'Kéo từng mục vào đúng nhóm' },
};

export const DP_TOPIC_COLORS: Record<string, { from: string; to: string; soft: string }> = {
  red: { from: '#F87171', to: '#B91C1C', soft: '#FEF2F2' },
  blue: { from: '#60A5FA', to: '#1D4ED8', soft: '#EFF6FF' },
  green: { from: '#4ADE80', to: '#15803D', soft: '#F0FDF4' },
  orange: { from: '#FB923C', to: '#C2410C', soft: '#FFF7ED' },
  purple: { from: '#C084FC', to: '#7E22CE', soft: '#FAF5FF' },
  teal: { from: '#2DD4BF', to: '#0F766E', soft: '#F0FDFA' },
  pink: { from: '#F472B6', to: '#BE185D', soft: '#FDF2F8' },
  amber: { from: '#FBBF24', to: '#B45309', soft: '#FFFBEB' },
  sky: { from: '#38BDF8', to: '#0369A1', soft: '#F0F9FF' },
  slate: { from: '#94A3B8', to: '#334155', soft: '#F8FAFC' },
};

const PRAISE = ['Tuyệt vời!', 'Chính xác!', 'Giỏi quá!', 'Xuất sắc!', 'Quá đỉnh!', 'Làm tốt lắm!'];
const COMFORT = ['Chưa đúng rồi', 'Tiếc quá!', 'Gần đúng rồi đó', 'Không sao, thử câu tiếp nhé'];
export const randomPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
export const randomComfort = () => COMFORT[Math.floor(Math.random() * COMFORT.length)];

/** Lời nhắc theo trạng thái chuỗi — cùng nội dung với web. */
export function reminderCopy(stats: DpStats, topicCount: number) {
  const streak = stats.streak || 0;
  const missed = stats.missedDays || 0;
  if (stats.streakState === 'lost' && (stats.lostStreak || 0) > 0) {
    return {
      mood: 'sad' as const,
      badge: 'BẠN ĐÃ LỠ CHUỖI',
      title: `Bạn đã lỡ chuỗi 🔥 ${stats.lostStreak} ngày!`,
      text: `Đã ${missed} ngày bạn chưa luyện tập. Đừng để công sức trôi đi — luyện tập ngay bây giờ để lấy lại phong độ, chỉ 5 phút thôi!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (stats.streakState === 'lost') {
    return {
      mood: 'sad' as const,
      badge: 'ĐỪNG BỎ CUỘC',
      title: 'Lâu rồi bạn chưa luyện tập!',
      text: `Đã ${missed} ngày rồi đó. Kiến thức sẽ quên dần nếu không ôn — làm ngay 10 câu để lấy lại phong độ nhé!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (streak > 0) {
    return {
      mood: 'thinking' as const,
      badge: 'CHUỖI SẮP MẤT',
      title: `Chuỗi 🔥 ${streak} ngày sắp mất!`,
      text: 'Hôm nay bạn chưa luyện tập — chuỗi sẽ về 0 lúc nửa đêm. Làm ngay 10 câu để giữ lửa!',
      cta: 'Giữ chuỗi ngay',
    };
  }
  return {
    mood: 'happy' as const,
    badge: 'THỬ THÁCH HÔM NAY',
    title: 'Luyện tập 5 phút mỗi ngày',
    text: `10 câu trắc nghiệm, kéo thả vui như trò chơi${topicCount ? ` với ${topicCount} chủ đề` : ''}. Bắt đầu chuỗi ngày đầu tiên nào!`,
    cta: 'Luyện tập ngay',
  };
}

export function resultMessage(stars: number) {
  if (stars >= 3) return { title: 'Hoàn hảo!', text: 'Bạn nắm chủ đề này rất chắc. Thử độ khó cao hơn nhé!' };
  if (stars === 2) return { title: 'Rất tốt!', text: 'Chỉ sai vài câu — xem lại phần giải thích để nhớ lâu hơn.' };
  if (stars === 1) return { title: 'Cố lên!', text: 'Bạn đang tiến bộ. Ôn lại các câu sai rồi chơi lại nhé.' };
  return { title: 'Đừng nản nhé!', text: 'Ai cũng bắt đầu từ đây. Thử độ khó Dễ để làm quen trước.' };
}
