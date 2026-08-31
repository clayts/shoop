"use strict";

// ============================================================================
// Board: renders the grid, the toolbar rows, and the hover/placement discs.
// ============================================================================
class Board {
  constructor(container, { onColumnClick, onRestart, onBuildTopRow }) {
    this.container = container;
    this.wrapper = container.parentElement;
    this.onRestart = onRestart;
    this.onBuildTopRow = onBuildTopRow;

    const rootStyles = getComputedStyle(document.documentElement);
    this.padding = parseFloat(rootStyles.getPropertyValue("--padding")) || 0;
    this.gap = parseFloat(rootStyles.getPropertyValue("--gap")) || 0;
    this.cellSize = 0;

    this.role = null;
    this.currentTurn = null;
    this.active = false; // both players connected
    this.gameOver = false;
    this.lastPointerEvent = null;

    this.container.addEventListener("mousemove", (e) => {
      this.lastPointerEvent = e;

      if (!this.isMyTurn()) return;

      const column = this.columnAt(e);
      if (column !== null) this.showPreview(column);
    });

    this.container.addEventListener("mouseleave", () => {
      this.lastPointerEvent = null;

      if (this.isMyTurn()) this.showPreview();
    });

    this.container.addEventListener("click", (e) => {
      const column = this.columnAt(e);
      if (column !== null) onColumnClick(column);
    });

    this.handleResize = () => this.layout();
    window.addEventListener("resize", this.handleResize);
  }

  isMyTurn() {
    return this.active && !this.gameOver && this.role !== null && this.role === this.currentTurn;
  }

  setRole(role) {
    this.role = role;
  }

  // Sets whose turn it is and refreshes the preview. In local mode, the
  // preview is recreated so the scale-in animation plays for each turn.
  setTurn(turn, { recreatePreview = false } = {}) {
    const turnChanged = this.currentTurn !== turn;
    this.currentTurn = turn;

    if (recreatePreview && turnChanged) {
      this.previewDisc?.remove();
      this.previewDisc = null;
      this.previewColumn = null;
    }

    this.showPreview();
  }

  // Enables/disables play (both players connected) and refreshes the preview.
  setActive(active) {
    this.active = active;
    this.showPreview();
  }

  // Marks the game as finished, hides the preview, and reveals the restart button.
  setGameOver(gameOver) {
    this.gameOver = gameOver;
    this.showPreview();
    this.restartButton.style.display = gameOver ? "inline-flex" : "none";
  }

  updatePresence(presence) {
    this.presenceEls.red.innerHTML = presence?.player1Connected ? ICONS.tick : ICONS.cross;
    this.presenceEls.blue.innerHTML = presence?.player2Connected ? ICONS.tick : ICONS.cross;
    this.presenceEls.spectators.textContent = String(presence?.spectatorCount ?? 0);
  }

