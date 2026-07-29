const Notification = require('../models/Notification');
const NotificationDelivery = require('../models/NotificationDelivery');
const logger = require('../config/logger');
const {
  renderTemplate,
  buildIdempotencyKey,
} = require('../constants/notificationTemplates');

async function trackDelivery({
  notificationId,
  eventId,
  idempotencyKey,
  userId,
  channel,
  status,
  lastError = '',
  providerMsgId = '',
  meta = {},
}) {
  try {
    const key = idempotencyKey ? `${idempotencyKey}::${channel}` : '';
    if (key) {
      return await NotificationDelivery.findOneAndUpdate(
        { idempotencyKey: key, channel },
        {
          $set: {
            notificationId: notificationId || null,
            eventId: eventId || '',
            userId: userId || '',
            status,
            lastError: String(lastError || '').slice(0, 500),
            providerMsgId: providerMsgId || '',
            meta,
          },
          $inc: { attempts: 1 },
          $setOnInsert: { idempotencyKey: key, channel },
        },
        { upsert: true, new: true }
      );
    }
    return await NotificationDelivery.create({
      notificationId: notificationId || null,
      eventId: eventId || '',
      userId: userId || '',
      channel,
      status,
      attempts: 1,
      lastError: String(lastError || '').slice(0, 500),
      providerMsgId,
      meta,
    });
  } catch (err) {
    if (err && err.code === 11000 && idempotencyKey) {
      return NotificationDelivery.findOne({
        idempotencyKey: `${idempotencyKey}::${channel}`,
        channel,
      });
    }
    logger.warn('[NotificationService] trackDelivery: %s', err.message);
    return null;
  }
}

function emitSocket(io, receiversArr, socketData) {
  if (!io) return;
  if (receiversArr.includes('GLOBAL')) {
    io.emit('RECEIVE_NOTIFICATION', socketData);
    io.emit('data:refresh', { type: 'global' });
  } else {
    receiversArr.forEach((receiver) => {
      io.to(receiver).emit('RECEIVE_NOTIFICATION', { ...socketData, userId: receiver });
      io.to(receiver).emit('data:refresh', { type: 'notification', receiver });
    });
  }
  io.emit('new-notification');
}

async function queueExternalChannels({
  notificationId,
  eventId,
  idempotencyKey,
  primaryUser,
  channelList,
  title,
  content,
  payload,
}) {
  const wantZalo = channelList.includes('zalo');
  const wantEmail = channelList.includes('email');
  if (!wantZalo && !wantEmail) return;

  const phone = payload?.phone ? String(payload.phone).trim() : '';
  const email = payload?.email ? String(payload.email).trim() : '';
  const text = String(payload?.notifyText || `${title}\n${content}`).trim();

  if ((phone || email) && text) {
    try {
      const { enqueueNotifyText } = require('./queue/jobQueue');
      await enqueueNotifyText({
        phone: wantZalo ? phone || undefined : undefined,
        email: wantEmail ? email || undefined : undefined,
        text,
        userName: payload?.userName,
        subject: title,
      });
      if (wantZalo) {
        await trackDelivery({
          notificationId,
          eventId,
          idempotencyKey,
          userId: primaryUser,
          channel: 'zalo',
          status: phone ? 'queued' : 'skipped',
          lastError: phone ? '' : 'no_phone',
        });
      }
      if (wantEmail) {
        await trackDelivery({
          notificationId,
          eventId,
          idempotencyKey,
          userId: primaryUser,
          channel: 'email',
          status: email ? 'queued' : 'skipped',
          lastError: email ? '' : 'no_email',
        });
      }
      return;
    } catch (err) {
      logger.warn('[NotificationService] enqueueNotifyText: %s', err.message);
      if (wantZalo) {
        await trackDelivery({
          notificationId, eventId, idempotencyKey, userId: primaryUser,
          channel: 'zalo', status: 'failed', lastError: err.message,
        });
      }
      if (wantEmail) {
        await trackDelivery({
          notificationId, eventId, idempotencyKey, userId: primaryUser,
          channel: 'email', status: 'failed', lastError: err.message,
        });
      }
      return;
    }
  }

  if (wantZalo) {
    await trackDelivery({
      notificationId, eventId, idempotencyKey, userId: primaryUser,
      channel: 'zalo', status: 'skipped', lastError: 'no_contact_in_payload',
    });
  }
  if (wantEmail) {
    await trackDelivery({
      notificationId, eventId, idempotencyKey, userId: primaryUser,
      channel: 'email', status: 'skipped', lastError: 'no_contact_in_payload',
    });
  }
}

