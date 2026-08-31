'use strict';

function socialOAuthDisabled(provider) {
  const name = String(provider || 'social').trim().toLowerCase();
  return function oauthDisabled(_req, res) {
    return res.status(410).json({
      success: false,
      code: `${name.toUpperCase()}_OAUTH_DISABLED`,
      message: `Đăng nhập ${name === 'zalo' ? 'Zalo' : 'Google'} không được hỗ trợ`,
    });
  };
}

const googleOAuthDisabled = socialOAuthDisabled('google');
const zaloOAuthDisabled = socialOAuthDisabled('zalo');

module.exports = {
  socialOAuthDisabled,
  googleOAuthDisabled,
  zaloOAuthDisabled,
};
