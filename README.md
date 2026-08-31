# Shoop

1. `GET /new` → redirects to `/game/<random-id>`
2. First visitor to `/game/<id>` becomes **player1**
3. Second visitor becomes **player2**
4. Everyone after that is a **spectator**
5. `/game/<id>` serves a game

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
- write an about page and add a link in the top bar
- make a home page
