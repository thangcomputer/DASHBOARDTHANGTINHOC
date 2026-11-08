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
  /**
   * Loại gói của học viên:
   * - 'free'    : Miễn phí — 60 XP/ngày, chỉ ôn bài cũ khi hết XP
   * - '1m'      : 1 tháng  — 300 XP/ngày, mở khóa bài mới (199.000đ)
   * - '3m'      : 3 tháng  — 300 XP/ngày, mở khóa bài mới (399.000đ)
   * - '6m'      : 6 tháng  — 300 XP/ngày, mở khóa bài mới (599.000đ)
   * - '12m'     : 1 năm    — 300 XP/ngày, mở khóa bài mới (999.000đ)
   * - 'lifetime': Vĩnh viễn — 300 XP/ngày, mở khóa bài mới (1.500.000đ)
   */
  planType?: DpPlanType | string;
  /** Giới hạn XP mỗi ngày theo gói (backend tính theo planType). */
  todayXpCap?: number;
  /** Học viên đã hết XP ngày hôm nay. */
  xpCapReached?: boolean;
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

export type DpStepKey = 'learn' | 'practice' | 'challenge' | 'checkpoint';
export type DpNodeState = 'completed' | 'active' | 'locked';

export type DpPathStep = {
  key: DpStepKey;
  label: string;
  difficulty: DpDifficulty | null;
  passPercent: number;
  state: DpNodeState;
  videos?: { id: string; title: string; url: string; step?: DpStepKey; state: DpNodeState }[];
};

export type DpPathNode = {
  key: string;
  label: string;
  icon: string;
  sortOrder: number;
  state: DpNodeState;
  levels: DpPathStep[];
};

export type DpPathUnit = {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  index: number;
  state: DpNodeState;
  testedOut: boolean;
  canTestOut: boolean;
  pathNodes: DpPathNode[];
  steps: DpPathStep[];
  videos?: DpPathVideo[];
  lesson: { unitId: string; subjectId: string; title: string } | null;
};

export type DpPathVideo = {
  id: string;
  title: string;
  url: string;
  state: DpNodeState;
  source?: 'unit' | 'step';
  step?: DpStepKey;
  stepLabel?: string;
};

/** Danh sách phát của popup video: video riêng của chặng + video buổi bài giảng đã gắn (nếu HV được mở). */
export type DpUnitVideos = {
  unitId: string;
  unitTitle: string;
  unitIndex: number;
  state: DpNodeState;
  videos: DpPathVideo[];
  lesson: {
    unitId: string;
    subjectId: string;
    title: string;
    locked: boolean;
    message: string;
    videos: Array<{ id: string; title: string; url: string }>;
  } | null;
};

export type DpNextStep = {
  unitId: string;
  unitTitle: string;
  nodeKey: string;
  nodeLabel: string;
  step: DpStepKey;
  stepLabel: string;
};

export type DpTopicPath = {
  topic: { id: string; name: string; description: string; icon: string; color: string };
  units: DpPathUnit[];
  completedUnits: number;
  totalUnits: number;
  next: DpNextStep | null;
};

export type DpPathResult = {
  unitId: string;
  unitTitle: string;
  step: DpStepKey;
  stepLabel: string;
  testOut: boolean;
  passed: boolean;
  scorePercent: number;
  passPercent: number;
  unitCompleted: boolean;
  unlockedUnit: { id: string; title: string; index: number } | null;
  topicCompleted: boolean;
  next: DpNextStep | null;
};

export type DpSession = {
  id: string;
  difficulty: DpDifficulty;
  total: number;
  questions: DpQuestion[];
  path?: {
    unitId: string;
    unitTitle: string;
    unitIndex: number;
    pathNodeKey?: string;
    pathNodeLabel?: string;
    step: DpStepKey;
    stepLabel: string;
    testOut: boolean;
    passPercent: number;
  };
};

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
  path?: DpPathResult | null;
  maxCombo?: number;
  durationSeconds?: number;
  firstToday?: boolean;
  week?: Array<{ day: string; label: string; played: boolean; today: boolean }>;
  /**
   * Phiên này không tính XP vì học viên free đã đạt giới hạn 60 XP/ngày.
   * Vẫn ghi nhận streak & tiến độ bài CŨ, nhưng không mở khóa bài MỚI.
   */
  xpDisabled?: boolean;
  /**
   * Học viên free đã hết XP ngày — kích thích mua gói.
   * Khi true: hiện banner chặn mở bài mới, CTA → trang mua gói.
   */
  xpCapReached?: boolean;
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
  path: () => call<{ topics: DpTopicPath[] }>('/path'),
  unitVideos: (unitId: string) => call<DpUnitVideos>(`/path/units/${encodeURIComponent(unitId)}/videos`),
  videoWatched: (unitId: string, videoId: string) => call<{ watched: boolean }>('/path/videos/watched', { unitId, videoId }),
  startPath: (unitId: string, step: DpStepKey, testOut = false, nodeKey = '') => call<DpSession>('/sessions', { mode: 'path', unitId, step, testOut, nodeKey }),
  answer: (sessionId: string, questionId: string, answer: DpAnswer) => call<DpAnswerResult>(`/sessions/${sessionId}/answer`, { questionId, answer }),
  hint: (sessionId: string, questionId: string) => call<{ hint: string; reveal: DpReveal }>(`/sessions/${sessionId}/hint`, { questionId }),
  finish: (sessionId: string) => call<DpSummary>(`/sessions/${sessionId}/finish`, {}),
  relatedTopics: (subjectId: string, unitId = '') => call<DpTopic[]>(
    `/related-topics?subjectId=${encodeURIComponent(subjectId)}${unitId ? `&unitId=${encodeURIComponent(unitId)}` : ''}`,
  ),
};

