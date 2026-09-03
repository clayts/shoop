"use strict";

const BOARD_WIDTH = 7;
const BOARD_HEIGHT = 6;
const LINE_LENGTH = 4;

function setup(startingPlayer) {
  // If a starting player is explicitly passed (e.g. on restart, to alternate
  // who goes first), use it; otherwise pick randomly, as for a brand-new game.
  const turn =
    startingPlayer === "player1" || startingPlayer === "player2"
      ? startingPlayer
      : Math.random() < 0.5
        ? "player1"
        : "player2";

  return {
    turn, // whose turn it is
    startingPlayer: turn, // who went first this game, so a future restart can flip it
    board: Array.from({ length: BOARD_WIDTH }, () => []),
    dimensions: { columns: BOARD_WIDTH, rows: BOARD_HEIGHT },
    line: null,
  };
}

function checkLine(board, player) {
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
      const cellPlayer = getCell(c, r);
      if (cellPlayer !== player) continue;

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

// `role` is whichever seat the calling socket currently holds — the handler
// determines this at connection time (see server/manager.js's assignSeat)
// and passes it straight through; there's no separate identity to look up.
function play(game, role, payload) {
  if (game.state.line != null) {
    return { valid: false, reason: `game has been won` };
  }

  if (role !== "player1" && role !== "player2") {
    return { valid: false, reason: "only players may move" };
  }

  // In local ("pass and play") games, one connection holds the only seat but
  // plays both sides — the side actually moving is whoever the game state
  // says has the turn, not the seat itself.
  const activeRole = game.local ? game.state.turn : role;

  if (payload == null || typeof payload !== "object") {
    return { valid: false, reason: "payload must be a JSON object" };
  }

  if (game.state.turn !== activeRole) {
    return { valid: false, reason: `not your turn (waiting on ${game.state.turn})` };
  }

  if ("column" in payload) {
    let column = payload["column"];
    if (column in game.state.board) {
      if (game.state.board[column].length < BOARD_HEIGHT) {
        game.state.board[column].unshift(activeRole);
      } else {
        return { valid: false, reason: `column is full` };
      }
    } else {
      return { valid: false, reason: `invalid column: ${column}` };
    }
  } else {
    return { valid: false, reason: `no column specified` };
  }

  const opponent = activeRole === "player1" ? "player2" : "player1";

  // The opponent gets priority: if they already have a winning line on the
  // board, that takes precedence over any line the mover just formed.
  game.state.line = checkLine(game.state.board, opponent) || checkLine(game.state.board, activeRole);

  if (!game.state.line) {
    game.state.turn = opponent;
  }

  return { valid: true, role: activeRole };
}

export { play as playMove, setup as initialState };
