/**
 * ensureIndexes.js — Đồng bộ indexes MongoDB khi server khởi động
 */
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Message = require('../models/Message');
const Transaction = require('../models/Transaction');
const Invoice = require('../models/Invoice');
const Evaluation = require('../models/Evaluation');
const Notification = require('../models/Notification');
const SystemLog = require('../models/SystemLog');
const Group = require('../models/Group');
const Course = require('../models/Course');
const Branch = require('../models/Branch');
const ExamResult = require('../models/ExamResult');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const PaymentSession = require('../models/PaymentSession');
const Employee = require('../models/Employee');
const PayrollLog = require('../models/PayrollLog');
const ScheduleHistory = require('../models/ScheduleHistory');
const TrainingProgress = require('../models/TrainingProgress');
const TrainingLesson = require('../models/TrainingLesson');
const TeachingGuide = require('../models/TeachingGuide');
const FileAsset = require('../models/FileAsset');
const BackupJob = require('../models/BackupJob');
const WorkflowInstance = require('../models/WorkflowInstance');
const FormDefinition = require('../models/FormDefinition');
const FormSubmission = require('../models/FormSubmission');
const ReportDefinition = require('../models/ReportDefinition');
const Tenant = require('../models/Tenant');

async function ensureIndexes() {
  try {
    await Promise.all([
      Student.syncIndexes(),
      Teacher.syncIndexes(),
      Schedule.syncIndexes(),
      Message.syncIndexes(),
      Transaction.syncIndexes(),
      Invoice.syncIndexes(),
      Evaluation.syncIndexes(),
      Notification.syncIndexes(),
      SystemLog.syncIndexes(),
      Group.syncIndexes(),
      Course.syncIndexes(),
      Branch.syncIndexes(),
      ExamResult.syncIndexes(),
      Assignment.syncIndexes(),
      Submission.syncIndexes(),
      PaymentSession.syncIndexes(),
      Employee.syncIndexes(),
      PayrollLog.syncIndexes(),
      ScheduleHistory.syncIndexes(),
      TrainingProgress.syncIndexes(),
      TrainingLesson.syncIndexes(),
      TeachingGuide.syncIndexes(),
      FileAsset.syncIndexes(),
      BackupJob.syncIndexes(),
      WorkflowInstance.syncIndexes(),
      FormDefinition.syncIndexes(),
      FormSubmission.syncIndexes(),
      ReportDefinition.syncIndexes(),
      Tenant.syncIndexes(),
    ]);
    console.log('✅ MongoDB indexes đã đồng bộ');
  } catch (err) {
    console.error('⚠️  Lỗi đồng bộ indexes:', err.message);
  }
}

module.exports = ensureIndexes;
