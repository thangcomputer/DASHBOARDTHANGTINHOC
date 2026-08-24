const test = require('node:test');
const assert = require('node:assert/strict');
const { canDeletePost, canDeleteComment, canEditPost } = require('../../services/policyShadow/feedPolicy');

test('Feed comment & post delete protection rules', async (t) => {
  const superAdmin = { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN' };
  const superAdminDb = { id: 'super_db_1', role: 'admin', adminRole: 'SUPER_ADMIN' };
  const highAdmin = { id: 'high_1', role: 'admin', adminRole: 'HIGH_ADMIN' };
  const staff = { id: 'staff_1', role: 'staff', adminRole: 'STAFF' };
  const regularAdmin = { id: 'admin_reg_1', role: 'admin', adminRole: null };
  const teacher = { id: 'teacher_1', role: 'teacher' };
  const student1 = { id: 'student_1', role: 'student' };
  const student2 = { id: 'student_2', role: 'student' };

  // Post & comments created by Super Admin
  const superPost = {
    authorId: 'admin',
    authorRole: 'admin',
    authorAdminRole: 'SUPER_ADMIN',
  };
  const superComment = {
    authorId: 'admin',
    authorRole: 'admin',
    authorAdminRole: 'SUPER_ADMIN',
  };

  // Post & comments created by Student
  const studentPost = {
    authorId: 'student_1',
    authorRole: 'student',
  };
  const studentComment = {
    authorId: 'student_1',
    authorRole: 'student',
  };

  // Comment created by High Admin
  const highComment = {
    authorId: 'high_1',
    authorRole: 'admin',
    authorAdminRole: 'HIGH_ADMIN',
  };

  await t.test('1. Super Admin comment CANNOT be deleted by anyone except Super Admin', () => {
    // Super admin themselves: ALLOW
    assert.equal(canDeleteComment(superAdmin, studentPost, superComment), true);
    assert.equal(canDeleteComment(superAdminDb, studentPost, superComment), true);

    // High Admin: DENIED
    assert.equal(canDeleteComment(highAdmin, studentPost, superComment), false);

    // Staff: DENIED
    assert.equal(canDeleteComment(staff, studentPost, superComment), false);

    // Regular Admin: DENIED
    assert.equal(canDeleteComment(regularAdmin, studentPost, superComment), false);

    // Post owner (student 1): DENIED
    assert.equal(canDeleteComment(student1, studentPost, superComment), false);

    // Other students / teachers: DENIED
    assert.equal(canDeleteComment(student2, studentPost, superComment), false);
    assert.equal(canDeleteComment(teacher, studentPost, superComment), false);
  });

  await t.test('2. Super Admin post CANNOT be deleted by anyone except Super Admin', () => {
    assert.equal(canDeletePost(superAdmin, superPost), true);
    assert.equal(canDeletePost(superAdminDb, superPost), true);
    assert.equal(canDeletePost(highAdmin, superPost), false);
    assert.equal(canDeletePost(staff, superPost), false);
    assert.equal(canDeletePost(regularAdmin, superPost), false);
    assert.equal(canDeletePost(student1, superPost), false);
  });

  await t.test('3. Authors can always delete their own comments and posts', () => {
    assert.equal(canDeleteComment(student1, studentPost, studentComment), true);
    assert.equal(canDeletePost(student1, studentPost), true);
    assert.equal(canDeleteComment(highAdmin, studentPost, highComment), true);
  });

  await t.test('4. Super Admin and High Admin can delete anyone elses comment or post', () => {
    // Super admin deletes student comment/post
    assert.equal(canDeleteComment(superAdmin, studentPost, studentComment), true);
    assert.equal(canDeletePost(superAdmin, studentPost), true);

    // High admin deletes student comment/post
    assert.equal(canDeleteComment(highAdmin, studentPost, studentComment), true);
    assert.equal(canDeletePost(highAdmin, studentPost), true);

    // Super admin deletes high admin comment
    assert.equal(canDeleteComment(superAdmin, studentPost, highComment), true);

    // High admin deletes another student comment on high admin post
    assert.equal(canDeleteComment(highAdmin, studentPost, studentComment), true);
  });

  await t.test('5. Non-elevated roles (Staff, Regular Admin, Teacher, Student) CANNOT delete other people post', () => {
    // Staff cannot delete student post
    assert.equal(canDeletePost(staff, studentPost), false);
    // Regular admin cannot delete student post
    assert.equal(canDeletePost(regularAdmin, studentPost), false);
    // Teacher cannot delete student post
    assert.equal(canDeletePost(teacher, studentPost), false);
    // Another student cannot delete student post
    assert.equal(canDeletePost(student2, studentPost), false);

    // Another student cannot delete student comment
    assert.equal(canDeleteComment(student2, studentPost, studentComment), false);
    // Teacher cannot delete student comment
    assert.equal(canDeleteComment(teacher, studentPost, studentComment), false);
  });

  await t.test('6. Edit Post permissions: ONLY author and Super Admin can edit post', () => {
    // Author can edit own post
    assert.equal(canEditPost(student1, studentPost), true);
    // Super admin can edit any post
    assert.equal(canEditPost(superAdmin, studentPost), true);
    assert.equal(canEditPost(superAdminDb, studentPost), true);

    // High Admin CANNOT edit someone else's post
    assert.equal(canEditPost(highAdmin, studentPost), false);
    // Staff CANNOT edit someone else's post
    assert.equal(canEditPost(staff, studentPost), false);
    // Regular admin CANNOT edit someone else's post
    assert.equal(canEditPost(regularAdmin, studentPost), false);
    // Teacher CANNOT edit someone else's post
    assert.equal(canEditPost(teacher, studentPost), false);
    // Another student CANNOT edit someone else's post
    assert.equal(canEditPost(student2, studentPost), false);
  });
});


