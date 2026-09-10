"use strict";

import { initialState, PLAYERS } from "./rules.js";

const GAME_ID_RE = /^[A-Za-z0-9-]{1,64}$/;
const GAME_TYPES = ["private", "public", "local"];
const GAME_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours of inactivity -> eligible for cleanup

class Game {
  constructor(type, id) {
    this.id = id;
    this.type = type;
    this.local = type === "local";
    this.createdAt = Date.now();
    this.lastActivity = this.createdAt;

    // Seats are held by a live socket, not by a persistent identity — there are
    // no cookies and no spectators, so "who's in this game" is just "whichever
    // sockets currently hold player1/player2". Local games only ever use
    // player1: that one connection plays both colours (see rules.js), so
    // player2 is never handed out.
    this.seats = { player1: null, player2: null };

    this.state = initialState();
  }

  get key() {
    return GameManager.key(this.type, this.id);
  }

  /** The seats this game type actually hands out. */
  get seatNames() {
    return this.local ? ["player1"] : PLAYERS;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  /** True once every seat this game offers is held by a live socket. */
  isFull() {
    return this.seatNames.every((role) => this.seats[role] != null);
  }

  /** True while nobody is here — used to decide when a game can be dropped. */
  isEmpty() {
    return this.seatNames.every((role) => this.seats[role] == null);
  }

  /**
   * Gives `socket` a seat and returns its role ("player1" / "player2"), or null
   * if no matching seat is available. Anyone with the link can claim a seat
   * that's open — whether because nobody has taken it yet, or because whoever
   * held it disconnected.
   *
   * `preferredRole`, if given, is a client asking for the seat it already held
   * (see client/game.js) — and that is the *only* seat it will accept. Falling
   * back to the other one would sit it down as the opponent it was just
   * playing against, so a taken preferred seat means null, not a consolation
   * seat. Only a connection with no preference at all (a first-ever visit)
   * takes whichever seat happens to be open. This is untrusted input: anything
   * that isn't one of the two literal seat names counts as no preference.
   */
  assignSeat(socket, preferredRole) {
    const candidates = this.seatNames.includes(preferredRole) ? [preferredRole] : this.seatNames;
    const role = candidates.find((seat) => this.seats[seat] == null);
    if (role == null) return null;

    this.seats[role] = socket;
    this.touch();
    return role;
  }

  /** Frees whichever seat `socket` holds (if any), so the next visitor can take it over. */
  releaseSeat(socket) {
    const role = this.seatOf(socket);
    if (role) this.seats[role] = null;
    return role;
  }

  seatOf(socket) {
    return PLAYERS.find((role) => this.seats[role] === socket) ?? null;
  }

  /**
   * The socket in the *other* seat from `socket`, or null if there isn't one.
   * Used to tell just the other player about something — a new connection, say
   * — without echoing it back to whoever triggered it.
   */
  opponentOf(socket) {
    const role = this.seatOf(socket);
    return role ? this.seats[role === "player1" ? "player2" : "player1"] : null;
  }

  /** All currently-seated sockets. */
  *allSockets() {
    for (const role of PLAYERS) {
      if (this.seats[role]) yield this.seats[role];
    }
  }

  presenceSnapshot() {
    // Local: one connection plays both sides, so "both players" arrive and
    // leave together, as a pair.
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
    this.publicQueue = []; // ids of public games still waiting for a second player
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

  /**
   * The game, creating it if this is the first time anyone has asked for it.
   * Returns null for a type/id that could never be valid.
   */
  getOrCreate(type, id) {
    if (!GameManager.isValidType(type) || !GameManager.isValidId(id)) return null;

    const key = GameManager.key(type, id);
    let game = this.games.get(key);
    if (!game) {
      game = new Game(type, id);
      this.games.set(key, game);
    }
    return game;
  }

  get(type, id) {
    if (!GameManager.isValidType(type) || !GameManager.isValidId(id)) return null;
    return this.games.get(GameManager.key(type, id)) ?? null;
  }

  /** The id of a public game with room in it, starting a new one if there is none. */
  joinOrCreateAutomatch(generateId) {
    while (this.publicQueue.length) {
      const id = this.publicQueue.shift();
      const game = this.get("public", id);
      if (game && !game.isFull()) return id;
      // Otherwise it's a stale entry (game filled up or expired) — drop it and
      // keep looking.
    }

    const id = generateId();
    this.getOrCreate("public", id);
    this.publicQueue.push(id);
    return id;
  }

  /** Drops games nobody has touched for GAME_TTL_MS. Call on an interval. */
  clean() {
    const cutoff = Date.now() - GAME_TTL_MS;

    for (const [key, game] of this.games) {
      if (game.isEmpty() && game.lastActivity < cutoff) this.games.delete(key);
    }

    this.publicQueue = this.publicQueue.filter((id) => this.games.has(GameManager.key("public", id)));
  }

  size() {
    return this.games.size;
  }
}

export { GameManager, Game, GAME_ID_RE, GAME_TYPES, GAME_TTL_MS };
