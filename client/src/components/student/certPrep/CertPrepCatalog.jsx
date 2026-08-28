import CertPrepCourseCard from './CertPrepCourseCard';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepCatalog({ courses, onOpen }) {
  if (!courses?.length) {
    return (
      <CertPrepEmptyState
        title="Chưa có khóa ôn thi cho tài khoản này."
        hint="Nếu bạn đã đăng ký khóa học mà vẫn thấy thông báo này, trung tâm cần liên kết khóa học với chương trình Ôn thi MOS/IC3 (hoặc cấp quyền thủ công)."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {courses.map((course) => (
        <CertPrepCourseCard key={course.id} course={course} onOpen={onOpen} />
      ))}
    </div>
  );
}
