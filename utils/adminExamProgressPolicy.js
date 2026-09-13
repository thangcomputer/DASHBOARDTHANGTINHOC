'use strict';

function validateAdminExamProgress(examProgress) {
  if (!Array.isArray(examProgress)) return { ok: true };

  for (const entry of examProgress) {
    if (!entry || entry.essayScore === null || entry.essayScore === undefined) continue;

    const score = Number(entry.essayScore);
    const tnScore = Number(entry.tracNghiem?.score);
    const tnTotal = Number(entry.tracNghiem?.total);
    if (!Number.isFinite(score) || score < 0 || score > 10) {
      return { ok: false, status: 400, message: 'Điểm tự luận phải nằm trong khoảng 0 đến 10' };
    }
    if (entry.thucHanh !== 'da_nop') {
      return { ok: false, status: 409, message: 'Không thể chấm khi học viên chưa nộp file thực hành' };
    }
    if (!Number.isFinite(tnScore) || !Number.isFinite(tnTotal) || tnTotal <= 0 || tnScore / tnTotal < 0.5) {
      return { ok: false, status: 409, message: 'Không thể chấm tự luận khi trắc nghiệm chưa đạt' };
    }
    if (entry.status === 'dat' && score < 5) {
      return { ok: false, status: 409, message: 'Trạng thái ĐẠT yêu cầu điểm tự luận từ 5 trở lên' };
    }
    if (entry.status === 'khong_dat' && score >= 5) {
      return { ok: false, status: 409, message: 'Trạng thái RỚT không hợp lệ với điểm tự luận từ 5 trở lên' };
    }
  }

  return { ok: true };
}

module.exports = { validateAdminExamProgress };
