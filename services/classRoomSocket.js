const { takeTicket, consumeTicket, joinRoom, member, leaveSocket, userKey } = require('./classRoom');

function registerClassRoomSocket(io, socket) {
  const userId = userKey(socket.user);

  socket.on('class-room:join', (payload = {}, ack) => {
    const reply = (body) => { if (typeof ack === 'function') ack(body); };
    if (!userId) return reply({ ok: false, message: 'Chưa đăng nhập' });
    const ticket = takeTicket(payload.ticket, userId);
    if (!ticket) return reply({ ok: false, message: 'Mã vào phòng không còn dùng được. Hãy bấm vào lớp lại.' });
    let joined;
    try {
      joined = joinRoom(ticket.scheduleId, socket.id, {
        userId,
        role: ticket.role,
        name: socket.user?.name || ticket.name || '',
      });
    } catch (err) {
      return reply({ ok: false, message: err.message || 'Không vào được phòng' });
    }
    consumeTicket(payload.ticket);
    joined.replaced.forEach((socketId) => {
      io.to(`classroom:${ticket.scheduleId}`).emit('class-room:peer-left', { scheduleId: ticket.scheduleId, socketId });
    });
    socket.join(`classroom:${ticket.scheduleId}`);
    socket.data.classRoomScheduleId = ticket.scheduleId;
    socket.to(`classroom:${ticket.scheduleId}`).emit('class-room:peer-joined', {
      scheduleId: ticket.scheduleId,
      peer: { socketId: socket.id, userId, role: ticket.role, name: socket.user?.name || ticket.name || '' },
    });
    return reply({ ok: true, scheduleId: ticket.scheduleId, peers: joined.peers });
  });

  socket.on('class-room:signal', (payload = {}) => {
    const scheduleId = String(payload.scheduleId || socket.data.classRoomScheduleId || '');
    const to = String(payload.to || '');
    if (!scheduleId || !to || !member(scheduleId, socket.id) || !member(scheduleId, to)) return;
    const description = payload.description && typeof payload.description === 'object' ? payload.description : null;
    const candidate = payload.candidate && typeof payload.candidate === 'object' ? payload.candidate : null;
    if (description && (typeof description.sdp !== 'string' || description.sdp.length > 80000)) return;
    if (candidate && typeof candidate.candidate === 'string' && candidate.candidate.length > 4096) return;
    io.to(to).emit('class-room:signal', {
      scheduleId,
      from: socket.id,
      description: description || undefined,
      candidate: candidate || undefined,
    });
  });

  socket.on('class-room:leave', () => {
    const left = leaveSocket(socket.id);
    left.forEach((scheduleId) => {
      socket.leave(`classroom:${scheduleId}`);
      io.to(`classroom:${scheduleId}`).emit('class-room:peer-left', { scheduleId, socketId: socket.id });
    });
    delete socket.data.classRoomScheduleId;
  });

  socket.on('disconnect', () => {
    const left = leaveSocket(socket.id);
    left.forEach((scheduleId) => {
      io.to(`classroom:${scheduleId}`).emit('class-room:peer-left', { scheduleId, socketId: socket.id });
    });
  });
}

module.exports = { registerClassRoomSocket };
