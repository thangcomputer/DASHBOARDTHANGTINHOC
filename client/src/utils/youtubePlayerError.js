export const describeYouTubePlayerError = (errorCode) => {
  const code = Number(errorCode);

  switch (code) {
    case 2:
      return 'YouTube báo mã lỗi 2: mã video hoặc tham số không hợp lệ. Kiểm tra lại link video.';
    case 5:
      return 'YouTube báo mã lỗi 5: trình phát HTML5 không phát được video. Thử tải lại trang hoặc mở video trên YouTube.';
    case 100:
      return 'YouTube báo mã lỗi 100: video không tồn tại, đã bị xóa, đặt riêng tư hoặc tài khoản hiện tại không có quyền xem.';
    case 101:
    case 150:
      return `YouTube báo mã lỗi ${code}: chủ video không cho phép nhúng video trên website khác.`;
    case 153:
      return 'YouTube báo mã lỗi 153: yêu cầu nhúng thiếu HTTP Referer hoặc thông tin nhận diện ứng dụng. Kiểm tra Referrer-Policy trên website, proxy hoặc CDN.';
    default:
      return `YouTube không phát được video (mã lỗi ${Number.isFinite(code) ? code : 'không xác định'}). Kiểm tra quyền xem và quyền nhúng video.`;
  }
};
