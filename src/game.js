"use strict";

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

  return { valid: true, role };
}

export { playMove, initialState };