class NotificationService {
  /**
   * Centralized Notification Sender (tương thích ngược).
   * Optional Phase 5: eventId, templateCode, priority, expiresAt, channels
   */
  static async send(io, {
    type,
    title,
    content,
    sender_id = 'SYSTEM',
    receivers,
    payload = {},
    link = '',
    eventId = '',
    templateCode = '',
    priority = 'normal',
    expiresAt = null,
    channels = ['in_app', 'socket'],
  }) {
    try {
      const receiversArr = Array.isArray(receivers) ? receivers : [receivers];
      const idempotencyKey = buildIdempotencyKey(eventId, receiversArr);

      if (idempotencyKey) {
        const existing = await Notification.findOne({ idempotencyKey }).lean();
        if (existing) {
          logger.info({ eventId, idempotencyKey }, '[NotificationService] idempotent hit');
          return existing;
        }
      }

      let newNotification;
      try {
        newNotification = await Notification.create({
          type,
          title,
          content,
          sender_id,
          receivers: receiversArr,
          payload: {
            ...payload,
            ...(eventId ? { eventId } : {}),
            ...(templateCode ? { templateCode } : {}),
          },
          path: link,
          templateCode: templateCode || '',
          eventId: eventId || '',
          ...(idempotencyKey ? { idempotencyKey } : {}),
          priority: ['low', 'normal', 'high'].includes(priority) ? priority : 'normal',
          expiresAt: expiresAt || null,
        });
      } catch (err) {
        if (err && err.code === 11000 && idempotencyKey) {
          const existing = await Notification.findOne({ idempotencyKey });
          if (existing) return existing;
        }
        throw err;
      }

      const channelList = Array.isArray(channels) ? channels : ['in_app', 'socket'];
      const primaryUser = receiversArr.find((r) => r && !String(r).startsWith('ALL_') && r !== 'GLOBAL') || '';

      await trackDelivery({
        notificationId: newNotification._id,
        eventId,
        idempotencyKey,
        userId: primaryUser,
        channel: 'in_app',
        status: 'sent',
      });

      if (io && channelList.includes('socket')) {
        emitSocket(io, receiversArr, {
          _id: newNotification._id,
          type: String(type).toLowerCase(),
          title,
          message: content,
          time: new Date(),
          payload: newNotification.payload,
          path: link,
          read: false,
          templateCode: templateCode || '',
          priority,
        });
        await trackDelivery({
          notificationId: newNotification._id,
          eventId,
          idempotencyKey,
          userId: primaryUser,
          channel: 'socket',
          status: 'sent',
        });
      }

      await queueExternalChannels({
        notificationId: newNotification._id,
        eventId,
        idempotencyKey,
        primaryUser,
        channelList,
        title,
        content,
        payload,
      });

      return newNotification;
    } catch (error) {
      logger.error('[NotificationService] Send error:', error);
      throw error;
    }
  }

  static async sendFromTemplate(io, {
    templateCode,
    receivers,
    data = {},
    sender_id = 'SYSTEM',
    eventId = '',
    payload = {},
  }) {
    const rendered = renderTemplate(templateCode, data);
    return this.send(io, {
      type: rendered.type,
      title: rendered.title,
      content: rendered.content,
      sender_id,
      receivers,
      payload: { ...payload, ...data, templateCode: rendered.templateCode },
      link: rendered.link,
      eventId,
      templateCode: rendered.templateCode,
      priority: rendered.priority,
      channels: rendered.channels,
    });
  }

  static async notifyAdmins(io, title, content, payload = {}, link = '') {
    return this.send(io, {
      type: 'SYSTEM',
      title,
      content,
      receivers: 'ALL_ADMIN',
      payload,
      link,
    });
  }
}

module.exports = NotificationService;
module.exports.trackDelivery = trackDelivery;
