const express    = require('express');
const http       = require('http');
const mongoose   = require('mongoose');
const cors       = require('cors');
const compression = require('compression');
const helmet     = require('helmet');
const hpp        = require('hpp');
const cookieParser = require('cookie-parser');
const session    = require('express-session');
const dotenv     = require('dotenv');
const mongoSanitize = require('./middleware/mongoSanitize');
const { Server } = require('socket.io');
const cron       = require('node-cron');
const pinoHttp   = require('pino-http');
const connectDB  = require('./config/db');

dotenv.config();
require('./config/validateEnv')();

const logger = require('./config/logger');
const { buildConversationId } = require('./utils/chatConversationId');
const { getMessagingRole } = require('./utils/messagingRoles');

const app    = express();
const server = http.createServer(app);

const trustProxy = process.env.TRUST_PROXY === '0' ? false : (parseInt(process.env.TRUST_PROXY, 10) || 1);
app.set('trust proxy', trustProxy);

const isProd = process.env.NODE_ENV === 'production';
const cookieSecret = process.env.COOKIE_SECRET || process.env.JWT_SECRET;

const viteLocalOrigins = [5173, 5174, 5175, 5176, 5177].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]);
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...viteLocalOrigins,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

const corsOriginFn = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
  cb(null, false);
};

