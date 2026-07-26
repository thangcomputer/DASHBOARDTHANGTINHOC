export function trainingUploadDisplayName(fileUrl, fileOriginalName) {
  if (fileOriginalName && String(fileOriginalName).trim()) return String(fileOriginalName).trim();
  if (!fileUrl || typeof fileUrl !== 'string') return '';
  try {
    const pathOnly = fileUrl.replace(/^https?:\/\/[^/]+/i, '');
    const seg = pathOnly.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(seg) || 'Tệp đính kèm';
  } catch {
    return 'Tệp đính kèm';
  }
}
