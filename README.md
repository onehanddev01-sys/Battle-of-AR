# Battle of AR

A room-based multiplayer Rock Paper Scissors experience with a simple webcam gesture flow for two players.

## Features

- Create or join a room by room code
- Two-player matchmaking in a shared room
- Gesture-based moves via webcam (rock, paper, scissors)
- Server-side round resolution with a simple turn-based flow

## Run locally

```bash
npm install
npm start
```

Then open http://localhost:3000.

## Deploy to Railway

1. Push this project to GitHub.
2. Create a new Railway project and connect the GitHub repo.
3. Railway will detect the Node app and use the existing start script.
4. Set the start command to `npm start` if needed.