const io = new Server(server, {
  cors: {
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(compression({ level: 6, threshold: 1024 }));

// Static uploads — không gắn CSP Helmet (tránh header gây nhiễu khi tải file)
function safeDownloadFilename(name) {
  const s = String(name || '').replace(/[/\\?\0\r\n]/g, '_').trim();
  if (!s || s === '.' || s === '..') return '';
  return s.slice(0, 240);
}

app.use('/uploads', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (/\.(zip|rar|7z|pdf|docx?|xlsx?|pptx?)$/i.test(req.path)) {
    const diskName = decodeURIComponent(req.path.split('/').pop() || 'file');
    const customName = safeDownloadFilename(req.query.downloadAs);
    const useName = customName || diskName;
    const asciiFallback = useName.replace(/[^\x20-\x7E]/g, '_') || diskName;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(useName)}`,
    );
  }
  next();
}, express.static('uploads'));

app.use(helmet({
  contentSecurityPolicy: isProd ? {
    useDefaults: true,
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  } : false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({ origin: corsOriginFn, credentials: true }));
app.use(cookieParser(cookieSecret));

const { csrfProtection } = require('./middleware/csrf');
app.use('/api', csrfProtection);

const sessionOptions = {
  name: 'qcms.sid',
  secret: cookieSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
  },
};

if (isProd && process.env.MONGODB_URI) {
  try {
    const MongoStore = require('connect-mongo');
    sessionOptions.store = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24, // 1 day
      crypto: process.env.SESSION_ENCRYPTION_KEY
        ? { secret: process.env.SESSION_ENCRYPTION_KEY }
        : undefined,
    });
  } catch (e) {
    logger.warn({ err: e.message }, 'connect-mongo unavailable; falling back to MemoryStore');
  }
}

app.use(session(sessionOptions));

app.use(pinoHttp({ logger }));

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || '1mb';
app.use(express.json({ limit: JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: JSON_BODY_LIMIT }));
app.use(mongoSanitize({ replaceWith: '_' }));
app.use(hpp());
require('./routes/authRoutes');
app.use(require('passport').initialize());
app.use(require('passport').session());

app.get('/healthz', (req, res) => {
  // Public probe — nhe, tuong thich cu; chi tiet o /api/monitoring/*
  const monitoring = require('./services/monitoringService');
  const h = monitoring.getHealth();
  res.status(h.ok ? 200 : 503).json({
    ok: h.ok,
    status: h.status,
    db: h.db.status,
    redis: h.redis.status,
    queue: h.queue.mode,
    uptime: h.uptimeSec,
    memory: { rssMb: h.memory.rssMb, heapUsedMb: h.memory.heapUsedMb },
  });
});

// Request metrics (Phase 10) — truoc routes API
app.use(require('./middleware/requestMetrics'));

app.set('io', io);
global.io = io;

const systemLogger = require('./middleware/systemLogger');
app.use(systemLogger);

const { apiRateLimitUnlessAuth } = require('./middleware/apiRateLimit');
app.use('/api', apiRateLimitUnlessAuth);

connectDB();

// ==========================================
// SOCKET.IO - REAL-TIME
// ==========================================
const onlineUsers = new Map();  // { key: { socketId, userId, role, name, branchId, connectedAt } }
const lastSeenMap = new Map();  // { userId: ISO timestamp } — lưu khi disconnect
const LAST_SEEN_MAX = 5000;
const { socketAuthMiddleware } = require('./middleware/socketAuth');
const Group = require('./models/Group');

function socketUserId(user) {
  return String(user?.id || user?._id || '');
}

function isAdminSocketUser(user) {
  if (!user) return false;
  return user.id === 'admin' || user.role === 'admin' || user.role === 'staff';
}

function trimLastSeenMap() {
  if (lastSeenMap.size <= LAST_SEEN_MAX) return;
  const entries = [...lastSeenMap.entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
  const remove = entries.length - LAST_SEEN_MAX;
  for (let i = 0; i < remove; i++) {
    lastSeenMap.delete(entries[i][0]);
  }
}

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Đăng ký user online — CHẶN SPOOFING: lấy ID/Role từ JWT thay vì tin client 100%
  socket.on('register', ({ branchId, branchCode }) => {
    if (!socket.user) return;

    const userId = socketUserId(socket.user);
    const messagingRole = getMessagingRole(socket.user);
    const name   = socket.user.name || 'User';
    const key    = `${messagingRole}_${userId}`;
    const resolvedBranchId = socket.user.branchId || branchId;
    const resolvedBranchCode = socket.user.branchCode || branchCode || '';

    onlineUsers.set(key, {
      socketId: socket.id,
      userId,
      role: messagingRole,
      name,
      branchId: resolvedBranchId,
      branchCode: resolvedBranchCode,
      connectedAt: new Date().toISOString(),
    });

    console.log(`👤 Online (Verified): ${name} (${messagingRole}) - ${key}`);

    // Join rooms for Centralized Notification Service
    socket.join(userId);           // Unique user room
    socket.join('GLOBAL');          // Global room
    
    if (messagingRole) {
      const uRole = messagingRole.toUpperCase();
      socket.join(`ALL_${uRole}`);

      if (socket.user.adminRole === 'STAFF' || messagingRole === 'staff') {
        socket.join('ALL_STAFF');
      }
      if (userId === 'admin' || socket.user?.adminRole === 'SUPER_ADMIN') {
        socket.join('ALL_ADMIN');
      }

      if (resolvedBranchId) {
        const bid = resolvedBranchId;
        socket.join(`ALL_${uRole}_${bid}`); 
      }
      
      if (resolvedBranchCode) {
        const bcode = resolvedBranchCode;
        socket.join(`ALL_${uRole}_${bcode}`);
      }
    }

    // Broadcast danh sách online
    io.emit('users:online', Array.from(onlineUsers.values()).map(u => ({
      userId: u.userId, role: u.role, name: u.name, branchId: u.branchId, connectedAt: u.connectedAt
    })));
  });

  // ── Nhắn tin 1-1 — luôn lấy người gửi từ JWT (socket.user), không tin client ──
  socket.on('message:send', (data) => {
    if (!socket.user) return;
    const u = socket.user;
    const senderMessagingRole = getMessagingRole(u);
    const senderId = String(u.id || u._id);
    const senderName = u.name || 'User';
    const isStaff = senderMessagingRole === 'staff';
    data = {
      ...data,
      senderId,
      senderName,
      senderRole: senderMessagingRole,
    };
    // data = { senderId, senderName, senderRole, receiverId, receiverRole, content }
    // Tìm người nhận (Hỗ trợ linh hoạt cả prefix admin_ và staff_)
    let receiver = onlineUsers.get(`${data.receiverRole}_${data.receiverId}`);
    if (!receiver && (data.receiverRole === 'admin' || data.receiverRole === 'staff')) {
      const altRole = data.receiverRole === 'admin' ? 'staff' : 'admin';
      receiver = onlineUsers.get(`${altRole}_${data.receiverId}`);
    }

    const isOneSideStudent = (data.senderRole === 'student' || data.receiverRole === 'student');

    const convId = buildConversationId(data.senderRole, data.senderId, data.receiverRole, data.receiverId);

    // Lấy branchCode người gửi để hiển thị badge (GV/HV/Staff)
    let sender = onlineUsers.get(`${data.senderRole}_${data.senderId}`);
    if (!sender && (data.senderRole === 'admin' || data.senderRole === 'staff')) {
      const altRole = data.senderRole === 'admin' ? 'staff' : 'admin';
      sender = onlineUsers.get(`${altRole}_${data.senderId}`);
    }
    const sBranch = sender?.branchCode || '';
    const rBranch = receiver?.branchCode || '';

    // Chuẩn hoá payload (giống messageRoutes)
    const DEPT_STAFF = 'Phòng Giáo Vụ';
    const DEPT_SUPER = 'Phòng Tuyển Sinh';
    const staffDisplayName = (rawName, branchCode) => {
      const base = rawName || DEPT_STAFF;
      const bc = String(branchCode || '').trim();
      return bc ? `${base} (P.Giáo Vụ-${bc})` : `${base} (P.Giáo Vụ)`;
    };

    let finalSenderId = data.senderId;
    let finalSenderName = data.senderName;
    if (data.receiverRole === 'student' && (u.role === 'admin' || u.role === 'staff')) {
      if (isStaff) {
        finalSenderName = staffDisplayName(finalSenderName, sBranch);
      } else {
        finalSenderName = DEPT_SUPER;
      }
    }

    let finalReceiverId = data.receiverId;
    let finalReceiverName = data.receiverName;
    if (data.senderRole === 'student' && isOneSideStudent && (data.receiverRole === 'admin' || data.receiverRole === 'staff')) {
      const rid = String(data.receiverId || '');
      if (rid === 'admin' || !mongoose.Types.ObjectId.isValid(rid)) {
        finalReceiverId = 'admin';
        finalReceiverName = DEPT_SUPER;
      } else {
        finalReceiverId = rid;
        finalReceiverName = staffDisplayName(finalReceiverName, rBranch);
      }
    }

    const msgPayload = {
      ...data,
      _id: data._id || `msg_${Date.now()}`,
      senderId: finalSenderId,
      senderName: finalSenderName,
      receiverId: finalReceiverId,
      receiverName: finalReceiverName,
      conversationId: convId,
      senderBranchCode: sBranch,
      receiverBranchCode: rBranch,
      createdAt: new Date().toISOString(),
      isRead: false,
    };

    // 1) Broadcast (chỉ admin/staff)
    if (data.receiverId === 'ALL_USERS') {
      if (!isAdminSocketUser(u)) return;
      io.emit('message:receive', msgPayload);
    } else if (data.receiverId === 'ALL_STUDENTS') {
      if (!isAdminSocketUser(u)) return;
      io.to('ALL_STUDENT').emit('message:receive', msgPayload);
    } else if (data.receiverId === 'ALL_TEACHERS') {
      if (!isAdminSocketUser(u)) return;
      io.to('ALL_TEACHER').emit('message:receive', msgPayload);
    } else if (data.receiverId?.startsWith('ALL_BRANCH_')) {
      if (!isAdminSocketUser(u)) return;
      const bCode = data.receiverId.replace('ALL_BRANCH_', '');
      io.to(`ALL_STUDENT_${bCode}`).to(`ALL_TEACHER_${bCode}`).to(`ALL_STAFF_${bCode}`).emit('message:receive', msgPayload);
    }
    // 2) Direct message: chỉ gửi đúng người nhận
    else if (receiver && receiver.socketId) {
      io.to(receiver.socketId).emit('message:receive', msgPayload);
    }

    // 5. Gửi confirm cho chính người gửi
    socket.emit('message:sent', msgPayload);
  });

  // ── Đánh dấu đã đọc ──
  socket.on('message:read', ({ conversationId, readerId }) => {
    if (!socket.user || socketUserId(socket.user) !== String(readerId || '')) return;
    socket.broadcast.emit('message:read_ack', { conversationId, readerId });
  });

  // ── Đán dấu đang gõ ──
  socket.on('typing:start', ({ conversationId, userId, userName }) => {
    socket.broadcast.emit('typing:show', { conversationId, userId, userName });
  });
  socket.on('typing:stop', ({ conversationId, userId }) => {
    socket.broadcast.emit('typing:hide', { conversationId, userId });
  });

  // ── Nhận report vi phạm thi ──
  socket.on('exam:violation', (data) => {
    if (!socket.user) return;
    const uid = socketUserId(socket.user);
    const role = socket.user.role;

    if (role === 'student') {
      if (String(data?.studentId || '') !== uid) return;
    } else if (role === 'teacher') {
      if (String(data?.teacherId || '') !== uid) return;
    } else if (!isAdminSocketUser(socket.user)) {
      return;
    }

    // data = { studentId, studentName, teacherId, course, reason }
    const notif = {
      type: 'violation',
      title: '🚨 Vi phạm Giám Sát Thi',
      message: `Học viên ${data.studentName} đã vi phạm (${data.reason}) bài thi ${data.course}. Tài khoản đã bị khóa quyền thi.`,
      date: new Date().toISOString()
    };

    // Broadcast tới tất cả Admin & Giảng viên qua NotificationService
    const NotificationService = require('./services/NotificationService');
    
    // 1. Gửi cho tất cả Admin
    NotificationService.send(io, {
      type: 'EXAM',
      title: notif.title,
      content: notif.message,
      receivers: 'ALL_ADMIN',
      payload: data,
      link: '/admin#students'
    });

    // 2. Gửi cho Giáo viên phụ trách
    if (data.teacherId) {
      NotificationService.send(io, {
        type: 'EXAM',
        title: notif.title,
        content: notif.message,
        receivers: data.teacherId.toString(),
        payload: data,
        link: '/teacher'
      });
    }
     // (Removed io.emit('exam:locked') to prevent INFINITE LOOP with StudentTest resolving 'exam:locked' by emitting 'exam:violation')
  });

  // ── Giảng viên join room riêng để nhận notify ──
  socket.on('teacher:join', ({ teacherId }) => {
    if (!socket.user || !teacherId) return;
    const uid = socketUserId(socket.user);
    const role = getMessagingRole(socket.user);
    if (role !== 'teacher' && !isAdminSocketUser(socket.user)) return;
    if (uid !== String(teacherId) && socket.user.id !== 'admin' && socket.user.adminRole !== 'SUPER_ADMIN') return;
    socket.join(`teacher_${teacherId}`);
    console.log(`👨‍🏫 Teacher ${teacherId} joined room teacher_${teacherId}`);
  });

  socket.on('student:join', ({ studentId }) => {
    if (!socket.user || !studentId) return;
    const uid = socketUserId(socket.user);
    const role = getMessagingRole(socket.user);
    if (role !== 'student' && !isAdminSocketUser(socket.user)) return;
    if (uid !== String(studentId) && socket.user.id !== 'admin' && socket.user.adminRole !== 'SUPER_ADMIN') return;
    socket.join(`student_${studentId}`);
    console.log(`🎓 Student ${studentId} joined room student_${studentId}`);
  });

  socket.on('admin:join', () => {
    if (!socket.user || !isAdminSocketUser(socket.user)) return;
    socket.join('admin_room');
    console.log(`🛡️  Admin joined admin_room`);
  });

  socket.on('group:join', async (groupId) => {
    if (!socket.user || !groupId) return;
    try {
      const uid = socketUserId(socket.user);
      const group = await Group.findById(groupId).select('participants').lean();
      if (!group) return;
      const isMember = (group.participants || []).some((p) => String(p.userId) === uid);
      if (!isMember && socket.user.id !== 'admin' && socket.user.adminRole !== 'SUPER_ADMIN') return;
      socket.join(`group_${groupId}`);
      console.log(`💬 Socket ${socket.id} joined group_${groupId}`);
    } catch (err) {
      logger.warn({ err: err.message, groupId }, 'group:join failed');
    }
  });

  // ── Client xác nhận nhận được exam:unlocked ──
  socket.on('exam:unlock_ack', ({ studentId }) => {
    console.log(`✅ [ACK] Học viên ${studentId} đã nhận thông báo unlock thi`);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    for (const [key, val] of onlineUsers.entries()) {
      if (val.socketId === socket.id) {
        // Lưu thời điểm offline để frontend tính "X phút trước"
        lastSeenMap.set(String(val.userId), new Date().toISOString());
        trimLastSeenMap();
        onlineUsers.delete(key);
        break;
      }
    }
    io.emit('users:online', Array.from(onlineUsers.values()).map(u => ({
      userId: u.userId, role: u.role, name: u.name, connectedAt: u.connectedAt
    })));
    // Broadcast lastSeen map để frontend cập nhật
    io.emit('users:lastSeen', Object.fromEntries(lastSeenMap));
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// ── Hàm gửi notification real-time ──
app.notifyUser = (role, userId, eventName, data) => {
  const strUserId = String(userId);

  if (strUserId === 'admin') {
    io.to('ALL_ADMIN').emit(eventName, data);
    return true;
  }

  const tryRoles = new Set([role, getMessagingRole({ id: strUserId, role })]);
  if (role === 'admin' || role === 'staff') {
    tryRoles.add('admin');
    tryRoles.add('staff');
  }

  for (const r of tryRoles) {
    if (!r) continue;
    const user = onlineUsers.get(`${r}_${strUserId}`);
    if (user?.socketId) {
      io.to(user.socketId).emit(eventName, data);
      return true;
    }
  }

  io.to(strUserId).emit(eventName, data);
  return true;
};

// ── Broadcast cho tất cả user có role nhất định ──
app.broadcastToRole = (role, eventName, data) => {
  for (const [, val] of onlineUsers.entries()) {
    if (val.role === role) {
      io.to(val.socketId).emit(eventName, data);
    }
  }
};

const studentRoutes      = require('./routes/studentRoutes');
const invoiceRoutes      = require('./routes/invoiceRoutes');
const authRoutes         = require('./routes/authRoutes');
const messageRoutes      = require('./routes/messageRoutes');
const scheduleRoutes     = require('./routes/scheduleRoutes');
const courseRoutes       = require('./routes/courseRoutes');
const teacherRoutes      = require('./routes/teacherRoutes');
const assignmentRoutes   = require('./routes/assignmentRoutes');
const evaluationRoutes   = require('./routes/evaluationRoutes');
const transactionRoutes  = require('./routes/transactionRoutes');
const systemLogRoutes    = require('./routes/systemLogRoutes');
const teachingGuideRoutes = require('./routes/teachingGuideRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const examResultRoutes   = require('./routes/examResultRoutes');
const settingsRoutes     = require('./routes/settingsRoutes');
const webhookRoutes      = require('./routes/webhookRoutes');
const staffRoutes        = require('./routes/staffRoutes');
const branchRoutes       = require('./routes/branchRoutes');
const analyticsRoutes    = require('./routes/analyticsRoutes');  // ← Revenue Analytics
const employeeRoutes     = require('./routes/employeeRoutes');   // ← HR & Payroll
const notificationRoutes = require('./routes/notificationRoutes');
const fileRoutes         = require('./routes/fileRoutes');
const backupRoutes       = require('./routes/backupRoutes');
const monitoringRoutes   = require('./routes/monitoringRoutes');
const aiRoutes           = require('./routes/aiRoutes');
const biRoutes           = require('./routes/biRoutes');
const workflowRoutes     = require('./routes/workflowRoutes');
const builderRoutes      = require('./routes/builderRoutes');
const tenantRoutes       = require('./routes/tenantRoutes');

app.use('/api/auth',         authRoutes);
app.use('/api/students',     studentRoutes);
app.use('/api/invoices',     invoiceRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/schedules',    scheduleRoutes);
app.use('/api/courses',      courseRoutes);
app.use('/api/teachers',     teacherRoutes);
app.use('/api/assignments',  assignmentRoutes);
app.use('/api/evaluations',  evaluationRoutes);
app.use('/api/exam-results', examResultRoutes);
app.use('/api/system-logs',  systemLogRoutes);
app.use('/api/training',     teachingGuideRoutes);
app.use('/api/training-lms', trainingRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/settings',     settingsRoutes);
app.use('/api/webhooks',     webhookRoutes);
app.use('/api/staff',        staffRoutes);
app.use('/api/branches',     branchRoutes);
app.use('/api/analytics',    analyticsRoutes);    // ← Revenue Analytics
app.use('/api/employees',    employeeRoutes);     // ← HR & Payroll
app.use('/api/notifications',notificationRoutes);
app.use('/api/files',        fileRoutes);
app.use('/api/backups',      backupRoutes);
app.use('/api/monitoring',  monitoringRoutes);
app.use('/api/ai',           aiRoutes);
app.use('/api/bi',           biRoutes);
app.use('/api/workflows',    workflowRoutes);
app.use('/api/builder',      builderRoutes);
app.use('/api/tenants',      tenantRoutes);




// Route mặc định
app.get('/', (req, res) => {
  res.json({
    message: 'QUANLYCMS API - Trung tam Thang Tin Hoc',
    version: '3.0.0',
    features: [
      'Socket.io Real-time',
      'Chat 1-1',
      'Schedule + Exam Unlock (Workflow 2)',
      'Assignment + Grading (Workflow 3)',
      'Teacher Salary (Workflow 4)',
      'Student Evaluation (Workflow 5)',
    ],
    endpoints: {
      auth:         '/api/auth',
      students:     '/api/students',
      teachers:     '/api/teachers',
      invoices:     '/api/invoices',
      messages:     '/api/messages',
      schedules:    '/api/schedules',
      courses:      '/api/courses',
      assignments:  '/api/assignments',
      evaluations:  '/api/evaluations',
      transactions: '/api/transactions',
    },
    socketIO: 'Connected',
  });
});

// ==========================================
// CRON JOB: Tự xóa file/ảnh tin nhắn quá hạn (mặc định 10 ngày)
// ==========================================
const Message = require('./models/Message');
const { purgeExpiredMessageFiles, RETENTION_DAYS } = require('./utils/messageFileRetention');

const runMessageFileRetention = async () => {
  try {
    const purged = await purgeExpiredMessageFiles(Message, logger);
    if (purged > 0) {
      logger.info(`[CRON] Đã xóa ${purged} file tin nhắn quá ${RETENTION_DAYS} ngày`);
    }
  } catch (err) {
    logger.error({ err: err.message }, '[CRON] message file retention');
  }
};

// Mỗi 6 giờ + chạy một lần khi server khởi động (sau khi DB sẵn sàng)
setTimeout(() => { runMessageFileRetention(); }, 15_000);
cron.schedule('0 */6 * * *', runMessageFileRetention);

// FileAsset registry — purge file hết hạn (Phase 8)
const fileService = require('./services/fileService');
const runFileAssetPurge = async () => {
  try {
    const { purged } = await fileService.purgeExpired();
    if (purged > 0) {
      logger.info(`[CRON] FileAsset: đã xóa ${purged} file hết hạn`);
    }
  } catch (err) {
    logger.error({ err: err.message }, '[CRON] FileAsset purge');
  }
};
setTimeout(() => { runFileAssetPurge(); }, 20_000);
cron.schedule('30 */6 * * *', runFileAssetPurge);

// Backup định kỳ (Phase 9) — mặc định 03:00 mỗi ngày; tắt bằng BACKUP_SCHEDULE=0
const backupService = require('./services/backupService');
const { enqueueBackup } = require('./services/queue/jobQueue');
const runScheduledBackup = async () => {
  if (process.env.BACKUP_SCHEDULE === '0') return;
  try {
    const job = await backupService.createBackupJob({ type: 'scheduled', createdBy: 'cron' });
    await enqueueBackup({ jobId: String(job._id) });
    logger.info({ jobId: String(job._id) }, '[CRON] Scheduled backup queued');
  } catch (err) {
    logger.error({ err: err.message }, '[CRON] scheduled backup');
  }
};
const backupCronExpr = process.env.BACKUP_CRON || '0 3 * * *';
if (process.env.BACKUP_SCHEDULE !== '0') {
  cron.schedule(backupCronExpr, runScheduledBackup);
}

// ==========================================
// CRON JOB: Nhắc lịch học tự động
// ==========================================
// const Schedule = require('./models/Schedule');
// const nodemailer = require('nodemailer');
//
// Chạy mỗi 10 phút - kiểm tra lịch sắp tới và gửi nhắc nhở
cron.schedule('*/10 * * * *', async () => {
  try {
    // const now = new Date();
    // const thirtyMinsLater = new Date(now.getTime() + 30 * 60000);
    //
    // const upcoming = await Schedule.find({
    //   date: { $gte: now, $lte: thirtyMinsLater },
    //   status: 'scheduled',
    //   reminderSent: false,
    // });
    //
    // for (const sched of upcoming) {
    //   // 1. Gửi notification real-time
    //   app.notifyUser('student', sched.studentId, 'class:reminder', {
    //     message: `Sắp đến giờ học! ${sched.course} lúc ${sched.startTime}`,
    //     linkHoc: sched.linkHoc,
    //     startTime: sched.startTime,
    //   });
    //   app.notifyUser('teacher', sched.teacherId, 'class:reminder', {
    //     message: `Sắp có buổi dạy! ${sched.studentName} - ${sched.course} lúc ${sched.startTime}`,
    //     linkHoc: sched.linkHoc,
    //     startTime: sched.startTime,
    //   });
    //
    //   // 2. Gửi Email (cần cấu hình SMTP trong .env)
    //   // await sendReminderEmail(sched);
    //
    //   // 3. Đánh dấu đã gửi
    //   sched.reminderSent = true;
    //   sched.reminderSentAt = new Date();
    //   await sched.save();
    // }
    //
    // if (upcoming.length > 0) {
    //   console.log(`📧 Đã gửi ${upcoming.length} nhắc lịch học`);
    // }

    logger.info(`[CRON] Kiểm tra lịch học: ${new Date().toLocaleTimeString('vi-VN')}`);
  } catch (err) {
    logger.error({ err: err.message }, '[CRON] schedule check');
  }
});

// ==========================================
// HÀM GỬI EMAIL NHẮC LỊCH
// ==========================================
// Cấu hình trong .env:
// SMTP_HOST=smtp.gmail.com
// SMTP_PORT=587
// SMTP_USER=thangtinhoc@gmail.com
// SMTP_PASS=your_app_password
//
// async function sendReminderEmail(schedule) {
//   const transporter = nodemailer.createTransport({
//     host: process.env.SMTP_HOST,
//     port: process.env.SMTP_PORT,
//     secure: false,
//     auth: {
//       user: process.env.SMTP_USER,
//       pass: process.env.SMTP_PASS,
//     },
//   });
//
//   await transporter.sendMail({
//     from: '"Thắng Tin Học" <thangtinhoc@gmail.com>',
//     to: schedule.studentEmail, // Cần thêm field email vào Schedule
//     subject: `📚 Nhắc lịch học: ${schedule.course} lúc ${schedule.startTime}`,
//     html: `
//       <div style="font-family:Arial; padding:20px; background:#f5f5f5; border-radius:12px;">
//         <img src="https://thangtinhoc.vn/logo.png" width="150" />
//         <h2 style="color:#dc2626;">Sắp đến giờ học!</h2>
//         <p>Xin chào <strong>${schedule.studentName}</strong>,</p>
//         <p>Bạn có buổi học <strong>${schedule.course}</strong> lúc <strong>${schedule.startTime}</strong>.</p>
//         <p>Giảng viên: <strong>${schedule.teacherName}</strong></p>
//         ${schedule.linkHoc ? `<a href="${schedule.linkHoc}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:16px;">VÀO LỚP NGAY</a>` : ''}
//         <p style="margin-top:20px;color:#666;font-size:12px;">Thắng Tin Học - Phát triển tri thức Việt</p>
//       </div>
//     `,
//   });
// }

// ==========================================
// ERROR HANDLING
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} khong ton tai`,
  });
});

app.use((err, req, res, _next) => {
  if (req.log) req.log.error(err);
  else logger.error(err);

  // Handle Mongoose CastError (Invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Định dạng ID không hợp lệ: ${err.value}`,
    });
  }

  res.status(500).json({
    success: false,
    message: 'Lỗi server nội bộ',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
const tokenBlacklist = require('./middleware/tokenBlacklist');
const { initJobQueue, closeJobQueue } = require('./services/queue/jobQueue');

server.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'QUANLYCMS server listening');
  initJobQueue().catch((err) => logger.warn({ err: err.message }, 'initJobQueue failed'));
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  try {
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await closeJobQueue();
    await mongoose.connection.close(false);
    await tokenBlacklist.close();
    const { closeRedis } = require('./config/redis');
    await closeRedis();
  } catch (e) {
    logger.error(e);
  }
  process.exit(0);
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));

module.exports = { app, server, io };
