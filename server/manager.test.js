"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { GameManager, Game } from "../server/manager.js";

// Seats only ever hold a socket by reference, so anything unique will do.
const socket = (name) => ({ name });

test("ids and types are checked before anything is created", () => {
  assert.ok(GameManager.isValidType("private"));
  assert.ok(!GameManager.isValidType("spectator"));
  assert.ok(GameManager.isValidId("aB-9"));
  assert.ok(!GameManager.isValidId("has spaces"));
  assert.ok(!GameManager.isValidId("../../etc/passwd"));
  assert.ok(!GameManager.isValidId(""));
  assert.ok(!GameManager.isValidId("x".repeat(65)));
  assert.ok(!GameManager.isValidId(undefined));

  const manager = new GameManager();
  assert.equal(manager.getOrCreate("private", "no spaces please"), null);
  assert.equal(manager.getOrCreate("spectator", "abc"), null);
  assert.equal(manager.size(), 0);
});

test("a game is created once and then handed back", () => {
  const manager = new GameManager();

  const first = manager.getOrCreate("private", "abc");
  const second = manager.getOrCreate("private", "abc");

  assert.equal(first, second);
  assert.equal(manager.size(), 1);
  assert.equal(manager.get("private", "abc"), first);
  assert.equal(manager.get("public", "abc"), null, "type is part of the identity");
});

test("the first two sockets take the seats and the third is turned away", () => {
  const game = new Game("private", "abc");
  const [one, two, three] = [socket("one"), socket("two"), socket("three")];

  assert.equal(game.assignSeat(one), "player1");
  assert.equal(game.assignSeat(two), "player2");
  assert.ok(game.isFull());
  assert.equal(game.assignSeat(three), null);

  assert.equal(game.opponentOf(one), two);
  assert.equal(game.opponentOf(two), one);
  assert.equal(game.opponentOf(three), null);
  assert.deepEqual([...game.allSockets()], [one, two]);
});

test("a released seat is free for whoever asks next", () => {
  const game = new Game("private", "abc");
  const [one, two, three] = [socket("one"), socket("two"), socket("three")];

  game.assignSeat(one);
  game.assignSeat(two);

  assert.equal(game.releaseSeat(one), "player1");
  assert.ok(!game.isFull());
  assert.deepEqual(game.presenceSnapshot(), { player1Connected: false, player2Connected: true });

  assert.equal(game.assignSeat(three), "player1");
  assert.equal(game.releaseSeat(socket("never seated")), null);
});

test("a preferred seat is the only seat that client will take", () => {
  const game = new Game("private", "abc");
  const [returning, other] = [socket("returning"), socket("other")];

  game.assignSeat(returning, "player2");
  assert.deepEqual(game.presenceSnapshot(), { player1Connected: false, player2Connected: true });

  // player1 is wide open, but sitting there would mean playing the side it was
  // just up against, so this is a refusal rather than a consolation seat.
  assert.equal(game.assignSeat(other, "player2"), null);
  assert.equal(game.assignSeat(other, "player1"), "player1");
});

test("a preference that isn't a seat name is treated as no preference", () => {
  const game = new Game("private", "abc");

  assert.equal(game.assignSeat(socket("one"), "spectator"), "player1");
  assert.equal(game.assignSeat(socket("two"), ["player1", "player2"]), "player2");
});

test("a local game has one seat, and both colours arrive with it", () => {
  const game = new Game("local", "abc");

  assert.ok(game.local);
  assert.equal(game.assignSeat(socket("one")), "player1");
  assert.ok(game.isFull());
  assert.equal(game.assignSeat(socket("two")), null);
  assert.equal(game.assignSeat(socket("two"), "player2"), null);
  assert.deepEqual(game.presenceSnapshot(), { player1Connected: true, player2Connected: true });
});

test("automatch keeps sending players to a waiting game until it fills up", () => {
  const manager = new GameManager();
  const ids = ["first", "second"];
  const generateId = () => ids.shift();

  const opened = manager.joinOrCreateAutomatch(generateId);
  assert.equal(opened, "first");

  const joined = manager.joinOrCreateAutomatch(generateId);
  assert.equal(joined, "first", "the second player should land in the game already waiting");

  // Now fill it: the next visitor needs a game of their own.
  const game = manager.get("public", "first");
  game.assignSeat(socket("one"));
  game.assignSeat(socket("two"));

  assert.equal(manager.joinOrCreateAutomatch(generateId), "second");
});

test("automatch steps over games that expired out from under the queue", () => {
  const manager = new GameManager();

  manager.joinOrCreateAutomatch(() => "gone");
  manager.games.delete(GameManager.key("public", "gone"));

  assert.equal(manager.joinOrCreateAutomatch(() => "fresh"), "fresh");
});

test("cleanup drops idle empty games, and the queue with them", () => {
  const manager = new GameManager();

  const idle = manager.getOrCreate("private", "idle");
  const busy = manager.getOrCreate("private", "busy");
  const recent = manager.getOrCreate("private", "recent");
  manager.joinOrCreateAutomatch(() => "queued");

  const longAgo = Date.now() - 24 * 60 * 60 * 1000;
  for (const game of [idle, busy, manager.get("public", "queued")]) game.lastActivity = longAgo;
  busy.assignSeat(socket("still here")); // which touches it, so put it back
  busy.lastActivity = longAgo;

  manager.clean();

  assert.equal(manager.get("private", "idle"), null);
  assert.equal(manager.get("private", "busy"), busy, "somebody is still connected");
  assert.equal(manager.get("private", "recent"), recent);
  assert.equal(manager.get("public", "queued"), null);
  assert.deepEqual(manager.publicQueue, []);
});
