/**
 * Lời động viên khi trả lời sai (web + mobile, đồng bộ).
 * wrongTryCount: số lần sai liên tiếp trên cùng câu (API trả về).
 */
export function resolveWrongEncouragement(wrongTryCount = 0) {
  if (wrongTryCount >= 4) {
    return 'Ôn lại phần kiến thức liên quan rồi quay lại. Mỗi lần thử bạn tiến thêm một bước.';
  }
  if (wrongTryCount >= 3) {
    return 'Hãy bấm Gợi ý bên dưới để xem manh mối, rồi thử lại nhé!';
  }
  if (wrongTryCount === 2) {
    return 'Cố lên! Đọc kỹ đề một lần nữa và thử tiếp. Mình tin bạn làm được!';
  }
  if (wrongTryCount >= 1) {
    return 'Đừng nản, thử lại nhé!';
  }
  return 'Đừng nản. Đọc lại đề và thử lại nhé!';
}

/** Từ lần sai thứ 3 trở đi gợi ý dùng nút Gợi ý (không nhấn Giải thích). */
export function shouldNudgeHintButton(wrongTryCount = 0, hintAlreadyUsed = false) {
  return wrongTryCount >= 3 && !hintAlreadyUsed;
}
