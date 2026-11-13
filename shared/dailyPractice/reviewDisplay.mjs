/** Bỏ "Đáp án đúng: …" trùng với dòng đáp án đã hiển thị (API hay gửi cả hai). */
export function normalizeExplanationBody(explanation, answerText) {
  const raw = String(explanation || '').trim();
  const ans = String(answerText || '').trim();
  if (!raw) return '';

  const stripPrefix = (text) => text.replace(/^đáp án đúng\s*[:：]\s*/i, '').replace(/\.+\s*$/, '').trim();

  let body = raw;
  if (ans) {
    const exactPrefix = new RegExp(`^đáp án đúng\\s*[:：]\\s*${ans.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\.?`, 'i');
    body = body.replace(exactPrefix, '').trim();
    if (!body && raw.toLowerCase().includes(ans.toLowerCase()) && /^đáp án đúng/i.test(raw)) return '';
  }
  if (!body && /^đáp án đúng/i.test(raw)) {
    const inner = stripPrefix(raw);
    if (!ans || inner.toLowerCase() === ans.toLowerCase()) return '';
    return inner;
  }
  if (/^đáp án đúng/i.test(body)) {
    const inner = stripPrefix(body);
    if (ans && inner.toLowerCase() === ans.toLowerCase()) return '';
    body = inner;
  }
  if (ans && body.toLowerCase() === ans.toLowerCase()) return '';
  return body;
}

/** Một dòng phụ cho thẻ xem lại: chỉ giải thích thêm, không lặp đáp án. */
export function reviewItemFollowUpLine(item) {
  const answerText = String(item?.correctAnswer?.text || '').trim();
  return normalizeExplanationBody(item?.explanation, answerText);
}
