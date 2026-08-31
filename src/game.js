"use strict";

/**
 * ===========================================================================
 * REPLACE THE CONTENTS OF THIS FILE WITH YOUR OWN GAME RULES.
 * ===========================================================================
 *
 * playMove(game, role, clientId, payload) is called once per incoming
 * WebSocket move message, BEFORE anything is broadcast. It must be synchronous
 * (or return a Promise) and must not throw for bad input — return
 * { valid: false, reason } instead.
 *
 * Arguments:
 *   game.state   - freeform object that persists for the life of the game.
 *                  Mutate it here to track board position, turn, scores, etc.
 *                  For a game like Connect 4, the board itself is the full
 *                  history, so there's no separate move log to consult.
 *   role         - 'player1' | 'player2' | 'spectator' (spectators never reach
 *                  here in the default wiring — see wsHandler.js)
 *   clientId     - stable id for the connecting browser (persists across reloads)
 *   payload      - whatever JSON object the client sent as `payload` in:
 *                  { type: "move", payload: { ... } }
 *
 * Return shape:
 *   { valid: true }                         - move accepted, will be broadcast as-is
 *   { valid: true, broadcastPayload: {...} } - accepted, but broadcast this instead
 *                                              (e.g. to attach server-computed fields
 *                                              like resulting board state)
 *   { valid: false, reason: "not your turn" } - rejected, sender gets an error,
 *                                                 nothing is broadcast
 *
 * The example below is a generic "strict alternating turns" placeholder
 * (player1 moves, then player2, then player1, ...). Swap in real rules for
 * your game (e.g. validate a tic-tac-toe cell is empty, a chess move is
 * legal, etc).
 * ===========================================================================
 */

const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 6;
const LINE_LENGTH = 4;

function initialState() {
  return {
    turn: Math.random() < 0.5 ? "player1" : "player2", // whose turn it is
    board: Array.from({ length: BOARD_WIDTH }, () => []),
    dimensions: { columns: BOARD_WIDTH, rows: BOARD_HEIGHT },
    line: null,
  };
}

function checkLine(board) {
  const getCell = (column, row) => board[column]?.[row] || null;

  const directions = [
    [1, 0], // Horizontal right
    [0, 1], // Vertical up
    [1, 1], // Diagonal up-right
    [1, -1], // Diagonal down-right
  ];

  for (let c = 0; c < BOARD_WIDTH; c++) {
    const colLength = board[c]?.length || 0;

    for (let r = 0; r < colLength; r++) {
      const player = getCell(c, r);
      if (!player) continue;

      for (const [dc, dr] of directions) {
        // Track coordinates starting with the initial piece
        const winningLine = [{ column: c, row: r }];

        for (let step = 1; step < LINE_LENGTH; step++) {
          const nextCol = c + dc * step;
          const nextRow = r + dr * step;

          if (getCell(nextCol, nextRow) === player) {
            winningLine.push({ column: nextCol, row: nextRow });
          } else {
            break;
          }
        }

        // Return coordinates array if line length is reached
        if (winningLine.length === LINE_LENGTH) {
          return winningLine;
        }
      }
    }
  }

  return null; // No winner found
}

function playMove(game, clientId, payload) {
  console.log("-----------------------------");
  console.log("validating:");
  console.log("game:");
  console.log(game);
  console.log("clientId:");
  console.log(clientId);
  console.log("payload:");
  console.log(payload);
  console.log("-----------------------------");

  if (game.state.line != null) {
    return { valid: false, reason: `game has been won` };
  }

  let role = game.roles.get(clientId);
  if (role !== "player1" && role !== "player2") {
    return { valid: false, reason: "only players may move" };
  }

  if (payload == null || typeof payload !== "object") {
    return { valid: false, reason: "payload must be a JSON object" };
  }

  if (game.state.turn !== role) {
    return { valid: false, reason: `not your turn (waiting on ${game.state.turn})` };
  }

  // --- YOUR GAME-SPECIFIC VALIDATION GOES HERE ---
  // e.g. check payload.cell is in range and empty, check payload.from/to is a
  // legal move for the piece at that square, etc. Mutate game.state to apply it.

  // Example placeholder: just flip the turn.

  if ("column" in payload) {
    let column = payload["column"];
    if (column in game.state.board) {
      if (game.state.board[column].length < BOARD_HEIGHT) {
        game.state.board[column].unshift(role);
      } else {
        return { valid: false, reason: `column is full` };
      }
    } else {
      return { valid: false, reason: `invalid column: ${column}` };
    }
  } else {
    return { valid: false, reason: `no column specified` };
  }

  game.state.line = checkLine(game.state.board);
  if (!game.state.line) {
    game.state.turn = game.roles.get(clientId) === "player1" ? "player2" : "player1";
  }

  console.log("-----------------------------");
  console.log("state updated:");
  console.dir(game.state, { depth: null });
  console.log("-----------------------------");

  return { valid: true };
}

module.exports = { playMove, initialState };
