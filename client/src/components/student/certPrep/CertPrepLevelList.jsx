import CertPrepLevelCard from './CertPrepLevelCard';
import CertPrepEmptyState from './CertPrepEmptyState';

export default function CertPrepLevelList({ levels, onOpen }) {
  if (!levels?.length) {
    return <CertPrepEmptyState title="Chưa có cấp độ nào." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {levels.map((level) => (
        <CertPrepLevelCard key={level.id} level={level} onOpen={onOpen} />
      ))}
    </div>
  );
}
