/**
 * Bộ chuẩn hóa dữ liệu & liên kết chia sẻ thành tích học tập (Web + Mobile).
 * Hiển thị thẻ kiểu Duolingo: huy hiệu · mascot · thông điệp · lưới 4 chỉ số · nút SHARE.
 */

export const DEFAULT_SHARE_URL = 'https://thangtinhoc.edu.vn';

const TONE_MAP = {
  award: { color: '#9333EA', bg: '#F3E8FF' },
  trophy: { color: '#D97706', bg: '#FEF3C7' },
  flame: { color: '#EA580C', bg: '#FFEDD5' },
  zap: { color: '#D97706', bg: '#FEF3C7' },
  clock: { color: '#0284C7', bg: '#E0F2FE' },
  check: { color: '#059669', bg: '#D1FAE5' },
  target: { color: '#0284C7', bg: '#E0F2FE' },
  star: { color: '#D97706', bg: '#FEF3C7' },
};

function makeStat(key, icon, value, label) {
  const tone = TONE_MAP[icon] || TONE_MAP.award;
  return {
    key,
    icon,
    color: tone.color,
    bg: tone.bg,
    value: String(value ?? '--'),
    label: String(label ?? ''),
  };
}

export function resolvePublicShareUrl(explicitUrl = '') {
  const raw = String(explicitUrl || '').trim();
  if (/^https?:\/\//i.test(raw) && !/localhost|127\.0\.0\.1/i.test(raw)) {
    return raw;
  }
  try {
    const origin = typeof globalThis !== 'undefined' ? globalThis.location?.origin : '';
    if (origin && /^https?:\/\//i.test(origin) && !/localhost|127\.0\.0\.1/i.test(origin)) {
      return raw && raw.startsWith('/') ? `${origin}${raw}` : origin;
    }
  } catch {
    /* ignore */
  }
  if (raw && raw.startsWith('/')) return `${DEFAULT_SHARE_URL}${raw}`;
  return DEFAULT_SHARE_URL;
}

export function formatShareDuration(seconds) {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total <= 0) return 'Hoàn tất';
  const rounded = Math.round(total);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatShareDateVi(dateValue) {
  try {
    const d = dateValue ? new Date(dateValue) : new Date();
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'Asia/Ho_Chi_Minh',
      });
    }
  } catch {
    /* ignore */
  }
  return 'Hôm nay';
}

function finalizePayload({
  topPrompt = 'Chia sẻ thành tích để lan tỏa cảm hứng học tập!',
  eyebrow = 'THÀNH TÍCH HỌC TẬP',
  heroLabel = 'HOÀN THÀNH',
  headline = 'Tôi vừa hoàn thành mục tiêu tại DewSkill!',
  mood = 'graduate',
  stats = [],
  shareUrl = '',
  shareHeading = 'Thành tích tại DewSkill · Thắng Tin Học',
  dateLabel = '',
}) {
  const cleanUrl = resolvePublicShareUrl(shareUrl);
  const statLine = stats
    .filter((s) => s && s.value && s.value !== '--')
    .slice(0, 4)
    .map((s) => `• ${s.value} ${s.label}`.trim())
    .join('\n');
  const shareText = `${headline}\n${statLine ? `\n${statLine}\n` : '\n'}Cùng học Tin học văn phòng & MOS tại DewSkill · Thắng Tin Học!\n${cleanUrl}\n#DewSkill #ThangTinHoc #TinHocVanPhong`;

  return {
    topPrompt,
    eyebrow,
    heroLabel,
    headline,
    mood,
    stats: stats.slice(0, 4),
    footerNote: `Thống kê DewSkill · Thắng Tin Học · ${dateLabel || formatShareDateVi()}`,
    shareTitle: shareHeading,
    shareText,
    shareUrl: cleanUrl,
  };
}

