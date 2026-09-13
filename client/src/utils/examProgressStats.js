export function getExamProgressDisplayStatus(entry) {
  const status = String(entry?.status || '');
  const score = Number(entry?.tracNghiem?.score ?? entry?.score);
  const total = Number(entry?.tracNghiem?.total ?? entry?.total);
  const tnPassed = Number.isFinite(score) && Number.isFinite(total) && total > 0 && score / total >= 0.5;

  if (status === 'dang_thi' && tnPassed && entry?.thucHanh !== 'da_nop') return 'cho_nop';
  if (status === 'dang_thi' && tnPassed && entry?.thucHanh === 'da_nop'
    && (entry?.essayScore === null || entry?.essayScore === undefined)) return 'cho_cham';
  if (status === 'dang_thi') return 'dang_thi';
  if (status === 'khong_dat') return 'khong_dat';
  if (!tnPassed) return 'khong_dat';
  if (entry?.thucHanh !== 'da_nop') return status;
  if (entry?.essayScore === null || entry?.essayScore === undefined) return 'cho_cham';
  return Number(entry.essayScore) >= 5 ? 'dat' : 'khong_dat';
}

export function summarizeExamProgress(students = []) {
  const summary = {
    total: 0,
    dat: 0,
    choNop: 0,
    choCham: 0,
    dangThi: 0,
    khongDat: 0,
  };

  for (const student of Array.isArray(students) ? students : []) {
    for (const entry of Array.isArray(student?.examProgress) ? student.examProgress : []) {
      if (!entry?.status || entry.status === 'chua_thi') continue;
      summary.total += 1;
      const displayStatus = getExamProgressDisplayStatus(entry);
      if (displayStatus === 'dat') summary.dat += 1;
      else if (displayStatus === 'cho_nop') summary.choNop += 1;
      else if (displayStatus === 'cho_cham') summary.choCham += 1;
      else if (displayStatus === 'dang_thi') summary.dangThi += 1;
      else if (displayStatus === 'khong_dat') summary.khongDat += 1;
    }
  }

  return summary;
}
