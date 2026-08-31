import CertPrepTestCard from './CertPrepTestCard';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepTestList({
  tests,
  expired = false,
  starting = false,
  startingTestId = '',
  onStart,
  onContinue,
}) {
  if (!tests?.length) {
    return <CertPrepEmptyState title="Chưa có bài kiểm tra nào trong cấp độ này." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {tests.map((test) => (
        <CertPrepTestCard
          key={test.id}
          test={test}
          expired={expired}
          starting={starting}
          startingTestId={startingTestId}
          onStart={onStart}
          onContinue={onContinue}
        />
      ))}
    </div>
  );
}
