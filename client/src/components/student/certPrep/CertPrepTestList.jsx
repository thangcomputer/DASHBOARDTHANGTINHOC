import CertPrepTestCard from './CertPrepTestCard';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepTestList({ tests, onOpen }) {
  if (!tests?.length) {
    return <CertPrepEmptyState title="Chưa có bài kiểm tra nào trong cấp độ này." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {tests.map((test) => (
        <CertPrepTestCard key={test.id} test={test} onOpen={onOpen} />
      ))}
    </div>
  );
}
