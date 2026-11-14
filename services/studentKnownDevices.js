const logger = require('../config/logger');
const NotificationService = require('./NotificationService');

const MAX_KNOWN_DEVICES = 30;
/** Bắt đầu cảnh báo / kiểm tra khóa khi số thiết bị >= 3. */
const ALERT_AFTER_COUNT = 2;

const DEVICE_LABELS = {
  laptop: 'Laptop',
  phone: 'Điện thoại',
  tablet: 'Tablet',
};

const STUDENT_LOCKED_RESPONSE = {
  success: false,
  isBan: true,
  code: 'ACCOUNT_LOCKED',
  message: 'Tài khoản học viên đã bị khóa đăng nhập. Vui lòng liên hệ trung tâm.',
};

function isStudentAccountLocked(user) {
  return !!(user && user.accountLocked);
}

function buildStudentLockedResponse(student) {
  const reason = String(student?.accountLockReason || '').trim();
  return {
    ...STUDENT_LOCKED_RESPONSE,
    ...(reason ? { lockReason: reason } : {}),
    message: reason
      ? `Tài khoản học viên đã bị khóa: ${reason}. Vui lòng liên hệ trung tâm.`
      : STUDENT_LOCKED_RESPONSE.message,
  };
}

/**
 * Phân loại thiết bị đăng nhập thành Laptop, Điện thoại hoặc Tablet.
 */
function detectDeviceType(userAgent, platformHint = '') {
  const ua = String(userAgent || '').trim();
  const platform = String(platformHint || '').trim().toLowerCase();

  // Kiểm tra Tablet trước (iPad hoặc Android không chứa "Mobile")
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return { deviceType: 'tablet', deviceLabel: DEVICE_LABELS.tablet };
  }

  // Điện thoại: iPhone, iPod, Android Mobile, Mobile UA hoặc mobile app platform
  if (/iPhone|iPod|Windows Phone|Mobile/i.test(ua) || /Android.*Mobile/i.test(ua) || ['android', 'ios'].includes(platform)) {
    return { deviceType: 'phone', deviceLabel: DEVICE_LABELS.phone };
  }

  return { deviceType: 'laptop', deviceLabel: DEVICE_LABELS.laptop };
}

/**
 * Chuẩn hóa họ hệ điều hành từ User-Agent / platformHint (độc lập với tên trình duyệt).
 */
function detectOsFamily(userAgent, platformHint = '') {
  const ua = String(userAgent || '').trim();
  const platform = String(platformHint || '').trim().toLowerCase();
  if (/Windows/i.test(ua)) return 'windows';
  if (/iPad/i.test(ua)) return 'ipad';
  if (/iPhone|iPod/i.test(ua) || platform === 'ios') return 'ios';
  if (/Android/i.test(ua) || platform === 'android') return 'android';
  if (/CrOS/i.test(ua)) return 'chromeos';
  if (/Macintosh|Mac OS X/i.test(ua) || platform === 'mac' || platform === 'macos') return 'mac';
  if (/Linux/i.test(ua) || platform === 'linux') return 'linux';
  return 'other';
}

function isSameNetworkOrLocal(deviceEntry, networkKey) {
  const nk = String(networkKey || '').trim();
  const entryNk = String(deviceEntry?.networkKey || '').trim();
  const locs = Array.isArray(deviceEntry?.locations) ? deviceEntry.locations : [];
  if (!nk || nk === 'local' || !entryNk || entryNk === 'local') return true;
  if (entryNk === nk) return true;
  return locs.includes(nk);
}

function pushUniqueCapped(list, value, limit = 20) {
  const next = Array.isArray(list) ? [...list] : [];
  const val = String(value || '').trim();
  if (!val) return next;
  if (!next.includes(val)) next.push(val);
  return next.length > limit ? next.slice(-limit) : next;
}

/**
 * Gộp các bản ghi knownDevices trùng lặp do đăng nhập nhiều trình duyệt trên cùng 1 thiết bị vật lý.
 */
