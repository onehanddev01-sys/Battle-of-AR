const express = require('express');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const { resolveRound } = require('./game');

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

function createRoom(code) {
  return {
    code,
    players: [],
    state: 'waiting',
    round: 0,
    lastResult: null,
    timeout: null,
  };
}

function getRoom(code) {
  if (!rooms.has(code)) {
    rooms.set(code, createRoom(code));
  }
  return rooms.get(code);
}

function broadcastRoom(room) {
  const payload = {
    type: 'room-state',
    room: {
      code: room.code,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        connected: player.connected,
      })),
      state: room.state,
      round: room.round,
      lastResult: room.lastResult,
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

  room.state = 'playing';
  room.round += 1;
  room.players.forEach((player) => {
    player.move = null;
  });
  room.lastResult = null;

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

      if (data.type === 'join') {
        const room = getRoom(data.roomCode || 'default');
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
        });
        broadcastRoom(room);

        if (room.players.length === 2) {
          startRound(room);
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

    currentRoom.players = currentRoom.players.filter((player) => player.id !== currentPlayer.id);
    currentRoom.state = 'waiting';
    currentRoom.lastResult = null;
    if (currentRoom.players.length === 0) {
      rooms.delete(currentRoom.code);
    } else {
      broadcastRoom(currentRoom);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Battle of AR server running on port ${PORT}`);
});
