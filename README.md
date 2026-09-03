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
- broadcast - do we really need to broadcast with an excluded socket, etc, if we only ever have two players in a game..?
