function removePlayerFromRoom(room, playerId) {
  if (!room) {
    return { closed: true, players: [], reason: 'room-missing' };
  }

  const filtered = room.players.filter((player) => player.id !== playerId);
  room.players = filtered;

  if (playerId === room.hostId) {
    room.state = 'closed';
    room.players = [];
    return { closed: true, players: [], reason: 'host-left' };
  }

  if (room.players.length === 0) {
    room.state = 'closed';
  }

  return { closed: false, players: room.players, reason: 'player-left' };
}

module.exports = { removePlayerFromRoom };
