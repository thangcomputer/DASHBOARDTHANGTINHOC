'use strict';

/** Cụm từ xin gặp người thật — dùng chung server/client (giữ đồng bộ với client/src/utils/aiSupport.js). */
const HUMAN_HANDOFF_RE = /(hỗ trợ trực tiếp|gặp\s*(nhân\s*viên|support|hỗ trợ|chuyên\s*viên|tư vấn|người(\s*thật)?)|nói chuyện với\s*(người thật|nhân viên|tư vấn)|người thật|tư vấn viên|(cần|muốn|xin)\s*(hỗ trợ trực tiếp|gặp\s*(nhân viên|người|support)|người thật)|muốn gặp support|ai không giải quyết|chuyển\s*(nhân\s*viên|support|hỗ trợ)|không\s*hài\s*lòng|liên\s*hệ\s*(nhân\s*viên|support|tư vấn)|chat với nhân viên|gọi nhân viên)/i;

function wantsHumanEscalation(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  return HUMAN_HANDOFF_RE.test(t);
}

/** Gemini hay bịa nút "Gặp nhân viên" — không được đưa tin này cho học viên. */
function isHumanHandoffButtonHallucination(text) {
  const t = String(text || '');
  return /(biểu tượng hỗ trợ trực tiếp|(nhấn|bấm|chọn|ấn)\s*nút.{0,48}(gặp nhân viên|cần nhân viên|hỗ trợ trực tiếp)|nút\s*["“']?(gặp nhân viên|cần nhân viên)|(gặp nhân viên|cần nhân viên hỗ trợ).{0,80}(khung chat|phía dưới))/i.test(t);
}

module.exports = {
  HUMAN_HANDOFF_RE,
  wantsHumanEscalation,
  isHumanHandoffButtonHallucination,
};
