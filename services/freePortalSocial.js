'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { FREE_COURSE_NAME, freePortalFlags } = require('./freePortal');
const { normalizeVNPhone } = require('../utils/phoneIdentity');

const PROVIDERS = {
  google: 'googleId',
  facebook: 'facebookId',
};

function profileReady(student) {
  const age = Number(student?.age);
  const phone = normalizeVNPhone(student?.phone);
  return Number.isInteger(age) && age >= 10 && age <= 80 && Boolean(phone);
}

function parseAge(value) {
  const age = Number(value);
  if (!Number.isInteger(age) || age < 10 || age > 80) return null;
  return age;
}

function clientOrigin() {
  return String(process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
}

function apiOrigin(req) {
  if (process.env.OAUTH_PUBLIC_ORIGIN) {
    return String(process.env.OAUTH_PUBLIC_ORIGIN).replace(/\/$/, '');
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  let host = String(req.headers['x-forwarded-host'] || req.get('host') || '').split(',')[0].trim();
  host = host.replace(/^\[::1\]/, '127.0.0.1').replace(/^::1/, '127.0.0.1');
  return `${proto}://${host}`;
}

function providerSetup(provider, req) {
  const redirectUri = `${apiOrigin(req)}/api/auth/free-portal/${provider}/callback`;
  if (provider === 'google') {
    const id = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    const secret = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
    if (!id || !secret) return null;
    return { id, secret, redirectUri };
  }
  const id = String(process.env.FACEBOOK_APP_ID || '').trim();
  const secret = String(process.env.FACEBOOK_APP_SECRET || '').trim();
  if (!id || !secret) return null;
  return { id, secret, redirectUri };
}

function socialStatus() {
  return {
    google: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim() && String(process.env.GOOGLE_CLIENT_SECRET || '').trim()),
    facebook: Boolean(String(process.env.FACEBOOK_APP_ID || '').trim() && String(process.env.FACEBOOK_APP_SECRET || '').trim()),
  };
}

function signTicket(payload) {
  return jwt.sign(
    { ...payload, purpose: 'free-portal-social' },
    process.env.JWT_SECRET,
    { expiresIn: '20m' },
  );
}

function readTicket(token) {
  const data = jwt.verify(token, process.env.JWT_SECRET);
  if (data?.purpose !== 'free-portal-social') {
    const error = new Error('Phiên mạng xã hội không hợp lệ');
    error.status = 401;
    throw error;
  }
  if (!PROVIDERS[data.provider] || !data.providerId) {
    const error = new Error('Phiên mạng xã hội không hợp lệ');
    error.status = 401;
    throw error;
  }
  return data;
}

function frontUrl(query) {
  const url = new URL('/DANGNHAPMIENPHI', clientOrigin());
  Object.entries(query).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function authUrl(provider, req, state) {
  const setup = providerSetup(provider, req);
  if (!setup) {
    const error = new Error(provider === 'google'
      ? 'Chưa cấu hình đăng nhập Google'
      : 'Chưa cấu hình đăng nhập Facebook');
    error.status = 503;
    throw error;
  }
  if (provider === 'google') {
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', setup.id);
    url.searchParams.set('redirect_uri', setup.redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return url.toString();
  }
  const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
  url.searchParams.set('client_id', setup.id);
  url.searchParams.set('redirect_uri', setup.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'email,public_profile');
  return url.toString();
}

async function fetchProfile(provider, req, code) {
  const setup = providerSetup(provider, req);
  if (!setup) {
    const error = new Error('Chưa cấu hình đăng nhập mạng xã hội');
    error.status = 503;
    throw error;
  }
  if (provider === 'google') {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: setup.id,
        client_secret: setup.secret,
        redirect_uri: setup.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      const error = new Error('Google chưa xác nhận tài khoản');
      error.status = 401;
      throw error;
    }
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    const info = await infoRes.json();
    if (!infoRes.ok || !info.sub) {
      const error = new Error('Không lấy được hồ sơ Google');
      error.status = 401;
      throw error;
    }
    return {
      provider,
      providerId: String(info.sub),
      name: String(info.name || '').trim(),
      email: String(info.email || '').trim().toLowerCase(),
      avatar: String(info.picture || ''),
    };
  }
  const tokenUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  tokenUrl.searchParams.set('client_id', setup.id);
  tokenUrl.searchParams.set('client_secret', setup.secret);
  tokenUrl.searchParams.set('redirect_uri', setup.redirectUri);
  tokenUrl.searchParams.set('code', code);
  const tokenRes = await fetch(tokenUrl);
  const token = await tokenRes.json();
  if (!tokenRes.ok || !token.access_token) {
    const error = new Error('Facebook chưa xác nhận tài khoản');
    error.status = 401;
    throw error;
  }
  const infoUrl = new URL('https://graph.facebook.com/me');
  infoUrl.searchParams.set('fields', 'id,name,email,picture');
  infoUrl.searchParams.set('access_token', token.access_token);
  const infoRes = await fetch(infoUrl);
  const info = await infoRes.json();
  if (!infoRes.ok || !info.id) {
    const error = new Error('Không lấy được hồ sơ Facebook');
    error.status = 401;
    throw error;
  }
  return {
    provider,
    providerId: String(info.id),
    name: String(info.name || '').trim(),
    email: String(info.email || '').trim().toLowerCase(),
    avatar: String(info.picture?.data?.url || ''),
  };
}

async function issueSession(student, fingerprint) {
  const fresh = await Student.findById(student._id);
  if (!fresh) {
    const error = new Error('Không thấy tài khoản');
    error.status = 404;
    throw error;
  }
  const tokenVersion = (fresh.tokenVersion || 0) + 1;
  const payload = {
    id: fresh._id,
    role: 'student',
    name: fresh.name,
    adminRole: null,
    permissions: [],
    branchId: null,
    branchCode: '',
    tokenVersion,
    aud: 'public',
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  fresh.tokenVersion = tokenVersion;
  fresh.refreshToken = refreshToken;
  fresh.lastLogin = new Date();
  fresh.loginAttempts = 0;
  if (fingerprint) fresh.deviceFingerprint = String(fingerprint).slice(0, 200);
  fresh.markModified('tokenVersion');
  await fresh.save({ validateModifiedOnly: true });
  return {
    accessToken,
    refreshToken,
    user: {
      _id: fresh._id,
      id: fresh._id,
      name: fresh.name,
      role: 'student',
      phone: normalizeVNPhone(fresh.phone) || fresh.phone || '',
      status: fresh.status,
      course: fresh.course,
      avatar: fresh.avatar || '',
      gender: fresh.gender || '',
      isFirstLogin: false,
      showWelcomeCelebration: fresh.welcomeCelebrationSeen === false,
      ...freePortalFlags(fresh),
    },
  };
}

async function findByProvider(profile) {
  const field = PROVIDERS[profile.provider];
  return Student.findOne({ [field]: profile.providerId });
}

function ticketFor(profile) {
  return signTicket(profile);
}

async function exchangeTicket(token, fingerprint) {
  const profile = readTicket(token);
  const student = await findByProvider(profile);
  if (student && profileReady(student)) {
    return { needsProfile: false, session: await issueSession(student, fingerprint) };
  }
  return {
    needsProfile: true,
    ticket: token,
    name: student?.name || profile.name || '',
    email: student?.email || profile.email || '',
    provider: profile.provider,
  };
}

async function completeProfile({ token, name, age, phone, email, fingerprint }) {
  const profile = readTicket(token);
  const parsedAge = parseAge(age);
  const canonicalPhone = normalizeVNPhone(phone);
  const displayName = String(name || profile.name || '').trim();
  const rawEmail = String(email || profile.email || '').trim().toLowerCase();
  if (!parsedAge) {
    const error = new Error('Tuổi từ 10 đến 80');
    error.status = 400;
    throw error;
  }
  if (!canonicalPhone) {
    const error = new Error('Số điện thoại không hợp lệ');
    error.status = 400;
    throw error;
  }
  if (displayName.length < 2) {
    const error = new Error('Hãy nhập họ tên');
    error.status = 400;
    throw error;
  }
  const field = PROVIDERS[profile.provider];
  let student = await findByProvider(profile);
  if (student && profileReady(student)) {
    return issueSession(student, fingerprint);
  }
  const byPhone = await Student.findOne({ $or: [{ phone: canonicalPhone }, { zalo: canonicalPhone }] });
  if (byPhone && (!student || String(byPhone._id) !== String(student._id))) {
    if (byPhone.freePortal !== true) {
      const error = new Error('Số này đã thuộc học viên của trung tâm. Hãy đăng nhập ở trang trung tâm.');
      error.status = 409;
      throw error;
    }
    if (byPhone[field] && byPhone[field] !== profile.providerId) {
      const error = new Error('Số điện thoại này đã gắn với tài khoản mạng xã hội khác.');
      error.status = 409;
      throw error;
    }
    student = byPhone;
  }
  if (student) {
    student.name = displayName;
    student.phone = canonicalPhone;
    student.zalo = canonicalPhone;
    student.age = parsedAge;
    student[field] = profile.providerId;
    if (rawEmail) student.email = rawEmail;
    if (profile.avatar && !student.avatar) student.avatar = profile.avatar;
    student.freePortal = true;
    await student.save();
    return issueSession(student, fingerprint);
  }
  student = await Student.create({
    name: displayName,
    phone: canonicalPhone,
    zalo: canonicalPhone,
    age: parsedAge,
    email: rawEmail || undefined,
    avatar: profile.avatar || '',
    password: crypto.randomBytes(24).toString('hex'),
    [field]: profile.providerId,
    course: FREE_COURSE_NAME,
    price: 0,
    paid: true,
    paidAmount: 0,
    status: 'Đang học',
    learningMode: 'ONLINE',
    freePortal: true,
    freeUnlocked: false,
    enrollments: [{
      courseName: FREE_COURSE_NAME,
      price: 0,
      paid: true,
      status: 'active',
      learningAccess: true,
      isPrimary: true,
      totalSessions: 0,
      remainingSessions: 0,
    }],
  });
  return issueSession(student, fingerprint);
}

module.exports = {
  profileReady,
  parseAge,
  socialStatus,
  authUrl,
  fetchProfile,
  frontUrl,
  ticketFor,
  exchangeTicket,
  completeProfile,
};
