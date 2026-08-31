"use strict";

/**
 * In-memory game registry.
 *
 * Each Game tracks:
 *  - roles:   Map<clientId, 'player1' | 'player2' | 'spectator'>   (sticky, survives reconnects)
 *  - sockets: Map<clientId, Set<WebSocket>>                        (live connections, may be empty)
 *  - state:   freeform object your playMove owns and mutates (board position, turn, scores, ...)
 *  - local:   true for a "pass and play" game where one browser plays both
 *             sides (see /game/local in server.js) — changes role assignment
 *             and presence reporting below, and how src/game.js resolves the
 *             mover's role.
 *
 * This is a single-process store. See README.md "Scaling beyond one instance" for
 * how to swap this out for Redis (or another shared store) without touching the
 * HTTP/WS handlers.
 */

import { initialState } from "./game.js";

const GAME_ID_RE = /^[A-Za-z0-9_-]{4,64}$/;
const GAME_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours of inactivity -> eligible for cleanup

class Game {
  constructor(id) {
    this.id = id;
    this.local = false;
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

    // Local games have one real player (everyone else who opens the link is
    // just watching) — the client alternates which colour it plays as.
    let role;
    if (this.local) {
      role = this.playerOrder[0] ? "spectator" : "player1";
    } else if (!this.playerOrder[0]) {
      role = "player1";
    } else if (!this.playerOrder[1]) {
      role = "player2";
    } else {
      role = "spectator";
    }

    if (role === "player1") this.playerOrder[0] = clientId;
    if (role === "player2") this.playerOrder[1] = clientId;
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
    return !!this.sockets.get(clientId)?.size;
  }

  /** All currently-open sockets across every client in this game. */
  *allSockets() {
    for (const set of this.sockets.values()) yield* set;
  }

  presenceSnapshot() {
    const spectatorCount = [...this.roles.values()].filter((r) => r === "spectator").length;

    // Local: one connection plays both sides, so "both players" are connected
    // together, as a pair, whenever that one connection is.
    if (this.local) {
      const connected = this.playerOrder[0] ? this.isConnected(this.playerOrder[0]) : false;
      return { player1Connected: connected, player2Connected: connected, spectatorCount };
    }

    return {
      player1Connected: this.playerOrder[0] ? this.isConnected(this.playerOrder[0]) : false,
      player2Connected: this.playerOrder[1] ? this.isConnected(this.playerOrder[1]) : false,
      spectatorCount,
    };
  }
}

class GameManager {
  constructor() {
    this.games = new Map(); // id -> Game
    this.publicQueue = []; // ids of public games still waiting for a 2nd player
  }

  static isValidId(id) {
    return typeof id === "string" && GAME_ID_RE.test(id);
  }

  getOrCreate(id) {
    if (!GameManager.isValidId(id)) return null;
    if (!this.games.has(id)) this.games.set(id, new Game(id));
    return this.games.get(id);
  }

  get(id) {
    return this.games.get(id) || null;
  }

  /**
   * Public matchmaking: joins the first still-open game on the queue, or
   * creates a fresh one and adds it to the queue. `makeId` mints a new id
   * (e.g. nanoid) only when a new game is actually needed.
   */
  joinOrCreatePublic(makeId) {
    while (this.publicQueue.length) {
      const id = this.publicQueue.shift();
      const game = this.games.get(id);
      if (game && !game.playerOrder[1]) return id; // still has room for player2
      // else: stale entry (game filled/expired) - drop it and keep looking
    }
    const id = makeId();
    this.getOrCreate(id);
    this.publicQueue.push(id);
    return id;
  }

  /** Removes games that have had no activity for GAME_TTL_MS. Call on an interval. */
  reap() {
    const now = Date.now();
    for (const [id, game] of this.games) {
      const stillConnected = [...game.sockets.values()].some((set) => set.size > 0);
      if (!stillConnected && now - game.lastActivity > GAME_TTL_MS) this.games.delete(id);
    }
  }

  size() {
    return this.games.size;
  }
}

export { GameManager, Game, GAME_ID_RE, GAME_TTL_MS };
