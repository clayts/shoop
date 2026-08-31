'use strict';

/**
 * In-memory game registry.
 *
 * Each Game tracks:
 *  - roles:   Map<clientId, 'player1' | 'player2' | 'spectator'>   (sticky, survives reconnects)
 *  - sockets: Map<clientId, Set<WebSocket>>                        (live connections, may be empty)
 *  - state:   freeform object your playMove owns and mutates (board position, turn, scores, ...)
 *             — the full move history, if you need it, lives here (e.g. Connect 4's board *is*
 *             its own history), so there's no separate move log to maintain.
 *
 * This is a single-process store. See README.md "Scaling beyond one instance" for
 * how to swap this out for Redis (or another shared store) without touching the
 * HTTP/WS handlers.
 */

const { initialState } = require('./game');

const GAME_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const MAX_SPECTATORS_LOGGED = 10000; // sanity guard, not a hard cap on spectators
const GAME_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours of inactivity -> eligible for cleanup

class Game {
  constructor(id) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastActivity = Date.now();
    this.roles = new Map(); // clientId -> role
    this.playerOrder = []; // [clientIdOfPlayer1, clientIdOfPlayer2]
    this.sockets = new Map(); // clientId -> Set<ws>
    this.state = initialState(); // handed to playMove, yours to define
  }

  touch() {
    this.lastActivity = Date.now();
  }

  /** Returns the existing role for a client, or assigns the next available one. */
  getOrAssignRole(clientId) {
    if (this.roles.has(clientId)) return this.roles.get(clientId);

    let role;
    if (!this.playerOrder[0]) {
      role = 'player1';
      this.playerOrder[0] = clientId;
    } else if (!this.playerOrder[1]) {
      role = 'player2';
      this.playerOrder[1] = clientId;
    } else {
      role = 'spectator';
    }
    this.roles.set(clientId, role);
    this.touch();
    return role;
  }

  addSocket(clientId, ws) {
    if (!this.sockets.has(clientId)) this.sockets.set(clientId, new Set());
    this.sockets.get(clientId).add(ws);
    this.touch();
  }

  removeSocket(clientId, ws) {
    const set = this.sockets.get(clientId);
    if (!set) return;
    set.delete(ws);
    if (set.size === 0) this.sockets.delete(clientId);
  }

  isConnected(clientId) {
    const set = this.sockets.get(clientId);
    return !!set && set.size > 0;
  }

  /** All currently-open sockets across every client in this game. */
  *allSockets() {
    for (const set of this.sockets.values()) {
      for (const ws of set) yield ws;
    }
  }

  presenceSnapshot() {
    return {
      player1Connected: this.playerOrder[0] ? this.isConnected(this.playerOrder[0]) : false,
      player2Connected: this.playerOrder[1] ? this.isConnected(this.playerOrder[1]) : false,
      spectatorCount: [...this.roles.values()].filter((r) => r === 'spectator').length,
    };
  }
}

class GameManager {
  constructor() {
    this.games = new Map(); // id -> Game
  }

  static isValidId(id) {
    return typeof id === 'string' && GAME_ID_RE.test(id);
  }

  getOrCreate(id) {
    if (!GameManager.isValidId(id)) return null;
    let game = this.games.get(id);
    if (!game) {
      game = new Game(id);
      this.games.set(id, game);
    }
    return game;
  }

  get(id) {
    return this.games.get(id) || null;
  }

  /** Removes games that have had no activity for GAME_TTL_MS. Call on an interval. */
  reap() {
    const now = Date.now();
    for (const [id, game] of this.games) {
      const stillConnected = [...game.sockets.values()].some((set) => set.size > 0);
      if (!stillConnected && now - game.lastActivity > GAME_TTL_MS) {
        this.games.delete(id);
      }
    }
  }

  size() {
    return this.games.size;
  }
}

module.exports = { GameManager, Game, GAME_ID_RE, MAX_SPECTATORS_LOGGED, GAME_TTL_MS };
