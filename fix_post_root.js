const fs = require('fs');
const path = 'd:\\web\\WEB TỔNG HỢP\\DASHBOARDTHANGTINHOC\\modules\\teacher\\services\\TeacherApplicationService.js';
let content = fs.readFileSync(path, 'utf8');

const startIndex = content.indexOf('  async post_root(data) {');
const endIndex = content.indexOf('  async get_root(data) {');

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not find boundaries');
  process.exit(1);
}

const replacement = `  async post_root(data) {
  try {
    const { name, phone, specialty, subjectIds, password, status, branchId: reqBranchId, branchCode: reqBranchCode, startDate, address, email: rawEmail, baseSalaryPerSession, gender } = data.body;
    if (!name || !phone) {
      return { _status: 400, _body: { success: false, message: 'Vui lòng nhập Tên và Số điện thoại' } };
    }
    const emailTrim = (rawEmail || '').trim();
    const email = emailTrim && emailTrim !== 'email@example.com' ? emailTrim : undefined;
    try {
      const { assertUniqueContact } = require('../../../utils/uniqueContact');
      await assertUniqueContact({ phone, zalo: phone, email });
    } catch (dupErr) {
      if (dupErr.status === 409) {
        return { _status: 409, _body: { success: false, message: dupErr.message } };
      }
      throw dupErr;
    }
    if (password && String(password).trim().length > 0 && String(password).trim().length < 6) {
      return { _status: 400, _body: { success: false, message: 'Mật khẩu phải ít nhất 6 ký tự' } };
    }

    let finalBranchId   = null;
    let finalBranchCode = '';
    if (data.userBranchId) {
      finalBranchId   = data.userBranchId;
      finalBranchCode = data.userBranchCode || '';
    } else if (reqBranchId) {
      finalBranchId   = reqBranchId;
      finalBranchCode = reqBranchCode || '';
    }

    const normalizedSubjectIds = Array.isArray(subjectIds)
      ? [...new Set(subjectIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    const plainPassword = password && String(password).trim()
      ? String(password).trim()
      : require('../../../utils/tempPassword').generateTempPassword(8);
      
    const teacher = await require('../repositories').teacherRepository.create({
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
        require('../../notification/services/NotificationService').notifyAdmins(
          io,
          '🆕 Giảng viên mới',
          \`Đã tạo giảng viên \${teacher.name} (\${teacher.phone}).\`,
          { teacherId: teacher._id },
          '/admin/teachers',
        ).catch((err) => require('../../../config/logger').warn('[TEACHERS] notifyAdmins:', err.message));
      }

      welcome = await require('../../../services/accountWelcome').sendAccountWelcome(io, {
        role: 'teacher',
        userId: teacher._id,
        name: teacher.name,
        phone: teacher.phone,
        email: teacher.email,
        password: plainPassword,
      });
    }

    return { _status: 201, _body: {
      success: true,
      message: \`Đã tạo giảng viên \${teacher.name}\`,
      data: {
        ...teacher.toObject(),
        password: undefined,
        tempPassword: plainPassword,
        welcomeQueued: welcome.queued,
        welcomeNotified: welcome.notified,
      }
    } };
  } catch (error) {
    if (error.code === 11000) {
      return { _status: 409, _body: { success: false, message: 'Số điện thoại đã tồn tại' } };
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors || {}).map((e) => e.message).join(', ');
      return { _status: 400, _body: { success: false, message: msg || 'Dữ liệu không hợp lệ' } };
    }
    require('../../../config/logger').error('[TEACHERS] Create error:', error);
    return { _status: 500, _body: { success: false, message: error.message || 'Lỗi server' } };
  }
}

`;

content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync(path, content, 'utf8');
console.log('Successfully replaced post_root');
