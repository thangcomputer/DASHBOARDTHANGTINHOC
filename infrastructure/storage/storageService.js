const fs = require('fs').promises;
const path = require('path');
const fileService = require('../../modules/file/services/fileService');
const logger = require('../../shared/logger/logger');

/**
 * Infrastructure Storage Service.
 * Manages file uploads (local disk or future cloud storage S3/MinIO).
 */
const storageService = {
  /**
   * Get dynamic Multer upload middleware.
   *
   * @param {Object} options - { allowedTypes: Array, maxSizeBytes: Number, destSubfolder: String }
   */
  getUploadMiddleware: (options = {}) => {
    // Delegates to existing fileService logic for backward compatibility
    return fileService.createUpload(
      options.destSubfolder || 'general',
      options.allowedTypes || [],
      options.maxSizeBytes || 5 * 1024 * 1024
    );
  },

  /**
   * Delete file from disk.
   *
   * @param {string} filePath - Absolute or relative file path to delete
   */
  deleteFile: async (filePath) => {
    if (!filePath) return false;
    try {
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);
      await fs.unlink(absolutePath);
      logger.info({ filePath: absolutePath }, 'File deleted successfully');
      return true;
    } catch (err) {
      logger.warn({ filePath, err: err.message }, 'Failed to delete file from storage');
      return false;
    }
  },

  /**
   * Get public url or path for a file resource.
   */
  getFileUrl: (filePath) => {
    if (!filePath) return '';
    return `/uploads/${filePath.replace(/\\/g, '/')}`;
  },
};

module.exports = storageService;
