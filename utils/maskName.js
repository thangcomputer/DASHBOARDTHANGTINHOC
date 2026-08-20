function maskStudentName(name) {
  if (!name) return '***';
  const str = String(name).trim();
  if (str.length === 0) return '***';
  return `${str.charAt(0)}***`;
}

module.exports = { maskStudentName };
