'use strict';
const logger = require('./../../../config/logger');
const backupService = require('./backupService');
const { enqueue } = require('./../../../services/queue/jobQueue');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];
// GET /api/backups/stats

class BackupApplicationService {
  async get_stats(data) {
  try {
    const data = await backupService.getStats();
    return { _status: 200, _body: ({ success: true, data });
  } catch (err) {
    logger.error('[BACKUP] stats:', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async get_root(data) {
  try {
    const result = await backupService.listBackups({
      page: data.page,
      limit: data.limit,
    });
    return { _status: 200, _body: ({ success: true, ...result });
  } catch (err) {
    logger.error('[BACKUP] list:', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_root(data) {
  try {
    const job = await backupService.createBackupJob({
      type: 'manual',
      createdBy: String(data.currentUser.id || ''),
    });
    const queued = await enqueue('notify', 'backup', { jobId: String(job._id) }, { attempts: 1 });
    return { _status: 202, _body: ({
      success: true,
      message: 'Da xep hang backup',
      data: {
        id: job._id,
        status: job.status,
        queue: queued,
      },
    });
  } catch (err) {
    logger.error('[BACKUP] create:', err);
    return { _status: 500, _body: ({ success: false, message: err.message || 'Loi server' });
  }
}

  async get_id_download(data) {
  try {
    const { job, fullPath } = await backupService.getBackupFile(data.id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + job.filename + '"');
    res.sendFile(fullPath);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
}

  async delete_id(data) {
  try {
    const data = await backupService.deleteBackup(data.id);
    return { _status: 200, _body: ({ success: true, message: 'Da xoa backup', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
}

}

module.exports = new BackupApplicationService();
