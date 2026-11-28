/**
 * Cache SystemSettings (singleton _key=main).
 * Khong cache secret (password hash, MFA secret).
 */
const SystemSettings = require('../models/SystemSettings');
const cache = require('../utils/cache');

const SETTINGS_CACHE_KEY = 'settings:doc';
const SETTINGS_CACHE_TTL = 60;
const SETTINGS_PUBLIC_SELECT = '-adminPasswordHash -adminMfaSecret -adminMfaPendingSecret';

async function invalidateSettingsCache() {
  await cache.del(SETTINGS_CACHE_KEY);
}

async function getCachedSettings() {
  return cache.wrap(SETTINGS_CACHE_KEY, SETTINGS_CACHE_TTL, async () => {
    let settings = await SystemSettings.findOne({ _key: 'main' })
      .select(SETTINGS_PUBLIC_SELECT)
      .lean();
    if (!settings) {
      try {
        await SystemSettings.updateOne(
          { _key: 'main' },
          { $setOnInsert: { _key: 'main' } },
          { upsert: true },
        );
      } catch (err) {
        if (err?.code !== 11000) throw err;
      }
      settings = await SystemSettings.findOne({ _key: 'main' })
        .select(SETTINGS_PUBLIC_SELECT)
        .lean();
    }
    return settings;
  });
}

module.exports = {
  SETTINGS_CACHE_KEY,
  SETTINGS_CACHE_TTL,
  getCachedSettings,
  invalidateSettingsCache,
};