"use strict";

import { Server } from "socket.io";
import { playMove, initialState } from "./rules.js";

const MAX_MESSAGE_BYTES = 16 * 1024; // per Socket.IO message; tune as needed
const MAX_MESSAGES_PER_WINDOW = 20; // per-connection burst limit
const RATE_WINDOW_MS = 5000;

function safeSend(socket, event, payload) {
  if (!socket.connected) return;
  try {
    socket.emit(event, payload);
  } catch {
    // Socket died mid-send; the 'disconnect' handler will clean it up.
  }
}

function broadcast(game, event, payload) {
  for (const socket of game.allSockets()) {
    if (socket.connected) socket.emit(event, payload);
  }
}

function attachSocketServer(server, gameManager) {
	const io = new Server(server, {
		// transports: ['websocket'],
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
  });

  io.on("connection", (socket) => {
    // The client passes which game it wants via the handshake query string
    // (see client/game.js) rather than the URL path — a single default
    // namespace keeps things simple and avoids accumulating one Socket.IO
    // namespace per game for the lifetime of the process.
    const { gameType, gameId } = socket.handshake.query;

    if (!gameManager.constructor.isValidType(gameType) || !gameManager.constructor.isValidId(gameId)) {
      safeSend(socket, "error", { reason: "invalid game type or id" });
      return socket.disconnect(true);
    }

    // Games are created lazily on first request for a given type/id (see
    // server.js's GET /game/:type/:id) — by the time a socket connects, the
    // page load that opened it should already have created the game.
    const game = gameManager.get(gameType, gameId);
    if (!game) {
      safeSend(socket, "error", { reason: "game not found" });
      return socket.disconnect(true);
    }

    // There's no identity to check against — whichever socket asks for a
    // seat first gets it, whether that's a brand-new visitor or someone
    // reconnecting after a disconnect freed one up. Once both seats are
    // held, everyone else is turned away.
    const role = game.assignSeat(socket);
    if (!role) {
      safeSend(socket, "full");
      return socket.disconnect(true);
    }

    let msgTimestamps = [];
    function rateLimited() {
      const now = Date.now();
      msgTimestamps = msgTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (msgTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        safeSend(socket, "error", { reason: "rate limit exceeded, slow down" });
        return true;
      }
      msgTimestamps.push(now);
      return false;
    }

    safeSend(socket, "init", {
      gameId,
      role,
      local: !!game.local,
      presence: game.presenceSnapshot(),
      state: game.state,
    });

    // Only the other player needs telling — broadcasting with an excluded
    // socket would be overkill for two seats, and would echo the event back
    // to the very connection that just triggered it.
    const opponent = game.opponentOf(socket);
    if (opponent) safeSend(opponent, "presence", { event: "connected", role, presence: game.presenceSnapshot() });

    socket.on("move", (payload) => {
      if (rateLimited()) return;

      let result;
      try {
        result = playMove(game, role, payload);
      } catch (err) {
        return safeSend(socket, "error", { reason: "validator threw: " + err.message });
      }
      if (!result?.valid) {
        return safeSend(socket, "error", { reason: result?.reason || `invalid move ${JSON.stringify(payload)}` });
      }

      game.touch();
      broadcast(game, "move", {
        role: result.role, // who actually moved (may differ from the connection's role in local games)
        payload: result.broadcastPayload !== undefined ? result.broadcastPayload : payload,
        line: game.state.line,
        time: Date.now(),
      });
    });

    socket.on("restart", () => {
      if (rateLimited()) return;

      if (game.state.line == null) {
        return safeSend(socket, "error", { reason: "game is not over yet" });
      }
      const nextStarter = game.state.startingPlayer === "player1" ? "player2" : "player1";
      game.state = initialState(nextStarter);
      game.touch();
      broadcast(game, "restart", { state: game.state, presence: game.presenceSnapshot() });
    });

    socket.on("ping", () => {
      if (rateLimited()) return;
      safeSend(socket, "pong");
    });

    socket.on("disconnect", () => {
      // Freeing the seat here (rather than remembering who held it) is what
      // lets anyone with the link take over for a player who's dropped off.
      game.releaseSeat(socket);
      broadcast(game, "presence", { event: "disconnected", role, presence: game.presenceSnapshot() });
    });
  });

  return io;
}

export { attachSocketServer };
