'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const catalogUiService = require('../../services/dewskillCatalogUiService');
const classService = require('../../services/dewskillClassService');
const DewskillClass = require('../../models/DewskillClass');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('sanitizeCatalogUiConfig trả mặc định chuẩn, giới hạn slide/mini banner và clamp autoPlaySeconds', () => {
  const def = catalogUiService.sanitizeCatalogUiConfig(null);
  assert.equal(def.showHeroSection, true);
  assert.equal(def.showFilterBar, true);
  assert.equal(def.showFeaturedBanner, true);
  assert.equal(def.sectionTitle, 'KHÓA HỌC PHÙ HỢP');
  assert.equal(def.heroSlides.length, 3);
  assert.equal(def.miniBanners.length, 2);

  const manySlides = Array.from({ length: 10 }, (_, idx) => ({
    id: `slide-${idx + 1}`,
    title: `Slide ${idx + 1}`,
    description: 'Mo ta',
    ctaLabel: 'Xem ngay',
    action: { type: 'tier', tier: 'mos' },
  }));
  const manyMinis = Array.from({ length: 4 }, (_, idx) => ({
    id: `mini-${idx + 1}`,
    title: `Mini ${idx + 1}`,
  }));

  const normalized = catalogUiService.sanitizeCatalogUiConfig({
    autoPlaySeconds: 99,
    heroSlides: manySlides,
    miniBanners: manyMinis,
  });

  assert.equal(normalized.autoPlaySeconds, 20);
  assert.equal(normalized.heroSlides.length, 6);
  assert.equal(normalized.miniBanners.length, 2);
});

test('sanitizeCatalogUiConfig chặn URL XSS, path traversal, CSS url() độc hại và ctaPath ngoài /student', () => {
  const dirty = catalogUiService.sanitizeCatalogUiConfig({
    heroSlides: [
      {
        id: 'xss-slide',
        title: 'An toàn',
        mascotUrl: 'javascript:alert(1)',
        gradient: 'url(https://evil.test/x.png); background: red',
        action: { type: 'tier', tier: 'invalid-tier' },
      },
    ],
    miniBanners: [
      {
        id: 'mini-xss',
        title: 'Mini',
        customImageUrl: '../../../etc/passwd',
        gradient: 'expression(alert(1))',
        targetTier: 'invalid-tier',
      },
    ],
    featuredBanner: {
      ctaPath: 'https://evil.example/phish',
      mascotUrl: 'data:text/html,<script>alert(1)</script>',
      gradient: 'linear-gradient(120deg, #10B981 0%, #0EA5E9 100%);}',
    },
  });

  assert.equal(
    dirty.heroSlides[0].mascotUrl,
    catalogUiService.DEFAULT_CATALOG_UI.heroSlides[0].mascotUrl
  );
  assert.equal(
    dirty.heroSlides[0].gradient,
    catalogUiService.DEFAULT_CATALOG_UI.heroSlides[0].gradient
  );
  assert.equal(dirty.heroSlides[0].action.tier, 'mos');

  assert.equal(dirty.miniBanners[0].customImageUrl, '');
  assert.equal(
    dirty.miniBanners[0].gradient,
    catalogUiService.DEFAULT_CATALOG_UI.miniBanners[0].gradient
  );
  assert.equal(dirty.miniBanners[0].targetTier, 'mos');

  assert.equal(dirty.featuredBanner.ctaPath, '/student/support');
  assert.equal(
    dirty.featuredBanner.mascotUrl,
    catalogUiService.DEFAULT_CATALOG_UI.featuredBanner.mascotUrl
  );
  assert.equal(
    dirty.featuredBanner.gradient,
    catalogUiService.DEFAULT_CATALOG_UI.featuredBanner.gradient
  );

  const validUploaded = catalogUiService.sanitizeCatalogUiConfig({
    heroSlides: [
      {
        title: 'Upload OK',
        mascotUrl: '/uploads/images/catalog/catalog_123.png',
        imageMode: 'cover',
      },
    ],
    featuredBanner: {
      ctaPath: '/student/ai-packages',
    },
  });
  assert.equal(validUploaded.heroSlides[0].mascotUrl, '/uploads/images/catalog/catalog_123.png');
  assert.equal(validUploaded.heroSlides[0].imageMode, 'cover');
  assert.equal(validUploaded.featuredBanner.ctaPath, '/student/ai-packages');
});

test('DewskillClass schema và LEVEL_OPTIONS hỗ trợ trường trình độ level', () => {
  const levelPath = DewskillClass.schema.path('level');
  assert.ok(levelPath, 'Schema phải có trường level');
  assert.deepEqual(levelPath.enumValues, ['', 'basic', 'intermediate', 'advanced']);
  assert.equal(classService.LEVEL_OPTIONS.length, 4);
  assert.deepEqual(
    classService.LEVEL_OPTIONS.map((o) => o.id),
    ['', 'basic', 'intermediate', 'advanced']
  );
});

test('dewskillClassRoutes đặt route /catalog-ui trước /:id, kiểm tra magic bytes upload và trả catalogUi trong /my-visible', () => {
  const routeSrc = read('routes/dewskillClassRoutes.js');
  const getCatalogIdx = routeSrc.indexOf("router.get('/catalog-ui'");
  const putCatalogIdx = routeSrc.indexOf("router.put('/catalog-ui'");
  const resetCatalogIdx = routeSrc.indexOf("router.post('/catalog-ui/reset'");
  const uploadCatalogIdx = routeSrc.indexOf("router.post('/catalog-ui/upload-image'");
  const paramPutIdx = routeSrc.indexOf("router.put('/:id'");

  assert.ok(getCatalogIdx > -1 && putCatalogIdx > -1 && resetCatalogIdx > -1 && uploadCatalogIdx > -1);
  assert.ok(uploadCatalogIdx < paramPutIdx, 'Các route /catalog-ui phải khai báo trước /:id');
  assert.ok(routeSrc.includes('validateUploadedFileMagic'));
  assert.ok(routeSrc.includes("uploads/images/catalog") || routeSrc.includes("'uploads', 'images', 'catalog'"));
  assert.ok(routeSrc.includes('catalogUi'));
});

test('AdminDewskillClassesTab và DewskillCatalogUiEditor không gắn data-theme DewSkill', () => {
  const adminTab = read('client/src/components/admin/tabs/AdminDewskillClassesTab.jsx');
  const uiEditor = read('client/src/components/admin/dewskillClasses/DewskillCatalogUiEditor.jsx');
  const formModal = read('client/src/components/admin/dewskillClasses/DewskillClassFormModal.jsx');

  assert.equal(adminTab.includes('data-theme="dewskill"'), false);
  assert.equal(uiEditor.includes('data-theme="dewskill"'), false);
  assert.ok(adminTab.includes("subTab === 'catalog-ui'") || adminTab.includes("setSubTab('catalog-ui')"));
  assert.ok(formModal.includes('form.level'));
});

test('StudentCoursesCatalogPage đồng bộ catalogUi từ API, Socket.IO và resolveMediaUrl', () => {
  const page = read('client/src/components/student/courses/StudentCoursesCatalogPage.jsx');
  assert.ok(page.includes('res.meta?.catalogUi'));
  assert.ok(page.includes("'dewskill:catalog-ui-updated'"));
  assert.ok(page.includes('resolveMediaUrl'));
  assert.ok(page.includes('showHeroSection'));
  assert.ok(page.includes('showFilterBar'));
  assert.ok(page.includes('showFeaturedCard'));
  assert.ok(page.includes('catalogUi?.sectionTitle'));
});
