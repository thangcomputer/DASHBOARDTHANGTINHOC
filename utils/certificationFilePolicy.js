'use strict';

function validateOwnedCertificationFile(asset, studentId, now = Date.now()) {
  if (!asset) return { ok: true, found: false };
  if (asset.relatedType !== 'certification_submission' || String(asset.uploadedBy) !== String(studentId)) {
    return { ok: false, status: 403, message: 'File bài thực hành không thuộc tài khoản này' };
  }
  if (asset.expiresAt && new Date(asset.expiresAt).getTime() <= now) {
    return { ok: false, status: 400, message: 'File bài thực hành đã hết hạn' };
  }
  return { ok: true, found: true };
}

module.exports = { validateOwnedCertificationFile };
