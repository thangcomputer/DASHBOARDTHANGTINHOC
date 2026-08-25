/**
 * Nhật ký hệ thống — chỉ các hành động nghiệp vụ cần theo dõi.
 */
const SYSTEM_LOG_VISIBLE_ACTIONS = [
  'THÊM HỌC VIÊN',
  'XÓA HỌC VIÊN',
  'CẬP NHẬT HV',
  'HOÀN HỌC PHÍ',
  'THÊM GIẢNG VIÊN',
  'XÓA GIẢNG VIÊN',
  'CẬP NHẬT GV',
  'THANH TOÁN GV',
  'THANH TOÁN TẤT CẢ',
  'XÁC NHẬN LƯƠNG',
  'THÊM NHÂN VIÊN',
  'XÓA NHÂN VIÊN',
  'PHÂN QUYỀN',
  'THÊM NHÂN SỰ',
  'XÓA NHÂN SỰ',
  'THANH TOÁN LƯƠNG',
  'TẢI BÁO CÁO TÀI CHÍNH',
  'TẢI BÁO CÁO DOANH THU',
  'THÊM KHÓA HỌC VIDEO',
  'CẬP NHẬT KHÓA HỌC VIDEO',
  'THÊM BÀI HỌC VIDEO',
  'THÊM LINK PHẦN MỀM',
  'CẬP NHẬT LINK PHẦN MỀM',
  'XÓA LINK PHẦN MỀM',
  'XÓA KHÓA HỌC VIDEO',
];

const SYSTEM_LOG_VISIBLE_SET = new Set(SYSTEM_LOG_VISIBLE_ACTIONS);

function isVisibleSystemLogAction(action) {
  return SYSTEM_LOG_VISIBLE_SET.has(String(action || '').trim());
}

module.exports = {
  SYSTEM_LOG_VISIBLE_ACTIONS,
  isVisibleSystemLogAction,
};
