const path = require('path');

/**
 * Pure file helper utilities.
 */
const fileHelper = {
  getFileExtension: (filename) => {
    if (!filename) return '';
    return path.extname(filename).toLowerCase();
  },

  isValidSize: (fileSize, maxBytes) => {
    return fileSize <= maxBytes;
  },

  isValidMimeType: (mimeType, allowedTypes = []) => {
    if (!allowedTypes || allowedTypes.length === 0) return true;
    return allowedTypes.includes(mimeType.toLowerCase());
  },

  sanitizeFilename: (filename) => {
    if (!filename) return '';
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    // Replace non-alphanumeric/spaces with underscores, and squash spaces
    const cleanBase = base
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    return `${cleanBase}${ext.toLowerCase()}`;
  },
};

module.exports = fileHelper;