export function buildPracticeShareData(summary = {}, extra = {}) {
  const total = Math.max(1, Number(summary?.total) || 1);
  const correctCount = Math.max(0, Number(summary?.correctCount) || 0);
  const accuracy = typeof summary?.path?.scorePercent === 'number'
    ? summary.path.scorePercent
    : Math.round((correctCount / total) * 100);
  const isPerfect = Boolean(
    summary && (summary.total || 0) >= 2 && (summary.correctCount === summary.total || summary.maxCombo === summary.total),
  );
  const path = summary?.path || null;
  const isFullCourse = Boolean(path?.passed && path?.topicCompleted);
  const isUnitTrophy = Boolean(path?.passed && (path?.unitCompleted || path?.testOut));
  const netXp = Number(summary?.xpEarned ?? summary?.netXp ?? summary?.xpDelta ?? 0);
  const streak = Number(summary?.stats?.streak || 0);
  const maxCombo = Number(summary?.maxCombo || 0);
  const stars = Math.max(1, Math.min(3, Number(summary?.stars) || (accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1)));

  let eyebrow = 'LUYỆN TẬP DEWSKILL';
  let heroLabel = `${accuracy}%`;
  let headline = isPerfect
    ? 'Đạt 100% hoàn hảo tại DewSkill!'
    : `Hoàn thành lượt luyện tập đạt ${accuracy}%!`;
  let mood = 'celebrate';

  if (isFullCourse) {
    eyebrow = 'CÚP VÀNG KHÓA HỌC';
    heroLabel = 'CÚP VÀNG';
    headline = `Chinh phục trọn vẹn lộ trình ${extra.topicName || path?.unitTitle || 'DewSkill'}!`;
    mood = 'graduate';
  } else if (isUnitTrophy) {
    eyebrow = 'CHINH PHỤC CHẶNG';
    heroLabel = `${accuracy}% ★`;
    headline = `Vượt qua xuất sắc ${path?.unitTitle || 'chặng học DewSkill'}!`;
    mood = 'graduate';
  } else if (path?.stepLabel) {
    eyebrow = `MỨC ${String(path.stepLabel).toUpperCase()}`;
    heroLabel = `${stars}★ · ${accuracy}%`;
    headline = `Hoàn thành bước ${path.stepLabel} tại DewSkill!`;
  }

  return finalizePayload({
    eyebrow,
    heroLabel,
    headline,
    mood,
    stats: [
      makeStat('acc', 'award', `${accuracy}%`, 'độ chính xác'),
      makeStat(
        'streak',
        'flame',
        streak > 0 ? `${streak} ngày` : `${Math.max(maxCombo, correctCount)} câu`,
        streak > 0 ? 'chuỗi liên tiếp' : 'trả lời đúng',
      ),
      makeStat('xp', 'zap', netXp >= 0 ? `+${netXp} XP` : `${netXp} XP`, 'điểm kinh nghiệm'),
      makeStat(
        'time',
        summary?.durationSeconds ? 'clock' : 'check',
        summary?.durationSeconds ? formatShareDuration(summary.durationSeconds) : `${correctCount}/${total}`,
        summary?.durationSeconds ? 'thời gian học' : 'câu trả lời đúng',
      ),
    ],
    shareUrl: extra.shareUrl,
  });
}

export function buildChestShareData({ unitTitle = '', rewardXp = 50, shareUrl = '' } = {}) {
  const safeXp = Math.max(0, Number(rewardXp) || 50);
  const label = unitTitle ? `chặng "${unitTitle}"` : 'chặng học DewSkill';
  return finalizePayload({
    eyebrow: 'RƯƠNG THƯỞNG CHẶNG',
    heroLabel: `+${safeXp} XP`,
    headline: `Tôi vừa mở rương hoàn thành ${label}!`,
    mood: 'celebrate',
    stats: [
      makeStat('progress', 'check', '100%', 'hoàn thành chặng'),
      makeStat('xp', 'zap', `+${safeXp} XP`, 'thưởng mở rương'),
      makeStat('badge', 'trophy', 'Xuất sắc', 'danh hiệu đạt được'),
      makeStat('rank', 'star', 'Chặng xong', 'lộ trình DewSkill'),
    ],
    shareUrl,
  });
}

