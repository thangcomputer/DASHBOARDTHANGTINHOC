/**
 * Dialog thay cho window.alert / window.confirm (dùng ModalProvider → cms-sheet).
 * Không fallback native confirm để tránh hộp thoại trình duyệt.
 */

export async function cmsConfirmAction(content, options = {}) {
  if (typeof window === 'undefined') return false;
  if (typeof window.cmsConfirmAdvanced === 'function') {
    return window.cmsConfirmAdvanced({
      title: options.title || 'Xác nhận',
      type: options.type || 'warning',
      cancelText: options.cancelText ?? 'Hủy',
      confirmText: options.confirmText || 'Chắc chắn',
      confirmButtonClass: options.confirmButtonClass,
      content,
    });
  }
  if (typeof window.cmsConfirm === 'function') {
    return window.cmsConfirm(content);
  }
  return false;
}

export async function cmsAlertMessage(content, type = 'info') {
  if (typeof window === 'undefined') return;
  if (typeof window.cmsAlert === 'function') {
    await window.cmsAlert(content, type);
    return;
  }
  if (typeof window.cmsConfirmAdvanced === 'function') {
    await window.cmsConfirmAdvanced({
      title: type === 'error' ? 'Lỗi' : 'Thông báo',
      content,
      type: type === 'error' ? 'error' : 'info',
      cancelText: null,
      confirmText: 'Đã hiểu',
    });
  }
}

export async function cmsPromptInput({
  title = 'Nhập thông tin',
  label = '',
  placeholder = '',
  defaultValue = '',
  confirmText = 'Xác nhận',
} = {}) {
  if (typeof window === 'undefined') return null;
  if (typeof window.cmsPrompt === 'function') {
    return window.cmsPrompt({ title, label, placeholder, defaultValue, confirmText });
  }
  return null;
}