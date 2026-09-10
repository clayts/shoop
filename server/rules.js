"use strict";

// ============================================================================
// The rules of Shoop: pure functions over a plain state object. No sockets, no
// timers, no DOM — everything here can be exercised from a test (see
// test/rules.test.js).
//
// The one thing worth knowing before reading on: a disc enters at the *bottom*
// of its column and shoves everything already there up one row. So index 0 of
// a column is its bottom cell, and a move can just as easily complete the
// opponent's line as your own.
// ============================================================================

const COLUMNS = 7;
const ROWS = 6;
const LINE_LENGTH = 4;

const PLAYERS = ["player1", "player2"];

/** The other player. Also used to alternate who starts after a restart. */
function opponentOf(player) {
  return player === "player1" ? "player2" : "player1";
}

/**
 * A fresh game. `startingPlayer` fixes who goes first (a restart passes the
 * other side in, so it alternates); anything else means pick at random.
 */
function initialState(startingPlayer) {
  const turn = PLAYERS.includes(startingPlayer) ? startingPlayer : PLAYERS[Math.random() < 0.5 ? 0 : 1];

  return {
    turn, // whose turn it is
    startingPlayer: turn, // who went first, so a restart can flip it
    board: Array.from({ length: COLUMNS }, () => []),
    dimensions: { columns: COLUMNS, rows: ROWS },
    // null while the game is in progress. Once it's over: { win: "player1" |
    // "player2", line: [...] } for a win, or { win: null, line: null } for a
    // draw (board full, nobody completed a line).
    result: null,
  };
}

// Only these four are needed: every line has an opposite twin, and scanning
// every cell as a potential start covers both ends of it.
const DIRECTIONS = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal, up-right
  [1, -1], // diagonal, down-right
];

/** The first line of LINE_LENGTH discs belonging to `player`, or null. */
function findLine(board, player) {
  const cellAt = (column, row) => board[column]?.[row] ?? null;

  for (let column = 0; column < COLUMNS; column++) {
    for (let row = 0; row < board[column].length; row++) {
      if (cellAt(column, row) !== player) continue;

      for (const [columnStep, rowStep] of DIRECTIONS) {
        const line = [{ column, row }];

        while (line.length < LINE_LENGTH) {
          const next = { column: column + columnStep * line.length, row: row + rowStep * line.length };
          if (cellAt(next.column, next.row) !== player) break;
          line.push(next);
        }

        if (line.length === LINE_LENGTH) return line;
      }
    }
  }

  return null;
}

/** Every column stacked to the top with nobody having won: a draw. */
function isBoardFull(board) {
  return board.every((column) => column.length >= ROWS);
}

/** The result of the position `mover` has just created, or null if play continues. */
function resultAfterMove(board, mover) {
  const opponent = opponentOf(mover);

  // The opponent gets priority: pushing a column up can complete their line as
  // readily as your own, and losing that way beats winning that way.
  const opponentLine = findLine(board, opponent);
  if (opponentLine) return { win: opponent, line: opponentLine };

  const moverLine = findLine(board, mover);
  if (moverLine) return { win: mover, line: moverLine };

  return isBoardFull(board) ? { win: null, line: null } : null;
}

/** The column named by a client-supplied payload, or null if it isn't a real one. */
function parseColumn(payload) {
  if (payload == null || typeof payload !== "object") return null;
  const { column } = payload;
  return Number.isInteger(column) && column >= 0 && column < COLUMNS ? column : null;
}

function invalid(reason) {
  return { valid: false, reason };
}

/**
 * Applies a move, mutating `game.state`. `role` is the seat the calling socket
 * holds (see server/manager.js) — there is no identity behind it beyond that.
 *
 * Returns { valid: true, role, column } on success, where `role` is the side
 * that actually moved: in local ("pass and play") games one seat plays both
 * colours, so that's whoever the state says is up rather than the seat itself.
 * Otherwise { valid: false, reason }.
 */
function playMove(game, role, payload) {
  if (!PLAYERS.includes(role)) return invalid("only players may move");
  if (game.state.result != null) return invalid("game is already over");

  const player = game.local ? game.state.turn : role;
  if (game.state.turn !== player) return invalid(`not your turn (waiting on ${game.state.turn})`);

  const column = parseColumn(payload);
  if (column == null) return invalid(`move must name a column between 0 and ${COLUMNS - 1}`);

  const stack = game.state.board[column];
  if (stack.length >= ROWS) return invalid("column is full");

  stack.unshift(player); // in at the bottom, everything above shifts up

  game.state.result = resultAfterMove(game.state.board, player);
  if (game.state.result == null) game.state.turn = opponentOf(player);

  return { valid: true, role: player, column };
}

export { playMove, initialState, opponentOf, findLine, PLAYERS, COLUMNS, ROWS, LINE_LENGTH };
