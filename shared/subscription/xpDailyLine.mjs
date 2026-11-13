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

/** Thẻ gói miễn phí (sidebar, drawer): xpTotal / hạn XP ngày của gói. */
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
