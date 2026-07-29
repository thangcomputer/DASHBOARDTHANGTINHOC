"""Extract TeacherStudentsTab, TeacherScheduleTab, TeacherOverviewTab from monolith or current dashboard."""
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
teacher_dir = ROOT / "client" / "src" / "components" / "teacher"
monolith = ROOT / "scripts" / "_teacher_monolith.jsx"

if not monolith.is_file():
    subprocess.check_call(
        [
            "git",
            "-C",
            str(ROOT),
            "show",
            "c27e67f:client/src/components/TeacherDashboard.jsx",
        ],
        stdout=monolith.open("wb"),
    )

lines = monolith.read_text(encoding="utf-8").splitlines(True)


def slice_lines(start: int, end: int) -> str:
    return "".join(lines[start - 1 : end])


students_tab_body = slice_lines(2852, 2994).replace("<StudentCard ", "<TeacherStudentCard ")
schedule_tab_body = slice_lines(2998, 3022).replace("<MonthlyCalendar", "<TeacherMonthlyCalendar").replace("MonthlyCalendar", "TeacherMonthlyCalendar")
# Fix double replacement on import line - schedule tab uses import separately
schedule_tab_body = slice_lines(2998, 3022).replace("<MonthlyCalendar", "<TeacherMonthlyCalendar")
overview_tab_body = slice_lines(3036, 3253)

(teacher_dir / "TeacherStudentsTab.jsx").write_text(
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
    encoding="utf-8",
    newline="\n",
)

(teacher_dir / "TeacherScheduleTab.jsx").write_text(
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
    encoding="utf-8",
    newline="\n",
)

(teacher_dir / "TeacherOverviewTab.jsx").write_text(
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
    encoding="utf-8",
    newline="\n",
)

print("Tab files written")
