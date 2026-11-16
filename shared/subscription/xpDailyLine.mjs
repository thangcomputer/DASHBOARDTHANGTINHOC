/** Tiến độ đã dùng trong trần ngày (ví dụ quest 30/60). */
export function formatDailyXpProgressLine(earned, cap) {
  const limit = Math.max(1, Number(cap) || 60);
  const used = Math.max(0, Math.min(limit, Number(earned) || 0));
  return `${used}/${limit} XP`;
}

/** Ví luyện tập: đang có / trần refill ngày — khớp «đang có 52» trên popup luyện. */
export function formatDailyXpWalletLine(balance, cap) {
  const limit = Math.max(1, Number(cap) || 60);
  const current = Math.max(0, Number(balance) || 0);
  return `${current}/${limit} XP`;
}

/** Thẻ gói (sidebar, drawer): xpTotal / hạn XP chu kỳ của gói. */
export function resolveTodayXpSidebar(stats, subscription) {
  const cap = Math.max(
    1,
    Number(
      stats?.todayXpCap
      ?? stats?.dailyAllowanceXp
      ?? stats?.dailyRefillXp
      ?? subscription?.dailyXpLimit
      ?? 60,
    ) || 60,
  );
  const balance = Math.max(
    0,
    Number(stats?.xpTotal ?? stats?.dailyXp ?? 0) || 0,
  );
  return { balance, cap, line: formatDailyXpWalletLine(balance, cap) };
}

/** Đã hết XP luyện (0 XP hoặc dưới ngưỡng stake tối thiểu của 1 lượt). */
export function isDailyXpExhausted(stats) {
  if (!stats || typeof stats !== 'object') return false;
  const minNeed = Math.max(1, Number(stats.sessionStakeXp) || 50);
  const hasBalance = stats.xpTotal != null || stats.dailyXp != null;
  if (hasBalance) {
    const balance = Math.max(0, Number(stats.xpTotal ?? stats.dailyXp ?? 0) || 0);
    return balance <= 0 || balance < minNeed;
  }
  return Boolean(stats.xpEmpty);
}
