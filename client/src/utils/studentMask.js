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

export function formatNotificationStudentMask(text, students = [], isAdmin = false) {
  if (!text || typeof text !== 'string') return text || '';
  
  let formatted = text;

  // 0. Strip ⟦student_detail:ID:tab|NAME⟧ or [student_detail:ID:tab|NAME] tokens
  formatted = formatted.replace(
    /(?:⟦|\[)student_detail:[^|⟧\]]+\|([^⟧\]]+)(?:⟧|\])/g,
    (match, displayName) => {
      if (!displayName) return isAdmin ? '' : '***';
      if (isAdmin) return displayName.trim();
      
      // Mask tên: giữ 1 ký tự đầu + ***
      return displayName.trim()[0] + '***';
    }
  );

  // Bỏ qua masking thủ công nếu là admin (để admin thấy tên thật)
  if (isAdmin) {
    return formatted;
  }

  // 1. Replace exact student names if matched in students array
  if (Array.isArray(students) && students.length > 0) {
    students.forEach((s) => {
      if (s?.name && typeof s.name === 'string' && s.name.trim().length > 1) {
        const sName = s.name.trim();
        if (formatted.includes(sName)) {
          const masked = sName[0] + '***';
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
      return `Học viên ${nameMatch[0]}*** đã đánh giá`;
    }
  );

  return formatted;
}
