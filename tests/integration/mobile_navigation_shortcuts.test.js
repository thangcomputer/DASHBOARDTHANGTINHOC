'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('student and teacher tab bars expose the feed and working support entry', () => {
  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  const supportScreen = read('thang-tin-hoc-mobile/src/screens/SupportEntryScreen.tsx');
  const types = read('thang-tin-hoc-mobile/src/navigation/types.ts');

  assert.ok(navigator.includes("{ name: 'Feed' as const, label: 'Bảng tin', shortLabel: 'Bảng tin', icon: Newspaper }"));
  assert.ok(navigator.includes("{ name: 'Support' as const, label: 'Support hỗ trợ', shortLabel: 'Hỗ trợ', icon: Headphones }"));
  assert.ok(navigator.includes('styles.navLabel') && navigator.includes('styles.navLabelActive'));
  assert.ok((navigator.match(/name="Feed" component=\{?FeedScreen\}?/g) || []).length >= 2);
  assert.equal((navigator.match(/name="Support" component=\{?SupportEntryScreen\}?/g) || []).length, 2);
  assert.ok(supportScreen.includes('openAiSupportConversation()'));
  assert.ok(supportScreen.includes("navigation.navigate('Conversation'"));
  assert.ok(types.includes('Support: undefined;'));
});
