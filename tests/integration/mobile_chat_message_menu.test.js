'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '../../thang-tin-hoc-mobile/src/screens/MessageScreens.tsx');
const screen = fs.readFileSync(screenPath, 'utf8');

describe('mobile chat message options menu', () => {
  it('aligns the menu toward the available horizontal space', () => {
    assert.ok(screen.includes('const { width: windowWidth } = useWindowDimensions()'));
    assert.ok(screen.includes('const menuAlignLeft = isMine'));
    assert.ok(screen.includes('bubbleWidth >= windowWidth * 0.45'));
    assert.ok(screen.includes('bubbleWidth < windowWidth * 0.45'));
    assert.ok(screen.includes('width: Math.min(164, windowWidth - 32)'));
    assert.ok(screen.includes('left: menuAlignLeft ? 0 : undefined'));
  });

  it('uses compact menu labels and spacing', () => {
    assert.ok(screen.includes('optionsMenuItem: { flexDirection: \'row\', alignItems: \'center\', gap: 8, paddingHorizontal: 10, paddingVertical: 7'));
    assert.ok(screen.includes('optionsMenuItemText: { flexShrink: 1, fontSize: 12'));
    assert.ok(screen.includes('Xóa chỉ ở phía tôi'));
  });

  it('keeps the emoji reaction bar inside the screen near the message', () => {
    assert.ok(screen.includes('const reactionPopupAlignLeft = !isMine && bubbleWidth < windowWidth * 0.45'));
    assert.ok(screen.includes('left: reactionPopupAlignLeft ? 0 : undefined'));
    assert.ok(screen.includes('width: Math.min(174, windowWidth - 24)'));
    assert.ok(screen.includes('width: \'100%\', flexDirection: \'row\', flexWrap: \'nowrap\''));
    assert.ok(screen.includes('reactionPopupEmojiBtn: { width: 23, height: 25'));
  });
});