function consolidateKnownDevices(devices) {
  if (!Array.isArray(devices) || devices.length <= 1) {
    return Array.isArray(devices) ? devices : [];
  }

  const merged = [];
  for (const raw of devices) {
    if (!raw || typeof raw !== 'object') continue;
    const fp = String(raw.fingerprint || '').trim().slice(0, 128);
    let fps = Array.isArray(raw.fingerprints)
      ? raw.fingerprints.map((item) => String(item || '').trim().slice(0, 128)).filter(Boolean)
      : [];
    if (fp) fps = pushUniqueCapped(fps, fp, 20);

    const detected = detectDeviceType(raw.userAgent);
    const deviceType = raw.deviceType || detected.deviceType;
    const deviceLabel = raw.deviceLabel || DEVICE_LABELS[deviceType] || detected.deviceLabel;
    const osFamily = String(raw.osFamily || detectOsFamily(raw.userAgent)).trim() || 'other';
    const ip = String(raw.ip || '').trim();
    const networkKey = String(raw.networkKey || computeNetworkKey(ip) || '').trim();
    let locations = Array.isArray(raw.locations) ? raw.locations.filter(Boolean) : [];
    if (networkKey) locations = pushUniqueCapped(locations, networkKey, 20);

    const target = merged.find((existing) => {
      const existingFps = Array.isArray(existing.fingerprints) ? existing.fingerprints : [];
      const fpOverlap = fps.some((candidate) => candidate === existing.fingerprint || existingFps.includes(candidate));
      if (fpOverlap) return true;
      const sameType = existing.deviceType === deviceType;
      const sameOs = (existing.osFamily || detectOsFamily(existing.userAgent)) === osFamily;
      if (!sameType || !sameOs) return false;
      const networks = [networkKey, ...locations].filter(Boolean);
      if (networks.length === 0) return isSameNetworkOrLocal(existing, '');
      return networks.some((loc) => isSameNetworkOrLocal(existing, loc));
    });

    if (!target) {
      merged.push({
        fingerprint: fp || fps[0] || '',
        fingerprints: fps.slice(-20),
        userAgent: String(raw.userAgent || '').trim().slice(0, 180),
        deviceType,
        deviceLabel,
        osFamily,
        ip,
        networkKey,
        locations: locations.slice(-20),
        firstSeenAt: raw.firstSeenAt || raw.lastSeenAt || new Date(),
        lastSeenAt: raw.lastSeenAt || raw.firstSeenAt || new Date(),
      });
      continue;
    }

    let combinedFps = Array.isArray(target.fingerprints) ? [...target.fingerprints] : [];
    if (target.fingerprint) combinedFps = pushUniqueCapped(combinedFps, target.fingerprint, 20);
    for (const candidate of fps) combinedFps = pushUniqueCapped(combinedFps, candidate, 20);
    target.fingerprints = combinedFps;
    if (fp) target.fingerprint = fp;

    let combinedLocs = Array.isArray(target.locations) ? [...target.locations] : [];
    for (const loc of locations) combinedLocs = pushUniqueCapped(combinedLocs, loc, 20);
    target.locations = combinedLocs;

    const rawFirst = raw.firstSeenAt ? new Date(raw.firstSeenAt) : null;
    const targetFirst = target.firstSeenAt ? new Date(target.firstSeenAt) : null;
    if (rawFirst && (!targetFirst || rawFirst < targetFirst)) {
      target.firstSeenAt = rawFirst;
    }

    const rawLast = raw.lastSeenAt ? new Date(raw.lastSeenAt) : null;
    const targetLast = target.lastSeenAt ? new Date(target.lastSeenAt) : null;
    if (rawLast && (!targetLast || rawLast >= targetLast)) {
      target.lastSeenAt = rawLast;
      if (raw.userAgent) target.userAgent = String(raw.userAgent).trim().slice(0, 180);
      if (ip) target.ip = ip;
      if (networkKey) target.networkKey = networkKey;
    }
  }

  return merged;
}

function normalizeClientIp(rawIp) {
  let raw = String(rawIp || '').split(',')[0].trim();
  if (!raw) return '';
  raw = raw.replace(/^::ffff:/i, '');
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(raw)) {
    raw = raw.split(':')[0];
  }
  return raw.slice(0, 64);
}

function computeNetworkKey(ip) {
  if (!ip) return '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') {
    return 'local';
  }
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    return `${v4[1]}.${v4[2]}.${v4[3]}.0/24`;
  }
  if (ip.includes(':')) {
    const parts = ip.split(':').filter((p) => p !== '');
    if (parts.length >= 2) {
      return `${parts.slice(0, 4).join(':')}::/64`;
    }
    return ip;
  }
  return ip;
}

function extractClientLocation(reqOrMeta) {
  if (typeof reqOrMeta === 'string') {
    return { userAgent: reqOrMeta, ip: '', networkKey: '', platform: '' };
  }
  if (!reqOrMeta || typeof reqOrMeta !== 'object') {
    return { userAgent: '', ip: '', networkKey: '', platform: '' };
  }
  if (reqOrMeta.headers && typeof reqOrMeta.headers === 'object') {
    const userAgent = String(reqOrMeta.headers['user-agent'] || '').trim();
    const rawIp = reqOrMeta.headers['x-forwarded-for'] || reqOrMeta.ip || reqOrMeta.socket?.remoteAddress || '';
    const ip = normalizeClientIp(rawIp);
    const platform = String(reqOrMeta.body?.platform || '').trim();
    return { userAgent, ip, networkKey: computeNetworkKey(ip), platform };
  }
  const userAgent = String(reqOrMeta.userAgent || '').trim();
  const ip = normalizeClientIp(reqOrMeta.ip || '');
  const networkKey = reqOrMeta.networkKey ? String(reqOrMeta.networkKey).trim() : computeNetworkKey(ip);
  const platform = String(reqOrMeta.platform || '').trim();
  return { userAgent, ip, networkKey, platform };
}

