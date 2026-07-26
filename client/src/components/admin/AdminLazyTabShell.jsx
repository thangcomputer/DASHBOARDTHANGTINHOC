import React, { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

const LazySystemSettingsTab = lazy(() => import('../SystemSettingsTab'));
const LazyStaffManagementTab = lazy(() => import('../StaffManagementTab'));
const LazyRevenueAnalyticsTab = lazy(() => import('../RevenueAnalyticsTab'));
const LazyEmployeeManagementTab = lazy(() => import('../EmployeeManagementTab'));
const LazyAdminOverviewTab = lazy(() => import('./tabs/AdminOverviewTab'));
const LazyStudentsTab = lazy(() => import('./tabs/AdminStudentsTab'));
const LazyTeachersTab = lazy(() => import('./tabs/AdminTeachersTab'));
const LazyTrainingTab = lazy(() => import('./tabs/AdminTrainingTab'));
const LazyEvaluationsTab = lazy(() => import('./tabs/AdminEvaluationsTab'));
const LazyFinanceTab = lazy(() => import('./tabs/AdminFinanceTab'));
const LazyLogsTab = lazy(() => import('./tabs/AdminLogsTab'));
const LazyStudentTrainingTab = lazy(() => import('./tabs/AdminStudentTrainingTab'));

function TabFallback() {
  return (
    <div className="flex items-center justify-center py-24 text-gray-400">
      <Loader2 className="animate-spin mr-2" size={22} />
      <span className="font-bold text-sm">Đang tải tab...</span>
    </div>
  );
}

const EXTERNAL_TABS = {
  settings: LazySystemSettingsTab,
  staff: LazyStaffManagementTab,
  analytics: LazyRevenueAnalyticsTab,
  hr: LazyEmployeeManagementTab,
};

export function AdminLazyExternalTab({ tab }) {
  const Component = EXTERNAL_TABS[tab];
  if (!Component) return null;
  return (
    <div className="animate-in fade-in duration-300">
      <Suspense fallback={<TabFallback />}>
        <Component />
      </Suspense>
    </div>
  );
}

export function AdminLazyOverviewTab(props) {
  return (
    <Suspense fallback={<TabFallback />}>
      <LazyAdminOverviewTab {...props} />
    </Suspense>
  );
}

function LazyAdminTab({ Component }) {
  return (
    <div className="animate-in fade-in duration-300">
      <Suspense fallback={<TabFallback />}>
        <Component />
      </Suspense>
    </div>
  );
}

export function AdminLazyStudentsTab() {
  return <LazyAdminTab Component={LazyStudentsTab} />;
}

export function AdminLazyTeachersTab() {
  return <LazyAdminTab Component={LazyTeachersTab} />;
}

export function AdminLazyTrainingTab() {
  return <LazyAdminTab Component={LazyTrainingTab} />;
}

export function AdminLazyEvaluationsTab() {
  return <LazyAdminTab Component={LazyEvaluationsTab} />;
}

export function AdminLazyFinanceTab() {
  return <LazyAdminTab Component={LazyFinanceTab} />;
}

export function AdminLazyLogsTab() {
  return <LazyAdminTab Component={LazyLogsTab} />;
}

export function AdminLazyStudentTrainingTab() {
  return <LazyAdminTab Component={LazyStudentTrainingTab} />;
}
