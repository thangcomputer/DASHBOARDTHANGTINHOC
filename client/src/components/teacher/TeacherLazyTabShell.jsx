import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const LazyStudentsTab = lazy(() => import('./TeacherStudentsTab'));
const LazyScheduleTab = lazy(() => import('./TeacherScheduleTab'));
const LazyProfileTab = lazy(() => import('./TeacherProfileTab'));
const LazyOverviewTab = lazy(() => import('./TeacherOverviewTab'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <Loader2 className="animate-spin mr-2" size={22} />
      <span className="font-bold text-sm">Đang tải tab...</span>
    </div>
  );
}

function LazyTeacherTab({ Component, ...props }) {
  return (
    <div className="animate-in fade-in duration-300 h-full flex flex-col">
      <Suspense fallback={<TabFallback />}>
        <Component {...props} />
      </Suspense>
    </div>
  );
}

export function TeacherLazyStudentsTab(props) {
  return <LazyTeacherTab Component={LazyStudentsTab} {...props} />;
}

export function TeacherLazyScheduleTab(props) {
  return <LazyTeacherTab Component={LazyScheduleTab} {...props} />;
}

export function TeacherLazyProfileTab(props) {
  return <LazyTeacherTab Component={LazyProfileTab} {...props} />;
}

export function TeacherLazyOverviewTab(props) {
  return <LazyTeacherTab Component={LazyOverviewTab} {...props} />;
}

