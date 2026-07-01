const test = require('node:test');
const assert = require('node:assert/strict');
const { removePlayerFromRoom } = require('../roomState');

test('host leaving closes the room and removes everyone', () => {
  const room = {
    code: 'ABC123',
    mode: 'game',
    hostId: 'p1',
    players: [{ id: 'p1' }, { id: 'p2' }],
    state: 'waiting',
  };

  const result = removePlayerFromRoom(room, 'p1');

  assert.equal(result.closed, true);
  assert.equal(result.players.length, 0);
  assert.equal(result.reason, 'host-left');
});

test('non-host leaving keeps the room open', () => {
  const room = {
    code: 'ABC123',
    mode: 'game',
    hostId: 'p1',
    players: [{ id: 'p1' }, { id: 'p2' }],
    state: 'waiting',
  };

  const result = removePlayerFromRoom(room, 'p2');

  assert.equal(result.closed, false);
  assert.equal(result.players.length, 1);
  assert.equal(result.players[0].id, 'p1');
  assert.equal(result.reason, 'player-left');
});
