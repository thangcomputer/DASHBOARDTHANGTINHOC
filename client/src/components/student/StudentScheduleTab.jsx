import React from 'react';
import { ScheduleView } from './StudentScheduleView';
import { CourseSwitcher } from './StudentShared';

export default function StudentScheduleTab({
  viewStudent,
  mySchedules,
  enrollments = [],
  activeCourseName,
  setActiveCourseName,
  setNoteModalSched,
  displayGrades,
}) {
  return (
    <div className="w-full min-w-0 py-3 sm:py-6 animate-in fade-in duration-500">
      <div className="mb-4">
        <CourseSwitcher
          courses={enrollments}
          activeCourseName={activeCourseName || viewStudent?.course}
          onChange={setActiveCourseName}
        />
      </div>
      <ScheduleView
        schedules={mySchedules}
        student={viewStudent}
        setNoteModalSched={setNoteModalSched}
        displayGrades={displayGrades}
      />
    </div>
  );
}
