/**
 * Nội dung hướng dẫn LMS ngắn gọn — HV & GV.
 */

export const STUDENT_GUIDE_STEPS = [
  {
    key: 'welcome',
    title: 'Chào mừng đến LMS',
    body: 'Đây là khu vực học tập của bạn. Menu bên trái giúp chuyển nhanh giữa các mục. Bấm Trợ giúp bất kỳ lúc nào để xem lại hướng dẫn.',
  },
  {
    key: 'dashboard',
    title: 'Tổng quan',
    body: 'Xem tiến độ học, lịch sắp tới và thông báo quan trọng trong ngày. Đây là trang bắt đầu mỗi khi đăng nhập.',
  },
  {
    key: 'exam',
    title: 'Phòng thi',
    body: 'Vào đây để thi / kiểm tra khi được mở khóa sau khi hoàn thành số buổi tương ứng.',
  },
  {
    key: 'schedule',
    title: 'Lịch học',
    body: 'Xem lịch học, link học (nếu có) và trạng thái buổi học. Đến đúng giờ để không bỏ lỡ buổi.',
  },
  {
    key: 'materials',
    title: 'Tài liệu',
    body: 'Xem video, file bài giảng và tài liệu khóa học. Học theo thứ tự để tránh loạn kiến thức.',
  },
  {
    key: 'inbox',
    title: 'Hộp thư',
    body: 'Nhắn tin với giáo viên / trung tâm. Gửi tin ngắn gọn, kèm ảnh nếu cần.',
  },
  {
    key: 'feed',
    title: 'Bảng tin',
    body: 'Dùng để đăng bài hỏi bài và trao đổi trong lớp. Bạn có thể: đăng bài, thả cảm xúc (Tim/Like/Haha/Wow/Buồn), bình luận kèm ảnh và bấm “Trả lời” để phản hồi comment.',
  },
  {
    key: 'evaluation',
    title: 'Đánh giá',
    body: 'Đánh giá cho trung tâm về chất lượng dạy học của giảng viên / Đánh giá giảng viên.',
  },
  {
    key: 'profile',
    title: 'Hồ sơ',
    body: 'Cập nhật thông tin cá nhân, đổi mật khẩu. Lưu số điện thoại đúng để đăng nhập.',
  },
];

export const TEACHER_GUIDE_STEPS = [
  {
    key: 'welcome',
    title: 'Chào mừng Giảng viên',
    body: 'Đây là bảng điều khiển dạy học. Menu trái để chuyển mục. Bấm Trợ giúp để xem lại từng chức năng.',
  },
  {
    key: 'dashboard',
    title: 'Tổng quan',
    body: 'Xem lịch dạy gần nhất, số học viên và việc cần xử lý trong ngày.',
  },
  {
    key: 'students',
    title: 'Quản lý học viên',
    body: 'Xem danh sách HV được phân công, cập nhật link học, điểm danh / đánh giá theo từng học viên.',
  },
  {
    key: 'schedule',
    title: 'Lịch dạy',
    body: 'Tạo và quản lý lịch. Đặt giờ bắt đầu / kết thúc, thêm link học online nếu cần.',
  },
  {
    key: 'test',
    title: 'Bài Test',
    body: 'Làm bài test / xem trạng thái khi chưa được cấp quyền dạy. Sau khi Active, mục này có thể ẩn.',
  },
  {
    key: 'training',
    title: 'Đào tạo',
    body: 'Học tài liệu nội bộ, xem video hướng dẫn giảng dạy từ trung tâm.',
  },
  {
    key: 'finance',
    title: 'Tài chính',
    body: 'Xem lương / thanh toán. Cập nhật thông tin ngân hàng trong Hồ sơ để nhận tiền đúng.',
  },
  {
    key: 'inbox',
    title: 'Hộp thư',
    body: 'Nhắn tin với học viên và admin. Trả lời nhanh để HV không chờ lâu.',
  },
  {
    key: 'feed',
    title: 'Bảng tin',
    body: 'Dùng để trao đổi/hỏi đáp với học viên. Bạn có thể đăng bài, thả cảm xúc, bình luận và trả lời comment để hướng dẫn nhanh. Comment có thể kèm ảnh.',
  },
  {
    key: 'profile',
    title: 'Hồ sơ cá nhân',
    body: 'Cập nhật email, Zalo, chuyên môn, tài khoản ngân hàng. Thông tin đúng giúp nhận lương và liên lạc.',
  },
];

export function getGuideSteps(role) {
  return role === 'teacher' ? TEACHER_GUIDE_STEPS : STUDENT_GUIDE_STEPS;
}

export function guideStorageKey(role, userId) {
  return 'lms_guide_seen_' + String(role || 'student') + '_' + String(userId || 'anon');
}

export function hasSeenLmsGuide(role, userId) {
  try {
    return localStorage.getItem(guideStorageKey(role, userId)) === '1';
  } catch {
    return false;
  }
}

export function markLmsGuideSeen(role, userId) {
  try {
    localStorage.setItem(guideStorageKey(role, userId), '1');
  } catch { /* ignore */ }
}

/** Map URL/hash hiện tại -> key hướng dẫn */
export function detectGuideTopic(role, pathname, hash) {
  const h = String(hash || '').replace(/^#/, '');
  const path = String(pathname || '');
  if (path.includes('/feed')) return 'feed';
  if (role === 'student') {
    if (path.includes('/exam')) return 'exam';
    if (path.includes('/inbox')) return 'inbox';
    if (h === 'schedule') return 'schedule';
    if (h === 'materials') return 'materials';
    if (h === 'evaluation') return 'evaluation';
    if (h === 'profile') return 'profile';
    return 'dashboard';
  }
  if (role === 'teacher') {
    if (path.includes('/test')) return 'test';
    if (path.includes('/finance')) return 'finance';
    if (path.includes('/inbox')) return 'inbox';
    if (h === 'students') return 'students';
    if (h === 'schedule') return 'schedule';
    if (h === 'training') return 'training';
    if (h === 'profile') return 'profile';
    return 'dashboard';
  }
  return 'welcome';
}
