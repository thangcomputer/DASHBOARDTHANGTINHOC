const fs = require('fs');

const ssFile = 'modules/student/services/StudentApplicationService.js';
const esFile = 'modules/enrollment/services/EnrollmentApplicationService.js';

let ssCode = fs.readFileSync(ssFile, 'utf8');

const methods = [
  'post_id_enrollments',
  'put_id_enrollments_enrollmentId_settings',
  'put_id_enrollments_enrollmentId_pay',
  'delete_id_enrollments_enrollmentId'
];

let extracted = '';

for (const m of methods) {
  const startIdx = ssCode.indexOf(`  async ${m}`);
  if (startIdx === -1) {
    console.log(`Method ${m} not found!`);
    continue;
  }
  let depth = 0;
  let i = startIdx;
  let started = false;
  while (i < ssCode.length) {
    const ch = ssCode[i];
    if (ch === '{') { started = true; depth++; }
    if (ch === '}') { depth--; }
    i++;
    if (started && depth === 0) {
      break;
    }
  }
  // read trailing newline
  while (i < ssCode.length && (ssCode[i] === '\n' || ssCode[i] === '\r')) {
    i++;
  }
  const block = ssCode.slice(startIdx, i);
  extracted += block + '\n\n';
  ssCode = ssCode.slice(0, startIdx) + ssCode.slice(i);
}

const esCode = `'use strict';
const { studentRepository } = require('../../student/repositories');
const Student = require('../../student/models/Student');
const Schedule = require('../../attendance/models/Schedule');
const Invoice = require('../../finance/models/Invoice');
const logger = require('../../../config/logger');
const { settlePayment, postRefund, voidLedgerEntry, postSalary } = require('../../finance/services/ledgerService');
const { applyEnrollmentStats, resolveEnrollmentExamSubjects } = require('./enrollmentService');

class EnrollmentApplicationService {
${extracted}
}

module.exports = new EnrollmentApplicationService();
`;

fs.writeFileSync(esFile, esCode);
fs.writeFileSync(ssFile, ssCode);
console.log('✅ Extraction complete');