// ── Gói XP ───────────────────────────────────────────────────────────────────

export type DpPlanType = 'free' | '1m' | '3m' | '6m' | '12m' | 'lifetime';

/** Giới hạn XP/ngày theo từng gói (tất cả các gói mua đều là 300 XP mỗi ngày, gói Free là 60 XP). */
export const DP_PLAN_XP_CAP: Record<DpPlanType, number> = {
  free:     60,   // Miễn phí — 60 XP/ngày, chỉ ôn bài cũ khi hết
  '1m':     300,  // 1 tháng  — 300 XP/ngày, mở bài mới
  '3m':     300,  // 3 tháng  — 300 XP/ngày, mở bài mới
  '6m':     300,  // 6 tháng  — 300 XP/ngày, mở bài mới
  '12m':    300,  // 1 năm    — 300 XP/ngày, mở bài mới
  lifetime: 300,  // Vĩnh viễn — 300 XP/ngày, mở bài mới
};

export const DP_PLANS: Array<{
  id: DpPlanType;
  label: string;
  duration: string;
  priceText: string;
  xpPerDay: number;
  canUnlock: boolean;
  hint: string;
  badge?: string;
}> = [
  { id: 'free',     label: 'Miễn phí', duration: '',        priceText: '0đ',        xpPerDay: 60,  canUnlock: false, hint: 'Mồi nhử trải nghiệm' },
  { id: '1m',       label: '1 tháng',  duration: '1 tháng', priceText: '199.000đ',  xpPerDay: 300, canUnlock: true,  hint: 'Làm quen' },
  { id: '3m',       label: '3 tháng',  duration: '3 tháng', priceText: '399.000đ',  xpPerDay: 300, canUnlock: true,  hint: 'Phổ biến', badge: 'Nên chọn' },
  { id: '6m',       label: '6 tháng',  duration: '6 tháng', priceText: '599.000đ',  xpPerDay: 300, canUnlock: true,  hint: 'Học chắc' },
  { id: '12m',      label: '1 năm',    duration: '1 năm',   priceText: '999.000đ',  xpPerDay: 300, canUnlock: true,  hint: 'Tiết kiệm nhất' },
  { id: 'lifetime', label: 'Vĩnh viễn', duration: 'Vĩnh viễn', priceText: '1.500.000đ', xpPerDay: 300, canUnlock: true,  hint: 'Học mãi', badge: 'Tốt nhất' },
];

/** Học viên có gói trả phí (được mở khóa bài mới). */
export function dpIsPro(planType?: DpPlanType | string): boolean {
  return planType === '1m' || planType === '3m' || planType === '6m' || planType === '12m' || planType === 'lifetime'
    || planType === 'monthly' || planType === 'quarterly' || planType === 'biannual';
}

/** Học viên free đã hết XP ngày (không mở khóa bài mới được). */
export function dpXpCapReached(stats: DpStats): boolean {
  if (dpIsPro(stats.planType)) return false;
  return (stats.todayXp || 0) >= (stats.todayXpCap ?? DP_PLAN_XP_CAP.free);
}

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

const TYPE_CHIP = { soft: '#F1F5F9', color: '#475569' };

export function playQuestionHeaderChips(path: DpSession['path'], typeLabel: string, levelMeta: typeof DP_DIFFICULTIES[number]) {
  if (path) {
    const pathText = path.testOut
      ? `Chặng ${path.unitIndex} · Kiểm tra vượt`
      : [`Chặng ${path.unitIndex}`, path.pathNodeLabel, path.stepLabel].filter(Boolean).join(' · ');
    return [
      { id: 'path', text: pathText, soft: '#FEF2F2', color: '#B91C1C' },
      { id: 'type', text: typeLabel, ...TYPE_CHIP },
    ];
  }
  return [
    { id: 'level', text: levelMeta.label, soft: levelMeta.soft, color: levelMeta.color },
    { id: 'type', text: typeLabel, ...TYPE_CHIP },
  ];
}

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

/** Mỗi chặng lộ trình một màu (xoay vòng) — giống các "phần" của Duolingo; cùng bảng màu với web. */
export const DP_UNIT_COLORS: Array<{ from: string; to: string; soft: string }> = [
  { from: '#4ADE80', to: '#16A34A', soft: '#F0FDF4' },
  { from: '#60A5FA', to: '#2563EB', soft: '#EFF6FF' },
  { from: '#C084FC', to: '#9333EA', soft: '#FAF5FF' },
  { from: '#FB923C', to: '#EA580C', soft: '#FFF7ED' },
  { from: '#F472B6', to: '#DB2777', soft: '#FDF2F8' },
  { from: '#2DD4BF', to: '#0D9488', soft: '#F0FDFA' },
  { from: '#FBBF24', to: '#D97706', soft: '#FFFBEB' },
  { from: '#818CF8', to: '#4F46E5', soft: '#EEF2FF' },
];
export const unitColor = (index: number) => DP_UNIT_COLORS[(Math.max(1, Number(index) || 1) - 1) % DP_UNIT_COLORS.length];

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
