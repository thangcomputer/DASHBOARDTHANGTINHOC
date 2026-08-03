/**
 * Utility to mask student names into phone number format (e.g. 091122****) for privacy in notifications and ratings.
 */
export function maskStudentPhone(phone) {
  if (!phone) return '09****';
  const clean = String(phone).trim().replace(/\s+/g, '');
  if (clean.length >= 7) {
    return clean.slice(0, -4) + '****';
  }
  if (clean.length >= 4) {
    return clean.slice(0, -2) + '****';
  }
  return clean + '****';
}

export function formatNotificationStudentMask(text, students = []) {
  if (!text || typeof text !== 'string') return text || '';
  
  let formatted = text;

  // 1. Replace exact student names if matched in students array
  if (Array.isArray(students) && students.length > 0) {
    students.forEach((s) => {
      if (s?.name && typeof s.name === 'string' && s.name.trim().length > 1) {
        const sName = s.name.trim();
        if (formatted.includes(sName)) {
          const masked = maskStudentPhone(s.phone || s.zalo);
          formatted = formatted.split(sName).join(masked);
        }
      }
    });
  }

  // 2. Generic fallback for notification patterns like "Học viên <NAME> đã đánh giá..."
  formatted = formatted.replace(
    /Học viên\s+([A-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầnẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ_-]+?)\s+đã đánh giá/gi,
    (match, nameMatch) => {
      if (/^\d{3,}/.test(nameMatch) || nameMatch.includes('*')) {
        return match;
      }
      return `Học viên 09**** đã đánh giá`;
    }
  );

  return formatted;
}
