import {
  BookOpen, Code2, Cpu, FileText, Globe, Image, Keyboard, Mail, Monitor, Presentation, Sheet, ShieldCheck,
} from 'lucide-react';

/** Dùng chung cho trang học viên và trang admin luyện tập hằng ngày. */
export const TOPIC_ICONS = {
  book: BookOpen,
  monitor: Monitor,
  'file-text': FileText,
  sheet: Sheet,
  presentation: Presentation,
  globe: Globe,
  keyboard: Keyboard,
  shield: ShieldCheck,
  cpu: Cpu,
  mail: Mail,
  image: Image,
  code: Code2,
};

export const TOPIC_COLORS = {
  red: { from: '#F87171', to: '#B91C1C', soft: '#FEF2F2', text: '#B91C1C' },
  blue: { from: '#60A5FA', to: '#1D4ED8', soft: '#EFF6FF', text: '#1D4ED8' },
  green: { from: '#4ADE80', to: '#15803D', soft: '#F0FDF4', text: '#15803D' },
  orange: { from: '#FB923C', to: '#C2410C', soft: '#FFF7ED', text: '#C2410C' },
  purple: { from: '#C084FC', to: '#7E22CE', soft: '#FAF5FF', text: '#7E22CE' },
  teal: { from: '#2DD4BF', to: '#0F766E', soft: '#F0FDFA', text: '#0F766E' },
  pink: { from: '#F472B6', to: '#BE185D', soft: '#FDF2F8', text: '#BE185D' },
  amber: { from: '#FBBF24', to: '#B45309', soft: '#FFFBEB', text: '#B45309' },
  sky: { from: '#38BDF8', to: '#0369A1', soft: '#F0F9FF', text: '#0369A1' },
  slate: { from: '#94A3B8', to: '#334155', soft: '#F8FAFC', text: '#334155' },
};

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD) - khớp cách server tính chuỗi ngày. */
export function vnTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export const topicColor = (key) => TOPIC_COLORS[key] || TOPIC_COLORS.red;

/** Mỗi chặng lộ trình một màu (xoay vòng) - giống các "phần" của Duolingo. */
export const UNIT_COLORS = [
  { from: '#4ADE80', to: '#16A34A', soft: '#F0FDF4', text: '#15803D' },
  { from: '#60A5FA', to: '#2563EB', soft: '#EFF6FF', text: '#1D4ED8' },
  { from: '#C084FC', to: '#9333EA', soft: '#FAF5FF', text: '#7E22CE' },
  { from: '#FB923C', to: '#EA580C', soft: '#FFF7ED', text: '#C2410C' },
  { from: '#F472B6', to: '#DB2777', soft: '#FDF2F8', text: '#BE185D' },
  { from: '#2DD4BF', to: '#0D9488', soft: '#F0FDFA', text: '#0F766E' },
  { from: '#FBBF24', to: '#D97706', soft: '#FFFBEB', text: '#B45309' },
  { from: '#818CF8', to: '#4F46E5', soft: '#EEF2FF', text: '#4338CA' },
];
export const unitColor = (index) => UNIT_COLORS[(Math.max(1, Number(index) || 1) - 1) % UNIT_COLORS.length];
export const topicIcon = (key) => TOPIC_ICONS[key] || BookOpen;

export const DIFFICULTIES = [
  { id: 'easy', label: 'Dễ', stars: 1, color: '#10B981', soft: '#ECFDF5', xp: 10 },
  { id: 'medium', label: 'Vừa', stars: 2, color: '#F59E0B', soft: '#FFFBEB', xp: 15 },
  { id: 'hard', label: 'Khó', stars: 3, color: '#EF4444', soft: '#FEF2F2', xp: 20 },
];
export const difficultyMeta = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];
/** XP đặt cược mỗi lượt luyện (khớp backend). */
export const VIDEO_CHECK_ANSWER_XP = 5;
export const QUESTION_STAKE_XP = 5;
/** 10 câu × 5 XP/câu */
export const SESSION_STAKE_XP = 50;
/** Kiểm tra vượt: đạt được 40 XP, không đạt hoặc thoát mất 40 XP. */
export const TEST_OUT_XP = 40;
/** @deprecated dùng TEST_OUT_XP */
export const CHECKPOINT_FAIL_PENALTY = TEST_OUT_XP;

export const QUESTION_TYPES = {
  mcq: { label: 'Trắc nghiệm', instruction: 'Chọn đáp án đúng' },
  truefalse: { label: 'Đúng hay Sai', instruction: 'Phát biểu này đúng hay sai?' },
  order: { label: 'Sắp xếp', instruction: 'Kéo thả để sắp xếp đúng thứ tự' },
  match: { label: 'Ghép cặp', instruction: 'Kéo mỗi thẻ vào đúng ô bên trái' },
  fill: { label: 'Điền vào chỗ trống', instruction: 'Kéo từ vào đúng chỗ trống' },
  sort: { label: 'Phân loại', instruction: 'Kéo từng mục vào đúng nhóm' },
};

const TYPE_CHIP = { soft: '#F1F5F9', color: '#475569' };

/**
 * Nhãn ngữ cảnh trên thẻ câu - lộ trình gom Chặng + nút + nấc; loại câu riêng (không lặp «Vừa»).
 * @returns {{ id: string, text: string, soft?: string, color?: string }[]}
 */
