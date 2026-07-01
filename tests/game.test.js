const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveCombatTurn } = require('../game');

const basePlayer1 = { hp: 10, energy: 0 };
const basePlayer2 = { hp: 10, energy: 0 };

test('attack deals 2 damage', () => {
  const result = resolveCombatTurn('attack', 'charge', basePlayer1, basePlayer2);
  assert.equal(result.hp2, 8);
  assert.equal(result.energy2, 1);
});

test('guard prevents attack damage', () => {
  const result = resolveCombatTurn('guard', 'attack', basePlayer1, basePlayer2);
  assert.equal(result.hp1, 10);
  assert.equal(result.hp2, 10);
});

test('ultimate deals 5 damage and spends 3 energy', () => {
  const result = resolveCombatTurn('ultimate', 'charge', { hp: 10, energy: 3 }, { hp: 10, energy: 0 });
  assert.equal(result.hp2, 5);
  assert.equal(result.energy1, 0);
});

test('ultimate against guard reduces damage to 2', () => {
  const result = resolveCombatTurn('ultimate', 'guard', { hp: 10, energy: 3 }, { hp: 10, energy: 0 });
  assert.equal(result.hp2, 8);
});
