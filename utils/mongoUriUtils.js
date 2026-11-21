'use strict';

function redactMongoUri(uri) {
  try {
    const parsed = new URL(String(uri || ''));
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid MongoDB URI>';
  }
}

function parseMongoTarget(uri, label) {
  let parsed;
  try {
    parsed = new URL(String(uri || ''));
  } catch {
    throw new Error(`${label} không phải MongoDB URI hợp lệ`);
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error(`${label} phải dùng mongodb:// hoặc mongodb+srv://`);
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ''));
  if (!dbName || dbName.includes('/')) {
    throw new Error(`${label} phải chỉ rõ đúng một database`);
  }
  return {
    uri: String(uri),
    dbName,
    hostname: parsed.hostname.toLowerCase(),
  };
}

module.exports = {
  parseMongoTarget,
  redactMongoUri,
};
