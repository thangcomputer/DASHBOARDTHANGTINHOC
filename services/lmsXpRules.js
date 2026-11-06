'use strict';

/** Số XP mặc định. Quản trị viên sửa được; thiếu khóa thì dùng số này. */
const DEFAULT_AMOUNTS = {
  theory: 10,
  video: 10,
  practice: 20,
  assignment: 15,
  exam80: 20,
  exam90: 30,
  exam100: 40,
  subject: 50,
  course: 200,
  streak3: 20,
  streak7: 50,
  streak14: 100,
  streak30: 300,
};

const DEFAULT_VIDEO_RATIO = 0.9;

const LEVELS = [
  { level: 1, xp: 0, title: 'Người mới' },
  { level: 2, xp: 100, title: 'Bắt đầu học' },
  { level: 3, xp: 250, title: 'Học viên chăm chỉ' },
  { level: 4, xp: 500, title: 'Người học tích cực' },
  { level: 5, xp: 1000, title: 'Cao thủ tin học' },
  { level: 6, xp: 2000, title: 'Chuyên gia thực hành' },
  { level: 7, xp: 3500, title: 'Bậc thầy tin học' },
  { level: 8, xp: 5000, title: 'Siêu cao thủ' },
  { level: 9, xp: 8000, title: 'Chuyên gia xuất sắc' },
  { level: 10, xp: 12000, title: 'Huyền thoại tin học' },
];

const STREAK_MILESTONES = [3, 7, 14, 30];
/** Hiện trên lịch, chưa thưởng XP. */
const STREAK_MARKS = [3, 7, 14, 30, 60, 100];

const ACTIVITY_REASONS = ['theory', 'video', 'practice', 'assignment', 'exam', 'subject', 'course'];

const REASON_LABELS = {
  welcome: 'Tặng XP chào mừng',
  theory: 'Xong phần lý thuyết',
  video: 'Xem video',
  practice: 'Xong bài thực hành',
  assignment: 'Nộp bài tập',
  exam: 'Bài kiểm tra',
  subject: 'Xong môn học',
  course: 'Xong khóa học',
  streak3: 'Chuỗi 3 ngày',
  streak7: 'Chuỗi 7 ngày',
  streak14: 'Chuỗi 14 ngày',
  streak30: 'Chuỗi 30 ngày',
};

const BADGES = [
  { key: 'first_step', title: 'Bước chân đầu tiên', description: 'Hoàn thành hoạt động học đầu tiên' },
  { key: 'lessons_10', title: 'Người chăm chỉ', description: 'Hoàn thành 10 hoạt động học' },
  { key: 'lessons_50', title: 'Học tập bền bỉ', description: 'Hoàn thành 50 hoạt động học' },
  { key: 'streak_7', title: 'Ngọn lửa đam mê', description: 'Học 7 ngày liên tiếp' },
  { key: 'streak_30', title: 'Kiên trì', description: 'Học 30 ngày liên tiếp' },
  { key: 'practice_20', title: 'Thực hành viên', description: 'Hoàn thành 20 bài thực hành' },
  { key: 'word', title: 'Chuyên gia Word', description: 'Hoàn thành khóa Word' },
  { key: 'excel', title: 'Chuyên gia Excel', description: 'Hoàn thành khóa Excel' },
  { key: 'powerpoint', title: 'Chuyên gia PowerPoint', description: 'Hoàn thành khóa PowerPoint' },
  { key: 'legend', title: 'Huyền thoại LMS', description: 'Đạt 5.000 XP học bài' },
];

const AMOUNT_KEYS = Object.keys(DEFAULT_AMOUNTS);

function levelFromXp(xpTotal) {
  const xp = Math.max(0, Number(xpTotal) || 0);
  let current = LEVELS[0];
  for (const row of LEVELS) {
    if (xp >= row.xp) current = row;
  }
  const next = LEVELS.find((row) => row.level === current.level + 1) || null;
  const span = next ? next.xp - current.xp : 0;
  return {
    xpTotal: xp,
    level: current.level,
    title: current.title,
    nextLevel: next ? next.level : null,
    nextTitle: next ? next.title : '',
    xpIntoLevel: next ? xp - current.xp : 0,
    xpForNextLevel: span,
    atMaxLevel: !next,
  };
}

function titleForLevel(level) {
  return LEVELS.find((row) => row.level === level)?.title || '';
}

function examBandXp(percent, amounts = DEFAULT_AMOUNTS) {
  const pct = Number(percent) || 0;
  if (pct >= 100) return amounts.exam100 || 0;
  if (pct >= 90) return amounts.exam90 || 0;
  if (pct >= 80) return amounts.exam80 || 0;
  return 0;
}

