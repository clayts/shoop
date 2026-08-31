"use strict";

import { WebSocketServer } from "ws";
import { playMove, initialState } from "./game.js";
import { readClientId } from "./client.js";

const MAX_MESSAGE_BYTES = 16 * 1024; // 16KB per message is plenty for a move; tune as needed
const MAX_MESSAGES_PER_WINDOW = 20; // per-connection burst limit
const RATE_WINDOW_MS = 5000;

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    // Socket died mid-send; the 'close' handler will clean it up.
  }
}

function broadcast(game, obj, exclude) {
  const msg = JSON.stringify(obj);
  for (const ws of game.allSockets()) {
    if (ws !== exclude && ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function attachWebSocketServer(server, gameManager, { path = "/ws" } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on("upgrade", (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, "http://localhost");
    } catch {
      return socket.destroy();
    }

    if (!url.pathname.startsWith(path + "/")) return socket.destroy();

    const gameId = url.pathname.slice((path + "/").length);
    const clientId = readClientId(req); // browser must have visited /game/:id first to receive this cookie

    if (!gameId || !gameManager.constructor.isValidId(gameId)) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      return socket.destroy();
    }
    if (!clientId) {
      // No identity cookie yet -> the browser hasn't loaded /game/:id in this
      // origin. Reject with 401 so the client can fall back to a normal page load.
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, { gameId, clientId });
    });
  });

  wss.on("connection", (ws, req, { gameId, clientId }) => {
    const game = gameManager.getOrCreate(gameId);
    if (!game) {
      safeSend(ws, { type: "error", reason: "invalid game id" });
      return ws.close(1008, "invalid game id");
    }

    const role = game.getOrAssignRole(clientId);
    game.addSocket(clientId, ws);
    let msgTimestamps = [];

    safeSend(ws, {
      type: "init",
      gameId,
      role,
      local: !!game.local,
      presence: game.presenceSnapshot(),
      state: game.state,
    });

    broadcast(game, { type: "presence", event: "connected", role, presence: game.presenceSnapshot() }, ws);

    ws.on("message", (raw) => {
      const now = Date.now();
      msgTimestamps = msgTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (msgTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        return safeSend(ws, { type: "error", reason: "rate limit exceeded, slow down" });
      }
      msgTimestamps.push(now);

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return safeSend(ws, { type: "error", reason: "malformed JSON" });
      }
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
        return safeSend(ws, { type: "error", reason: 'message must have a string "type"' });
      }

      switch (msg.type) {
        case "move": {
          if (role === "spectator") {
            return safeSend(ws, { type: "error", reason: "spectators cannot move" });
          }

          let result;
          try {
            result = playMove(game, clientId, msg.payload);
          } catch (err) {
            return safeSend(ws, { type: "error", reason: "validator threw: " + err.message });
          }
          if (!result?.valid) {
            return safeSend(ws, { type: "error", reason: result?.reason || `invalid move ${msg.payload}` });
          }

          game.touch();
          broadcast(game, {
            type: "move",
            role: result.role, // who actually moved (may differ from the connection's role in local games)
            payload: result.broadcastPayload !== undefined ? result.broadcastPayload : msg.payload,
            line: game.state.line,
            time: Date.now(),
          });
          break;
        }

        case "restart": {
          if (role === "spectator") {
            return safeSend(ws, { type: "error", reason: "spectators cannot restart" });
          }
          if (game.state.line == null) {
            return safeSend(ws, { type: "error", reason: "game is not over yet" });
          }
          game.state = initialState();
          game.touch();
          broadcast(game, { type: "restart", state: game.state, presence: game.presenceSnapshot() });
          break;
        }

        case "ping":
          safeSend(ws, { type: "pong" });
          break;

        default:
          safeSend(ws, { type: "error", reason: `unknown message type "${msg.type}"` });
      }
    });

    ws.on("close", () => {
      game.removeSocket(clientId, ws);
      broadcast(game, { type: "presence", event: "disconnected", role, presence: game.presenceSnapshot() });
    });

    ws.on("error", () => {
      // 'close' fires right after; nothing extra needed here.
    });
  });

  return wss;
}

export { attachWebSocketServer };
