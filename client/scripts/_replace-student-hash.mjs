import fs from 'fs';
import path from 'path';

const p = path.resolve(import.meta.dirname, '../src/components/StudentDashboard.jsx');
let src = fs.readFileSync(p, 'utf8');

const start = '        {/* ═══ CONTENT — Switch based on hash ═══ */}';
const end = '      </div>\n\n      {/* FAB - Thay thay thế Zalo';

const i = src.indexOf(start);
const j = src.indexOf(end);
if (i < 0 || j < 0) {
  console.error('markers not found', i, j);
  process.exit(1);
}

const replacement = `        {/* ═══ CONTENT — Switch based on hash ═══ */}
        {currentHash === 'schedule' ? (
          <StudentLazyScheduleTab
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            mySchedules={mySchedules}
            setNoteModalSched={setNoteModalSched}
            displayGrades={displayGrades}
          />
        ) : currentHash === 'materials' ? (
          <StudentLazyMaterialsTab
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            studentTrainingForLms={studentTrainingForLms}
            myAssignments={myAssignments}
            studentTrainingData={studentTrainingData}
          />
        ) : currentHash === 'evaluation' ? (
          <StudentLazyEvaluationTab
            studentData={{ ...viewStudent, courses: enrollments }}
            evaluatingCourseId={evaluatingCourseId}
            setEvaluatingCourseId={setEvaluatingCourseId}
            STUDENT_ID={STUDENT_ID}
            submitPrivateEvaluation={submitPrivateEvaluation}
            getTeacherRating={getTeacherRating}
            ratingSubmitted={ratingSubmitted}
            setRatingSubmitted={setRatingSubmitted}
            isEditingRating={isEditingRating}
            setIsEditingRating={setIsEditingRating}
            ratingCriteria={ratingCriteria}
            setRatingCriteria={setRatingCriteria}
            ratingComment={ratingComment}
            setRatingComment={setRatingComment}
            RATING_CRITERIA={RATING_CRITERIA}
            rateTeacher={rateTeacher}
            privateEvaluations={privateEvaluations}
            teacherRatingData={teacherRatingData}
            setTeacherRatingData={setTeacherRatingData}
            api={api}
          />
        ) : currentHash === 'profile' ? (
          <StudentLazyProfileTab
            studentData={studentData}
            progressPct={progressPct}
            setShowUpdateProfileModal={setShowUpdateProfileModal}
            setShowTuitionModal={setShowTuitionModal}
          />
        ) : (
          <StudentLazyOverviewTab
            studentData={studentData}
            enrollments={enrollments}
            activeCourseName={activeCourseName}
            setActiveCourseName={setActiveCourseName}
            viewStudent={viewStudent}
            progressPct={progressPct}
            teacherRatingData={teacherRatingData}
            isNew={isNew}
            myAssignments={myAssignments}
            upcomingScheduleCount={upcomingScheduleCount}
            myUnreadMsgs={myUnreadMsgs}
            studyLogs={studyLogs}
            materials={materials}
          />
        )}
`;

src = src.slice(0, i) + replacement + src.slice(j);
fs.writeFileSync(p, src, 'utf8');
console.log('hash replaced');