/** Chỉ cộng phần chênh so với mốc đã nhận, không cộng chồng 20+30+40. */
function examUpgradeXp(percent, alreadyXp, amounts = DEFAULT_AMOUNTS) {
  return Math.max(0, examBandXp(percent, amounts) - Math.max(0, Number(alreadyXp) || 0));
}

function streakProgress(profile, today, previousDay) {
  const last = profile?.lastStudyDay || '';
  if (last === today) {
    return {
      streak: Math.max(1, profile?.streak || 1),
      streakStartedOn: profile?.streakStartedOn || today,
    };
  }
  if (last && last === previousDay) {
    return {
      streak: (profile?.streak || 0) + 1,
      streakStartedOn: profile?.streakStartedOn || last,
    };
  }
  return { streak: 1, streakStartedOn: today };
}

function sanitizeAmounts(input) {
  const amounts = { ...DEFAULT_AMOUNTS };
  for (const key of AMOUNT_KEYS) {
    const value = Number(input?.[key]);
    if (Number.isFinite(value)) amounts[key] = Math.max(0, Math.min(10000, Math.floor(value)));
  }
  return amounts;
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || 'Hoạt động học';
}

function badgeCatalog(overrides = {}) {
  return BADGES.map((badge) => {
    const over = overrides?.[badge.key] || {};
    const title = String(over.title || badge.title).trim().slice(0, 80);
    const description = String(over.description || badge.description).trim().slice(0, 160);
    return {
      key: badge.key,
      title: title || badge.title,
      description: description || badge.description,
      enabled: over.enabled !== false,
    };
  });
}

function sanitizeBadges(input = {}) {
  const saved = {};
  for (const badge of BADGES) {
    const over = input?.[badge.key];
    if (!over || typeof over !== 'object') continue;
    saved[badge.key] = {
      title: String(over.title || badge.title).trim().slice(0, 80),
      description: String(over.description || badge.description).trim().slice(0, 160),
      enabled: over.enabled !== false,
    };
  }
  return saved;
}

function courseBadgeEarned(key, names) {
  const list = (names || []).map((name) => String(name || '').toLowerCase());
  if (key === 'word') return list.some((name) => name.includes('word'));
  if (key === 'excel') return list.some((name) => name.includes('excel'));
  if (key === 'powerpoint') return list.some((name) => name.includes('powerpoint') || name.includes('power point'));
  return false;
}

function badgeEarned(key, stats) {
  const activities = Number(stats?.activities) || 0;
  const practice = Number(stats?.practice) || 0;
  const bestStreak = Number(stats?.bestStreak) || 0;
  const xpTotal = Number(stats?.xpTotal) || 0;
  if (key === 'first_step') return activities >= 1;
  if (key === 'lessons_10') return activities >= 10;
  if (key === 'lessons_50') return activities >= 50;
  if (key === 'streak_7') return bestStreak >= 7;
  if (key === 'streak_30') return bestStreak >= 30;
  if (key === 'practice_20') return practice >= 20;
  if (key === 'legend') return xpTotal >= 5000;
  return courseBadgeEarned(key, stats?.courseNames);
}

function weekBounds(dayKey) {
  const [year, month, day] = String(dayKey || '').split('-').map(Number);
  if (!year || !month || !day) return { start: '', end: '' };
  const utc = new Date(Date.UTC(year, month - 1, day));
  const dow = utc.getUTCDay();
  const fromMonday = dow === 0 ? 6 : dow - 1;
  const startDate = new Date(Date.UTC(year, month - 1, day - fromMonday));
  const endDate = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  const key = (date) => date.toISOString().slice(0, 10);
  return { start: key(startDate), end: key(endDate) };
}

function monthKeyOf(dayKey) {
  return String(dayKey || '').slice(0, 7);
}

function monthCells(monthKey, studyDays, today) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return [];
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const pad = firstDow === 0 ? 6 : firstDow - 1;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const done = new Set(studyDays || []);
  const cells = Array.from({ length: pad }, () => null);
  for (let day = 1; day <= count; day += 1) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, key, studied: done.has(key), today: key === today });
  }
  return cells;
}

function sanitizeVideoRatio(value) {
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) return DEFAULT_VIDEO_RATIO;
  return Math.max(0.5, Math.min(1, Math.round(ratio * 100) / 100));
}

module.exports = {
  DEFAULT_AMOUNTS,
  DEFAULT_VIDEO_RATIO,
  LEVELS,
  STREAK_MILESTONES,
  STREAK_MARKS,
  ACTIVITY_REASONS,
  BADGES,
  reasonLabel,
  badgeCatalog,
  sanitizeBadges,
  badgeEarned,
  weekBounds,
  monthKeyOf,
  monthCells,
  AMOUNT_KEYS,
  levelFromXp,
  titleForLevel,
  examBandXp,
  examUpgradeXp,
  streakProgress,
  sanitizeAmounts,
  sanitizeVideoRatio,
};
