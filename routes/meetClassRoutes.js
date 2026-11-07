'use strict';

const express = require('express');
const mongoose = require('mongoose');
const MeetClass = require('../models/MeetClass');
const { SLOTS } = MeetClass;
const Student = require('../models/Student');
const { authMiddleware, checkPermission, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  hasMeetAccess,
  listMeetEligibleStudents,
  MAX_MEET_CLASS_STUDENTS,
} = require('../services/subscriptionService');

const router = express.Router();
const adminGuard = [authMiddleware, branchFilter, checkPermission(PERMISSIONS.MANAGE_STUDENTS)];

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function cleanDay(raw) {
  const day = String(raw || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw httpError(400, 'Ngày học không hợp lệ');
  return day;
}

function cleanMeetLink(raw) {
  const link = String(raw || '').trim();
  if (!link) throw httpError(400, 'Hãy dán link Google Meet');
  if (!/^https?:\/\//i.test(link)) throw httpError(400, 'Link Meet phải bắt đầu bằng http:// hoặc https://');
  return link.slice(0, 500);
}

function cleanClock(raw, label) {
  const text = String(raw || '').trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!match) throw httpError(400, `${label} phải dạng HH:mm`);
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw httpError(400, `${label} không hợp lệ`);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function clockMinutes(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
}

function resolveSlotTimes(body) {
  const slotKey = String(body?.slot || 'evening');
  if (slotKey === 'custom') {
    const startTime = cleanClock(body?.startTime, 'Giờ bắt đầu');
    const endTime = cleanClock(body?.endTime, 'Giờ kết thúc');
    if (clockMinutes(endTime) <= clockMinutes(startTime)) throw httpError(400, 'Giờ kết thúc phải sau giờ bắt đầu');
    return { slotKey, startTime, endTime };
  }
  const slot = SLOTS[slotKey];
  if (!slot) throw httpError(400, 'Hãy chọn ca Sáng, Chiều, Tối hoặc Giờ tùy chọn');
  return { slotKey, startTime: slot.startTime, endTime: slot.endTime };
}

function view(row, { withStudents = false } = {}) {
  const slot = row.slot === 'custom' ? { label: 'Tùy chọn' } : (SLOTS[row.slot] || { label: '' });
  return {
    id: String(row._id),
    title: row.title || 'Học Meet',
    day: row.day,
    slot: row.slot,
    slotLabel: slot.label || '',
    startTime: row.startTime,
    endTime: row.endTime,
    status: row.status,
    note: row.note || '',
    linkHoc: String(row.linkHoc || '').trim(),
    inviteAllMeetPackage: row.inviteAllMeetPackage === true,
    studentCount: Array.isArray(row.studentIds) ? row.studentIds.length : 0,
    ...(withStudents ? { students: (row.students || []).map((student) => ({ id: String(student.id), name: student.name || '' })) } : {}),
    createdAt: row.createdAt,
  };
}

router.get('/mine', authMiddleware, async (req, res) => {
  try {
    if (req.user?.role !== 'student') {
      return res.status(403).json({ success: false, message: 'Chỉ học viên xem lịch của mình' });
    }
    const student = await Student.findById(req.user.id).select('subscription freePortal').lean();
    if (!student || !hasMeetAccess(student)) {
      return res.json({ success: true, data: [], meetAccess: false });
    }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const rows = await MeetClass.find({
      status: 'scheduled',
      studentIds: req.user.id,
      day: { $gte: today },
    }).sort({ day: 1, startTime: 1 }).limit(20).lean();
    return res.json({ success: true, data: rows.map((row) => view(row)), meetAccess: true });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không tải được lịch Meet' });
  }
});

router.get('/eligible-students', ...adminGuard, async (req, res) => {
  try {
    const data = await listMeetEligibleStudents(req.branchFilter || {});
    return res.json({
      success: true,
      data,
      count: data.length,
      max: MAX_MEET_CLASS_STUDENTS,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không tải được danh sách học viên gói Meet' });
  }
});

router.get('/', ...adminGuard, async (req, res) => {
  try {
    const rows = await MeetClass.find({}).sort({ day: -1, startTime: -1 }).limit(40).lean();
    return res.json({ success: true, data: rows.map((row) => view(row, { withStudents: true })), slots: SLOTS });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Không tải được lịch Meet' });
  }
});

router.post('/', ...adminGuard, async (req, res) => {
  try {
    const day = cleanDay(req.body?.day);
    const { slotKey, startTime, endTime } = resolveSlotTimes(req.body);
    const linkHoc = cleanMeetLink(req.body?.linkHoc);
    const inviteAllMeetPackage = req.body?.allMeetPackage === true;
    let ids = [];
    if (inviteAllMeetPackage) {
      ids = (await listMeetEligibleStudents(req.branchFilter || {})).map((row) => row.id);
    } else {
      ids = [...new Set((Array.isArray(req.body?.studentIds) ? req.body.studentIds : []).map((id) => String(id || '').trim()).filter(Boolean))];
    }
    if (!ids.length) throw httpError(400, inviteAllMeetPackage ? 'Không có học viên gói Meet trong phạm vi quản lý' : 'Hãy chọn ít nhất một học viên');
    if (ids.length > MAX_MEET_CLASS_STUDENTS) throw httpError(400, `Một buổi tối đa ${MAX_MEET_CLASS_STUDENTS} học viên`);
    if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Học viên không hợp lệ');
    const found = await Student.find({ _id: { $in: ids } }).select('name subscription freePortal').lean();
    if (found.length !== ids.length) throw httpError(400, 'Có học viên không còn trong hệ thống');
    const missingMeet = found.filter((row) => !hasMeetAccess(row)).map((row) => row.name || 'Học viên');
    const notFreePortal = found.filter((row) => row.freePortal !== true).map((row) => row.name || 'Học viên');
    if (notFreePortal.length) throw httpError(400, `Không phải tài khoản miễn phí / Meet online: ${notFreePortal.join(', ')}`);
    if (missingMeet.length) throw httpError(400, `Học viên chưa có gói Meet: ${missingMeet.join(', ')}`);
    const byId = new Map(found.map((student) => [String(student._id), student.name || 'Học viên']));
    const created = await MeetClass.create({
      title: String(req.body?.title || 'Học Meet').trim().slice(0, 80) || 'Học Meet',
      day,
      slot: slotKey,
      startTime,
      endTime,
      linkHoc,
      inviteAllMeetPackage,
      studentIds: ids,
      students: ids.map((id) => ({ id, name: byId.get(id) || 'Học viên' })),
      note: String(req.body?.note || '').trim().slice(0, 200),
      createdById: String(req.user.id || req.user._id || ''),
      createdByName: String(req.user.name || ''),
    });
    return res.json({ success: true, data: view(created.toObject(), { withStudents: true }) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không tạo được buổi Meet' });
  }
});

router.patch('/:id/link', ...adminGuard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, 'Buổi học không hợp lệ');
    const linkHoc = cleanMeetLink(req.body?.linkHoc);
    const updated = await MeetClass.findOneAndUpdate(
      { _id: req.params.id, status: 'scheduled' },
      { $set: { linkHoc } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw httpError(404, 'Không tìm thấy buổi đang mở');
    return res.json({ success: true, data: view(updated, { withStudents: true }) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không cập nhật được link Meet' });
  }
});

router.post('/:id/cancel', ...adminGuard, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) throw httpError(400, 'Buổi học không hợp lệ');
    const updated = await MeetClass.findOneAndUpdate(
      { _id: req.params.id, status: 'scheduled' },
      { $set: { status: 'cancelled' } },
      { returnDocument: 'after' },
    ).lean();
    if (!updated) throw httpError(404, 'Không tìm thấy buổi đang mở');
    return res.json({ success: true, data: view(updated, { withStudents: true }) });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không hủy được buổi Meet' });
  }
});

module.exports = router;
