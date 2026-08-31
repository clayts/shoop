'use strict';

const { WebSocketServer } = require('ws');
const { playMove } = require('./game');
const { readClientId } = require('./client');

const MAX_MESSAGE_BYTES = 16 * 1024; // 16KB per message is plenty for a move; tune as needed
const MAX_MESSAGES_PER_WINDOW = 20; // per-connection burst limit
const RATE_WINDOW_MS = 5000;

function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch (err) {
    // Socket died mid-send; the 'close' handler will clean it up.
  }
}

function broadcast(game, obj, exclude) {
  const msg = JSON.stringify(obj);
  for (const ws of game.allSockets()) {
    if (ws === exclude) continue;
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function attachWebSocketServer(server, gameManager, { path = '/ws' } = {}) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

  server.on('upgrade', (req, socket, head) => {
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      socket.destroy();
      return;
    }

    if (!url.pathname.startsWith(path + '/')) {
      socket.destroy();
      return;
    }

    const gameId = url.pathname.slice((path + '/').length);
    const clientId = readClientId(req); // browser must have visited /game/:id first to receive this cookie

    if (!gameId || !gameManager.constructor.isValidId(gameId)) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!clientId) {
      // No identity cookie yet -> the browser hasn't loaded /game/:id in this
      // origin. Reject with 401 so the client can fall back to a normal page load.
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, { gameId, clientId });
    });
  });

  wss.on('connection', (ws, req, { gameId, clientId }) => {
    const game = gameManager.getOrCreate(gameId);
    if (!game) {
      safeSend(ws, { type: 'error', reason: 'invalid game id' });
      ws.close(1008, 'invalid game id');
      return;
    }

    const role = game.getOrAssignRole(clientId);
    game.addSocket(clientId, ws);

    let msgTimestamps = [];

    // Tell the newly connected client who they are and bring them up to speed.
    safeSend(ws, {
      type: 'init',
      gameId,
      role,
      presence: game.presenceSnapshot(),
      state: game.state,
    });

    // Let everyone else know someone joined/reconnected.
    broadcast(
      game,
      { type: 'presence', event: 'connected', role, presence: game.presenceSnapshot() },
      ws
    );

    ws.on('message', (raw) => {
      const now = Date.now();
      msgTimestamps = msgTimestamps.filter((t) => now - t < RATE_WINDOW_MS);
      if (msgTimestamps.length >= MAX_MESSAGES_PER_WINDOW) {
        safeSend(ws, { type: 'error', reason: 'rate limit exceeded, slow down' });
        return;
      }
      msgTimestamps.push(now);

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        safeSend(ws, { type: 'error', reason: 'malformed JSON' });
        return;
      }

      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
        safeSend(ws, { type: 'error', reason: 'message must have a string "type"' });
        return;
      }

      switch (msg.type) {
        case 'move': {
          if (role === 'spectator') {
            safeSend(ws, { type: 'error', reason: 'spectators cannot move' });
            return;
          }

          let result;
          try {
            result = playMove(game, clientId, msg.payload);
          } catch (err) {
            safeSend(ws, { type: 'error', reason: 'validator threw: ' + err.message });
            return;
          }

          if (!result || !result.valid) {
            safeSend(ws, {
              type: 'error',
              reason: (result && result.reason) || `invalid move ${msg.payload}`,
            });
            return;
          }

          const outPayload = result.broadcastPayload !== undefined ? result.broadcastPayload : msg.payload;
          game.touch();

          broadcast(game, {
            type: 'move',
            role,
            payload: outPayload,
            line: game.state.line,
            time: Date.now(),
          });
          break;
        }

        case 'ping': {
          safeSend(ws, { type: 'pong' });
          break;
        }

        default:
          safeSend(ws, { type: 'error', reason: `unknown message type "${msg.type}"` });
      }
    });

    ws.on('close', () => {
      game.removeSocket(clientId, ws);
      broadcast(game, { type: 'presence', event: 'disconnected', role, presence: game.presenceSnapshot() });
    });

    ws.on('error', () => {
      // 'close' fires right after; nothing extra needed here.
    });
  });

  return wss;
}

module.exports = { attachWebSocketServer };
