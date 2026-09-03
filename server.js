"use strict";

import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { customAlphabet } from "nanoid";

import { GameManager } from "./server/manager.js";
import { attachSocketServer } from "./server/handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const GAME_ID_ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
const GAME_ID_LENGTH = 16;
const RANDOM_ID_GAME_TYPES = ["private", "local"]; // "public" gets its own route below (automatch)
const NEW_GAME_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const NEW_GAME_RATE_LIMIT_MAX = 20; // per window, per IP

const generateGameId = customAlphabet(GAME_ID_ALPHABET, GAME_ID_LENGTH);

const app = express();
const gameManager = new GameManager();

// --- Security & platform basics ---------------------------------------------------
app.set("trust proxy", 1); // needed so req.secure / X-Forwarded-Proto work behind a reverse proxy
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true, // keep helmet's other sane defaults (object-src 'none', base-uri 'self', etc.)
      directives: {
        // Everything is self-hosted now — the Socket.IO client bundle is
        // served by our own server (see server/handler.js) and Courier
        // Prime is bundled under client/fonts — so plain 'self' covers it.
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "font-src": ["'self'"],
        // Socket.IO connects back to the same origin (both the polling
        // fallback and the ws/wss upgrade) — nothing cross-origin to allow.
        "connect-src": ["'self'"],
        "img-src": ["'self'", "data:"],
      },
    },
  }),
);
app.disable("x-powered-by");

// --- Rate limiting for game creation (cheap to abuse otherwise) ------------------
const newGameLimiter = rateLimit({
  windowMs: NEW_GAME_RATE_LIMIT_WINDOW_MS,
  limit: NEW_GAME_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Routes ------------------------------------------------------------------------
// These all end in a redirect to /game/:type/:id; role assignment and
// gameplay always happen over that page's Socket.IO connection (see
// server/handler.js), never here. Games are no longer explicitly
// pre-created: any well-formed type/id is valid and is created lazily the
// first time it's requested, so users can also type their own id directly
// into /game/:type/:id.

// Private & local: mint a fresh random id and send the visitor straight to it.
RANDOM_ID_GAME_TYPES.forEach((type) => {
  app.get(`/game/${type}`, newGameLimiter, (req, res) => {
    res.redirect(302, `/game/${type}/${generateGameId()}`);
  });
});

// Public: join the first open game in the automatch queue, or start a new one.
app.get("/game/public", newGameLimiter, (req, res) => {
  const id = gameManager.joinOrCreateAutomatch(generateGameId);
  res.redirect(302, `/game/public/${id}`);
});

// Serves the page; seat assignment itself happens over the Socket.IO
// connection the page opens, because that's the point at which we know the
// visitor is actually here to participate, and it's naturally serialized (no
// race between two concurrent HTTP requests). There's no identity behind a
// seat — whoever's socket claims it first (including a returning player
// after someone else's dropped) gets to play; a third visitor sees this
// "full" page instead. (A socket connecting mid-race, after this check but
// before it lands a seat, gets the same outcome via the socket's own
// "full" message — see server/handler.js.)
app.get("/game/:type/:id", (req, res) => {
  const { type, id } = req.params;
  if (!GameManager.isValidType(type)) {
    return res.status(404).send("Game not found: invalid type");
  }
  if (!GameManager.isValidId(id)) {
    return res.status(404).send("Game not found: invalid id");
  }
  const game = gameManager.getOrCreate(type, id);
  if (game.isFull()) {
    return res.status(409).sendFile(path.join(__dirname, "client", "full.html"));
  }
  res.sendFile(path.join(__dirname, "client", "game.html"));
});

// Simple read-only status endpoint, handy for debugging / smoke tests.
app.get("/game/:type/:id/status", (req, res) => {
  const game = gameManager.get(req.params.type, req.params.id);
  if (!game) return res.status(404).json({ error: "not found" });
  res.json({ id: game.id, type: game.type, local: game.local, presence: game.presenceSnapshot(), state: game.state });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, games: gameManager.size(), uptime: process.uptime() });
});

app.use(express.static(path.join(__dirname, "client")));

// --- HTTP + Socket.IO server -------------------------------------------------------
const server = http.createServer(app);
attachSocketServer(server, gameManager);

// Periodic cleanup of abandoned games so memory doesn't grow unbounded.
const reapInterval = setInterval(() => gameManager.reap(), 15 * 60 * 1000);
reapInterval.unref();

server.listen(PORT, () => {
  console.log(`Game server listening on :${PORT}`);
});

// --- Graceful shutdown --------------------------------------------------------------
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  clearInterval(reapInterval);
  server.close(() => {
    console.log("HTTP server closed.");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // force-exit if connections don't drain in time
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server, gameManager };
