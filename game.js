function resolveRound(player1Move, player2Move) {
  if (player1Move === player2Move) {
    return 'draw';
  }

  const wins = {
    rock: 'scissors',
    paper: 'rock',
    scissors: 'paper',
  };

  if (wins[player1Move] === player2Move) {
    return 'player1';
  }

  return 'player2';
}

module.exports = { resolveRound };
