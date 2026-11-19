const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('dark mode stylesheet loads after index.css without cascade clobbering', () => {
  const mainJsx = read('client/src/main.jsx');
  const idxPos = mainJsx.indexOf("import './index.css'");
  const darkPos = mainJsx.indexOf("import './styles/darkMode.css'");
  assert.ok(idxPos !== -1, 'client/src/main.jsx must import index.css');
  assert.ok(darkPos > idxPos, 'darkMode.css must be imported after index.css so dark overrides win the cascade');

  const indexCss = read('client/src/index.css');
  assert.doesNotMatch(
    indexCss,
    /@layer\s+base[\s\S]*html\[data-theme="dark"\]/,
    'index.css must not declare html[data-theme="dark"] inside @layer base where unlayered :root overrides it',
  );
});

test('darkMode.css enforces high contrast for hex colors, topbar chrome, inputs, modals, and custom components', () => {
  const darkCss = read('client/src/styles/darkMode.css');

  // Unlayered dark tokens & media screen scoping (keeps print/PDF crisp white)
  assert.match(darkCss, /@media screen/);
  assert.match(darkCss, /color-scheme:\s*dark/);
  assert.match(darkCss, /--cms-border:\s*rgba\(/);
  assert.match(darkCss, /--cms-surface:\s*#111827/);

  // Arbitrary dark text hex values from Profile & Dashboards must flip to crisp light ink
  for (const hex of ['#0F172A', '#1E293B', '#334155', '#475569', '#64748B', '#0F766E', '#059669']) {
    assert.ok(darkCss.includes(hex), `darkMode.css should handle arbitrary text/surface hex ${hex}`);
  }

  // Light hex backgrounds & borders used in cards and buttons
  for (const hex of ['#F8FAFC', '#F0FDFA', '#ECFDF5', '#F1F5F9', '#E2E8F0']) {
    assert.ok(darkCss.includes(hex), `darkMode.css should handle light hex surface/border ${hex}`);
  }

  // Topbar controls, brand logo legibility, bottom nav, inputs, tables, and custom modules
  assert.match(darkCss, /\.cms-topbar__action/);
  assert.match(darkCss, /\.cms-topbar__brand/);
  assert.match(darkCss, /\.cms-mobile-bottom-nav/);
  assert.match(darkCss, /\.cms-notif-sheet/);
  assert.match(darkCss, /\.cms-fm-support-button/);
  assert.match(darkCss, /\.dp-dew-main-panel/);
  assert.match(darkCss, /\.th-dashboard-overview/);
  assert.match(darkCss, /table thead/);
  assert.match(darkCss, /select option/);

  // Printable invoices & certificates stay light
  assert.match(darkCss, /data-keep-light/);
  assert.match(darkCss, /#th-digital-cert-sheet/);
  assert.match(darkCss, /\.invoice-paper/);
});

test('key components provide explicit dark-mode contrast classes and protect certificates as light paper', () => {
  const langSwitcher = read('client/src/components/LanguageSwitcher.jsx');
  assert.match(langSwitcher, /dark:bg-slate-900/);
  assert.match(langSwitcher, /dark:bg-emerald-950\/55/);
  assert.match(langSwitcher, /dark:text-slate-200/);

  const profileTab = read('client/src/components/student/StudentProfileTab.jsx');
  assert.match(profileTab, /dark:bg-emerald-950\/35/);
  assert.match(profileTab, /dark:text-slate-50/);
  assert.match(profileTab, /dark:bg-rose-950\/30/);

  const layout = read('client/src/components/DashboardLayout.jsx');
  assert.match(layout, /dark:bg-\[#0b1018\]/);

  const certModal = read('client/src/components/student/DigitalCertificateModal.jsx');
  assert.match(certModal, /id="th-digital-cert-sheet"[\s\S]*data-keep-light="true"/);
});
