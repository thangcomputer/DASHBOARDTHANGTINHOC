/**
 * Câu chào động theo ngữ cảnh chuỗi học (streak) dùng chung cho Web và Mobile.
 * @param {{
 *   playedToday?: boolean,
 *   streak?: number,
 *   streakState?: 'new' | 'active' | 'at_risk' | 'lost' | string,
 *   missedDays?: number,
 *   lostStreak?: number,
 * } | null | undefined} stats
 * @param {{ mode?: 'free' | 'path' | 'goal' | string }} [options]
 * @returns {string}
 */
export function buildHeroStreakTagline(stats, { mode = 'free' } = {}) {
  const isFree = mode === 'free';
  if (!stats) {
    return isFree
      ? 'Cố gắng hoàn thành chuỗi học hôm nay để tích lũy XP nhé!'
      : 'Cố gắng hoàn thành chuỗi học hôm nay để chinh phục Tin học nhé!';
  }

  const playedToday = Boolean(stats.playedToday);
  const streak = Math.max(0, Number(stats.streak) || 0);
  const streakState = stats.streakState || (playedToday ? 'active' : streak > 0 ? 'at_risk' : 'new');
  const missedDays = Math.max(0, Number(stats.missedDays) || 0);
  const lostStreak = Math.max(0, Number(stats.lostStreak) || 0);

  if (playedToday) {
    if (streak >= 7 && streak % 7 === 0) {
      return `Xuất sắc! Bạn đã đạt chuỗi ${streak} ngày liên tiếp — giữ vững phong độ nhé!`;
    }
    if (streak > 0) {
      if (isFree) {
        const daysToSeven = 7 - (streak % 7);
        if (daysToSeven === 1) {
          return `Bạn đã hoàn thành chuỗi hôm nay (${streak} ngày)! Chỉ còn 1 ngày nữa đạt mốc 7 ngày (+100 XP).`;
        }
        return `Tuyệt vời! Bạn đã hoàn thành chuỗi hôm nay (${streak} ngày) — còn ${daysToSeven} ngày nữa nhận +100 XP.`;
      }
      return `Tuyệt vời! Bạn đã hoàn thành chuỗi hôm nay (${streak} ngày liên tiếp), tiếp tục bứt phá nhé!`;
    }
    return 'Tuyệt vời! Bạn đã hoàn thành lượt học hôm nay — tiếp tục tích lũy XP nhé!';
  }

  if (streakState === 'at_risk' && streak > 0) {
    if (isFree && (streak + 1) % 7 === 0) {
      return `Cố gắng hoàn thành chuỗi hôm nay để chạm mốc ${streak + 1} ngày liên tiếp và nhận ngay +100 XP!`;
    }
    return `Cố gắng hoàn thành chuỗi hôm nay để giữ vững ${streak} ngày liên tiếp nhé!`;
  }

  if (streakState === 'lost') {
    if (missedDays > 0 && lostStreak >= 2) {
      return `Bạn đã bỏ lỡ ${missedDays} ngày và đánh rơi chuỗi ${lostStreak} ngày — cố gắng hoàn thành chuỗi hôm nay để lấy lại phong độ nhé!`;
    }
    if (missedDays > 0) {
      return `Bạn đã bỏ lỡ ${missedDays} ngày rồi — cố gắng hoàn thành chuỗi hôm nay để lấy lại nhịp học nhé!`;
    }
    return 'Lâu rồi bạn chưa quay lại — cố gắng hoàn thành chuỗi học hôm nay nhé!';
  }

  if (isFree) {
    return 'Cố gắng hoàn thành chuỗi ngày đầu tiên hôm nay — duy trì 7 ngày liên tiếp để nhận +100 XP!';
  }
  return 'Cố gắng hoàn thành chuỗi học hôm nay để bắt đầu hành trình chinh phục Tin học nhé!';
}
