const fs = require('fs');
const path = require('path');

const studentServicePath = path.join(__dirname, 'modules/student/services/StudentApplicationService.js');
const studentControllerPath = path.join(__dirname, 'modules/student/controllers/StudentController.js');
const studentRoutesPath = path.join(__dirname, 'modules/student/routes/studentRoutes.js');

const enrollmentServicePath = path.join(__dirname, 'modules/enrollment/services/EnrollmentApplicationService.js');
const enrollmentControllerPath = path.join(__dirname, 'modules/enrollment/controllers/EnrollmentController.js');

// 1. Extract methods from StudentApplicationService
const ssCode = fs.readFileSync(studentServicePath, 'utf8');
const scCode = fs.readFileSync(studentControllerPath, 'utf8');
let srCode = fs.readFileSync(studentRoutesPath, 'utf8');

const methods = [
  'post_id_enrollments',
  'put_id_enrollments_enrollmentId_settings',
  'put_id_enrollments_enrollmentId_pay',
  'delete_id_enrollments_enrollmentId'
];

let enrollmentServiceMethods = '';
let newSsCode = ssCode;

for (const m of methods) {
  const methodRegex = new RegExp(`  async ${m}\\(data\\) \\{[\\s\\S]*?\\n  \\}\\n\\n`);
  const match = newSsCode.match(methodRegex);
  if (match) {
    enrollmentServiceMethods += match[0];
    newSsCode = newSsCode.replace(match[0], '');
  } else {
    console.error(`Method ${m} not found in StudentApplicationService`);
  }
}

// Write EnrollmentApplicationService
const esCode = `'use strict';
const { studentRepository } = require('../../student/repositories');
const Student = require('../../student/models/Student');
const Schedule = require('../../attendance/models/Schedule');
const Invoice = require('../../finance/models/Invoice');
const logger = require('../../../config/logger');
const { settlePayment, postRefund, voidLedgerEntry, postSalary } = require('../../finance/services/ledgerService');
const { applyEnrollmentStats, resolveEnrollmentExamSubjects } = require('./enrollmentService');

class EnrollmentApplicationService {
${enrollmentServiceMethods}
}

module.exports = new EnrollmentApplicationService();
`;
fs.mkdirSync(path.dirname(enrollmentServicePath), { recursive: true });
fs.writeFileSync(enrollmentServicePath, esCode);
fs.writeFileSync(studentServicePath, newSsCode);

// 2. Extract methods from StudentController
let enrollmentControllerMethods = '';
let newScCode = scCode;

for (const m of methods) {
  const methodRegex = new RegExp(`  async ${m}\\(req, res\\) \\{[\\s\\S]*?\\n  \\}\\n\\n`);
  const match = newScCode.match(methodRegex);
  if (match) {
    enrollmentControllerMethods += match[0].replace(/studentApplicationService\./g, 'enrollmentApplicationService.');
    newScCode = newScCode.replace(match[0], '');
  } else {
    console.error(`Method ${m} not found in StudentController`);
  }
}

const ecCode = `'use strict';
const enrollmentApplicationService = require('../services/EnrollmentApplicationService');

class EnrollmentController {
${enrollmentControllerMethods}
}

module.exports = new EnrollmentController();
`;
fs.mkdirSync(path.dirname(enrollmentControllerPath), { recursive: true });
fs.writeFileSync(enrollmentControllerPath, ecCode);
fs.writeFileSync(studentControllerPath, newScCode);

// 3. Update Routes
for (const m of methods) {
  srCode = srCode.replace(`studentController.${m}`, `enrollmentController.${m}`);
}
// Add import if needed
if (!srCode.includes('EnrollmentController')) {
  srCode = srCode.replace(
    `const studentController = require('../controllers/StudentController');`,
    `const studentController = require('../controllers/StudentController');\nconst enrollmentController = require('../../enrollment/controllers/EnrollmentController');`
  );
}
fs.writeFileSync(studentRoutesPath, srCode);

console.log('✅ Enrollment domain separated from Student domain');
