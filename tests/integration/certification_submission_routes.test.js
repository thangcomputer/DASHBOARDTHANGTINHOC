'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { Phase15LiveHarness } = require('../helpers/phase15LiveHarness');

const harness = new Phase15LiveHarness();
let studentId;
let studentToken;
let otherStudentToken;
const staffTokens = {};
let uploadedFileUrl;

async function login(phone, password) {
  return harness.request('POST', '/api/auth/login/public', {
    body: { phone, password, role: 'student' },
  });
}

async function internalLogin(phone, password) {
  const captcha = await harness.captcha();
  return harness.request('POST', '/api/auth/login/internal', {
    body: { phone, password, ...captcha },
  });
}

async function seedFixtures() {
  const Student = require('../../models/Student');
  const Teacher = require('../../models/Teacher');
  const student = await Student.create({
    name: 'Certification Integration Student',
    phone: '0905551001',
    zalo: '0905551001',
    password: 'CertificationPass!1',
    course: 'Word căn bản',
    price: 1000000,
    status: 'Đang học',
    paid: true,
    studentExamUnlocked: true,
    examProgress: [{
      id: 'word',
      status: 'dang_thi',
      attemptStatus: 'submitted',
      thucHanh: 'chua_nop',
      tracNghiem: { score: 8, total: 10 },
    }],
  });
  await Student.create({
    name: 'Other Certification Student',
    phone: '0905551002',
    zalo: '0905551002',
    password: 'CertificationPass!2',
    course: 'Word căn bản',
    price: 1000000,
    status: 'Đang học',
    paid: true,
    studentExamUnlocked: true,
  });
  await Teacher.create({
    name: 'Certification Teacher',
    phone: '0905551010',
    password: 'CertificationTeacher!1',
    role: 'teacher',
    status: 'pending',
    subjectIds: ['word'],
  });
  await Teacher.create({
    name: 'Certification Staff',
    phone: '0905551011',
    password: 'CertificationStaff!1',
    role: 'staff',
    adminRole: 'STAFF',
    status: 'active',
  });
  await Teacher.create({
    name: 'Certification Admin',
    phone: '0905551012',
    password: 'CertificationAdmin!1',
    role: 'admin',
    adminRole: 'HIGH_ADMIN',
    status: 'active',
  });
  studentId = String(student._id);
}

test.before(async () => {
  await harness.resetAndSeed(seedFixtures);
  await harness.start();
  const student = await login('0905551001', 'CertificationPass!1');
  const other = await login('0905551002', 'CertificationPass!2');
  assert.equal(student.response.status, 200);
  assert.equal(other.response.status, 200);
  studentToken = student.json.data.accessToken;
  otherStudentToken = other.json.data.accessToken;
  const teacher = await harness.request('POST', '/api/auth/login/public', {
    body: { phone: '0905551010', password: 'CertificationTeacher!1', role: 'teacher' },
  });
  assert.equal(teacher.response.status, 200);
  staffTokens.teacher = teacher.json.data.accessToken;
  for (const [role, phone, password] of [
    ['staff', '0905551011', 'CertificationStaff!1'],
    ['admin', '0905551012', 'CertificationAdmin!1'],
  ]) {
    const internal = await internalLogin(phone, password);
    assert.equal(internal.response.status, 200);
    staffTokens[role] = internal.json.data.accessToken;
  }
});

test.after(async () => {
  await harness.stop();
});

test('certification upload rejects spoofed file content', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from('not a real Word document')]), 'spoofed.docx');
  const response = await fetch(`${harness.baseUrl}/api/assignments/upload?context=certification`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${studentToken}`,
      Cookie: harness.cookie,
      'X-CSRF-Token': harness.csrfToken,
    },
    body: form,
  });
  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.match(payload.message, /không khớp/i);
});

test('certification upload registers an owned FileAsset', async () => {
  const form = new FormData();
  form.append('file', new Blob([Buffer.from([0x50, 0x4b, 0x03, 0x04])]), 'answer.docx');
  const response = await fetch(`${harness.baseUrl}/api/assignments/upload?context=certification`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${studentToken}`,
      Cookie: harness.cookie,
      'X-CSRF-Token': harness.csrfToken,
    },
    body: form,
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  uploadedFileUrl = payload.fileUrl;

  const FileAsset = require('../../models/FileAsset');
  await mongoose.connect(process.env.TEST_DATABASE_URI);
  const asset = await FileAsset.findOne({ url: payload.fileUrl }).lean();
  await mongoose.disconnect();
  assert.equal(String(asset.uploadedBy), studentId);
  assert.equal(asset.relatedType, 'certification_submission');
});

test('student cannot submit practical work without a certification file', async () => {
  const result = await harness.request('PUT', `/api/students/${studentId}/exam-progress`, {
    token: studentToken,
    body: {
      subjectId: 'word',
      changes: { thucHanh: 'da_nop' },
    },
  });
  assert.equal(result.response.status, 400);
  assert.match(result.json.message, /file/i);
});

test('another student cannot use the uploaded certification file', async () => {
  assert.ok(uploadedFileUrl);

  const result = await harness.request('PUT', `/api/students/${studentId}/exam-progress`, {
    token: otherStudentToken,
    body: {
      subjectId: 'word',
      changes: { thucHanh: 'da_nop', essayFile: uploadedFileUrl },
    },
  });
  assert.equal(result.response.status, 403);
});

test('certification download requires authentication and enforces token revocation', async () => {
  assert.ok(uploadedFileUrl);

  const unauthenticated = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
    headers: { Accept: 'application/json' },
  });
  assert.equal(unauthenticated.status, 401);

  const ownDownload = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(ownDownload.status, 200);

  for (const role of ['teacher', 'staff', 'admin']) {
    const staffDownload = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
      headers: { Authorization: `Bearer ${staffTokens[role]}` },
    });
    assert.equal(staffDownload.status, 200, role);
  }

  const otherDownload = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
    headers: { Authorization: `Bearer ${otherStudentToken}` },
  });
  assert.equal(otherDownload.status, 403);

  const FileAsset = require('../../models/FileAsset');
  await mongoose.connect(process.env.TEST_DATABASE_URI);
  await FileAsset.updateOne(
    { url: uploadedFileUrl },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  await mongoose.disconnect();
  const expiredDownload = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(expiredDownload.status, 404);

  await mongoose.connect(process.env.TEST_DATABASE_URI);
  await FileAsset.updateOne(
    { url: uploadedFileUrl },
    { $set: { expiresAt: null } },
  );
  await mongoose.disconnect();
  const logout = await harness.request('POST', '/api/auth/logout', {
    token: studentToken,
    body: {},
  });
  assert.equal(logout.response.status, 200);
  const revokedDownload = await fetch(`${harness.baseUrl}${uploadedFileUrl}`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  assert.equal(revokedDownload.status, 401);
});
