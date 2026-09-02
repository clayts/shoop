"use strict";

import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { customAlphabet } from "nanoid";

import { clientIdMiddleware } from "./server/id.js";
import { GameManager } from "./server/manager.js";
import { attachWebSocketServer } from "./server/handler.js";

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
app.use(helmet({ contentSecurityPolicy: false })); // enable & configure this once you know your page's script sources
app.disable("x-powered-by");

// --- Stable per-browser identity (drives sticky role assignment) -----------------
app.use(clientIdMiddleware);

// --- Rate limiting for game creation (cheap to abuse otherwise) ------------------
const newGameLimiter = rateLimit({
  windowMs: NEW_GAME_RATE_LIMIT_WINDOW_MS,
  limit: NEW_GAME_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Routes ------------------------------------------------------------------------
// These all end in a redirect to /game/:type/:id; role assignment and
// gameplay always happen over that page's WebSocket connection (see
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

// Serves the page; role assignment itself happens over the WebSocket
// connection the page opens, because that's the point at which we know the
// visitor is actually here to participate, and it's naturally serialized (no
// race between two concurrent HTTP requests).
app.get("/game/:type/:id", (req, res) => {
  const { type, id } = req.params;
  if (!GameManager.isValidType(type)) {
    return res.status(404).send("Game not found: invalid type");
  }
  if (!GameManager.isValidId(id)) {
    return res.status(404).send("Game not found: invalid id");
  }
  gameManager.getOrCreate(type, id);
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

// --- HTTP + WebSocket server -------------------------------------------------------
const server = http.createServer(app);
attachWebSocketServer(server, gameManager, { path: "/ws" });

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