function summarizeKnownDevices(devices) {
  if (!Array.isArray(devices) || !devices.length) return '';
  const present = new Set(
    devices.map((d) => d.deviceType || detectDeviceType(d.userAgent).deviceType),
  );
  const ordered = ['laptop', 'phone', 'tablet']
    .filter((type) => present.has(type))
    .map((type) => DEVICE_LABELS[type]);
  return ordered.join(', ');
}

/**
 * Ghi nhận thiết bị & vị trí mạng của HV vào knownDevices.
 * - Cùng thiết bị (fingerprint đã biết) đăng nhập ở vị trí khác -> hợp lệ, không khóa, không báo.
 * - Đủ 3 thiết bị (Laptop, Điện thoại, Tablet) -> báo Admin biết, chưa khóa.
 * - Từ 3 thiết bị trở lên bất thường ở vị trí khác của thiết bị khác -> tự động khóa & báo Admin.
 */
function recordStudentKnownDevice(student, fingerprint, reqOrMeta) {
  const fp = String(fingerprint || '').trim().slice(0, 128);
  const currentCount = Array.isArray(student?.knownDevices)
    ? student.knownDevices.length
    : (Number(student?.knownDeviceCount) || 0);
  if (!student || !fp) {
    return { isNew: false, shouldAlert: false, shouldLock: false, count: currentCount };
  }

  const { userAgent, ip, networkKey, platform } = extractClientLocation(reqOrMeta);
  const { deviceType, deviceLabel } = detectDeviceType(userAgent, platform);
  const osFamily = detectOsFamily(userAgent, platform);
  const ua = String(userAgent || '').trim().slice(0, 180);
  const now = new Date();
  if (!Array.isArray(student.knownDevices)) student.knownDevices = [];
  if (student.knownDevices.length > 1) {
    student.knownDevices = consolidateKnownDevices(student.knownDevices);
  }

  // Tầng 1: khớp chính xác fingerprint (cùng mã thiết bị v2 hoặc nằm trong danh sách trình duyệt đã biết của thiết bị đó)
  // Tầng 2: nhiều trình duyệt khác nhau trên cùng 1 máy (cùng loại thiết bị + cùng OS + cùng mạng/local)
  const existing = student.knownDevices.find((d) => {
    const knownFps = Array.isArray(d.fingerprints) ? d.fingerprints : [];
    return String(d.fingerprint) === fp || knownFps.includes(fp);
  }) || student.knownDevices.find((d) => {
    const dType = d.deviceType || detectDeviceType(d.userAgent).deviceType;
    const dOs = d.osFamily || detectOsFamily(d.userAgent);
    return dType === deviceType && dOs === osFamily && isSameNetworkOrLocal(d, networkKey);
  });

  if (existing) {
    const prevLocations = Array.isArray(existing.locations) ? existing.locations : [];
    const locationChanged = Boolean(networkKey && existing.networkKey && existing.networkKey !== networkKey);
    let knownFps = Array.isArray(existing.fingerprints) ? [...existing.fingerprints] : [];
    if (existing.fingerprint) knownFps = pushUniqueCapped(knownFps, existing.fingerprint, 20);
    knownFps = pushUniqueCapped(knownFps, fp, 20);

    existing.lastSeenAt = now;
    existing.fingerprint = fp;
    existing.fingerprints = knownFps;
    if (ua) existing.userAgent = ua;
    existing.deviceType = deviceType;
    existing.deviceLabel = deviceLabel;
    existing.osFamily = osFamily;
    if (ip) existing.ip = ip;
    if (networkKey) {
      existing.networkKey = networkKey;
      if (!prevLocations.includes(networkKey)) prevLocations.push(networkKey);
      existing.locations = prevLocations.slice(-20);
    }
    student.knownDeviceCount = student.knownDevices.length;
    student.knownDeviceSummary = summarizeKnownDevices(student.knownDevices);
    student.markModified('knownDevices');
    return {
      isNew: false,
      shouldAlert: false,
      shouldLock: false,
      locationChanged,
      count: student.knownDevices.length,
      deviceType,
      deviceLabel,
      ip,
      networkKey,
    };
  }

  const priorLocations = new Set(
    student.knownDevices
      .flatMap((d) => [d.networkKey, ...(Array.isArray(d.locations) ? d.locations : [])])
      .filter((loc) => loc && loc !== 'local'),
  );
  const isDifferentLocation = Boolean(
    networkKey && networkKey !== 'local' && priorLocations.size > 0 && !priorLocations.has(networkKey),
  );

  student.knownDevices.push({
    fingerprint: fp,
    fingerprints: [fp],
    userAgent: ua,
    deviceType,
    deviceLabel,
    osFamily,
    ip,
    networkKey,
    locations: networkKey ? [networkKey] : [],
    firstSeenAt: now,
    lastSeenAt: now,
  });
  if (student.knownDevices.length > MAX_KNOWN_DEVICES) {
    student.knownDevices = student.knownDevices.slice(-MAX_KNOWN_DEVICES);
  }

  const count = student.knownDevices.length;
  student.knownDeviceCount = count;
  student.knownDeviceSummary = summarizeKnownDevices(student.knownDevices);
  student.markModified('knownDevices');

  const uniqueTypes = new Set(
    student.knownDevices.map((d) => d.deviceType || detectDeviceType(d.userAgent).deviceType),
  );

  let shouldAlert = false;
  let shouldLock = false;
  let reason = '';

  if (count === 3) {
    if (uniqueTypes.size === 3 || !isDifferentLocation) {
      shouldAlert = true;
      shouldLock = false;
      reason = 'three_devices';
    } else {
      shouldAlert = true;
      shouldLock = true;
      reason = 'abnormal_device_location';
      student.accountLocked = true;
      student.accountLockReason = 'Đăng nhập bất thường từ 3 thiết bị trở lên ở vị trí/thiết bị khác';
    }
  } else if (count >= 4) {
    shouldAlert = true;
    shouldLock = true;
    reason = isDifferentLocation ? 'abnormal_device_location' : 'exceeded_three_devices';
    student.accountLocked = true;
    student.accountLockReason = 'Đăng nhập vượt quá 3 thiết bị cho phép ở vị trí/thiết bị khác';
  }

  return {
    isNew: true,
    shouldAlert,
    shouldLock,
    reason,
    isDifferentLocation,
    count,
    deviceType,
    deviceLabel,
    ip,
    networkKey,
  };
}

