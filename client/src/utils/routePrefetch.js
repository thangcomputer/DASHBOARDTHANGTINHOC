/**
 * Prefetch các route chunk khi người dùng rê chuột/focus vào menu hoặc sau khi đăng nhập.
 * Mỗi đường dẫn chỉ kích hoạt import() một lần để không lặp mạng.
 */
const prefetched = new Set();

const ROUTE_LOADERS = [
  ['/admin/notifications', () => import('../components/NotificationCenterPage')],
  ['/admin/files', () => import('../components/FileCenterPage')],
  ['/admin/backups', () => import('../components/BackupCenterPage')],
  ['/admin/monitoring', () => import('../components/MonitoringPage')],
  ['/admin/ai', () => import('../components/AiCenterPage')],
  ['/admin/bi', () => import('../components/BiDashboardPage')],
  ['/admin/workflows', () => import('../components/WorkflowCenterPage')],
  ['/admin/builder', () => import('../components/FormReportBuilderPage')],
  ['/admin/tenants', () => import('../components/TenantManagementPage')],
  ['/admin/inbox', () => import('../components/Inbox')],
  ['/admin/feed', () => import('../components/FeedBoard')],
  ['/admin/news', () => import('../components/NewsPage')],
  ['/admin/center-info/manage', () => import('../components/centerInfo/CenterInfoManagePage')],
  ['/admin/center-info', () => import('../components/centerInfo/CenterInfoPage')],
  ['/admin', () => import('../components/AdminDashboard')],

  ['/teacher/finance', () => import('../components/TeacherFinanceAndTraining')],
  ['/teacher/notifications', () => import('../components/NotificationCenterPage')],
  ['/teacher/inbox', () => import('../components/Inbox')],
  ['/teacher/feed', () => import('../components/FeedBoard')],
  ['/teacher/news', () => import('../components/NewsPage')],
  ['/teacher/center-info', () => import('../components/centerInfo/CenterInfoPage')],
  ['/teacher/support', () => import('../components/SupportEntryPage')],
  ['/teacher/test', () => import('../components/TeacherTest')],
  ['/teacher', () => import('../components/TeacherDashboard')],

  ['/student/exam', () => import('../components/StudentExamRoom')],
  ['/student/notifications', () => import('../components/NotificationCenterPage')],
  ['/student/inbox', () => import('../components/Inbox')],
  ['/student/feed', () => import('../components/FeedBoard')],
  ['/student/news', () => import('../components/NewsPage')],
  ['/student/center-info', () => import('../components/centerInfo/CenterInfoPage')],
  ['/student/support', () => import('../components/SupportEntryPage')],
  ['/student/cert-prep', () => import('../components/student/certPrep/CertPrepCatalogPage')],
  ['/student/lesson-practice', () => import('../components/student/lessonPractice/LessonPracticeCatalogPage')],
  ['/student/daily-practice', () => import('../components/student/dailyPractice/DailyPracticePage')],
  ['/student', () => import('../components/StudentDashboard')],
];

export function prefetchRouteByPath(rawPath) {
  if (!rawPath || typeof rawPath !== 'string') return;
  const cleanPath = rawPath.split('#')[0].split('?')[0];
  if (!cleanPath || prefetched.has(cleanPath)) return;
  const hit = ROUTE_LOADERS.find(([prefix]) => (
    cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)
  ));
  if (!hit) return;
  prefetched.add(cleanPath);
  try {
    hit[1]().catch(() => { prefetched.delete(cleanPath); });
  } catch {
    prefetched.delete(cleanPath);
  }
}

export function prefetchRoleDashboard(role) {
  if (role === 'admin' || role === 'staff') prefetchRouteByPath('/admin');
  else if (role === 'teacher') prefetchRouteByPath('/teacher');
  else if (role === 'student') prefetchRouteByPath('/student');
}

