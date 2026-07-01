const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { resolveRound } = require('./game');
const { removePlayerFromRoom } = require('./roomState');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const ROUND_TIMEOUT_MS = 5000;

const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

function createRoom(code, mode, hostId) {
  return {
    code,
    mode,
    hostId,
    players: [],
    state: 'waiting',
    round: 0,
    lastResult: null,
    timeout: null,
  };
}

function getRoom(code, mode, hostId) {
  if (!rooms.has(code)) {
    rooms.set(code, createRoom(code, mode, hostId));
  }
  return rooms.get(code);
}

function broadcastRoom(room) {
  const payload = {
    type: 'room-state',
    room: {
      code: room.code,
      mode: room.mode,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: player.connected,
      })),
      state: room.state,
      round: room.round,
      lastResult: room.lastResult,
      hostId: room.hostId,
    },
  };

  room.players.forEach((player) => {
    if (player.ws.readyState === 1) {
      player.ws.send(JSON.stringify(payload));
    }
  });
}

function sendToPlayer(player, payload) {
  if (player.ws.readyState === 1) {
    player.ws.send(JSON.stringify(payload));
  }
}

function startRound(room) {
  if (room.timeout) {
    clearTimeout(room.timeout);
  }

  room.state = 'ready';
  room.round += 1;
  room.players.forEach((player) => {
    player.move = null;
  });
  room.lastResult = null;

  broadcastRoom(room);

  room.players.forEach((player) => {
    sendToPlayer(player, {
      type: 'round-ready',
      round: room.round,
      timeoutMs: ROUND_TIMEOUT_MS,
    });
  });
}

function beginCountdown(room) {
  if (room.state !== 'ready') {
    return;
  }

  room.state = 'countdown';
  let countdown = 3;
  const tick = () => {
    if (room.state !== 'countdown') {
      return;
    }

    if (countdown <= 0) {
      room.state = 'playing';
      broadcastRoom(room);
      room.players.forEach((player) => {
        sendToPlayer(player, {
          type: 'round-start',
          round: room.round,
          timeoutMs: ROUND_TIMEOUT_MS,
        });
      });
      room.timeout = setTimeout(() => {
        finalizeRound(room);
      }, ROUND_TIMEOUT_MS);
      return;
    }

    room.players.forEach((player) => {
      sendToPlayer(player, {
        type: 'countdown',
        round: room.round,
        value: countdown,
      });
    });

    countdown -= 1;
    setTimeout(tick, 1000);
  };

  tick();
}

function finalizeRound(room) {
  if (room.state !== 'playing') {
    return;
  }

  const player1 = room.players[0];
  const player2 = room.players[1];

  if (!player1 || !player2) {
    room.state = 'waiting';
    broadcastRoom(room);
    return;
  }

  const move1 = player1.move || 'none';
  const move2 = player2.move || 'none';

  let result = 'draw';
  if (move1 !== 'none' && move2 !== 'none') {
    result = resolveRound(move1, move2);
  } else {
    result = 'timeout';
  }

  room.state = 'result';
  room.lastResult = {
    round: room.round,
    result,
    moves: { player1: move1, player2: move2 },
  };

  broadcastRoom(room);

  room.players.forEach((player) => {
    sendToPlayer(player, {
      type: 'round-result',
      round: room.round,
      result,
      moves: { player1: move1, player2: move2 },
    });
  });

  room.timeout = setTimeout(() => {
    startRound(room);
  }, 2500);
}

wss.on('connection', (ws) => {
  let currentRoom = null;
  let currentPlayer = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'create-room') {
        const roomCode = (data.roomCode || 'default').toUpperCase();
        const room = getRoom(roomCode, data.mode || 'game', null);
        currentRoom = room;

        if (room.players.length > 0) {
          sendToPlayer({ ws }, { type: 'error', message: 'Room already exists.' });
          return;
        }

        const playerName = data.playerName || 'Host';
        currentPlayer = {
          id: `${room.code}-host`,
          ws,
          name: playerName,
          connected: true,
          move: null,
        };

        room.hostId = currentPlayer.id;
        room.mode = data.mode || 'game';
        room.players.push(currentPlayer);
        sendToPlayer(currentPlayer, {
          type: 'joined',
          roomCode: room.code,
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          isHost: true,
          mode: room.mode,
        });
        broadcastRoom(room);
      }

      if (data.type === 'join') {
        const room = rooms.get((data.roomCode || 'default').toUpperCase()) || null;
        if (!room || room.state === 'closed') {
          sendToPlayer({ ws }, { type: 'error', message: 'Room not found.' });
          return;
        }

        currentRoom = room;
        if (room.players.length >= 2) {
          sendToPlayer({ ws }, { type: 'error', message: 'Room is full.' });
          return;
        }

        const playerName = data.playerName || `Player ${room.players.length + 1}`;
        currentPlayer = {
          id: `${room.code}-${room.players.length + 1}`,
          ws,
          name: playerName,
          connected: true,
          move: null,
        };

        room.players.push(currentPlayer);
        sendToPlayer(currentPlayer, {
          type: 'joined',
          roomCode: room.code,
          playerId: currentPlayer.id,
          playerName: currentPlayer.name,
          isHost: false,
          mode: room.mode,
        });
        broadcastRoom(room);

        if (room.players.length === 2) {
          startRound(room);
        }
      }

      if (data.type === 'start-round' && currentRoom && currentPlayer) {
        if (currentRoom.state === 'ready') {
          beginCountdown(currentRoom);
        }
      }

      if (data.type === 'move' && currentRoom && currentPlayer) {
        if (currentRoom.state !== 'playing') {
          sendToPlayer(currentPlayer, { type: 'error', message: 'Round is not active.' });
          return;
        }

        currentPlayer.move = data.move;
        const otherPlayer = currentRoom.players.find((player) => player.id !== currentPlayer.id);

        if (otherPlayer && otherPlayer.move) {
          finalizeRound(currentRoom);
        } else {
          broadcastRoom(currentRoom);
          sendToPlayer(currentPlayer, { type: 'move-accepted', move: data.move });
        }
      }
    } catch (error) {
      console.error(error);
    }
  });

  ws.on('close', () => {
    if (!currentRoom || !currentPlayer) {
      return;
    }

    const result = removePlayerFromRoom(currentRoom, currentPlayer.id);
    if (result.closed) {
      rooms.delete(currentRoom.code);
      return;
    }

    currentRoom.lastResult = null;
    broadcastRoom(currentRoom);
  });
});

server.listen(PORT, () => {
  console.log(`Battle of AR server running on port ${PORT}`);
});
