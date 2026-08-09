const fs = require('fs');

const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let content = fs.readFileSync(path, 'utf8');

const regex = /const isAssigningBranch = !!\(finalBranchId \|\| finalBranchCode\);\s+const msg = Object\.values\(error\.errors \|\| \{\}\)\.map\(\(e\) => e\.message\)\.join\(\', \'\);\s+return \{ _status: 400, _body: \(\{ success: false, message: msg \|\| \'Dữ liệu không hợp lệ\' \}\);/g;

const replacement = `const isAssigningBranch = !!(finalBranchId || finalBranchCode);
    
    const normalizedSubjectIds = Array.isArray(subjectIds)
      ? [...new Set(subjectIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    const plainPassword = password && String(password).trim()
      ? String(password).trim()
      : generateTempPassword(8);
      
    const teacher = await teacherRepository.create({
      name,
      phone,
      email,
      specialty: specialty || normalizedSubjectIds.join(', '),
      subjectIds: normalizedSubjectIds,
      startDate: startDate || Date.now(),
      address:   address   || '',
      password:  plainPassword,
      status:    status || 'inactive',
      testStatus: null,
      role: 'teacher',
      isFirstLogin: true,
      branchId:   finalBranchId,
      branchCode: finalBranchCode,
      gender:     gender || 'male',
      baseSalaryPerSession: Math.max(0, Number(baseSalaryPerSession) || 0),
    });

    const io = data.app?.get?.('io') || null;
    let welcome = { queued: false, notified: false };
    
    if (!data.skipSideEffects) {
      if (io) {
        io.emit('teacher:new', {
          teacherId: teacher._id,
          name: teacher.name,
          branchCode: teacher.branchCode,
          message: \`Giảng viên mới: \${teacher.name} — Chi nhánh: \${teacher.branchCode || 'Chưa phân'}\`,
        });
        NotificationService.notifyAdmins(
          io,
          '🆕 Giảng viên mới',
          \`Đã tạo giảng viên \${teacher.name} (\${teacher.phone}).\`,
          { teacherId: teacher._id },
          '/admin/teachers',
        ).catch((err) => logger.warn('[TEACHERS] notifyAdmins:', err.message));
      }

      welcome = await sendAccountWelcome(io, {
        role: 'teacher',
        userId: teacher._id,
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email,
        password: plainPassword,
      });
    }

    return { _status: 201, _body: ({
      success: true,
      message: \`Đã tạo giảng viên \${teacher.name}\`,
      data: {
        ...teacher.toObject(),
        password: undefined,
        tempPassword: plainPassword,
        welcomeQueued: welcome.queued,
        welcomeNotified: welcome.notified,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return { _status: 409, _body: ({ success: false, message: 'Số điện thoại đã tồn tại' });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors || {}).map((e) => e.message).join(', ');
      return { _status: 400, _body: ({ success: false, message: msg || 'Dữ liệu không hợp lệ' });`;

content = content.replace(regex, replacement);
fs.writeFileSync(path, content, 'utf8');
console.log('Fixed successfully');