  // Builds an empty rows x columns board, plus an invisible row above (toolbar)
  // and below (restart control + hover preview). Row 0 is the bottom row.
  build(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.stacks = Array.from({ length: columns }, () => []);
    this.gameOver = false;

    this.container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    const topRow = document.createElement("div");
    topRow.className = "top-row";
    topRow.style.gridColumn = "1 / -1";
    this.presenceEls = buildPresenceStatus(topRow);

    const rightGroup = document.createElement("div");
    rightGroup.className = "top-row-right";
    topRow.appendChild(rightGroup);
    this.onBuildTopRow?.(rightGroup);
    fragment.appendChild(topRow);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.column = c;
        cell.dataset.row = rows - 1 - r;
        fragment.appendChild(cell);
      }
    }

    const bottomRow = document.createElement("div");
    bottomRow.className = "bottom-row";
    bottomRow.style.gridColumn = "1 / -1";

    this.restartButton = document.createElement("button");
    this.restartButton.className = "restart-toggle";
    this.restartButton.title = "Restart game";
    this.restartButton.style.display = "none";
    this.restartButton.innerHTML = ICONS.restart;

    this.restartButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.onRestart?.();
    });

    bottomRow.appendChild(this.restartButton);
    fragment.appendChild(bottomRow);

    this.container.appendChild(fragment);

    this.previewDisc = null;
    this.previewColumn = null; // null means "centered", used to re-layout correctly

    this.layout();
  }

  // Fills the board instantly from a server-provided state, no animation.
  loadState(boardState) {
    boardState.forEach((stack, column) => {
      stack.forEach((role, row) => {
        const disc = this.createDisc(role);
        this.positionDisc(disc, column, row);
        this.stacks[column][row] = disc;
      });
    });
  }

  // Shifts the column's existing discs up one row and drops a new disc in at the bottom.
  playDisc(column, role) {
    const stack = this.stacks[column];
    stack.forEach((disc, row) => this.positionDisc(disc, column, row + 1));

    const disc = this.createDisc(role);
    this.positionDisc(disc, column, -1); // start in the invisible row
    void disc.offsetHeight; // force reflow so the next move animates
    this.positionDisc(disc, column, 0);
    stack.unshift(disc);
  }

  // Returns the column currently under the last known mouse position.
  previewColumnFromPointer() {
    if (!this.lastPointerEvent) return null;
    return this.columnAt(this.lastPointerEvent);
  }

  // Shows the preview over `column` (or centered if omitted), or removes it
  // entirely if column is null or play isn't allowed. The scale-in animation
  // only plays the moment the preview (re)appears — while it's already shown,
  // moving it across columns just animates position, not size.
  showPreview(column = this.isMyTurn() ? (this.columns - 1) / 2 : null) {
    this.previewColumn = column;

    if (column === null) {
      this.previewDisc?.remove();
      this.previewDisc = null;
      return;
    }

    // Existing preview: just update its colour and position.
    if (this.previewDisc) {
      this.previewDisc.className = `disc preview ${this.role}`;
      this.positionDisc(this.previewDisc, column, -1);
      return;
    }

    const centeredColumn = (this.columns - 1) / 2;

    // A newly-created preview should immediately inspect the current pointer
    // and use that column when one is available.
    const pointerColumn = this.previewColumnFromPointer();
    const targetColumn = pointerColumn ?? centeredColumn;

    const disc = document.createElement("div");
    disc.className = `disc preview ${this.role}`;
    disc.style.setProperty("--preview-scale", 0);

    this.container.appendChild(disc);

    // Create the disc at the central position first.
    this.positionDisc(disc, centeredColumn, -1);

    this.previewDisc = disc;
    this.previewColumn = targetColumn;

    // Force the browser to commit the initial scale of zero.
    void disc.offsetHeight;

    // Start the scale-in animation.
    disc.style.setProperty("--preview-scale", 1);

    // Immediately update its location to the current mouse position.
    this.positionDisc(disc, targetColumn, -1);
  }

  highlightLine(line) {
    line.forEach(({ column, row }) => {
      this.container
        .querySelector(`.cell[data-column="${column}"][data-row="${row}"]`)
        .classList.add("highlighted");
    });
  }

  // Recomputes cell size to fill the wrapper, keeping cells square and
  // reserving one invisible row above (toolbar) and one below (hover preview).
  layout() {
    const availableWidth = this.wrapper.clientWidth - this.padding * 2;
    const availableHeight = this.wrapper.clientHeight - this.padding * 2;
    const totalRows = this.rows + 2;
    const widthPerCell = (availableWidth - this.gap * (this.columns - 1)) / this.columns;
    const heightPerCell = (availableHeight - this.gap * (totalRows - 1)) / totalRows;
    this.cellSize = Math.max(0, Math.floor(Math.min(widthPerCell, heightPerCell)));
    this.container.style.setProperty("--cell-size", `${this.cellSize}px`);
    this.container.style.gridTemplateColumns = `repeat(${this.columns}, ${this.cellSize}px)`;
    this.container.style.gridTemplateRows = `repeat(${totalRows}, ${this.cellSize}px)`;
    this.container.style.width = `${this.cellSize * this.columns + this.gap * (this.columns - 1)}px`;
    this.container.style.height = `${this.cellSize * totalRows + this.gap * (totalRows - 1)}px`;
    this.stacks.forEach((stack, c) => stack.forEach((disc, r) => this.positionDisc(disc, c, r)));
    if (this.previewColumn !== null && this.previewDisc) {
      this.positionDisc(this.previewDisc, this.previewColumn, -1);
    }
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
  }

  createDisc(role) {
    const disc = document.createElement("div");
    disc.className = `disc ${role}`;
    this.container.appendChild(disc);
    return disc;
  }

  positionDisc(disc, column, row) {
    disc.style.setProperty("--col", column);
    disc.style.setProperty("--row", this.rows - row);
  }

  columnAt(event) {
    const rect = this.container.getBoundingClientRect();

    const column = Math.floor((event.clientX - rect.left) / (this.cellSize + this.gap));

    return column >= 0 && column < this.columns ? column : null;
  }
}

