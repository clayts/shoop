"use strict";

// Socket.IO's server auto-serves its own client bundle (serveClient: true by
// default — see server/handler.js), so this is same-origin, not a CDN.
import { io } from "/socket.io/socket.io.esm.min.js";

import { SOUNDS, moveSound, SoundPlayer } from "./sound.js";
import { Board, ICONS } from "./board.js";

const OPPONENT_ROLE = { player1: "player2", player2: "player1" };

const LINK_COPIED_DISPLAY_DURATION_MS = 1200;

// ============================================================================
// Board setup.
// ============================================================================

const sound = new SoundPlayer();

const board = new Board(document.getElementById("grid"), {
  onColumnClick: (column) => socket.emit("move", { column }),

  onRestart: () => socket.emit("restart"),

  onConstructTopRow: (rightGroup) => {
    // Copy-link button: briefly shows a tick after copying.
    const linkButton = document.createElement("button");
    linkButton.className = "link-toggle";
    linkButton.title = "Copy link";
    linkButton.innerHTML = ICONS.link;

    let linkRevertTimer = null;
    linkButton.addEventListener("click", (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(window.location.href);
      linkButton.innerHTML = ICONS.tick;
      clearTimeout(linkRevertTimer);
      linkRevertTimer = setTimeout(() => (linkButton.innerHTML = ICONS.link), LINK_COPIED_DISPLAY_DURATION_MS);
    });

    rightGroup.appendChild(linkButton);

    // Mute/unmute toggle.
    const muteButton = document.createElement("button");
    muteButton.className = "mute-toggle";
    muteButton.title = "Toggle sound";
    muteButton.innerHTML = sound.muted ? ICONS.volumeMuted : ICONS.volumeHigh;

    muteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      sound.toggleMute();
      muteButton.innerHTML = sound.muted ? ICONS.volumeMuted : ICONS.volumeHigh;
    });

    rightGroup.appendChild(muteButton);
  },
});

// ============================================================================
// Socket.IO <-> board. Local ("pass and play") games use this exact same
// code path — the server just lets one connection move for both colours —
// board.applyTurn() is what keeps board.role glued to whichever side is
// currently up in that case.
// ============================================================================

// URL shape: /game/<type>/<id>
const [, gameType, gameId] = location.pathname.split("/").filter(Boolean);

// gameType/gameId travel in the handshake query rather than the socket URL
// path, so every game shares one connection/namespace instead of the server
// accumulating one per game for its whole lifetime.
const socket = io({
	query: { gameType, gameId },
	// transports: ["websocket"],
  pingInterval: 10000,
  pingTimeout: 5000,
});

socket.onAnyOutgoing((event, ...args) => console.log(`sent: ${event}`, ...args));
socket.onAny((event, ...args) => console.log(`received: ${event}`, ...args));

socket.on("init", (message) => {
  board.setGameMode(message.local, message.role);

  const { rows, columns } = message.state.dimensions;

  board.construct(rows, columns);
  board.loadState(message.state.board);
  board.applyTurn(message.state.turn);
  board.applyPresence(message.presence);

  if (message.state.line) {
    board.highlightLine(message.state.line);
    board.setGameOver(true);
  }
});

socket.on("presence", (message) => {
  board.applyPresence(message.presence);
  sound.play(message.event === "connected" ? SOUNDS.connected : SOUNDS.disconnected);
});

socket.on("move", (message) => {
  // Captured before playDisc, which immediately unshifts the new disc onto
  // the stack.
  const discsInColumn = board.stacks[message.payload.column].length;

  board.playDisc(message.payload.column, message.role);
  sound.play(moveSound(message.payload.column, board.scaleDurationMs / 1000, discsInColumn));

  if (message.line) {
    board.setGameOver(true);

    // playDisc's animation is two phases — horizontal slide, then vertical
    // drop — each scaleDurationMs long, so the disc has fully landed at 2x.
    // That's when the line highlight and win/lose arpeggio (following on
    // from the move sound above) play.
    window.setTimeout(() => {
      board.highlightLine(message.line);

      // Local ("pass and play") games have one speaker for both sides
      const hasWon = board.isLocal || message.role === board.role;
      sound.play(hasWon ? SOUNDS.win : SOUNDS.lose);
    }, board.scaleDurationMs * 2);
  }

  board.applyTurn(OPPONENT_ROLE[message.role]);
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

socket.on("full", () => {
  // Someone else grabbed the second seat between this page loading and its
  // socket connecting. Reload: the server now sees the game as full and
  // will serve the "game full" page instead.
  window.location.reload();
});
