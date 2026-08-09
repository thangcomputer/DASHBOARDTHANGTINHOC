const fs = require('fs');
const path = require('path');

const pairs = [
  ['modules/student/models/Student.js', 'models/Student.js'],
  ['modules/teacher/models/Teacher.js', 'models/Teacher.js'],
  ['modules/invoice/models/Invoice.js', 'models/Invoice.js'],
  ['modules/attendance/models/Schedule.js', 'models/Schedule.js'],
  ['modules/finance/models/LedgerEntry.js', 'models/LedgerEntry.js'],
  ['modules/notification/models/Notification.js', 'models/Notification.js'],
  ['modules/branch/models/Branch.js', 'models/Branch.js'],
  ['modules/chat/models/Message.js', 'models/Message.js'],
  ['modules/exam/models/ExamResult.js', 'models/ExamResult.js'],
  ['modules/exam/models/LessonQuiz.js', 'models/LessonQuiz.js'],
  ['modules/exam/models/Evaluation.js', 'models/Evaluation.js'],
  ['modules/payment/models/PaymentSession.js', 'models/PaymentSession.js'],
  ['modules/payment/models/SepayWebhookEvent.js', 'models/SepayWebhookEvent.js'],
  ['modules/finance/models/CreditNote.js', 'models/CreditNote.js'],
  ['modules/finance/models/PayrollLog.js', 'models/PayrollLog.js'],
  ['modules/finance/models/FinanceDailySnapshot.js', 'models/FinanceDailySnapshot.js'],
  ['modules/blog/models/BlogPost.js', 'models/BlogPost.js'],
  ['modules/feed/models/FeedPost.js', 'models/FeedPost.js'],
  ['modules/file/models/FileAsset.js', 'models/FileAsset.js'],
  ['modules/course/models/Course.js', 'models/Course.js'],
  ['modules/course/models/Assignment.js', 'models/Assignment.js'],
  ['modules/auth/models/Employee.js', 'models/Employee.js'],
];

for (const [modRel, rootRel] of pairs) {
  const modAbs = path.join(__dirname, '..', modRel);
  const rootAbs = path.join(__dirname, '..', rootRel);
  if (!fs.existsSync(modAbs) || !fs.existsSync(rootAbs)) {
    console.log('skip missing', modRel);
    continue;
  }
  // depth from modules/x/models/file -> ../../../models
  const depth = modRel.split('/').length - 1;
  const rel = `${'../'.repeat(depth)}${rootRel.replace(/\\/g, '/')}`;
  fs.writeFileSync(
    modAbs,
    `/** Canonical: ${rootRel} — re-export to avoid mongoose dual registration */\nmodule.exports = require('${rel}');\n`
  );
  console.log('re-export', modRel, '->', rel);
}
