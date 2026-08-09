const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const EXCLUDED_DIRS = ['node_modules', 'client', '.git', 'dist'];

const DOMAINS = ['student', 'teacher', 'course', 'enrollment', 'attendance'];
const FOLDERS = [
  'controllers', 'services', 'repositories', 'routes', 'models',
  'validators', 'dto', 'events', 'tests'
];

const MOVES = [
  // Student
  { src: 'routes/studentRoutes.js', dest: 'modules/student/routes/studentRoutes.js' },
  { src: 'models/Student.js', dest: 'modules/student/models/Student.js' },
  { src: 'models/Group.js', dest: 'modules/student/models/Group.js' },
  
  // Teacher
  { src: 'routes/teacherRoutes.js', dest: 'modules/teacher/routes/teacherRoutes.js' },
  { src: 'routes/staffRoutes.js', dest: 'modules/teacher/routes/staffRoutes.js' },
  { src: 'routes/employeeRoutes.js', dest: 'modules/teacher/routes/employeeRoutes.js' },
  { src: 'models/Teacher.js', dest: 'modules/teacher/models/Teacher.js' },
  { src: 'models/TeacherAssignmentSegment.js', dest: 'modules/teacher/models/TeacherAssignmentSegment.js' },
  { src: 'services/teacherStarBonus.js', dest: 'modules/teacher/services/teacherStarBonus.js' },
  
  // Course
  { src: 'routes/courseRoutes.js', dest: 'modules/course/routes/courseRoutes.js' },
  { src: 'routes/trainingRoutes.js', dest: 'modules/course/routes/trainingRoutes.js' },
  { src: 'routes/teachingGuideRoutes.js', dest: 'modules/course/routes/teachingGuideRoutes.js' },
  { src: 'routes/assignmentRoutes.js', dest: 'modules/course/routes/assignmentRoutes.js' },
  { src: 'models/Course.js', dest: 'modules/course/models/Course.js' },
  { src: 'models/TrainingCourse.js', dest: 'modules/course/models/TrainingCourse.js' },
  { src: 'models/TrainingLesson.js', dest: 'modules/course/models/TrainingLesson.js' },
  { src: 'models/TrainingProgress.js', dest: 'modules/course/models/TrainingProgress.js' },
  { src: 'models/TeachingGuide.js', dest: 'modules/course/models/TeachingGuide.js' },
  { src: 'models/Assignment.js', dest: 'modules/course/models/Assignment.js' },
  { src: 'models/Submission.js', dest: 'modules/course/models/Submission.js' },
  
  // Enrollment
  { src: 'services/enrollmentService.js', dest: 'modules/enrollment/services/enrollmentService.js' },
  
  // Attendance
  { src: 'routes/scheduleRoutes.js', dest: 'modules/attendance/routes/scheduleRoutes.js' },
  { src: 'models/Schedule.js', dest: 'modules/attendance/models/Schedule.js' },
  { src: 'models/ScheduleHistory.js', dest: 'modules/attendance/models/ScheduleHistory.js' }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 1. Create structure
DOMAINS.forEach(domain => {
  const domainDir = path.join(ROOT_DIR, 'modules', domain);
  ensureDir(domainDir);
  
  // Create index.js
  const indexFile = path.join(domainDir, 'index.js');
  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, '// Entry point for ' + domain + ' module\n', 'utf8');
  }
  
  // Create placeholders
  FOLDERS.forEach(folder => {
    ensureDir(path.join(domainDir, folder));
  });
});

// 2. Map old absolute paths to new absolute paths
const fileMap = new Map(); // oldAbsPath -> newAbsPath
MOVES.forEach(m => {
  fileMap.set(path.join(ROOT_DIR, m.src), path.join(ROOT_DIR, m.dest));
});

// 3. Move files
MOVES.forEach(m => {
  const oldPath = path.join(ROOT_DIR, m.src);
  const newPath = path.join(ROOT_DIR, m.dest);
  if (fs.existsSync(oldPath)) {
    ensureDir(path.dirname(newPath));
    fs.renameSync(oldPath, newPath);
    console.log(`Moved: ${m.src} -> ${m.dest}`);
  }
});

// Helper to find all JS files
function getAllFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    if (EXCLUDED_DIRS.includes(file)) continue;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      getAllFiles(fullPath, files);
    } else if (file.endsWith('.js') || file.endsWith('.cjs')) {
      files.push(fullPath);
    }
  }
  return files;
}

// 4. Update imports in ALL files
const allFiles = getAllFiles(ROOT_DIR);
let updatedFilesCount = 0;

allFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // Regex to match require('...') or require("...")
  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  
  content = content.replace(requireRegex, (match, importPath) => {
    // Only care about relative imports
    if (!importPath.startsWith('.')) return match;
    
    const currentDir = path.dirname(filePath);
    let absImportPath = path.resolve(currentDir, importPath);
    
    if (!absImportPath.endsWith('.js')) {
      absImportPath += '.js';
    }

    let fileWasMoved = false;
    let oldFileDir = currentDir;
    for (const [oldAbs, newAbs] of fileMap.entries()) {
      if (newAbs === filePath) {
        fileWasMoved = true;
        oldFileDir = path.dirname(oldAbs);
        break;
      }
    }

    let actualTargetAbs;
    let newTargetAbs = fileMap.get(absImportPath);

    if (newTargetAbs) {
      actualTargetAbs = newTargetAbs;
    } else {
      if (fileWasMoved) {
         let originalTargetAbs = path.resolve(oldFileDir, importPath);
         if (!originalTargetAbs.endsWith('.js')) originalTargetAbs += '.js';
         
         if (fileMap.has(originalTargetAbs)) {
           actualTargetAbs = fileMap.get(originalTargetAbs);
         } else {
           actualTargetAbs = originalTargetAbs;
         }
      } else {
        return match;
      }
    }

    let newRelative = path.relative(currentDir, actualTargetAbs);
    
    if (newRelative.endsWith('.js')) {
      newRelative = newRelative.slice(0, -3);
    }
    
    newRelative = newRelative.replace(/\\/g, '/');
    
    if (!newRelative.startsWith('.')) {
      newRelative = './' + newRelative;
    }

    return `require('${newRelative}')`;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedFilesCount++;
    console.log(`Updated imports in: ${path.relative(ROOT_DIR, filePath)}`);
  }
});

console.log(`\nBatch 2 Migration Complete. Updated ${updatedFilesCount} files.`);
