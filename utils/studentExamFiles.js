'use strict';

function sanitizeStudentExamFilesPayload(body) {
  const out = {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) return out;

  for (const [key, value] of Object.entries(body)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const subjectId = String(key).trim().slice(0, 40);
    if (!subjectId) continue;

    const fileUrl = String(value.fileUrl || '').trim();
    if (!fileUrl.startsWith('/uploads/')) continue;

    out[subjectId] = {
      fileUrl: fileUrl.slice(0, 500),
      fileName: String(value.fileName || '').trim().slice(0, 255),
      fileType: String(value.fileType || '').trim().slice(0, 20).toUpperCase(),
    };
  }

  return out;
}

function buildStudentExamFileUpdates(files) {
  return Object.entries(sanitizeStudentExamFilesPayload(files))
    .reduce((updates, [subjectId, fileMeta]) => {
      updates[`studentExamFilesRaw.${subjectId}`] = fileMeta;
      return updates;
    }, {});
}

module.exports = {
  sanitizeStudentExamFilesPayload,
  buildStudentExamFileUpdates,
};
