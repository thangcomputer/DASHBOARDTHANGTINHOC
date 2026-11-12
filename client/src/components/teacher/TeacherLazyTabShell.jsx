import React, { Suspense, lazy } from 'react';
import { TabFallback } from '../LoadingScreen';

const LazyStudentsTab = lazy(() => import('./TeacherStudentsTab'));
const LazyScheduleTab = lazy(() => import('./TeacherScheduleTab'));
const LazyProfileTab = lazy(() => import('./TeacherProfileTab'));
const LazyOverviewTab = lazy(() => import('./TeacherOverviewTab'));

function LazyTeacherTab({ Component, ...props }) {
  return (
    <div className="animate-in fade-in duration-300 flex-1 min-h-0 flex flex-col w-full">
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
  // Tổng quan cuộn theo shell (overflow-y-auto) - không dùng flex-1/min-h-0 để tránh cắt nội dung.
  return (
    <div className="animate-in fade-in duration-300 w-full min-w-0">
      <Suspense fallback={<TabFallback />}>
        <LazyOverviewTab {...props} />
      </Suspense>
    </div>
  );
}


