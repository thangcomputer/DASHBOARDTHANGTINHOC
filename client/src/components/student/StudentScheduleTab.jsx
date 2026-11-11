import React, { useEffect, useMemo, useState } from 'react';
import { ScheduleView } from './StudentScheduleView';
import {
  filterSchedulesByCourse,
  getActiveOneToOneEnrollment,
  scopeStudentToEnrollment,
} from '../../utils/enrollments';

export default function StudentScheduleTab({
  viewStudent,
  mySchedules,
  enrollments = [],
  activeCourseName,
  setNoteModalSched,
  displayGrades,
}) {
  const preferredCourse = getActiveOneToOneEnrollment(enrollments);
  const [scheduleCourseName, setScheduleCourseName] = useState('');

  useEffect(() => {
    const selectedExists = enrollments.some(
      (enrollment) => (enrollment.courseName || enrollment.name) === scheduleCourseName,
    );
    if (!scheduleCourseName || !selectedExists) {
      setScheduleCourseName(
        preferredCourse?.courseName
        || preferredCourse?.name
        || activeCourseName
        || viewStudent?.course
        || '',
      );
    }
  }, [activeCourseName, enrollments, preferredCourse, scheduleCourseName, viewStudent?.course]);

  const selectedEnrollment = enrollments.find(
    (enrollment) => (enrollment.courseName || enrollment.name) === scheduleCourseName,
  );
  const scheduleStudent = selectedEnrollment
    ? scopeStudentToEnrollment(viewStudent, selectedEnrollment)
    : viewStudent;
  const schedulesForSelectedCourse = useMemo(
    () => filterSchedulesByCourse(mySchedules, scheduleCourseName),
    [mySchedules, scheduleCourseName],
  );

  return (
    <div className="w-full min-w-0 pt-0 pb-3 sm:pt-0 sm:pb-6 animate-in fade-in duration-500">
      <ScheduleView
        schedules={schedulesForSelectedCourse}
        allSchedules={mySchedules}
        student={scheduleStudent}
        enrollments={enrollments}
        activeCourseName={scheduleCourseName || activeCourseName || viewStudent?.course}
        onSelectCourse={setScheduleCourseName}
        setNoteModalSched={setNoteModalSched}
        displayGrades={displayGrades}
      />
    </div>
  );
}
