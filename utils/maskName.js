function maskStudentName(name) {
  if (!name) return 'Vô danh';
  const str = String(name).trim();
  if (str.length === 0) return 'Vô danh';
  if (str.length === 1) return `${str}***`;
  const first = str.charAt(0);
  const last = str.charAt(str.length - 1);
  return `${first}***${last}`;
}

module.exports = { maskStudentName };
