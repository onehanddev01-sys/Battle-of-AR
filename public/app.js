let socket;
let roomCode = '';
let playerName = '';
let currentRound = 0;
let lastDetectedGesture = '';
let lastGestureTime = 0;
let cameraStarted = false;

const joinForm = document.getElementById('join-form');
const roomCodeInput = document.getElementById('room-code');
const playerNameInput = document.getElementById('player-name');
const statusEl = document.getElementById('status');
const roomInfoEl = document.getElementById('room-info');
const roundInfoEl = document.getElementById('round-info');
const overlayEl = document.getElementById('overlay');
const videoEl = document.getElementById('video');

function connectSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${window.location.host}`);

  socket.addEventListener('open', () => {
    statusEl.textContent = 'เชื่อมต่อสำเร็จแล้ว';
  });

  socket.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);

    if (data.type === 'joined') {
      roomCode = data.roomCode;
      playerName = data.playerName;
      statusEl.textContent = `เข้าห้อง ${roomCode} เรียบร้อย`;
      return;
    }

    if (data.type === 'room-state') {
      renderRoomState(data.room);
      return;
    }

    if (data.type === 'round-start') {
      currentRound = data.round;
      roundInfoEl.textContent = `รอบที่ ${data.round} เริ่มแล้ว เลือกท่าใน 5 วินาที`;
      overlayEl.textContent = 'เริ่มจับมือ';
      return;
    }

    if (data.type === 'round-result') {
      roundInfoEl.innerHTML = `ผลรอบ ${data.round}: <strong>${formatResult(data.result, data.moves)}</strong>`;
      return;
    }

    if (data.type === 'move-accepted') {
      roundInfoEl.textContent = `ส่งท่า ${data.move} เรียบร้อย รอผู้เล่นอีกคน...`;
      return;
    }

    if (data.type === 'error') {
      statusEl.textContent = data.message;
    }
  });
}

function formatResult(result, moves) {
  if (result === 'timeout') {
    return 'หมดเวลา ไม่มีผู้เล่นส่งท่า';
  }

  if (result === 'draw') {
    return `เสมอ (${moves.player1} vs ${moves.player2})`;
  }

  if (result === 'player1') {
    return `คุณชนะ (${moves.player1} vs ${moves.player2})`;
  }

  if (result === 'player2') {
    return `คุณแพ้ (${moves.player1} vs ${moves.player2})`;
  }

  return result;
}

function renderRoomState(room) {
  const playerNames = room.players.map((player) => player.name).join(', ') || 'ยังไม่มีผู้เล่น';
  roomInfoEl.innerHTML = `ห้อง: <strong>${room.code}</strong><br/>ผู้เล่น: ${playerNames}<br/>สถานะ: ${room.state}`;

  if (room.players.length === 2) {
    statusEl.textContent = 'พร้อมเล่นแล้ว';
  } else {
    statusEl.textContent = 'กำลังรอผู้เล่นอีกคน...';
  }
}

joinForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const roomCodeValue = roomCodeInput.value.trim().toUpperCase();
  const playerNameValue = playerNameInput.value.trim();

  if (!roomCodeValue || !playerNameValue) {
    statusEl.textContent = 'กรอกเลขห้องและชื่อก่อน';
    return;
  }

  if (!socket || socket.readyState !== WebSocket.OPEN) {
    connectSocket();
  }

  socket.send(JSON.stringify({ type: 'join', roomCode: roomCodeValue, playerName: playerNameValue }));
});

function sendMove(move) {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    statusEl.textContent = 'ยังเชื่อมต่อไม่สำเร็จ';
    return;
  }

  socket.send(JSON.stringify({ type: 'move', move }));
}

document.querySelectorAll('[data-move]').forEach((button) => {
  button.addEventListener('click', () => sendMove(button.dataset.move));
});

async function startCamera() {
  if (cameraStarted) {
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    overlayEl.textContent = 'เบราเซอร์นี้ไม่รองรับกล้อง';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = stream;
    await videoEl.play();
    cameraStarted = true;
    overlayEl.textContent = 'กำลังสแกนมือ';

    if (window.Hands && window.Camera) {
      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });

      hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      hands.onResults(onResults);

      const camera = new window.Camera(videoEl, {
        onFrame: async () => {
          await hands.send({ image: videoEl });
        },
        width: 480,
        height: 360,
      });
      camera.start();
    }
  } catch (error) {
    console.error(error);
    overlayEl.textContent = 'ไม่สามารถเปิดกล้องได้';
  }
}

function onResults(results) {
  if (!results.multiHandLandmarks?.length) {
    return;
  }

  const landmarks = results.multiHandLandmarks[0];
  const gesture = classifyGesture(landmarks);

  if (!gesture || gesture === 'unknown') {
    return;
  }

  if (gesture !== lastDetectedGesture || Date.now() - lastGestureTime > 700) {
    lastDetectedGesture = gesture;
    lastGestureTime = Date.now();
    sendMove(gesture);
  }
}

function classifyGesture(landmarks) {
  const openFingers = countOpenFingers(landmarks);

  if (openFingers === 0) {
    return 'rock';
  }

  if (openFingers >= 4) {
    return 'paper';
  }

  if (openFingers === 2) {
    return 'scissors';
  }

  return 'unknown';
}

function countOpenFingers(landmarks) {
  let count = 0;

  if (landmarks[8].y < landmarks[6].y) {
    count += 1;
  }
  if (landmarks[12].y < landmarks[10].y) {
    count += 1;
  }
  if (landmarks[16].y < landmarks[14].y) {
    count += 1;
  }
  if (landmarks[20].y < landmarks[18].y) {
    count += 1;
  }
  if (landmarks[4].x < landmarks[2].x) {
    count += 1;
  }

  return count;
}

videoEl.addEventListener('click', startCamera);
window.addEventListener('load', () => {
  connectSocket();
  startCamera();
});
