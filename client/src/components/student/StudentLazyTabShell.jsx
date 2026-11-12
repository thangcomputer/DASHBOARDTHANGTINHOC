import React, { Suspense, lazy } from 'react';
import { TabFallback } from '../LoadingScreen';

const LazyStudentScheduleTab = lazy(() => import('./StudentScheduleTab'));
const LazyStudentMaterialsTab = lazy(() => import('./StudentMaterialsTab'));
const LazyStudentEvaluationTab = lazy(() => import('./StudentEvaluationTab'));
const LazyStudentProfileTab = lazy(() => import('./StudentProfileTab'));
const LazyStudentOverviewTab = lazy(() => import('./StudentOverviewTab'));

function LazyStudentTab({ Component, props }) {
  return (
    <div className="animate-in fade-in duration-300">
      <Suspense fallback={<TabFallback />}>
        <Component {...props} />
      </Suspense>
    </div>
  );
}

export function StudentLazyScheduleTab(props) {
  return <LazyStudentTab Component={LazyStudentScheduleTab} props={props} />;
}

export function StudentLazyMaterialsTab(props) {
  return <LazyStudentTab Component={LazyStudentMaterialsTab} props={props} />;
}

export function StudentLazyEvaluationTab(props) {
  return <LazyStudentTab Component={LazyStudentEvaluationTab} props={props} />;
}

export function StudentLazyProfileTab(props) {
  return <LazyStudentTab Component={LazyStudentProfileTab} props={props} />;
}

export function StudentLazyOverviewTab(props) {
  return <LazyStudentTab Component={LazyStudentOverviewTab} props={props} />;
}