// Left-hand presence status: a solid red/blue dot (tick when that player is
// connected, cross when not) and a translucent lozenge with the spectator count.
function buildPresenceStatus(topRow) {
  const wrap = document.createElement("div");
  wrap.className = "presence-status";

  wrap.innerHTML = `
    <span class="presence-dot presence-red"></span>
    <span class="presence-dot presence-blue"></span>
    <span class="presence-lozenge">0</span>
  `;

  topRow.appendChild(wrap);

  return {
    red: wrap.querySelector(".presence-red"),
    blue: wrap.querySelector(".presence-blue"),
    spectators: wrap.querySelector(".presence-lozenge"),
  };
}

const ICONS = {
  restart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M544.1 256L552 256C565.3 256 576 245.3 576 232L576 88C576 78.3 570.2 69.5 561.2 65.8C552.2 62.1 541.9 64.2 535 71L483.3 122.8C439 86.1 382 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6C143.2 199.5 223.3 128 320 128C364.4 128 405.2 143 437.7 168.3L391 215C384.1 221.9 382.1 232.2 385.8 241.2C389.5 250.2 398.3 256 408 256L544.1 256zM573.5 356.5C576 339 563.8 322.8 546.4 320.3C529 317.8 512.7 330 510.2 347.4C496.9 440.4 416.8 511.9 320.1 511.9C275.7 511.9 234.9 496.9 202.4 471.6L249 425C255.9 418.1 257.9 407.8 254.2 398.8C250.5 389.8 241.7 384 232 384L88 384C74.7 384 64 394.7 64 408L64 552C64 561.7 69.8 570.5 78.8 574.2C87.8 577.9 98.1 575.8 105 569L156.8 517.2C201 553.9 258 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg>`,
  cross: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>`,
  tick: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6"/></svg>`,
  volumeMuted: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416zM399 239C389.6 248.4 389.6 263.6 399 272.9L446 319.9L399 366.9C389.6 376.3 389.6 391.5 399 400.8C408.4 410.1 423.6 410.2 432.9 400.8L479.9 353.8L526.9 400.8C536.3 410.2 551.5 410.2 560.8 400.8C570.2 391.4 570.2 376.2 560.8 366.9L513.8 319.9L560.8 272.9C570.2 263.5 570.2 248.3 560.8 239C551.4 229.7 536.2 229.6 526.9 239L479.9 286L432.9 239C423.5 229.6 408.3 229.6 399 239z"/></svg>`,
  volumeHigh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M533.6 96.5C523.3 88.1 508.2 89.7 499.8 100C491.4 110.3 493 125.4 503.3 133.8C557.5 177.8 592 244.8 592 320C592 395.2 557.5 462.2 503.3 506.3C493 514.7 491.5 529.8 499.8 540.1C508.1 550.4 523.3 551.9 533.6 543.6C598.5 490.7 640 410.2 640 320C640 229.8 598.5 149.2 533.6 96.5zM473.1 171C462.8 162.6 447.7 164.2 439.3 174.5C430.9 184.8 432.5 199.9 442.8 208.3C475.3 234.7 496 274.9 496 320C496 365.1 475.3 405.3 442.8 431.8C432.5 440.2 431 455.3 439.3 465.6C447.6 475.9 462.8 477.4 473.1 469.1C516.3 433.9 544 380.2 544 320.1C544 260 516.3 206.3 473.1 171.1zM412.6 245.5C402.3 237.1 387.2 238.7 378.8 249C370.4 259.3 372 274.4 382.3 282.8C393.1 291.6 400 305 400 320C400 335 393.1 348.4 382.3 357.3C372 365.7 370.5 380.8 378.8 391.1C387.1 401.4 402.3 402.9 412.6 394.6C434.1 376.9 448 350.1 448 320C448 289.9 434.1 263.1 412.6 245.5zM80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416z"/></svg>`,
};

