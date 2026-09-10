"use strict";

import test from "node:test";
import assert from "node:assert/strict";

import { playMove, initialState, opponentOf, findLine, COLUMNS, ROWS } from "../server/rules.js";

// A stand-in for the Game that server/manager.js holds: the rules only ever
// touch these two fields.
function makeGame({ local = false, turn = "player1", board = null } = {}) {
  const state = initialState(turn);
  if (board) state.board = board;
  return { local, state };
}

/** Columns as "bottom disc first" strings: "12" means player1 below player2. */
function board(...columns) {
  const parsed = columns.map((column) => [...column].map((disc) => `player${disc}`));
  while (parsed.length < COLUMNS) parsed.push([]);
  return parsed;
}

test("a new game starts empty, with the named player to move", () => {
  const state = initialState("player2");

  assert.equal(state.turn, "player2");
  assert.equal(state.startingPlayer, "player2");
  assert.equal(state.result, null);
  assert.deepEqual(state.dimensions, { columns: COLUMNS, rows: ROWS });
  assert.equal(state.board.length, COLUMNS);
  assert.ok(state.board.every((column) => column.length === 0));
});

test("an unrecognised starting player means pick one at random", () => {
  const starters = new Set(Array.from({ length: 50 }, () => initialState(undefined).turn));
  assert.deepEqual([...starters].sort(), ["player1", "player2"]);
});

test("a disc enters at the bottom and pushes the column up", () => {
  const game = makeGame({ turn: "player1", board: board("22") });

  const move = playMove(game, "player1", { column: 0 });

  assert.deepEqual(move, { valid: true, role: "player1", column: 0 });
  assert.deepEqual(game.state.board[0], ["player1", "player2", "player2"]);
  assert.equal(game.state.turn, "player2");
});

test("moves out of turn, off the board, or into a full column are refused", () => {
  const cases = [
    ["the wrong player", "player2", { column: 0 }],
    ["a spectator", "watcher", { column: 0 }],
    ["a missing column", "player1", {}],
    ["a column past the edge", "player1", { column: COLUMNS }],
    ["a negative column", "player1", { column: -1 }],
    ["a fractional column", "player1", { column: 1.5 }],
    ["a column as a string", "player1", { column: "1" }],
    ["a payload that isn't an object", "player1", "1"],
    ["no payload at all", "player1", null],
    ["a full column", "player1", { column: 1 }],
  ];

  for (const [description, role, payload] of cases) {
    const game = makeGame({ turn: "player1", board: board("", "121212") });
    const move = playMove(game, role, payload);

    assert.equal(move.valid, false, description);
    assert.ok(move.reason, `${description} should say why`);
    assert.deepEqual(game.state.board, board("", "121212"), `${description} should leave the board alone`);
  }
});

test("a finished game accepts no further moves", () => {
  const game = makeGame({ turn: "player1", board: board("111") });
  playMove(game, "player1", { column: 0 });

  assert.equal(game.state.result.win, "player1");
  assert.equal(playMove(game, "player2", { column: 3 }).valid, false);
});

test("four in a column wins", () => {
  const game = makeGame({ turn: "player1", board: board("111") });

  playMove(game, "player1", { column: 0 });

  assert.equal(game.state.result.win, "player1");
  assert.deepEqual(
    game.state.result.line,
    [0, 1, 2, 3].map((row) => ({ column: 0, row })),
  );
});

test("four along a row wins", () => {
  const game = makeGame({ turn: "player2", board: board("2", "2", "2") });

  playMove(game, "player2", { column: 3 });

  assert.equal(game.state.result.win, "player2");
  assert.deepEqual(
    game.state.result.line,
    [0, 1, 2, 3].map((column) => ({ column, row: 0 })),
  );
});

test("four along a diagonal wins", () => {
  // player1 sits one row lower in each successive column, and the new disc
  // lands at the bottom of the fourth to finish the run.
  const game = makeGame({ turn: "player1", board: board("2221", "221", "21") });

  playMove(game, "player1", { column: 3 });

  assert.equal(game.state.result.win, "player1");
  assert.deepEqual(game.state.result.line, [
    { column: 0, row: 3 },
    { column: 1, row: 2 },
    { column: 2, row: 1 },
    { column: 3, row: 0 },
  ]);
});

test("completing the opponent's line loses, even while completing your own", () => {
  // Every column here holds player1 at the bottom with player2 above it, so
  // dropping into the fourth completes both a player1 row at row 0 and a
  // player2 row at row 1. The player being pushed up takes priority.
  const game = makeGame({ turn: "player1", board: board("12", "12", "12", "2") });

  playMove(game, "player1", { column: 3 });

  assert.equal(game.state.result.win, "player2");
  assert.ok(findLine(game.state.board, "player1"), "player1 completed a line of their own too");
  assert.deepEqual(
    game.state.result.line,
    [0, 1, 2, 3].map((column) => ({ column, row: 1 })),
  );
});

test("a full board with no line is a draw", () => {
  // Blocks of three, inverted on every other row and again in the last column:
  // no run of four in any direction, 21 discs each.
  const discAt = (column, row) => ((column < 3 || column === COLUMNS - 1) === (row % 2 === 0) ? "player1" : "player2");
  const filled = Array.from({ length: COLUMNS }, (_, column) =>
    Array.from({ length: ROWS }, (_, row) => discAt(column, row)),
  );

  // One short of full: take the bottom disc out of the first column, and
  // everything that was above it has slid down a row.
  const opening = filled.map((column, index) => (index === 0 ? column.slice(1) : column));
  const mover = filled[0][0];

  const game = makeGame({ turn: mover, board: opening });
  assert.equal(findLine(opening, "player1"), null, "the position before the move should be a real one");
  assert.equal(findLine(opening, "player2"), null, "the position before the move should be a real one");

  playMove(game, mover, { column: 0 });

  assert.deepEqual(game.state.result, { win: null, line: null });
  assert.equal(game.state.board.flat().length, COLUMNS * ROWS);
});

test("in a local game the seat plays whichever side is up", () => {
  const game = makeGame({ local: true, turn: "player2" });

  // The connection holds player1, but player2 is to move, so that's who moves.
  const move = playMove(game, "player1", { column: 3 });

  assert.deepEqual(move, { valid: true, role: "player2", column: 3 });
  assert.deepEqual(game.state.board[3], ["player2"]);
  assert.equal(game.state.turn, "player1");
});

test("opponentOf flips sides", () => {
  assert.equal(opponentOf("player1"), "player2");
  assert.equal(opponentOf("player2"), "player1");
});
