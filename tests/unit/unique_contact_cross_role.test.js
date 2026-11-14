'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const { assertUniqueContact } = require('../../utils/uniqueContact');
const authRouter = require('../../routes/authRoutes');

function stubQuery(result) {
  return {
    select() { return this; },
    limit() { return this; },
    lean() { return Promise.resolve(result); },
    then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
  };
}

test('assertUniqueContact rejects MASTER_ADMIN_PHONE and MASTER_ADMIN_EMAIL', async () => {
  const prevPhone = process.env.MASTER_ADMIN_PHONE;
  const prevEmail = process.env.MASTER_ADMIN_EMAIL;
  process.env.MASTER_ADMIN_PHONE = '0935758462';
  process.env.MASTER_ADMIN_EMAIL = 'admin@thangtinhoc.vn';

  const origStudentFindOne = Student.findOne;
  const origTeacherFindOne = Teacher.findOne;
  Student.findOne = () => stubQuery(null);
  Teacher.findOne = () => stubQuery(null);

  try {
    await assert.rejects(
      () => assertUniqueContact({ phone: '0935758462' }),
      (err) => err.status === 409 && /Admin/i.test(err.message),
    );
    await assert.rejects(
      () => assertUniqueContact({ phone: '+84935758462' }),
      (err) => err.status === 409 && /Admin/i.test(err.message),
    );
    await assert.rejects(
      () => assertUniqueContact({ email: 'ADMIN@thangtinhoc.vn' }),
      (err) => err.status === 409 && /Admin/i.test(err.message),
    );
    await assert.equal(
      await assertUniqueContact({ phone: '0911222333', email: 'new@example.com' }),
      true,
    );
  } finally {
    Student.findOne = origStudentFindOne;
    Teacher.findOne = origTeacherFindOne;
    if (prevPhone === undefined) delete process.env.MASTER_ADMIN_PHONE;
    else process.env.MASTER_ADMIN_PHONE = prevPhone;
    if (prevEmail === undefined) delete process.env.MASTER_ADMIN_EMAIL;
    else process.env.MASTER_ADMIN_EMAIL = prevEmail;
  }
});

test('assertUniqueContact labels admin/staff conflicts accurately and checks email case-insensitively', async () => {
  const origStudentFindOne = Student.findOne;
  const origTeacherFindOne = Teacher.findOne;

  Student.findOne = () => stubQuery(null);
  Teacher.findOne = (q) => {
    if (q?.email instanceof RegExp && q.email.test('boss@thangtinhoc.vn')) {
      return stubQuery({ name: 'Admin A', email: 'Boss@thangtinhoc.vn', role: 'admin' });
    }
    return stubQuery(null);
  };

  try {
    await assert.rejects(
      () => assertUniqueContact({ email: 'boss@thangtinhoc.vn' }),
      (err) => err.status === 409 && err.message.includes('quản trị viên'),
    );
  } finally {
    Student.findOne = origStudentFindOne;
    Teacher.findOne = origTeacherFindOne;
  }
});

test('lookupUserByPhone and lookupUserByEmail fail closed for MASTER_ADMIN and cross-role duplicates', async () => {
  const prevPhone = process.env.MASTER_ADMIN_PHONE;
  const prevEmail = process.env.MASTER_ADMIN_EMAIL;
  process.env.MASTER_ADMIN_PHONE = '0935758462';
  process.env.MASTER_ADMIN_EMAIL = 'admin@thangtinhoc.vn';

  const origStudentFind = Student.find;
  const origTeacherFind = Teacher.find;

  // Simulate duplicate email existing in both Student and Teacher
  Student.find = () => stubQuery([{ _id: 's1', email: 'dup@gmail.com' }]);
  Teacher.find = () => stubQuery([{ _id: 't1', email: 'dup@gmail.com', role: 'teacher' }]);

  try {
    assert.equal(await authRouter._test.lookupUserByPhone('0935758462', 'student'), null);
    assert.equal(await authRouter._test.lookupUserByPhone('0935758462', 'teacher'), null);
    assert.equal(await authRouter._test.lookupUserByEmail('admin@thangtinhoc.vn', 'student'), null);
    assert.equal(await authRouter._test.lookupUserByEmail('dup@gmail.com', 'student'), null);
    assert.equal(await authRouter._test.lookupUserByEmail('dup@gmail.com', 'teacher'), null);

    // Admin stored in Teacher collection cannot log in as teacher via email
    Student.find = () => stubQuery([]);
    Teacher.find = () => stubQuery([{ _id: 'a1', email: 'staff@thangtinhoc.vn', role: 'admin' }]);
    assert.equal(await authRouter._test.lookupUserByEmail('staff@thangtinhoc.vn', 'teacher'), null);
  } finally {
    Student.find = origStudentFind;
    Teacher.find = origTeacherFind;
    if (prevPhone === undefined) delete process.env.MASTER_ADMIN_PHONE;
    else process.env.MASTER_ADMIN_PHONE = prevPhone;
    if (prevEmail === undefined) delete process.env.MASTER_ADMIN_EMAIL;
    else process.env.MASTER_ADMIN_EMAIL = prevEmail;
  }
});

