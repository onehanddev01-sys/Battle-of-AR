function resolveCombatTurn(player1Move, player2Move, player1State, player2State) {
  let hp1 = player1State.hp;
  let hp2 = player2State.hp;
  let energy1 = player1State.energy;
  let energy2 = player2State.energy;

  if (player1Move === 'charge') {
    energy1 += 1;
  }

  if (player2Move === 'charge') {
    energy2 += 1;
  }

  if (player1Move === 'ultimate' && energy1 >= 3) {
    energy1 -= 3;
    if (player2Move === 'guard') {
      hp2 -= 2;
    } else {
      hp2 -= 5;
    }
  } else if (player2Move === 'ultimate' && energy2 >= 3) {
    energy2 -= 3;
    if (player1Move === 'guard') {
      hp1 -= 2;
    } else {
      hp1 -= 5;
    }
  } else if (player1Move === 'attack' && player2Move === 'guard') {
    hp2 += 0;
  } else if (player2Move === 'attack' && player1Move === 'guard') {
    hp1 += 0;
  } else if (player1Move === 'attack' && player2Move !== 'guard') {
    hp2 -= 2;
  } else if (player2Move === 'attack' && player1Move !== 'guard') {
    hp1 -= 2;
  }

  return {
    hp1: Math.max(0, hp1),
    hp2: Math.max(0, hp2),
    energy1,
    energy2,
  };
}

module.exports = { resolveCombatTurn };
