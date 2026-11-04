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

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD) — khớp cách server tính chuỗi ngày. */
export function vnTodayKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}

export const topicColor = (key) => TOPIC_COLORS[key] || TOPIC_COLORS.red;
export const topicIcon = (key) => TOPIC_ICONS[key] || BookOpen;

export const DIFFICULTIES = [
  { id: 'easy', label: 'Dễ', stars: 1, color: '#10B981', soft: '#ECFDF5', xp: 10 },
  { id: 'medium', label: 'Vừa', stars: 2, color: '#F59E0B', soft: '#FFFBEB', xp: 15 },
  { id: 'hard', label: 'Khó', stars: 3, color: '#EF4444', soft: '#FEF2F2', xp: 20 },
];
export const difficultyMeta = (id) => DIFFICULTIES.find((d) => d.id === id) || DIFFICULTIES[0];

export const QUESTION_TYPES = {
  mcq: { label: 'Trắc nghiệm', instruction: 'Chọn đáp án đúng' },
  truefalse: { label: 'Đúng hay Sai', instruction: 'Phát biểu này đúng hay sai?' },
  order: { label: 'Sắp xếp', instruction: 'Kéo thả để sắp xếp đúng thứ tự' },
  match: { label: 'Ghép cặp', instruction: 'Kéo mỗi thẻ vào đúng ô bên trái' },
  fill: { label: 'Điền vào chỗ trống', instruction: 'Kéo từ vào đúng chỗ trống' },
  sort: { label: 'Phân loại', instruction: 'Kéo từng mục vào đúng nhóm' },
};

const PRAISE = ['Tuyệt vời!', 'Chính xác!', 'Giỏi quá!', 'Xuất sắc!', 'Quá đỉnh!', 'Làm tốt lắm!'];
const COMFORT = ['Chưa đúng rồi', 'Tiếc quá!', 'Gần đúng rồi đó', 'Không sao, thử câu tiếp nhé'];

export const randomPraise = () => PRAISE[Math.floor(Math.random() * PRAISE.length)];
export const randomComfort = () => COMFORT[Math.floor(Math.random() * COMFORT.length)];

/** Lời nhắc theo trạng thái chuỗi — giọng thúc đẩy, tạo cảm giác "đừng để mất". */
export function reminderCopy(stats = {}, topicCount = 0) {
  const streak = stats.streak || 0;
  if (stats.streakState === 'lost' && stats.lostStreak > 0) {
    return {
      mood: 'sad',
      badge: 'Bạn đã lỡ chuỗi',
      title: `Bạn đã lỡ chuỗi 🔥 ${stats.lostStreak} ngày!`,
      text: `Đã ${stats.missedDays} ngày bạn chưa luyện tập. Đừng để công sức trôi đi — luyện tập ngay bây giờ để lấy lại phong độ, chỉ 5 phút thôi!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (stats.streakState === 'lost') {
    return {
      mood: 'sad',
      badge: 'Đừng bỏ cuộc',
      title: 'Lâu rồi bạn chưa luyện tập!',
      text: `Đã ${stats.missedDays} ngày rồi đó. Kiến thức sẽ quên dần nếu không ôn — làm ngay 10 câu để lấy lại phong độ nhé!`,
      cta: 'Lấy lại phong độ ngay',
    };
  }
  if (streak > 0) {
    return {
      mood: 'thinking',
      badge: 'Chuỗi sắp mất',
      title: `Chuỗi 🔥 ${streak} ngày sắp mất!`,
      text: 'Hôm nay bạn chưa luyện tập — chuỗi sẽ về 0 lúc nửa đêm. Làm ngay 10 câu để giữ lửa!',
      cta: 'Giữ chuỗi ngay',
    };
  }
  return {
    mood: 'happy',
    badge: 'Thử thách hôm nay',
    title: 'Luyện tập 5 phút mỗi ngày',
    text: `10 câu trắc nghiệm, kéo thả vui như trò chơi${topicCount ? ` với ${topicCount} chủ đề` : ''}. Bắt đầu chuỗi ngày đầu tiên nào!`,
    cta: 'Luyện tập ngay',
  };
}

export function resultMessage(stars) {
  if (stars >= 3) return { title: 'Hoàn hảo!', text: 'Bạn nắm chủ đề này rất chắc. Thử độ khó cao hơn nhé!' };
  if (stars === 2) return { title: 'Rất tốt!', text: 'Chỉ sai vài câu — xem lại phần giải thích để nhớ lâu hơn.' };
  if (stars === 1) return { title: 'Cố lên!', text: 'Bạn đang tiến bộ. Ôn lại các câu sai rồi chơi lại nhé.' };
  return { title: 'Đừng nản nhé!', text: 'Ai cũng bắt đầu từ đây. Thử độ khó Dễ để làm quen trước.' };
}
