/**
 * Chrome đầu câu khi chơi — web + mobile dùng chung số đo / copy.
 * Giọng LMS gọn: không badge đỏ HOA, không gradient mascot, icon nét thường.
 */
export const PLAY_QUESTION_CHROME = {
  label: 'Câu hỏi',
  mascotSize: { web: 44, mobile: 40 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  typeChip: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  prompt: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '500',
    color: '#334155',
  },
  hintButton: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  hintRevealBox: {
    fontSize: 14,
    fontWeight: '500',
    color: '#334155',
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  mascotWrap: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  icon: {
    strokeWidth: 2,
    hintSize: 16,
    primaryActionSize: 17,
  },
  /** Icon trạng thái đúng/sai trên banner (nét mảnh, không chữ X trắng trên nền đỏ). */
  feedbackStatus: {
    strokeWidth: 2,
    wrong: {
      size: 14,
      color: '#DC2626',
      backgroundColor: '#FFFFFF',
      borderColor: '#FECACA',
    },
    correct: {
      size: 15,
      color: '#059669',
      backgroundColor: '#FFFFFF',
      borderColor: '#A7F3D0',
    },
  },
};
