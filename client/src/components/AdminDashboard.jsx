import React from 'react';
import { mutate } from 'swr';
import { AdminTabProvider } from './admin/AdminTabContext';
import {
  AdminLazyExternalTab,
  AdminLazyOverviewTab,
  AdminLazyStudentsTab,
  AdminLazyTeachersTab,
  AdminLazyTrainingTab,
  AdminLazyTeacherWorkflowModule,
  AdminLazyEvaluationsTab,
  AdminLazyFinanceTab,
  AdminLazyLogsTab,
  AdminLazyStudentTrainingTab,
  AdminLazyCertPrepTab,
  AdminLazyLessonPracticeTab,
} from './admin/AdminLazyTabShell';

import AdminModalManager from './admin/shared/AdminModalManager';
import { useAdminDashboardState } from './admin/hooks/useAdminDashboardState';
import { AdminFinanceProvider } from './admin/hooks/AdminFinanceContext';
import { AdminTrainingProvider } from './admin/hooks/AdminTrainingContext';
import { AdminLogsProvider } from './admin/hooks/AdminLogsContext';

const AdminDashboard = () => {
  const {
    activeTab,
    adminTabValue
  } = useAdminDashboardState();

  return (
    <AdminTabProvider value={adminTabValue}>
      <div className="bg-transparent h-full min-h-0">
        <div className="min-w-0 h-full min-h-0">
          <div className="px-0 py-1 sm:px-0 sm:py-2 md:px-0 lg:px-0 h-full min-h-0">
            {activeTab === 'dashboard' && (
              <AdminLazyOverviewTab
                session={(() => {
                  try {
                    return JSON.parse(localStorage.getItem('admin_user') || localStorage.getItem('staff_user') || '{}') || {};
                  } catch {
                    return {};
                  }
                })()}
              />
            )}

            {activeTab === 'students' && <AdminLazyStudentsTab />}
            {activeTab === 'teachers' && <AdminLazyTeachersTab />}
            {(activeTab === 'training' || activeTab.startsWith('training-')) && activeTab !== 'training-guides-evaluations' && (
              <AdminTrainingProvider activeTab={activeTab}>
                <AdminLazyTrainingTab
                  section={activeTab === 'training' ? undefined : ({
                    'training-videos': 'videos',
                    'training-resources': 'resources',
                    'training-exam-room': 'exam-room',
                  })[activeTab]}
                />
              </AdminTrainingProvider>
            )}
            {activeTab === 'training-guides-evaluations' && (
              <AdminTrainingProvider activeTab={activeTab}>
                <AdminLazyTeacherWorkflowModule />
              </AdminTrainingProvider>
            )}
            {activeTab === 'evaluations' && <AdminLazyEvaluationsTab />}
            {activeTab === 'finance' && (
              <AdminFinanceProvider activeTab={activeTab}>
                <AdminLazyFinanceTab />
              </AdminFinanceProvider>
            )}
            {['student-training', 'student-resources'].includes(activeTab) && (
              <AdminTrainingProvider activeTab={activeTab}>
                <AdminLazyStudentTrainingTab
                  resourceOnly={activeTab === 'student-resources'}
                  examRoomOnly={activeTab === 'student-training'}
                />
              </AdminTrainingProvider>
            )}
            {activeTab === 'cert-prep' && <AdminLazyCertPrepTab />}
            {activeTab === 'lesson-practice' && (
              <AdminTrainingProvider activeTab={activeTab}>
                <AdminLazyLessonPracticeTab />
              </AdminTrainingProvider>
            )}
            {activeTab === 'logs' && (
              <AdminLogsProvider activeTab={activeTab}>
                <AdminLazyLogsTab />
              </AdminLogsProvider>
            )}
            {['settings', 'staff', 'analytics', 'hr'].includes(activeTab) && (
              <AdminLazyExternalTab tab={activeTab} />
            )}
          </div>
        </div>
        <AdminModalManager />
      </div>
    </AdminTabProvider>
  );
};

export default AdminDashboard;
