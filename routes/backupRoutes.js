const express = require('express');
const router = express.Router();
const { authMiddleware, isSuperAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const backupService = require('../services/backupService');
const { enqueue } = require('../services/queue/jobQueue');

const guard = [authMiddleware, isSuperAdmin];

// GET /api/backups/stats
router.get('/stats', guard, async (req, res) => {
  try {
    const data = await backupService.getStats();
    res.json({ success: true, data });
  } catch (err) {
    logger.error('[BACKUP] stats:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// GET /api/backups
router.get('/', guard, async (req, res) => {
  try {
    const result = await backupService.listBackups({
      page: req.query.page,
      limit: req.query.limit,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[BACKUP] list:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// POST /api/backups — tao backup (async qua queue)
router.post('/', guard, async (req, res) => {
  try {
    const job = await backupService.createBackupJob({
      type: 'manual',
      createdBy: String(req.user.id || ''),
    });
    const queued = await enqueue('notify', 'backup', { jobId: String(job._id) }, { attempts: 1 });
    res.status(202).json({
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
    res.status(500).json({ success: false, message: err.message || 'Loi server' });
  }
});

// GET /api/backups/:id/download
router.get('/:id/download', guard, async (req, res) => {
  try {
    const { job, fullPath } = await backupService.getBackupFile(req.params.id);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', 'attachment; filename="' + job.filename + '"');
    res.sendFile(fullPath);
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
});

// DELETE /api/backups/:id
router.delete('/:id', guard, async (req, res) => {
  try {
    const data = await backupService.deleteBackup(req.params.id);
    res.json({ success: true, message: 'Da xoa backup', data });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
});

module.exports = router;