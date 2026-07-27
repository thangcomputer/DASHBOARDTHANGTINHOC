import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const LazyTraining = lazy(() => import('../TeacherTrainingLMS'));
const LazyAssignments = lazy(() => import('../TeacherAssignmentsView'));
const LazyProfile = lazy(() => import('./TeacherProfileTab'));
const LazyCalendar = lazy(() => import('./TeacherMonthlyCalendar'));
const LazyScheduleModal = lazy(() => import('./TeacherScheduleModal'));
const LazyStudentCard = lazy(() => import('./TeacherStudentCard'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <Loader2 className="animate-spin mr-2" size={22} />
      <span className="font-bold text-sm">Đang tải...</span>
    </div>
  );
}

function Wrap({ children }) {
  return <Suspense fallback={<TabFallback />}>{children}</Suspense>;
}

export function TeacherLazyTrainingTab(props) {
  return <Wrap><LazyTraining {...props} /></Wrap>;
}
export function TeacherLazyAssignmentsTab(props) {
  return <Wrap><LazyAssignments {...props} /></Wrap>;
}
export function TeacherLazyProfileTab(props) {
  return <Wrap><LazyProfile {...props} /></Wrap>;
}
export function TeacherLazyMonthlyCalendar(props) {
  return <Wrap><LazyCalendar {...props} /></Wrap>;
}
export function TeacherLazyScheduleModal(props) {
  return <Wrap><LazyScheduleModal {...props} /></Wrap>;
}
export function TeacherLazyStudentCard(props) {
  return (
    <Suspense fallback={<div className="h-24 animate-pulse rounded-2xl bg-slate-100" />}>
      <LazyStudentCard {...props} />
    </Suspense>
  );
}
