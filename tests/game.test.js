const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRound } = require('../game');

test('rock beats scissors', () => {
  assert.equal(resolveRound('rock', 'scissors'), 'player1');
  assert.equal(resolveRound('scissors', 'rock'), 'player2');
});

test('paper beats rock', () => {
  assert.equal(resolveRound('paper', 'rock'), 'player1');
  assert.equal(resolveRound('rock', 'paper'), 'player2');
});

test('scissors beats paper', () => {
  assert.equal(resolveRound('scissors', 'paper'), 'player1');
  assert.equal(resolveRound('paper', 'scissors'), 'player2');
});

test('same moves result in draw', () => {
  assert.equal(resolveRound('rock', 'rock'), 'draw');
});
