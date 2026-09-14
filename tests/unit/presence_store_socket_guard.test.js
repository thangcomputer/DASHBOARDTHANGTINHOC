const test = require('node:test');
const assert = require('node:assert/strict');

test('presence disconnect cleanup must preserve a newer socket for the same user', () => {
  const current = { socketId: 'new-socket' };
  const shouldRemove = (row, disconnectingSocketId) => (
    Boolean(row)
      && (!disconnectingSocketId || !row.socketId || row.socketId === disconnectingSocketId)
  );

  assert.equal(shouldRemove(current, 'old-socket'), false);
  assert.equal(shouldRemove(current, 'new-socket'), true);
});
