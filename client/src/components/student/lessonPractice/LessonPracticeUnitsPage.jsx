import { Navigate, useParams, useSearchParams } from 'react-router-dom';

export default function LessonPracticeUnitsPage() {
  const { subjectId } = useParams();
  const [searchParams] = useSearchParams();
  const unitId = searchParams.get('unitId') || '';
  const qs = new URLSearchParams();
  if (subjectId) qs.set('subjectId', subjectId);
  if (unitId) qs.set('unitId', unitId);
  const query = qs.toString();
  return <Navigate to={`/student/daily-practice${query ? `?${query}` : ''}`} replace />;
}
