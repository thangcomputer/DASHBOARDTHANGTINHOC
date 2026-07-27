import fs from 'fs';
import path from 'path';

const root = path.resolve(import.meta.dirname, '../src/components');
const p = path.join(root, 'StudentDashboard.jsx');
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join('\n');
const dir = path.join(root, 'student');
fs.mkdirSync(dir, { recursive: true });

const schedTab = `import React from 'react';
import { Calendar, FileText } from 'lucide-react';
import { CourseSwitcher } from './StudentShared';
import { ScheduleView } from './StudentScheduleView';
import { getGradeTextClasses } from '../../utils/gradeColors';

export default function StudentScheduleTab({
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  mySchedules,
  setNoteModalSched,
  displayGrades,
}) {
  return (
${slice(528, 591)}
  );
}
`.replace(/StudentLazyScheduleView/g, 'ScheduleView');
fs.writeFileSync(path.join(dir, 'StudentScheduleTab.jsx'), schedTab, 'utf8');

const matTab = `import React from 'react';
import { CourseSwitcher } from './StudentShared';
import StudentTrainingLMS from '../StudentTrainingLMS';

export default function StudentMaterialsTab({
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  studentTrainingForLms,
  myAssignments,
  studentTrainingData,
}) {
  return (
${slice(595, 610)}
  );
}
`.replace(/StudentLazyTrainingLMS/g, 'StudentTrainingLMS');
fs.writeFileSync(path.join(dir, 'StudentMaterialsTab.jsx'), matTab, 'utf8');

fs.writeFileSync(
  path.join(dir, 'StudentEvaluationTab.jsx'),
  `import React from 'react';
import { EvaluationView } from './StudentEvaluationView';

export default function StudentEvaluationTab(props) {
  return <EvaluationView {...props} />;
}
`,
  'utf8'
);

const profTab = `import React from 'react';
import {
  CheckCircle, User, Settings, BookOpen, TrendingUp,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';

export default function StudentProfileTab({
  studentData,
  progressPct,
  setShowUpdateProfileModal,
  setShowTuitionModal,
}) {
  return (
${slice(638, 844)}
  );
}
`;
fs.writeFileSync(path.join(dir, 'StudentProfileTab.jsx'), profTab, 'utf8');

const ovTab = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlayCircle, Clock, CheckCircle, MessageSquare, Download,
  BookOpen, Star, TrendingUp, Zap, Calendar, Video,
  ClipboardList, ChevronRight, XCircle, Phone,
} from 'lucide-react';
import { CourseSwitcher, StatCard } from './StudentShared';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';

export default function StudentOverviewTab({
  studentData,
  enrollments,
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  progressPct,
  teacherRatingData,
  isNew,
  myAssignments,
  upcomingScheduleCount,
  myUnreadMsgs,
  studyLogs,
  materials,
}) {
  const navigate = useNavigate();
  return (
    <>
${slice(848, 1082)}
    </>
  );
}
`;
fs.writeFileSync(path.join(dir, 'StudentOverviewTab.jsx'), ovTab, 'utf8');

console.log('done');