export function playQuestionHeaderChips({ path, typeLabel, levelMeta }) {
  const level = levelMeta || DIFFICULTIES[0];
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
    { id: 'level', text: level.label, soft: level.soft, color: level.color },
    { id: 'type', text: typeLabel, ...TYPE_CHIP },
  ];
}

const PRAISE = ['Tuyệt vời!', 'Chính xác!', 'Giỏi quá!', 'Xuất sắc!', 'Quá đỉnh!', 'Làm tốt lắm!'];
const COMFORT = ['Chưa đúng rồi', 'Tiếc quá!', 'Gần đúng rồi đó', 'Không sao, thử câu tiếp nhé'];

export const randomPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
export const randomComfort = () => COMFORT[Math.floor(Math.random() * COMFORT.length)];

/** Lời nhắc theo trạng thái chuỗi - giọng thúc đẩy, tạo cảm giác "đừng để mất". */
export function reminderCopy(stats = {}, topicCount = 0) {
  const streak = stats.streak || 0;
  if (stats.streakState === 'lost' && stats.lostStreak > 0) {
    return {
      mood: 'sad',
      badge: 'Bạn đã lỡ chuỗi',
      title: `Bạn đã lỡ chuỗi 🔥 ${stats.lostStreak} ngày!`,
      text: `Đã ${stats.missedDays} ngày bạn chưa luyện tập. Đừng để công sức trôi đi - luyện tập ngay bây giờ để lấy lại phong độ, chỉ 5 phút thôi!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (stats.streakState === 'lost') {
    return {
      mood: 'offline',
      badge: 'Đừng bỏ cuộc',
      title: 'Lâu rồi bạn chưa luyện tập!',
      text: `Đã ${stats.missedDays} ngày rồi đó. Kiến thức sẽ quên dần nếu không ôn. Làm ngay 10 câu để lấy lại phong độ nhé!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (streak > 0) {
    return {
      mood: 'determined',
      badge: 'Chuỗi sắp mất',
      title: `Chuỗi 🔥 ${streak} ngày sắp mất!`,
      text: 'Hôm nay bạn chưa luyện tập. Chuỗi sẽ về 0 lúc nửa đêm. Làm ngay 10 câu để giữ lửa!',
      cta: 'Giữ chuỗi ngay',
    };
  }
  return {
    mood: 'energy',
    badge: 'Thử thách hôm nay',
    title: 'Luyện tập 5 phút mỗi ngày',
    text: `10 câu trắc nghiệm, kéo thả vui như trò chơi${topicCount ? ` với ${topicCount} chủ đề` : ''}. Bắt đầu chuỗi ngày đầu tiên nào!`,
    cta: 'Luyện tập ngay',
  };
}

export function resultMessage(stars) {
  if (stars >= 3) return { title: 'Hoàn hảo!', text: 'Bạn nắm chủ đề này rất chắc. Thử độ khó cao hơn nhé!' };
  if (stars === 2) return { title: 'Rất tốt!', text: 'Chỉ sai vài câu. Xem lại phần giải thích để nhớ lâu hơn.' };
  if (stars === 1) return { title: 'Cố lên!', text: 'Bạn đang tiến bộ. Ôn lại các câu sai rồi chơi lại nhé.' };
  return { title: 'Đừng nản nhé!', text: 'Ai cũng bắt đầu từ đây. Thử độ khó Dễ để làm quen trước.' };
}

/** Trong lượt có cược: ví đã trừ stake - hiển thị tổng (ví + đang cược) cho khớp màn ngoài. */
export function inPlayWalletXp(profileXp, stakeXp) {
  const wallet = Math.max(0, Number(profileXp) || 0);
  const stake = Math.max(0, Number(stakeXp) || 0);
  return stake > 0 ? wallet + stake : wallet;
}

/**
 * XP màn kết quả / celebration.
 * gainedXp là thay đổi ròng ví; đạt chỉ hoàn cược → hiển thị +reward và giải thích ví giữ nguyên.
 */
export function practiceFinishXpDisplay(summary) {
  if (!summary || summary.xpDisabled) {
    return { amount: 0, prefix: '', caption: 'Không tính XP', positive: true };
  }
  const gained = Number(summary.gainedXp) || 0;
  const reward = Math.max(0, Number(summary.xp) || 0);
  const stake = Math.max(0, Number(summary.stakeXp) || 0);
  const hintNote = summary.hintPenaltyXp ? ` (−${summary.hintPenaltyXp} gợi ý)` : '';

  if (!summary.passed) {
    return {
      amount: gained,
      prefix: gained < 0 ? '' : '+',
      caption: gained < 0
        ? `Ròng ${gained} XP · không đạt nên không nhận XP câu đúng`
        : (stake ? `Mất trắng −${stake} XP` : 'XP lượt này'),
      positive: false,
    };
  }
  if (gained > 0) {
    return {
      amount: gained,
      prefix: '+',
      caption: `Lời +${gained} XP${hintNote}`,
      positive: true,
    };
  }
  if (reward > 0) {
    return {
      amount: reward,
      prefix: '+',
      caption: `Hoàn ${reward} XP cược · ví giữ nguyên${hintNote}`,
      positive: true,
    };
  }
  return {
    amount: 0,
    prefix: '',
    caption: `Hoàn cược · ví giữ nguyên${hintNote}`,
    positive: true,
  };
}
