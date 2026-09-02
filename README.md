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
- Make spectators get win noise rather than lose noise
- Add way to join as spectator specifically even if other players haven't joined yet?
- Fix for WhatsApp browser?