// "Copy link" button that briefly shows a tick after copying.
function buildLinkButton(container) {
  const button = document.createElement("button");
  button.className = "link-toggle";
  button.title = "Copy link";
  button.innerHTML = ICONS.link;

  let revertTimer = null;

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(window.location.href);
    button.innerHTML = ICONS.tick;
    clearTimeout(revertTimer);
    revertTimer = setTimeout(() => (button.innerHTML = ICONS.link), 1200);
  });

  container.appendChild(button);
}

// Mute/unmute toggle. isMuted() reports current state; onToggle() flips it.
function buildMuteButton(container, isMuted, onToggle) {
  const button = document.createElement("button");
  button.className = "mute-toggle";
  button.title = "Toggle sound";
  button.innerHTML = isMuted() ? ICONS.volumeMuted : ICONS.volumeHigh;

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onToggle();
    button.innerHTML = isMuted() ? ICONS.volumeMuted : ICONS.volumeHigh;
  });

  container.appendChild(button);
}

// ============================================================================
// SynthPlayer: tiny WebAudio note sequencer for move/win/error chimes.
// ============================================================================
class SynthPlayer {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Converts note name like "A4", "C#5", "Db3" to frequency in Hz
  static noteToFreq(note) {
    if (typeof note === "number") return note;

    const m = note.match(/^([A-Ga-g])(#|b)?(-?\d+)$/);

    if (!m) {
      throw new Error(`Invalid note: ${note}`);
    }

    const [, letter, accidental, octaveStr] = m;
    const semitones = {
      C: 0,
      D: 2,
      E: 4,
      F: 5,
      G: 7,
      A: 9,
      B: 11,
    };

    let n = semitones[letter.toUpperCase()];

    if (accidental === "#") n += 1;
    if (accidental === "b") n -= 1;

    const midi = (parseInt(octaveStr, 10) + 1) * 12 + n;

    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // notes: [{freq: number|string, duration, glide, waveform}, ...]
  playSequence(notes, { waveform = "sine", gain = 0.2 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();

    osc.type = waveform;
    g.gain.value = gain;

    osc.connect(g).connect(ctx.destination);

    const resolved = notes.map((n) => ({
      ...n,
      freq: SynthPlayer.noteToFreq(n.freq),
    }));

    let t = ctx.currentTime;

    resolved.forEach((note, i) => {
      const dur = note.duration ?? 0.3;

      if (note.waveform && note.waveform !== osc.type) {
        osc.type = note.waveform;
      }

      if (i === 0 || !note.glide) {
        osc.frequency.setValueAtTime(note.freq, t);
      } else {
        osc.frequency.linearRampToValueAtTime(note.freq, t + dur);
      }

      t += dur;
    });

    osc.start();
    osc.stop(t);

    return {
      osc,
      gain: g,
      stop: () => osc.stop(),
    };
  }
}

// ============================================================================
// Wiring: websocket <-> board. Local ("pass and play") games use this exact
// same code path — the server just lets one connection move for both colours
// (see src/game.js / src/manager.js). The only client-side accommodation is
// applyTurn() keeping board.role glued to whichever side is currently up, so
// clicks/preview/colours always follow the active player instead of a fixed side.
// ============================================================================
let synth = null; // created lazily on first user gesture (mute button click)
let muted = true;
let isLocal = false;

function playSound(notes, opts) {
  if (!muted && synth) {
    synth.playSequence(notes, opts);
  }
}

function applyTurn(turn) {
  if (isLocal) board.setRole(turn);
  board.setTurn(turn, {
    recreatePreview: isLocal,
  });
}

const board = new Board(document.getElementById("grid"), {
  onColumnClick: (column) =>
    ws.send(
      JSON.stringify({
        type: "move",
        payload: { column },
      }),
    ),

  onRestart: () =>
    ws.send(
      JSON.stringify({
        type: "restart",
      }),
    ),

  onBuildTopRow: (rightGroup) => {
    buildLinkButton(rightGroup);

    buildMuteButton(
      rightGroup,
      () => muted,
      () => {
        if (!synth) synth = new SynthPlayer();

        synth.ctx.resume();
        muted = !muted;
      },
    );
  },
});

const gameId = location.pathname.split("/").filter(Boolean)[1]; // /game/<id>

const ws = new WebSocket(
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${gameId}`,
);

function applyPresence(presence) {
  board.setActive(!!(presence?.player1Connected && presence?.player2Connected));

  board.updatePresence(presence);
}

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "init": {
      isLocal = !!msg.local;

      board.setRole(msg.role);

      const { rows, columns } = msg.state.dimensions;

      board.build(rows, columns);
      board.loadState(msg.state.board);
      applyTurn(msg.state.turn);
      applyPresence(msg.presence);

      if (msg.state.line) {
        board.highlightLine(msg.state.line);
        board.setGameOver(true);
      }

      break;
    }

    case "presence": {
      applyPresence(msg.presence);

      const notes = msg.event === "connected" ? ["C4", "G4"] : ["G4", "C4"];

      playSound(
        notes.map((freq, i) => ({
          freq,
          duration: i === 0 ? 0.1 : 0.15,
        })),
        {
          waveform: "sine",
          gain: 0.2,
        },
      );

      break;
    }

    case "move": {
      board.playDisc(msg.payload.column, msg.role);

      if (msg.line) {
        board.highlightLine(msg.line);
        board.setGameOver(true);

        const won = msg.role === board.role;

        playSound(
          won
            ? [
                { freq: "C5", duration: 0.15 },
                { freq: "E5", duration: 0.15 },
                { freq: "G5", duration: 0.25 },
              ]
            : [
                { freq: "G4", duration: 0.15 },
                { freq: "E4", duration: 0.15 },
                { freq: "C4", duration: 0.3 },
              ],
          {
            waveform: "sine",
            gain: 0.25,
          },
        );
      } else {
        playSound(
          [
            {
              freq: msg.role === "player1" ? "C5" : "E5",
              duration: 0.12,
            },
          ],
          {
            waveform: "triangle",
            gain: 0.25,
          },
        );
      }

      applyTurn(msg.role === "player1" ? "player2" : "player1");

      break;
    }

    case "restart": {
      const { rows, columns } = msg.state.dimensions;

      board.build(rows, columns);
      applyTurn(msg.state.turn);
      applyPresence(msg.presence);

      break;
    }

    case "error":
      playSound(
        [
          { freq: "A3", duration: 0.15 },
          { freq: "Ab3", duration: 0.2 },
        ],
        {
          waveform: "sawtooth",
          gain: 0.2,
        },
      );

      break;
  }
});