export function buildMilestoneShareData({
  nodeTitle = '',
  difficultyLabel = 'Dễ',
  sectionsDone = 0,
  sectionsTotal = 0,
  allThreeDone = false,
  shareUrl = '',
} = {}) {
  const cleanTitle = nodeTitle || 'bài học DewSkill';
  return finalizePayload({
    eyebrow: allThreeDone ? 'HOÀN THÀNH BÀI HỌC' : `XONG MỨC ${String(difficultyLabel || 'DỄ').toUpperCase()}`,
    heroLabel: allThreeDone ? '3/3 CẤP' : 'HOÀN TẤT',
    headline: allThreeDone
      ? `Tôi đã chinh phục cả 3 cấp độ bài "${cleanTitle}"!`
      : `Hoàn thành mức ${difficultyLabel} bài "${cleanTitle}"!`,
    mood: allThreeDone ? 'graduate' : 'celebrate',
    stats: [
      makeStat('level', 'award', allThreeDone ? '3/3 mức' : difficultyLabel, 'cấp độ đạt được'),
      makeStat('sec', 'check', sectionsTotal > 0 ? `${sectionsDone}/${sectionsTotal}` : '100%', 'phần hoàn thành'),
      makeStat('status', 'star', '100%', 'tiến độ bài học'),
      makeStat('track', 'trophy', 'DewSkill', 'lộ trình thực hành'),
    ],
    shareUrl,
  });
}

export function buildPlacementShareData(result = {}, extra = {}) {
  const total = Math.max(1, Number(result?.total) || 10);
  const score = Math.max(0, Number(result?.score) || 0);
  const pct = Math.round((score / total) * 100);
  const level = result?.recommendedLevel || result?.ai?.levelLabel || 'Sẵn sàng';
  return finalizePayload({
    eyebrow: 'ĐÁNH GIÁ NĂNG LỰC',
    heroLabel: `${score}/${total}`,
    headline: `Kết quả kiểm tra năng lực Tin học: ${level}!`,
    mood: 'graduate',
    stats: [
      makeStat('score', 'award', `${score}/${total} câu`, 'kết quả đúng'),
      makeStat('pct', 'target', `${pct}%`, 'độ chính xác'),
      makeStat('lvl', 'star', level, 'trình độ xếp loại'),
      makeStat('topic', 'trophy', result?.matchedTopicName || result?.recommendedSkill || 'Tin học', 'lộ trình ưu tiên'),
    ],
    shareUrl: extra.shareUrl,
  });
}

export function buildLessonPracticeShareData({ result = {}, unitTitle = '', courseTitle = '', shareUrl = '' } = {}) {
  const total = Math.max(1, Number(result?.total) || 1);
  const correct = Math.max(0, Number(result?.correct) || 0);
  const pct = Number.isFinite(Number(result?.percentage))
    ? Math.round(Number(result.percentage))
    : Math.round((correct / total) * 100);
  const bestStreak = Math.max(0, Number(result?.bestStreak) || 0);
  const targetTitle = unitTitle || courseTitle || 'bài luyện tập';
  return finalizePayload({
    eyebrow: 'BÀI TẬP THỰC HÀNH',
    heroLabel: `${pct}%`,
    headline: pct === 100
      ? `Hoàn hảo 100% bài "${targetTitle}"!`
      : `Đã hoàn thành bài luyện tập "${targetTitle}"!`,
    mood: pct >= 90 ? 'graduate' : 'celebrate',
    stats: [
      makeStat('correct', 'check', `${correct}/${total}`, 'số câu đúng'),
      makeStat('pct', 'award', `${pct}%`, 'độ chính xác'),
      makeStat('streak', 'flame', `${bestStreak} câu`, 'chuỗi đúng dài nhất'),
      makeStat('course', 'star', courseTitle || 'DewSkill', 'chủ đề học tập'),
    ],
    shareUrl,
  });
}

/**
 * @param {object} [params]
 * @param {string} [params.title]
 * @param {string} [params.kindLabel]
 * @param {number} [params.score]
 * @param {number} [params.scoreMax]
 * @param {number} [params.correctCount]
 * @param {number} [params.totalQuestions]
 * @param {boolean} [params.passed]
 * @param {number | null} [params.durationSeconds]
 * @param {number | null} [params.timeLimitMinutes]
 * @param {string} [params.shareUrl]
 */
