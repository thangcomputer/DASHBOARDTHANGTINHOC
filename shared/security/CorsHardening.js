'use strict';
const cors = require('cors');
const config = require('../../config/security');

// Dynamic origin validation
const viteLocalOrigins = [5173, 5174, 5175, 5176, 5177].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]);
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  ...viteLocalOrigins,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

const isProd = process.env.NODE_ENV === 'production';

const corsOriginFn = (origin, cb) => {
  if (!origin) return cb(null, true);
  if (allowedOrigins.includes(origin)) return cb(null, true);
  if (!isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return cb(null, true);
  cb(null, false);
};

module.exports = cors({
  origin: corsOriginFn,
  credentials: config.cors.credentials
});