import CertPrepCourseCard from './CertPrepCourseCard';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepCatalog({ courses, onOpen }) {
  if (!courses?.length) {
    return <CertPrepEmptyState title="Bạn chưa được cấp quyền truy cập khóa học ôn thi." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {courses.map((course) => (
        <CertPrepCourseCard key={course.id} course={course} onOpen={onOpen} />
      ))}
    </div>
  );
}
