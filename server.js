"use strict";

import http from "node:http";
import path from "node:path";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { GameManager } from "./server/manager.js";
import { attachSocketServer } from "./server/handler.js";

const CLIENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "client");

const PORT = process.env.PORT || 3000;
const GAME_ID_ALPHABET = "QWERTYUIOPASDFGHJKLZXCVBNMqwertyuiopasdfghjklzxcvbnm1234567890";
const GAME_ID_LENGTH = 16;
const RANDOM_ID_GAME_TYPES = ["private", "local"]; // "public" gets its own route below (automatch)
const NEW_GAME_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const NEW_GAME_RATE_LIMIT_MAX = 20; // per window, per IP
const CLEAN_INTERVAL_MS = 15 * 60 * 1000;
const SHUTDOWN_GRACE_MS = 10 * 1000;

// ~95 bits from a CSPRNG, which is plenty to make a private game's URL
// unguessable. randomInt() rejection-samples, so no character is favoured.
function generateGameId() {
  return Array.from({ length: GAME_ID_LENGTH }, () => GAME_ID_ALPHABET[randomInt(GAME_ID_ALPHABET.length)]).join("");
}

const app = express();
const gameManager = new GameManager();

// --- Security & platform basics ---------------------------------------------------
app.set("trust proxy", 1); // so req.secure / X-Forwarded-Proto work behind a reverse proxy
app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true, // keep helmet's other sane defaults (object-src 'none', base-uri 'self', etc.)
      directives: {
        // Everything is self-hosted: the Socket.IO client bundle is served by
        // this server (see server/handler.js) and Courier Prime is bundled
        // under client/fonts, so plain 'self' covers it. Note that this leaves
        // no room for inline <style> or <script> — anything a page needs
        // belongs in a file next to it.
        "script-src": ["'self'"],
        "style-src": ["'self'"],
        "font-src": ["'self'"],
        // Socket.IO connects back to the same origin, both for the polling
        // fallback and the ws/wss upgrade — nothing cross-origin to allow.
        "connect-src": ["'self'"],
        "img-src": ["'self'", "data:"],
      },
    },
  }),
);

// --- Rate limiting for game creation (cheap to abuse otherwise) ------------------
const newGameLimiter = rateLimit({
  windowMs: NEW_GAME_RATE_LIMIT_WINDOW_MS,
  limit: NEW_GAME_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});

// --- Routes ------------------------------------------------------------------------
// The entry points below all end in a redirect to /game/:type/:id. Games
// themselves are created lazily by the first socket to connect (see
// server/handler.js), so any well-formed type/id is playable — including one a
// visitor typed in by hand — and a page load that never opens a socket costs
// nothing.

// Private & local: mint a fresh random id and send the visitor straight to it.
for (const type of RANDOM_ID_GAME_TYPES) {
  app.get(`/game/${type}`, newGameLimiter, (req, res) => {
    res.redirect(302, `/game/${type}/${generateGameId()}`);
  });
}

// Public: join the first open game in the automatch queue, or start a new one.
app.get("/game/public", newGameLimiter, (req, res) => {
  res.redirect(302, `/game/public/${gameManager.joinOrCreateAutomatch(generateGameId)}`);
});

// Serves the page. Seat assignment happens over the Socket.IO connection that
// page opens, because that's the point at which we know the visitor is
// actually here to play, and it's naturally serialized (no race between two
// concurrent HTTP requests). The check here is a courtesy: it shows a full
// game's third visitor a real page instead of a spinner. A socket that arrives
// mid-race, after this check but before it lands a seat, gets the same outcome
// from its own "full" message.
app.get("/game/:type/:id", (req, res, next) => {
  const { type, id } = req.params;
  if (!GameManager.isValidType(type) || !GameManager.isValidId(id)) return next();

  const game = gameManager.get(type, id);
  if (game?.isFull()) return res.status(409).sendFile(path.join(CLIENT_DIR, "full.html"));

  res.sendFile(path.join(CLIENT_DIR, "game.html"));
});

// Read-only status, handy for debugging and smoke tests.
app.get("/game/:type/:id/status", (req, res) => {
  const game = gameManager.get(req.params.type, req.params.id);
  if (!game) return res.status(404).json({ error: "not found" });

  res.json({
    id: game.id,
    type: game.type,
    local: game.local,
    presence: game.presenceSnapshot(),
    state: game.state,
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true, games: gameManager.size(), uptime: process.uptime() });
});

app.use(express.static(CLIENT_DIR));

app.use((req, res) => {
  res.status(404).type("text/plain").send("Not found");
});

// Four arguments, so express treats this as the error handler rather than more
// middleware. Replaces the built-in one, which would send the stack trace.
app.use((error, req, res, next) => {
  console.error(`${req.method} ${req.originalUrl} failed:`, error);
  res.status(500).type("text/plain").send("Something went wrong");
});

// --- HTTP + Socket.IO server -------------------------------------------------------
const server = http.createServer(app);
const io = attachSocketServer(server, gameManager);

// Periodic cleanup of abandoned games, so memory doesn't grow unbounded.
const cleanInterval = setInterval(() => gameManager.clean(), CLEAN_INTERVAL_MS);
cleanInterval.unref();

server.listen(PORT, () => {
  console.log(`Game server listening on :${PORT}`);
});

// --- Graceful shutdown --------------------------------------------------------------
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return; // a second Ctrl-C shouldn't restart the clock
  shuttingDown = true;

  console.log(`${signal} received, shutting down...`);
  clearInterval(cleanInterval);

  // io.close() disconnects every socket and closes the HTTP server with them.
  // Without it the open WebSockets would keep the process alive until the
  // force-exit below, since server.close() only waits for connections to drain.
  io.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });

  setTimeout(() => process.exit(1), SHUTDOWN_GRACE_MS).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server, io, gameManager };
