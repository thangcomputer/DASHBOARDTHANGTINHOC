const fs = require('fs');
const path = require('path');

const RETENTION_DAYS = Math.max(1, Number(process.env.MESSAGE_FILE_RETENTION_DAYS) || 10);
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function buildExpiredNotice(fileName, messageType) {
  const label = messageType === 'image' ? 'H\u00ecnh \u1ea3nh' : 'T\u1ec7p \u0111\u00ednh k\u00e8m';
  const namePart = fileName ? ` "${fileName}"` : '';
  return `${label}${namePart} \u0111\u00e3 h\u1ebft h\u1ea1n l\u01b0u tr\u1eef (${RETENTION_DAYS} ng\u00e0y) v\u00e0 kh\u00f4ng c\u00f2n \u0111\u01b0\u1ee3c l\u01b0u tr\u00ean h\u1ec7 th\u1ed1ng.`;
}

function resolveDiskPath(fileUrl) {
  if (!fileUrl) return null;
  let p = String(fileUrl).trim();
  if (p.startsWith('http://') || p.startsWith('https://')) {
    try {
      p = new URL(p).pathname;
    } catch {
      return null;
    }
  }
  const normalized = p.replace(/\\/g, '/');
  if (!normalized.startsWith('/uploads/messages/')) return null;
  return path.join(process.cwd(), normalized.replace(/^\//, ''));
}

function isAttachmentMessage(msg) {
  return msg && ['file', 'image'].includes(msg.messageType);
}

function isExpiredByAge(msg) {
  if (!isAttachmentMessage(msg) || !msg.fileUrl || msg.fileExpired) return false;
  const created = new Date(msg.createdAt || 0).getTime();
  if (!Number.isFinite(created)) return false;
  return Date.now() - created >= RETENTION_MS;
}

function sanitizeMessageDoc(msg) {
  const doc = msg?.toObject ? msg.toObject() : { ...msg };
  if (!isAttachmentMessage(doc)) return doc;

  if (doc.fileExpired || isExpiredByAge(doc)) {
    return {
      ...doc,
      fileUrl: '',
      fileExpired: true,
      content: doc.content || buildExpiredNotice(doc.fileName, doc.messageType),
    };
  }
  return doc;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages.map(sanitizeMessageDoc);
}

async function expireMessageFile(message, { save = true } = {}) {
  if (!message?.fileUrl || message.fileExpired) return false;

  const diskPath = resolveDiskPath(message.fileUrl);
  if (diskPath) {
    try {
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    } catch {
      /* file may already be gone */
    }
  }

  const notice = buildExpiredNotice(message.fileName, message.messageType);
  message.fileUrl = '';
  message.fileExpired = true;
  message.fileExpiredAt = new Date();
  message.content = notice;
  if (save && typeof message.save === 'function') {
    await message.save();
  }
  return true;
}

async function purgeExpiredMessageFiles(MessageModel, logger) {
  const cutoff = new Date(Date.now() - RETENTION_MS);
  const candidates = await MessageModel.find({
    messageType: { $in: ['file', 'image'] },
    fileUrl: { $nin: ['', null] },
    fileExpired: { $ne: true },
    createdAt: { $lte: cutoff },
  }).limit(500);

  let purged = 0;
  for (const msg of candidates) {
    try {
      if (await expireMessageFile(msg, { save: true })) purged += 1;
    } catch (err) {
      logger?.warn?.({ err: err.message, id: msg._id }, '[message-retention] purge failed');
    }
  }
  return purged;
}

module.exports = {
  RETENTION_DAYS,
  RETENTION_MS,
  buildExpiredNotice,
  sanitizeMessageDoc,
  sanitizeMessages,
  purgeExpiredMessageFiles,
  expireMessageFile,
};