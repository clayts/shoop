# Shoop

1. `/game/local` <- Play against a friend locally in a single browser window
2. `/game/private` <- Play against a friend remotely by sharing the URL
3. `/game/public` <- Play against a random opponent online

## Running it (testing & dev)

```bash
npm install
npm run dev        # node --watch, restarts on file changes
```
## Running it (production)

```bash
npm ci --omit=dev
node server.js
```

## To Do
- New joining logic - get rid of cookies and get rid of spectators. The first two players to grab a socket can play. Further players get a 'game full' error page. If a player is disconnected anyone may connect and take over the seat.
