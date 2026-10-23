const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const catalog = require('../../shared/messaging/chatStickers.json');
const categories = new Set([
  'greetings',
  'thanks',
  'confirm',
  'emotions',
  'study',
  'teacher',
  'celebration',
  'work',
  'other',
]);

describe('shared chat sticker catalog', () => {
  it('has unique IDs and complete metadata for the 54 new and legacy stickers', () => {
    const ids = catalog.map((sticker) => sticker.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const sticker of catalog) {
      assert.equal(typeof sticker.id, 'string');
      assert.ok(sticker.id.trim());
      assert.equal(typeof sticker.name, 'string');
      assert.ok(sticker.name.trim());
      assert.ok(categories.has(sticker.category), `${sticker.id} has unknown category`);
      assert.match(sticker.src, /^\/stickers\//);
      assert.ok(Array.isArray(sticker.keywords) && sticker.keywords.length > 0);
      assert.ok(sticker.keywords.every((keyword) => typeof keyword === 'string' && keyword.trim()));
      assert.match(sticker.src, /\.(png|webp|svg)(\?[^/]*)?$/i);
      if (sticker.visible !== false) {
        assert.match(sticker.src, /^\/stickers\/[^/]+\.webp$/i);
        assert.equal(path.basename(sticker.src, '.webp'), sticker.id);
      }
    }
    const activeStickers = catalog.filter((sticker) => sticker.visible !== false);
    assert.equal(activeStickers.length, 54);
    assert.deepEqual(
      Object.fromEntries([...new Set(activeStickers.map((sticker) => sticker.category))]
        .map((category) => [category, activeStickers.filter((sticker) => sticker.category === category).length])),
      {
        greetings: 5,
        thanks: 7,
        confirm: 6,
        emotions: 12,
        study: 6,
        teacher: 5,
        celebration: 6,
        work: 7,
      },
    );
    assert.equal(activeStickers.filter((sticker) => sticker.src.endsWith('.webp')).length, 54);
    for (const legacyId of [
      'hello', 'thanks', 'love', 'ok', 'da-vang', 'sorry', 'sad', 'cheer',
      'cute', 'haha', 'thinking', 'congrats', 'like', 'thank-you', 'wave', 'celebrate',
    ]) {
      assert.ok(catalog.some((sticker) => sticker.id === legacyId), `missing legacy sticker ID: ${legacyId}`);
    }
  });

  it('catalogs all 54 top-level WebP sticker assets', () => {
    const stickerRoot = path.join(ROOT, 'client', 'public', 'stickers');
    const webpFiles = fs.readdirSync(stickerRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.webp$/i.test(entry.name))
      .map((entry) => `/stickers/${entry.name}`);
    assert.equal(webpFiles.length, 54);

    const activeStickerSources = new Set(
      catalog.filter((sticker) => sticker.visible !== false).map((sticker) => sticker.src),
    );
    for (const webpPath of webpFiles) {
      assert.ok(activeStickerSources.has(webpPath), `WebP is not cataloged: ${webpPath}`);
    }
  });

  it('does not reuse asset paths', () => {
    const stickersBySrc = new Map();
    for (const sticker of catalog) {
      const previous = stickersBySrc.get(sticker.src);
      assert.ok(!previous, `${sticker.src} is shared by ${previous?.id} and ${sticker.id}`);
      stickersBySrc.set(sticker.src, sticker);
    }
  });

  it('reports missing assets and validates existing image files', (t) => {
    const missing = [];
    for (const sticker of catalog) {
      const assetPath = sticker.src.split('?')[0].replace(/^\//, '');
      const absolutePath = path.join(ROOT, 'client', 'public', assetPath);
      if (!fs.existsSync(absolutePath)) {
        missing.push(`MISSING STICKER ASSET: ${sticker.src}`);
        continue;
      }
      if (/\.(png|webp)$/i.test(assetPath)) {
        const data = fs.readFileSync(absolutePath);
        if (/\.webp$/i.test(assetPath)) {
          assert.equal(data.toString('ascii', 0, 4), 'RIFF', `${sticker.src} is not RIFF`);
          assert.equal(data.toString('ascii', 8, 12), 'WEBP', `${sticker.src} is not WebP`);
        } else {
          assert.deepEqual(
            data.subarray(0, 8),
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            `${sticker.src} is not PNG`,
          );
        }
      }
    }
    if (missing.length > 0) {
      t.diagnostic(missing.join('\n'));
      assert.deepEqual(missing, [], 'Sticker catalog references missing assets');
    }
  });

  it('matches Vietnamese search terms with or without diacritics', async () => {
    const { matchesChatStickerSearch } = await import('../../client/src/utils/chatStickerSearch.js');
    const byId = new Map(catalog.map((sticker) => [sticker.id, sticker]));
    for (const [query, id] of [
      ['cam on', 'cam-on'],
      ['xin chao', 'xin-chao'],
      ['ok', 'ok-luon'],
      ['hoc', 'dang-hoc'],
      ['buon', 'buon-qua'],
      ['co len', 'co-len'],
    ]) {
      assert.ok(matchesChatStickerSearch(byId.get(id), query), `${query} should match ${id}`);
    }
  });
});
