"""One-off: extract TeacherDashboard subcomponents into client/src/components/teacher/."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "scripts" / "_teacher_monolith.jsx"
if not src.is_file():
    src = ROOT / "client" / "src" / "components" / "TeacherDashboard.jsx"
teacher_dir = ROOT / "client" / "src" / "components" / "teacher"
teacher_dir.mkdir(parents=True, exist_ok=True)

lines = src.read_text(encoding="utf-8").splitlines(True)


def slice_lines(start: int, end: int) -> str:
    return "".join(lines[start - 1 : end])


def write_file(name: str, header: str, body: str, rename: list[tuple[str, str]] | None = None) -> None:
    code = body
    if rename:
        for old, new in rename:
            code = code.replace(old, new, 1)
    (teacher_dir / name).write_text(header + code, encoding="utf-8", newline="\n")


write_file(
    "TeacherShared.jsx",
    """import React from 'react';
import { XCircle } from 'lucide-react';
import { useModal } from '../../utils/Modal.jsx';

""",
    slice_lines(30, 127),
)

write_file(
    "TeacherScheduleModal.jsx",
    """import React, { useState } from 'react';
import { Calendar, X } from 'lucide-react';
import CmsSelect from '../ui/CmsSelect';
import {
  isEndTimeAfterStart, normalizeScheduleDate, normalizeTimeHHmm,
  getCurrentTimeHHmm, endTimeFromStart,
  findStudentScheduleConflict, formatScheduleConflictMessage,
} from '../../utils/scheduleTime';

""",
    slice_lines(131, 293),
    [("const ScheduleModal = ", "export default function TeacherScheduleModal")],
)

write_file(
    "TeacherStudentCard.jsx",
    """import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar, Video, CheckCircle, Save, MessageSquare, FileText,
  GraduationCap, TrendingUp, Clock, Star, Link2, Upload,
  BookOpen, Award, Plus, ChevronRight, Eye, X, XCircle,
  Search, Download, AlertCircle, Clipboard, Send, UserCheck, Check,
  Activity, Filter, User, Phone, Mail, Edit3, Shield, Ban, PlayCircle, Loader2,
} from 'lucide-react';
import { useModal } from '../../utils/Modal.jsx';
import { useSocket } from '../../context/SocketContext';
import api, { resolveMediaUrl, buildMediaDownloadUrl } from '../../services/api';
import { getGradeBadgeClasses, getGradeLabel } from '../../utils/gradeColors';
import { showGlossyAlert, FailExamButton, getDisplayName } from './TeacherShared';

""",
    slice_lines(296, 1358),
    [("const StudentCard = ", "export default function TeacherStudentCard")],
)

write_file(
    "TeacherMonthlyCalendar.jsx",
    """import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, X, CheckCircle, Ban, Video, Clock,
  MessageSquare, Edit3, Trash2,
} from 'lucide-react';
import { csrfFetch } from '../../services/api';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';
import { showGlossyAlert } from './TeacherShared';

""",
    slice_lines(1362, 1826),
    [("const MonthlyCalendar = ", "export default function TeacherMonthlyCalendar")],
)

write_file(
    "TeacherRatingDisplay.jsx",
    """import React from 'react';
import { Star } from 'lucide-react';

""",
    slice_lines(1830, 1910),
    [("const TeacherRatingDisplay = ", "export default function TeacherRatingDisplay")],
)

write_file(
    "TeacherProfileTab.jsx",
    """import React, { useState, useEffect } from 'react';
import {
  User, Phone, Mail, Calendar, MapPin, Award, Save, Clock, Shield,
  CreditCard, Landmark, Copy, Edit3, Building2, AlertCircle, DollarSign,
} from 'lucide-react';
import { useData } from '../../context/DataContext';
import { BankSelect } from '../BankSelect';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';

""",
    slice_lines(1924, 2452),
    [("const TeacherProfileSection = ", "export default function TeacherProfileTab")],
)

students_tab_body = slice_lines(2864, 3006).replace("<StudentCard ", "<TeacherStudentCard ")
write_file(
    "TeacherStudentsTab.jsx",
    """import React from 'react';
import { Search, MessageSquare, Users, GraduationCap } from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import TeacherStudentCard from './TeacherStudentCard';

export default function TeacherStudentsTab({
  studentSearch,
  setStudentSearch,
  students,
  onlineUsers,
  lastSeenUsers,
  timeAgo,
  selectedEnrollmentKey,
  setSelectedEnrollmentKey,
  navigate,
  mySchedules,
  markAttendance,
  updateLink,
  saveGrade,
  updateNotes,
  lockStudentExam,
}) {
  return (
"""
    + students_tab_body
    + "\n  );\n}\n",
    "",
)

schedule_tab_body = slice_lines(3010, 3034).replace("MonthlyCalendar", "TeacherMonthlyCalendar")
write_file(
    "TeacherScheduleTab.jsx",
    """import React from 'react';
import { Calendar, Plus } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';

export default function TeacherScheduleTab({
  setEditingSchedule,
  setShowScheduleModal,
  mySchedules,
  startEditSchedule,
  cancelSchedule,
}) {
  return (
"""
    + schedule_tab_body
    + "\n  );\n}\n",
    "",
)

overview_tab_body = slice_lines(3048, 3265)
write_file(
    "TeacherOverviewTab.jsx",
    """import React from 'react';
import {
  Calendar, ChevronRight, BookOpen, Award, Star, Zap, UserCheck, Clipboard,
  MessageSquare, GraduationCap, Users, Activity,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import TeacherRatingDisplay from './TeacherRatingDisplay';

export default function TeacherOverviewTab({
  navigate,
  totalMonthlyIncome,
  completed,
  totalDone,
  teacherName,
  currentTeacher,
  teacherRating,
  students,
  totalSess,
  avgGrade,
  mySchedules,
  myNotifs,
  RATING_CRITERIA,
}) {
  return (
"""
    + overview_tab_body
    + "\n  );\n}\n",
    "",
)

(teacher_dir / "TeacherLazyTabShell.jsx").write_text(
    """import React, { Suspense, lazy } from 'react';
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

function LazyTeacherTab({ Component, props }) {
  return (
    <div className="animate-in fade-in duration-300">
      <Suspense fallback={<TabFallback />}>
        <Component {...props} />
      </Suspense>
    </div>
  );
}

export function TeacherLazyStudentsTab(props) {
  return <LazyTeacherTab Component={LazyStudentsTab} props={props} />;
}

export function TeacherLazyScheduleTab(props) {
  return <LazyTeacherTab Component={LazyScheduleTab} props={props} />;
}

export function TeacherLazyProfileTab(props) {
  return <LazyTeacherTab Component={LazyProfileTab} props={props} />;
}

export function TeacherLazyOverviewTab(props) {
  return <LazyTeacherTab Component={LazyOverviewTab} props={props} />;
}
""",
    encoding="utf-8",
    newline="\n",
)

print("Wrote teacher component files under", teacher_dir)
