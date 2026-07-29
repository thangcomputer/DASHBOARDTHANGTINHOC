"""Rewrite TeacherDashboard.jsx shell after teacher/* extraction."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = ROOT / "client" / "src" / "components" / "TeacherDashboard.jsx"
lines = src.read_text(encoding="utf-8").splitlines(True)

# Keep main component from line 2455 to end, but remove subcomponents (lines 30-2453)
header = """import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, CheckCircle, Clock, BookOpen, ChevronRight,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import TeacherAssignmentsView from './TeacherAssignmentsView';
import { useData } from '../context/DataContext';
import { useSocket } from '../context/SocketContext';
import api, { csrfFetch } from '../services/api';
import { useToast } from '../utils/toast';
import { useModal } from '../utils/Modal.jsx';
import PopupBanner from './PopupBanner';
import TeacherTrainingLMS from './TeacherTrainingLMS';
import TeacherScheduleModal from './teacher/TeacherScheduleModal';
import {
  TeacherLazyStudentsTab,
  TeacherLazyScheduleTab,
  TeacherLazyProfileTab,
  TeacherLazyOverviewTab,
} from './teacher/TeacherLazyTabShell';
export { showGlossyAlert, GlossyAlertProvider } from './teacher/TeacherShared';
import { getDisplayName } from './teacher/TeacherShared';

"""

main_body = "".join(lines[2454:])  # from const TeacherDashboard

# Replace hash content block (between CONTENT comment and showScheduleModal)
old_start = "        {currentHash === 'training' ? ("
old_end = "      {showScheduleModal && ("

if old_start not in main_body or old_end not in main_body:
    raise SystemExit("Could not find hash block markers in TeacherDashboard")

before, rest = main_body.split(old_start, 1)
_, after = rest.split(old_end, 1)

new_hash = """        {currentHash === 'training' ? (
           <TeacherTrainingLMS onBack={() => window.location.hash = ''} />
        ) : currentHash === 'students' ? (
          <TeacherLazyStudentsTab
            studentSearch={studentSearch}
            setStudentSearch={setStudentSearch}
            students={students}
            onlineUsers={onlineUsers}
            lastSeenUsers={lastSeenUsers}
            timeAgo={timeAgo}
            selectedEnrollmentKey={selectedEnrollmentKey}
            setSelectedEnrollmentKey={setSelectedEnrollmentKey}
            navigate={navigate}
            mySchedules={mySchedules}
            markAttendance={markAttendance}
            updateLink={updateLink}
            saveGrade={saveGrade}
            updateNotes={updateNotes}
            lockStudentExam={lockStudentExam}
          />
        ) : currentHash === 'schedule' ? (
          <TeacherLazyScheduleTab
            setEditingSchedule={setEditingSchedule}
            setShowScheduleModal={setShowScheduleModal}
            mySchedules={mySchedules}
            startEditSchedule={startEditSchedule}
            cancelSchedule={cancelSchedule}
          />
        ) : currentHash === 'assignments' ? (
          <div className="px-4 md:px-8 py-6 md:py-8">
            <TeacherAssignmentsView teacherId={TEACHER_ID} myStudents={students} />
          </div>
        ) : currentHash === 'profile' ? (
          <TeacherLazyProfileTab teacherId={TEACHER_ID} currentTeacher={currentTeacher} />
        ) : (
          <TeacherLazyOverviewTab
            navigate={navigate}
            totalMonthlyIncome={totalMonthlyIncome}
            completed={completed}
            totalDone={totalDone}
            teacherName={teacherName}
            currentTeacher={currentTeacher}
            teacherRating={teacherRating}
            students={students}
            totalSess={totalSess}
            avgGrade={avgGrade}
            mySchedules={mySchedules}
            myNotifs={myNotifs}
            RATING_CRITERIA={RATING_CRITERIA}
          />
        )}
"""

main_body = before + new_hash + "\n\n      " + old_end + after

main_body = main_body.replace(
    "<ScheduleModal",
    "<TeacherScheduleModal",
).replace(
    "ScheduleModal\n",
    "TeacherScheduleModal\n",
)

out = header + main_body
src.write_text(out, encoding="utf-8", newline="\n")
print(len(out.splitlines()))