async function notifyIfNewStudentDevice(io, student, record) {
  const triggerAlert = Boolean(record?.shouldAlert) || Boolean(record?.isNew && record.count > ALERT_AFTER_COUNT);
  if (!triggerAlert) return;
  try {
    const sid = String(student._id);
    const name = student.name || 'Học viên';
    const phone = student.phone || student.zalo || '';
    const summary = student.knownDeviceSummary || summarizeKnownDevices(student.knownDevices) || 'Laptop, Điện thoại, Tablet';
    const deviceDetail = `${record.deviceLabel || 'Thiết bị'}${record.ip ? ` · IP ${record.ip}` : ''}`;

    const title = record.shouldLock
      ? 'Tự động khóa tài khoản học viên (đăng nhập bất thường)'
      : 'Học viên đăng nhập đủ 3 thiết bị';

    const content = record.shouldLock
      ? `${name}${phone ? ` (${phone})` : ''} vừa đăng nhập thiết bị thứ ${record.count} (${deviceDetail}) ở vị trí/thiết bị bất thường (Danh sách: ${summary}). Hệ thống đã tự động khóa tài khoản.`
      : `${name}${phone ? ` (${phone})` : ''} đã đăng nhập đủ 3 thiết bị (${summary}). Nếu phát hiện thiết bị khác ở vị trí khác tiếp theo, hệ thống sẽ tự động khóa tài khoản.`;

    await NotificationService.notifyBranchAdmins(io, {
      branchId: student.branchId || null,
      title,
      content,
      payload: {
        kind: 'student_device_alert',
        locked: !!record.shouldLock,
        studentId: sid,
        studentName: name,
        phone,
        deviceCount: record.count,
        deviceSummary: summary,
        deviceType: record.deviceType || '',
        deviceLabel: record.deviceLabel || '',
        ip: record.ip || '',
      },
      link: `/admin#students?studentId=${encodeURIComponent(sid)}`,
    });
  } catch (err) {
    logger.warn('[AUTH] student device notify: %s', err.message);
  }
}

module.exports = {
  detectDeviceType,
  detectOsFamily,
  consolidateKnownDevices,
  normalizeClientIp,
  computeNetworkKey,
  extractClientLocation,
  summarizeKnownDevices,
  recordStudentKnownDevice,
  notifyIfNewStudentDevice,
  isStudentAccountLocked,
  buildStudentLockedResponse,
  STUDENT_LOCKED_RESPONSE,
};
