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

/** ISO / YYYY-MM-DD trong nội dung thông báo → dd/MM/yyyy (tin cũ + tin mới). */
export function formatNotificationDatesInText(text) {
  if (!text || typeof text !== 'string') return text || '';
  return text.replace(
    /\b(\d{4}-\d{2}-\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?\b/g,
    (full, ymd) => {
      if (/T/.test(full)) {
        const d = new Date(full);
        if (!Number.isNaN(d.getTime())) {
          return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        }
      }
      return `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
    },
  );
}

export function formatNotificationStudentMask(text, students = [], isAdmin = false) {
  if (!text || typeof text !== 'string') return text || '';
  
  let formatted = formatNotificationDatesInText(text);

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

  // 3. Heal old backend hardcoded masks (e.g. P***N -> P***)
  formatted = formatted.replace(/([A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸửữựỳỵỷỹ])\*{2,}[A-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸửữựỳỵỷỹ0-9]?/gi, '$1***');

  return formatted;
}
