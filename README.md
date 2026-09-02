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
- make games appear at /game/local/xxx, /game/private/xxx, /game/public/xxx
- since we will then be able to determine the game type from the URL, remove requirement for a game to be explicitly created - let users type in whatever they want for an ID (alphanumeric plus dashes only)
- change nanoid's alphabet to QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890 and increase ID length to 16
