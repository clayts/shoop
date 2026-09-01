"use strict";

import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { nanoid } from "nanoid";

import { clientIdMiddleware } from "./server/id.js";
import { GameManager } from "./server/manager.js";
import { attachWebSocketServer } from "./server/handler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const GAME_ID_LENGTH = 12; // ~71 bits of randomness with nanoid's default alphabet

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
  windowMs: 60 * 1000,
  limit: 20, // 20 new games per minute per IP is generous; tune to your traffic
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Routes ------------------------------------------------------------------------
// These three all end in a redirect to the plain /game/:id page below; role
// assignment and gameplay always happen over that same page's WebSocket
// connection (see src/handler.js), never here.

// Private: mint a fresh id and send the creator straight to it (share the URL to invite).
app.get("/game/private", newGameLimiter, (req, res) => {
  const id = nanoid(GAME_ID_LENGTH);
  gameManager.getOrCreate(id); // pre-create so /game/:id and the WS upgrade agree it exists
  res.redirect(302, `/game/${id}`);
});

// Public: join the first open game in the automatch queue, or start a new one.
app.get("/game/public", newGameLimiter, (req, res) => {
  const id = gameManager.joinOrCreateAutomatch(() => nanoid(GAME_ID_LENGTH));
  res.redirect(302, `/game/${id}`);
});

// Local: pass-and-play on one browser. Same page & game code as everything
// else — only the `local` flag on the Game changes how roles/turns/presence
// are resolved (src/manager.js, src/game.js).
app.get("/game/local", newGameLimiter, (req, res) => {
  const id = nanoid(GAME_ID_LENGTH);
  gameManager.getOrCreate(id).local = true;
  res.redirect(302, `/game/${id}`);
});

// Serves the page; role assignment itself happens over the WebSocket
// connection the page opens, because that's the point at which we know the
// visitor is actually here to participate, and it's naturally serialized (no
// race between two concurrent HTTP requests).
app.get("/game/:id", (req, res) => {
  if (!GameManager.isValidId(req.params.id)) {
    return res.status(404).send("Game not found: invalid id");
  }
  if (!gameManager.get(req.params.id)) {
    // Games are only created via /game/private, /game/public, or /game/local —
    // an unrecognized id (e.g. typed in by hand) is not a valid game.
    return res.status(404).send("Game not found");
  }
  res.sendFile(path.join(__dirname, "client", "game.html"));
});

// Simple read-only status endpoint, handy for debugging / smoke tests.
app.get("/game/:id/status", (req, res) => {
  const game = gameManager.get(req.params.id);
  if (!game) return res.status(404).json({ error: "not found" });
  res.json({ id: game.id, local: game.local, presence: game.presenceSnapshot(), state: game.state });
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
