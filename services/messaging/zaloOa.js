/**
 * Zalo OA messaging — gửi tin nhắn text (OTP, mật khẩu tạm).
 */
const axios = require('axios');
const logger = require('../../config/logger');

let tokenCache = { token: '', expiresAt: 0 };

async function getZaloOAToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt - 5 * 60 * 1000) {
    return tokenCache.token;
  }

  const refreshToken = process.env.ZALO_OA_REFRESH_TOKEN || '';
  const appId = process.env.ZALO_APP_ID || '';
  const appSecret = process.env.ZALO_APP_SECRET || '';
  const staticToken = process.env.ZALO_OA_TOKEN || '';

  if (refreshToken && appId && appSecret) {
    try {
      const resp = await axios.post(
        'https://oauth.zaloapp.com/v4/oa/access_token',
        new URLSearchParams({
          app_id: appId,
          app_secret: appSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
      const newToken = resp.data?.access_token;
      const expiresIn = (resp.data?.expires_in || 3600) * 1000;
      if (newToken) {
        tokenCache = { token: newToken, expiresAt: Date.now() + expiresIn };
        return newToken;
      }
    } catch (e) {
      logger.warn({ err: e.response?.data || e.message }, '[Zalo OA] Refresh token failed');
    }
  }

  if (staticToken) {
    tokenCache = { token: staticToken, expiresAt: Date.now() + 55 * 60 * 1000 };
    return staticToken;
  }
  return '';
}

async function sendZaloText(userId, text) {
  const token = await getZaloOAToken();
  if (!token) {
    logger.warn('[Zalo OA] Chua cau hinh ZALO_OA_TOKEN / refresh token');
    return { ok: false, reason: 'not_configured' };
  }

  const post = (accessToken) =>
    axios.post(
      'https://openapi.zalo.me/v2.0/oa/message',
      { recipient: { user_id: userId }, message: { text } },
      { headers: { access_token: accessToken } },
    );

  try {
    let resp = await post(token);
    if (resp.data?.error === -216) {
      tokenCache = { token: '', expiresAt: 0 };
      const newToken = await getZaloOAToken();
      if (!newToken) return { ok: false, reason: 'token_expired' };
      resp = await post(newToken);
    }
    if (resp.data?.error && resp.data.error !== 0) {
      logger.warn({ data: resp.data }, '[Zalo OA] API error');
      return { ok: false, reason: 'api_error', data: resp.data };
    }
    return { ok: true };
  } catch (e) {
    logger.warn({ err: e.response?.data || e.message }, '[Zalo OA] Send failed');
    return { ok: false, reason: 'network', error: e.message };
  }
}

module.exports = { getZaloOAToken, sendZaloText };