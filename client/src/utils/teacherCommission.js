/**
 * Lương cứng GV = baseSalaryPerSession × số buổi completed.
 * Thưởng sao tách riêng: ≥5 HV đạt 5★ trong tháng
 * → +customStarBonusAmount (mặc định 200.000đ)/tháng.
 * (Điểm TB uy tín vẫn cộng dồn toàn thời gian — không chặn thưởng.)
 */

export const STAR_BONUS_MIN_STUDENTS = 5;
export const STAR_BONUS_MIN_STARS = 5;
export const STAR_BONUS_AMOUNT = 200000;

export function formatHoaHong(amount) {
  const n = Number(amount) || 0;
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function formatStarBonusRule(bonus = {}) {
  const minHv = Number(bonus.minStudents) || STAR_BONUS_MIN_STUDENTS;
  const minStars = Number(bonus.minStars) || STAR_BONUS_MIN_STARS;
  const amt = Number(bonus.bonusPerMonth) || STAR_BONUS_AMOUNT;
  return `≥${minHv} HV đạt ${minStars}★ trong tháng › thưởng ${formatHoaHong(amt)}/tháng`;
}
