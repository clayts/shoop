"use strict";

import { Server } from "socket.io";

import { playMove, initialState, opponentOf } from "./rules.js";

const MAX_MESSAGE_BYTES = 16 * 1024; // per Socket.IO message
const MAX_MESSAGES_PER_WINDOW = 20; // per-connection burst limit
const RATE_WINDOW_MS = 5000;

function send(socket, event, ...payload) {
  if (!socket.connected) return;
  try {
    socket.emit(event, ...payload);
  } catch {
    // Socket died mid-send; the "disconnect" handler will clean it up.
  }
}

function broadcast(game, event, payload) {
  for (const socket of game.allSockets()) send(socket, event, payload);
}

/**
 * Says why we're turning a connection away, then closes it.
 *
 * Deliberately not socket.disconnect(true): closing the transport outright can
 * discard a packet that hasn't been flushed yet, which is exactly the case
 * here — a connection is still on HTTP long-polling this early, before the
 * WebSocket upgrade, and may have no open poll to write to. A plain
 * disconnect() queues its own packet behind ours instead, so both arrive.
 */
function reject(socket, event, ...payload) {
  send(socket, event, ...payload);
  socket.disconnect();
}

/** A sliding-window counter: returns true once a connection is talking too fast. */
function createRateLimiter() {
  let timestamps = [];

  return () => {
    const now = Date.now();
    timestamps = timestamps.filter((at) => now - at < RATE_WINDOW_MS);
    if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) return true;

    timestamps.push(now);
    return false;
  };
}

function attachSocketServer(server, gameManager) {
  const io = new Server(server, {
    maxHttpBufferSize: MAX_MESSAGE_BYTES,
    pingInterval: 5000,
    pingTimeout: 4000,
  });

  io.on("connection", (socket) => {
    // Which game this socket wants travels in the handshake query (see
    // client/game.js) rather than the URL path, so every game shares the one
    // default namespace instead of the server accumulating a namespace per
    // game for the lifetime of the process.
    const { gameType, gameId, preferredRole } = socket.handshake.query;

    // Created here rather than when the page was served: a page load that
    // never opens a socket (a crawler, a link preview) shouldn't be able to
    // fill the server with empty games, and a game that outlived a server
    // restart comes back rather than stranding the client.
    const game = gameManager.getOrCreate(gameType, gameId);
    if (!game) return reject(socket, "error", { reason: "invalid game type or id" });

    // No identity to check against — whichever socket asks for a seat first
    // gets it, be it a brand-new visitor or someone reconnecting after a
    // disconnect freed one up. Once every seat is held, everyone else is
    // turned away and the client decides whether to keep trying.
    const role = game.assignSeat(socket, preferredRole);
    if (!role) return reject(socket, "full");

    const isRateLimited = createRateLimiter();

    /**
     * Registers a client-triggered event: rate-limited, and contained, so that
     * one malformed message can't take the process down and every other game
     * in progress with it.
     */
    const on = (event, handler) => {
      socket.on(event, (...args) => {
        if (isRateLimited()) return send(socket, "error", { reason: "rate limit exceeded, slow down" });

        try {
          handler(...args);
        } catch (error) {
          console.error(`[${game.key}] "${event}" failed:`, error);
          send(socket, "error", { reason: "server error" });
        }
      });
    };

    send(socket, "init", {
      gameId: game.id,
      role,
      local: game.local,
      presence: game.presenceSnapshot(),
      state: game.state,
    });

    // Only the other player needs telling. Broadcasting would echo the event
    // back to the connection that just triggered it, which already knows.
    const opponent = game.opponentOf(socket);
    if (opponent) send(opponent, "presence", { event: "connected", role, presence: game.presenceSnapshot() });

    on("move", (payload) => {
      const move = playMove(game, role, payload);
      if (!move.valid) return send(socket, "error", { reason: move.reason });

      game.touch();
      broadcast(game, "move", {
        role: move.role, // who actually moved (differs from this seat in local games)
        payload: { column: move.column },
        result: game.state.result,
        time: Date.now(),
      });
    });

    on("restart", () => {
      if (game.state.result == null) return send(socket, "error", { reason: "game is not over yet" });

      game.state = initialState(opponentOf(game.state.startingPlayer)); // alternate who starts
      game.touch();
      broadcast(game, "restart", { state: game.state, presence: game.presenceSnapshot() });
    });

    // Not registered through `on`: rate-limiting a disconnect would strand the
    // seat, and Socket.IO reserves this event for itself. The reason is worth
    // logging as-is — "ping timeout" means a missed heartbeat (the network or
    // the server being too slow), while "transport close"/"transport error"
    // mean something outside Socket.IO killed the connection, e.g. a proxy.
    socket.on("disconnect", (reason) => {
      console.log(`[${game.key}] ${role} left: ${reason}`);

      // Freeing the seat here, rather than remembering who held it, is what
      // lets anyone with the link take over for a player who has dropped off.
      game.releaseSeat(socket);
      broadcast(game, "presence", { event: "disconnected", role, presence: game.presenceSnapshot() });
    });
  });

  return io;
}

export { attachSocketServer };
