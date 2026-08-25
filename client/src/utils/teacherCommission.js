/**
 * Lương cứng GV = baseSalaryPerSession × số buổi completed.
 * Thưởng sao tách riêng: ≥15 HV/tháng + ≥5★ (cộng dồn từ đánh giá HV)
 * → +customStarBonusAmount (mặc định 200.000đ)/tháng.
 */

export const STAR_BONUS_MIN_STUDENTS = 15;
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
  return `≥${minHv} HV/tháng và ≥${minStars}★ → thưởng ${formatHoaHong(amt)}/tháng`;
}
