"use strict";

import { initialState } from "./rules.js";

const GAME_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const GAME_TYPES = ["private", "public", "local"];
const GAME_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours of inactivity -> eligible for cleanup

class Game {
  constructor(type, id) {
    this.id = id;
    this.type = type;
    this.local = type === "local";
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
    const spectatorCount = [...this.roles.entries()].filter(
      ([clientId, role]) => role === "spectator" && this.isConnected(clientId),
    ).length;

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
    this.games = new Map(); // "type:id" -> Game
    this.publicQueue = []; // ids of public games still waiting for a 2nd player
  }

  static isValidId(id) {
    return typeof id === "string" && GAME_ID_RE.test(id);
  }

  static isValidType(type) {
    return GAME_TYPES.includes(type);
  }

  static key(type, id) {
    return `${type}:${id}`;
  }

  /** Creates the game if it doesn't exist yet, otherwise returns the existing one. */
  getOrCreate(type, id) {
    if (!GameManager.isValidType(type) || !GameManager.isValidId(id)) return null;
    const key = GameManager.key(type, id);
    if (!this.games.has(key)) this.games.set(key, new Game(type, id));
    return this.games.get(key);
  }

  get(type, id) {
    if (!GameManager.isValidType(type) || !GameManager.isValidId(id)) return null;
    return this.games.get(GameManager.key(type, id)) || null;
  }

  joinOrCreateAutomatch(generateId) {
    while (this.publicQueue.length) {
      const id = this.publicQueue.shift();
      const game = this.get("public", id);
      if (game && !game.playerOrder[1]) return id; // still has room for player2
      // else: stale entry (game filled/expired) - drop it and keep looking
    }
    const id = generateId();
    this.getOrCreate("public", id);
    this.publicQueue.push(id);
    return id;
  }

  /** Removes games that have had no activity for GAME_TTL_MS. Call on an interval. */
  reap() {
    const now = Date.now();
    for (const [key, game] of this.games) {
      const stillConnected = [...game.sockets.values()].some((set) => set.size > 0);
      if (!stillConnected && now - game.lastActivity > GAME_TTL_MS) this.games.delete(key);
    }
  }

  size() {
    return this.games.size;
  }
}

export { GameManager, Game, GAME_ID_RE, GAME_TYPES, GAME_TTL_MS };
