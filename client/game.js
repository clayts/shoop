"use strict";

// Socket.IO's server serves its own client bundle (serveClient defaults to
// true — see server/handler.js), so this is same-origin, not a CDN.
import { io } from "/socket.io/socket.io.esm.min.js";

import { SOUNDS, moveSound, SoundPlayer } from "./sound.js";
import { Board, ICONS } from "./board.js";

const OPPONENT_ROLE = { player1: "player2", player2: "player1" };

const LINK_COPIED_DISPLAY_DURATION_MS = 1200;
const FULL_RETRY_LIMIT = 10;
const FULL_RETRY_BASE_MS = 1000;

// Add ?debug to the URL to log the traffic in both directions.
const debug = new URLSearchParams(location.search).has("debug");

let fullRetries = 0;

// ============================================================================
// Board and controls.
// ============================================================================

const sound = new SoundPlayer();

// A toolbar button: an icon, a label for anyone who can't see it, and a click
// that doesn't reach the grid underneath (which would read as a move).
function createControl({ label, icon, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "control";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.innerHTML = icon;

  button.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick(button);
  });

  return button;
}

const board = new Board(document.getElementById("grid"), {
  onColumnClick: (column) => socket.emit("move", { column }),

  onRestart: () => socket.emit("restart"),

  onConstructTopRow: (rightGroup) => {
    // Copy-link button: briefly shows a tick once the link is on the clipboard.
    let linkRevertTimer = null;
    const linkButton = createControl({
      label: "Copy link",
      icon: ICONS.link,
      onClick: async (button) => {
        try {
          await navigator.clipboard.writeText(location.href);
        } catch {
          return; // no clipboard access (insecure context, or the user said no)
        }

        button.innerHTML = ICONS.tick;
        clearTimeout(linkRevertTimer);
        linkRevertTimer = setTimeout(() => (button.innerHTML = ICONS.link), LINK_COPIED_DISPLAY_DURATION_MS);
      },
    });

    const muteButton = createControl({
      label: "Toggle sound",
      icon: sound.muted ? ICONS.volumeMuted : ICONS.volumeHigh,
      onClick: (button) => {
        button.innerHTML = sound.toggleMute() ? ICONS.volumeMuted : ICONS.volumeHigh;
      },
    });

    rightGroup.append(linkButton, muteButton);
  },
});

// ============================================================================
// Socket.IO <-> board. Local ("pass and play") games run through this exact
// same path — the server simply lets the one connection move for both colours,
// and board.applyTurn() is what keeps board.role glued to whichever side is
// currently up.
// ============================================================================

// URL shape: /game/<type>/<id>
const [, gameType, gameId] = location.pathname.split("/").filter(Boolean);

// gameType/gameId travel in the handshake query rather than the socket URL
// path, so every game shares one connection namespace instead of the server
// accumulating one per game for its whole lifetime.
//
// preferredRole starts empty (any open seat will do) and is filled in once the
// server says which seat we hold. Socket.IO re-reads this object on every
// reconnect attempt, so mutating it in place is enough to make a reconnect ask
// for the same seat back rather than race for whichever one happens to be free.
const query = { gameType, gameId, preferredRole: "" };
const socket = io({ query });

if (debug) {
  socket.onAnyOutgoing((event, ...args) => console.log(`sent: ${event}`, ...args));
  socket.onAny((event, ...args) => console.log(`received: ${event}`, ...args));
}

socket.on("init", (message) => {
  fullRetries = 0;

  // Local games only ever have the one seat, so there's nothing to preserve
  // across a reconnect — leave preferredRole empty.
  if (!message.local) query.preferredRole = message.role;

  board.setGameMode(message.local, message.role);

  const { rows, columns } = message.state.dimensions;
  board.construct(rows, columns);
  board.loadState(message.state.board);
  board.applyTurn(message.state.turn);
  board.applyPresence(message.presence);

  if (message.state.result) {
    if (message.state.result.line) board.highlightLine(message.state.result.line);
    board.setGameOver(true);
  }
});

socket.on("presence", (message) => {
  board.applyPresence(message.presence);
  sound.play(message.event === "connected" ? SOUNDS.connected : SOUNDS.disconnected);
});

socket.on("move", ({ role, payload, result }) => {
  const { column } = payload;

  // Read before playDisc, which immediately unshifts the new disc onto the stack.
  const discsInColumn = board.stacks[column].length;

  board.playDisc(column, role);
  sound.play(moveSound(column, board.scaleDurationMs / 1000, discsInColumn));

  if (!result) {
    board.applyTurn(OPPONENT_ROLE[role]);
    return;
  }

  board.setGameOver(true);
  if (!result.line) return; // a draw: no line to draw, no fanfare

  // playDisc's animation runs in two phases — the horizontal slide, then the
  // rise — each scaleDurationMs long, so the disc has fully landed at 2x.
  // That's when the line and the win/lose arpeggio follow on from the move sound.
  window.setTimeout(() => {
    board.highlightLine(result.line);

    // The winner is whoever the result says won, which isn't necessarily
    // whoever's move triggered it — a move can complete the opponent's line as
    // well as the mover's own. Local games have one speaker for both sides, so
    // there's nobody there for it to be a loss for.
    sound.play(board.isLocal || result.win === board.role ? SOUNDS.win : SOUNDS.lose);
  }, board.scaleDurationMs * 2);
});

socket.on("restart", (message) => {
  const { rows, columns } = message.state.dimensions;

  sound.play(SOUNDS.restart);

  board.restart(rows, columns, () => {
    board.applyTurn(message.state.turn);
    board.applyPresence(message.presence);
  });
});

socket.on("error", () => {
  sound.play(SOUNDS.error);
});

socket.on("disconnect", () => board.setReconnecting(true));
socket.on("connect", () => board.setReconnecting(false));

// "full" means the seat we asked for was taken: either both seats are occupied,
// or — after a reconnect — someone else has sat down in ours. The server closes
// the connection after saying so, which stops Socket.IO reconnecting on its
// own, so back off and try again by hand for a while. A seat may yet free up;
// if it doesn't, reload and let the server serve its "game full" page.
socket.on("full", () => {
  if (fullRetries >= FULL_RETRY_LIMIT) return window.location.reload();

  fullRetries += 1;
  setTimeout(() => socket.connect(), FULL_RETRY_BASE_MS * fullRetries);
});
