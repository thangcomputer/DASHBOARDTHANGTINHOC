const FILE_TYPE_BY_EXTENSION = {
  doc: { label: 'Tài liệu Word', badgeClass: 'bg-blue-700 text-white' },
  docx: { label: 'Tài liệu Word', badgeClass: 'bg-blue-700 text-white' },
  xls: { label: 'Bảng tính Excel', badgeClass: 'bg-emerald-700 text-white' },
  xlsx: { label: 'Bảng tính Excel', badgeClass: 'bg-emerald-700 text-white' },
  ppt: { label: 'Bài thuyết trình PowerPoint', badgeClass: 'bg-orange-600 text-white' },
  pptx: { label: 'Bài thuyết trình PowerPoint', badgeClass: 'bg-orange-600 text-white' },
  pdf: { label: 'Tài liệu PDF', badgeClass: 'bg-red-600 text-white' },
  txt: { label: 'Tệp văn bản', badgeClass: 'bg-slate-600 text-white' },
  zip: { label: 'Tệp ZIP', badgeClass: 'bg-amber-600 text-white' },
  rar: { label: 'Tệp RAR', badgeClass: 'bg-amber-700 text-white' },
  '7z': { label: 'Tệp 7Z', badgeClass: 'bg-amber-700 text-white' },
};

export function getChatFileType(fileName, fileUrl) {
  const getExtension = (value) => {
    const source = String(value || '').split(/[?#]/, 1)[0];
    return source.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  };
  const extension = getExtension(fileName) || getExtension(fileUrl);
  const knownType = FILE_TYPE_BY_EXTENSION[extension];

  return {
    extension: extension ? extension.toUpperCase() : 'FILE',
    label: knownType?.label || 'Tệp đính kèm',
    badgeClass: knownType?.badgeClass || 'bg-slate-600 text-white',
  };
}