export function buildExamShareData({
  title = '',
  kindLabel = 'KẾT QUẢ BÀI THI',
  score = 0,
  scoreMax = 100,
  correctCount = 0,
  totalQuestions = 0,
  passed = true,
  durationSeconds = /** @type {number | null} */ (null),
  timeLimitMinutes = /** @type {number | null} */ (null),
  shareUrl = '',
} = {}) {
  const cleanTitle = title || 'Bài kiểm tra kiến thức';
  const maxVal = Number(scoreMax) || 100;
  const heroScore = maxVal === 100 ? `${Math.round(Number(score) || 0)}%` : `${score}/${maxVal}`;
  const timeVal = durationSeconds
    ? formatShareDuration(durationSeconds)
    : (timeLimitMinutes ? `${timeLimitMinutes} phút` : 'Hoàn tất');

  return finalizePayload({
    eyebrow: kindLabel,
    heroLabel: heroScore,
    headline: passed
      ? `Tôi đã thi đạt "${cleanTitle}" tại Thắng Tin Học!`
      : `Tôi vừa hoàn thành bài thi "${cleanTitle}"!`,
    mood: passed ? 'graduate' : 'happy',
    stats: [
      makeStat('score', 'trophy', heroScore, 'điểm số đạt được'),
      makeStat('status', passed ? 'check' : 'target', passed ? 'Đạt chuẩn' : 'Hoàn thành', 'xếp loại kết quả'),
      makeStat(
        'questions',
        'award',
        totalQuestions > 0 ? `${correctCount}/${totalQuestions}` : heroScore,
        'câu trả lời đúng',
      ),
      makeStat('time', 'clock', timeVal, 'thời gian làm bài'),
    ],
    shareUrl,
  });
}

/**
 * @param {object} [params]
 * @param {string} [params.title]
 * @param {string} [params.scope]
 * @param {string} [params.studentName]
 * @param {number} [params.completionRate]
 * @param {number | null} [params.avgGrade]
 * @param {string} [params.certCode]
 * @param {string} [params.verifyUrl]
 */
export function buildCourseOrCertShareData({
  title = '',
  scope = 'course',
  studentName = '',
  completionRate = 100,
  avgGrade = /** @type {number | null} */ (null),
  certCode = '',
  verifyUrl = '',
} = {}) {
  const noun = scope === 'subject' ? 'môn học' : 'khóa học';
  const pct = Math.min(100, Math.max(0, Math.round(Number(completionRate) || 100)));
  const cleanTitle = title || `${noun} Thắng Tin Học`;
  const gradeLabel = avgGrade != null && Number(avgGrade) > 0 ? `${avgGrade}/10` : 'Đạt';

  return finalizePayload({
    eyebrow: certCode ? 'CHỨNG NHẬN HOÀN THÀNH' : `HOÀN THÀNH ${noun.toUpperCase()}`,
    heroLabel: certCode ? 'ĐÃ XÁC THỰC' : `${pct}%`,
    headline: studentName
      ? `${studentName} đã hoàn thành ${noun} "${cleanTitle}"!`
      : `Tôi đã hoàn thành ${noun} "${cleanTitle}" tại Thắng Tin Học!`,
    mood: 'graduate',
    stats: [
      makeStat('done', 'check', `${pct}%`, `tiến độ ${noun}`),
      makeStat('grade', 'trophy', gradeLabel, 'kết quả đánh giá'),
      makeStat('cert', 'award', certCode || 'DewSkill', certCode ? 'mã xác thực' : 'hệ thống học'),
      makeStat('academy', 'star', 'Thắng Tin Học', 'chứng nhận số'),
    ],
    shareUrl: verifyUrl || DEFAULT_SHARE_URL,
  });
}

export function buildPlatformShareUrls({ title = '', text = '', url = '' } = {}) {
  const cleanUrl = resolvePublicShareUrl(url);
  const cleanText = String(text || title || '').trim();
  const encUrl = encodeURIComponent(cleanUrl);
  const encText = encodeURIComponent(cleanText);
  const encSubject = encodeURIComponent(String(title || 'Thành tích học tập DewSkill'));
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}&quote=${encText}`,
    telegram: `https://t.me/share/url?url=${encUrl}&text=${encText}`,
    x: `https://twitter.com/intent/tweet?text=${encText}`,
    zaloWeb: 'https://chat.zalo.me/',
    email: `mailto:?subject=${encSubject}&body=${encText}`,
  };
}
