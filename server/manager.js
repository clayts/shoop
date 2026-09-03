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

    // Seats are held by a live socket connection, not a persistent identity — there
    // are no cookies and no spectators, so "who's in the game" is just
    // "whichever two sockets currently hold player1/player2". Local games
    // only ever use player1: that one connection plays both colours (see
    // rules.js), so player2 is never handed out.
    this.seats = { player1: null, player2: null };

    this.state = initialState();
  }

  touch() {
    this.lastActivity = Date.now();
  }

  /** True once every seat this game type offers is held by a live socket. */
  isFull() {
    return this.local ? this.seats.player1 != null : this.seats.player1 != null && this.seats.player2 != null;
  }

  /**
   * Gives `ws` the first open seat and returns its role ("player1" /
   * "player2"), or null if the game is already full. Anyone with the link
   * can claim a seat that's open — whether because nobody's taken it yet, or
   * because whoever held it disconnected.
   */
  assignSeat(ws) {
    if (this.seats.player1 == null) {
      this.seats.player1 = ws;
      this.touch();
      return "player1";
    }
    if (!this.local && this.seats.player2 == null) {
      this.seats.player2 = ws;
      this.touch();
      return "player2";
    }
    return null;
  }

  /** Frees whichever seat `ws` holds (if any), so the next visitor can take it over. */
  releaseSeat(ws) {
    if (this.seats.player1 === ws) this.seats.player1 = null;
    else if (this.seats.player2 === ws) this.seats.player2 = null;
  }

  /**
   * The socket in the *other* seat from `ws`, or null if there isn't one.
   * Used to notify just the other player about something — e.g. a new
   * connection — without echoing it back to whoever triggered it.
   */
  opponentOf(ws) {
    if (this.seats.player1 === ws) return this.seats.player2;
    if (this.seats.player2 === ws) return this.seats.player1;
    return null;
  }

  /** All currently-open sockets in this game. */
  *allSockets() {
    if (this.seats.player1) yield this.seats.player1;
    if (this.seats.player2) yield this.seats.player2;
  }

  presenceSnapshot() {
    // Local: one connection plays both sides, so "both players" are connected
    // together, as a pair, whenever that one connection is.
    if (this.local) {
      const connected = this.seats.player1 != null;
      return { player1Connected: connected, player2Connected: connected };
    }

    return {
      player1Connected: this.seats.player1 != null,
      player2Connected: this.seats.player2 != null,
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
      if (game && game.seats.player2 == null) return id; // still has room for player2
      // else: stale entry (game filled/expired) - drop it and keep looking
    }
    const id = generateId();
    this.getOrCreate("public", id);
    this.publicQueue.push(id);
    return id;
  }

  /** Removes games that have had no activity for GAME_TTL_MS. Call on an interval. */
  clean() {
    const now = Date.now();
    for (const [key, game] of this.games) {
      const stillConnected = game.seats.player1 != null || game.seats.player2 != null;
      if (!stillConnected && now - game.lastActivity > GAME_TTL_MS) this.games.delete(key);
    }
  }

  size() {
    return this.games.size;
  }
}

export { GameManager, Game, GAME_ID_RE, GAME_TYPES, GAME_TTL_MS };
