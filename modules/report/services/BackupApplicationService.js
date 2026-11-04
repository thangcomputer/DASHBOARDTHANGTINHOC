'use strict';
const logger = require('./../../../config/logger');
const backupService = require('./backupService');
const { enqueue } = require('./../../../services/queue/jobQueue');

// GET /api/backups/stats

class BackupApplicationService {
  async get_stats(data) {
  try {
    const stats = await backupService.getStats();
    return { _status: 200, _body: { success: true, data: stats } };
  } catch (err) {
    logger.error('[BACKUP] stats:', err);
    return { _status: 500, _body: { success: false, message: 'Loi server' } };
  }
}

  async get_root(data) {
  try {
    const result = await backupService.listBackups({
      page: data.page,
      limit: data.limit,
    });
    return { _status: 200, _body: { success: true, ...result } };
  } catch (err) {
    logger.error('[BACKUP] list:', err);
    return { _status: 500, _body: { success: false, message: 'Loi server' } };
  }
}

  async post_root(data) {
  try {
    const job = await backupService.createBackupJob({
      type: 'manual',
      createdBy: String(data.currentUser.id || ''),
    });
    const queued = await enqueue('notify', 'backup', { jobId: String(job._id) }, { attempts: 1 });
    return { _status: 202, _body: {
      success: true,
      message: 'Da xep hang backup',
      data: {
        id: job._id,
        status: job.status,
        queue: queued,
      },
    } };
  } catch (err) {
    logger.error('[BACKUP] create:', err);
    return { _status: 500, _body: { success: false, message: err.message || 'Loi server' } };
  }
}

  async get_id_download(data) {
  try {
    const { job, fullPath } = await backupService.getBackupFile(data.id);
    return {
      _status: 200,
      _isDownload: true,
      _filePath: fullPath,
      _filename: job.filename,
    };
  } catch (err) {
    logger.error('[BACKUP] download:', err);
    return { _status: err.status || 500, _body: { success: false, message: err.message || 'Loi server' } };
  }
}

  async delete_id(data) {
  try {
    const deleted = await backupService.deleteBackup(data.id);
    return { _status: 200, _body: { success: true, message: 'Da xoa backup', data: deleted } };
  } catch (err) {
    logger.error('[BACKUP] delete:', err);
    return { _status: err.status || 500, _body: { success: false, message: err.message || 'Loi server' } };
  }
}

}

module.exports = new BackupApplicationService();
