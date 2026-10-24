const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  loadedModule._compile(compiled, filename);
};

const appRoot = path.resolve(__dirname, '..');
const featurePath = path.join(appRoot, 'src/features/learning');

function loadFeature(name) {
  const modulePath = require.resolve(path.join(featurePath, `${name}.ts`));
  delete require.cache[modulePath];
  return require(modulePath);
}

function readText(relPath) {
  return fs.readFileSync(path.join(appRoot, relPath), 'utf8');
}

test('feature flag keeps mock mode stable and renders fixture-based learning catalog by default', async () => {
  process.env.EXPO_PUBLIC_MOBILE_LEARNING_API = 'false';
  const { learningService, isLearningApiEnabled } = loadFeature('learningService');

  assert.equal(isLearningApiEnabled, false);
  const courses = await learningService.courses();
  assert.ok(Array.isArray(courses));
  assert.ok(courses.length > 0);
  assert.ok(courses[0].title.length > 0);
  const lessonList = await learningService.lessons(courses[0]._id);
  assert.ok(Array.isArray(lessonList));
  assert.ok(lessonList.length >= 1);
  assert.equal(typeof lessonList[0].title, 'string');
});

test('real learning repository calls the authenticated training-lms endpoints and maps them into course and lesson objects', async () => {
  process.env.EXPO_PUBLIC_MOBILE_LEARNING_API = 'true';
  const { learningApiRepository } = loadFeature('learningApiRepository');
  const calls = [];
  const request = async (path, options = {}) => {
    calls.push({ path, method: options.method || 'GET', body: options.body });
    if (path === '/api/training-lms/courses') {
      return {
        success: true,
        data: [{
          _id: 'course-1',
          title: 'Word nâng cao',
          description: 'Khóa học Word nâng cao',
          subject: 'Word',
          software: 'Word',
          progress: 60,
          enrolled: true,
          lessons: [{
            _id: 'lesson-1',
            title: 'Giới thiệu',
            duration: '00:10:00',
            progress: 50,
            completed: false,
            locked: false,
            content: 'Nội dung bài học',
            order: 1,
          }],
        }],
      };
    }
    if (path === '/api/training-lms/courses/course-1/lessons') {
      return {
        success: true,
        data: [{
          _id: 'lesson-1',
          title: 'Giới thiệu',
          duration: '00:10:00',
          watchedSeconds: 300,
          completed: false,
          locked: false,
          videoUrl: 'https://example.com/video.mp4',
          content: 'Nội dung bài học',
        }],
      };
    }
    if (path === '/api/training-lms/progress/me') {
      return { success: true, data: { 'lesson-1': 75 } };
    }
    if (path === '/api/training-lms/save-watch-progress') {
      return { success: true }
    }
    if (path === '/api/training-lms/complete-lesson') {
      return { success: true }
    }
    throw new Error(`Unexpected path: ${path}`);
  };

  const courses = await learningApiRepository.listCourses(request);
  const lessons = await learningApiRepository.listLessons('course-1', request);
  const progress = await learningApiRepository.getProgress(request);
  await learningApiRepository.saveProgress(request, { courseId: 'course-1', lessonId: 'lesson-1', watchedSeconds: 600 });
  await learningApiRepository.completeLesson(request, { courseId: 'course-1', lessonId: 'lesson-1', watchedSeconds: 600 });

  assert.equal(calls[0].path, '/api/training-lms/courses');
  assert.equal(courses[0].title, 'Word nâng cao');
  assert.equal(lessons[0].title, 'Giới thiệu');
  assert.equal(progress['lesson-1'], 75);
  assert.equal(calls[2].path, '/api/training-lms/progress/me');
  assert.equal(calls[3].path, '/api/training-lms/save-watch-progress');
  assert.equal(calls[4].path, '/api/training-lms/complete-lesson');
});

test('real learning logic stays centralized and no mock service embeds learning endpoints', () => {
  const mockServiceText = readText('src/services/mockService.ts');
  assert.doesNotMatch(mockServiceText, /api\/training-lms/i);
  assert.doesNotMatch(mockServiceText, /EXPO_PUBLIC_MOBILE_LEARNING_API/i);

  const parityScreenText = readText('src/screens/ParityScreens.tsx');
  assert.match(parityScreenText, /useStudentLearning/);
  assert.doesNotMatch(parityScreenText, /learningService\.courses\(\)/);

  const featureServiceText = readText('src/features/learning/learningService.ts');
  assert.match(featureServiceText, /EXPO_PUBLIC_MOBILE_LEARNING_API/);
  assert.match(featureServiceText, /mockLearningCourses/);
});
