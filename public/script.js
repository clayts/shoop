class Board {
  constructor(container, { onColumnClick, onBuildTopRow }) {
    this.container = container;
    this.wrapper = container.parentElement;
    this.onBuildTopRow = onBuildTopRow;

    const rootStyles = getComputedStyle(document.documentElement);
    this.padding = parseFloat(rootStyles.getPropertyValue("--padding")) || 0;
    this.gap = parseFloat(rootStyles.getPropertyValue("--gap")) || 0;
    this.cellSize = 0;

    this.role = null;
    this.currentTurn = null;
    this.active = false; // both players connected
    this.gameOver = false;

    this.container.addEventListener("mousemove", (e) => {
      if (!this.isMyTurn()) return;
      const column = this.columnAt(e);
      if (column !== null) this.showPreview(column);
    });
    this.container.addEventListener("mouseleave", () => {
      if (this.isMyTurn()) this.showPreview();
    });
    this.container.addEventListener("click", (e) => {
      if (!this.isMyTurn()) return;
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

  // Sets whose turn it is and refreshes the preview accordingly.
  setTurn(turn) {
    this.currentTurn = turn;
    this.showPreview();
  }

  // Enables/disables play (both players connected) and refreshes the preview.
  setActive(active) {
    this.active = active;
    this.showPreview();
  }

  // Marks the game as finished and refreshes the preview (hides it).
  setGameOver(gameOver) {
    this.gameOver = gameOver;
    this.showPreview();
  }

  // Builds an empty rows x columns board, plus an invisible row above (toolbar)
  // and below (hover preview). Row 0 is the bottom row.
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
    this.onBuildTopRow?.(topRow);
    fragment.appendChild(topRow);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const row = rows - 1 - r;
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.column = c;
        cell.dataset.row = row;
        fragment.appendChild(cell);
      }
    }
    this.container.appendChild(fragment);

    this.previewDisc = document.createElement("div");
    this.previewDisc.className = "circle preview";
    this.previewDisc.style.display = "none";
    this.container.appendChild(this.previewDisc);
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

  // Shows the preview over `column` (or centered if omitted) using role,
  // or hides it entirely if column is explicitly null or play isn't allowed.
  showPreview(column = this.isMyTurn() ? (this.columns - 1) / 2 : null) {
    this.previewColumn = column;
    if (column === null) {
      this.previewDisc.style.display = "none";
      return;
    }
    this.previewDisc.className = `circle preview ${this.role}`;
    this.positionDisc(this.previewDisc, column, -1);
    this.previewDisc.style.display = "block";
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
    if (this.previewColumn !== null) this.positionDisc(this.previewDisc, this.previewColumn, -1);
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
  }

  createDisc(role) {
    const disc = document.createElement("div");
    disc.className = `circle ${role}`;
    this.container.appendChild(disc);
    return disc;
  }

  positionDisc(disc, column, row) {
    disc.style.setProperty("--col", column);
    disc.style.setProperty("--row", this.rows - row);
  }

  columnAt(event) {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const column = Math.floor(x / (this.cellSize + this.gap));
    return column >= 0 && column < this.columns ? column : null;
  }
}

class SynthPlayer {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // Converts note name like "A4", "C#5", "Db3" to frequency in Hz
  static noteToFreq(note) {
    if (typeof note === "number") return note;
    const m = note.match(/^([A-Ga-g])(#|b)?(-?\d+)$/);
    if (!m) throw new Error(`Invalid note: ${note}`);
    const [, letter, accidental, octaveStr] = m;
    const semitones = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let n = semitones[letter.toUpperCase()];
    if (accidental === "#") n += 1;
    if (accidental === "b") n -= 1;
    const octave = parseInt(octaveStr, 10);
    const midi = (octave + 1) * 12 + n; // MIDI note number
    return 440 * Math.pow(2, (midi - 69) / 12); // A4 = 440Hz = MIDI 69
  }

  // notes: [{freq: number|string, duration, glide, waveform}, ...]
  playSequence(notes, { waveform = "sine", gain = 0.2 } = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = waveform;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);

    const resolved = notes.map((n) => ({ ...n, freq: SynthPlayer.noteToFreq(n.freq) }));

    let t = ctx.currentTime;
    osc.frequency.setValueAtTime(resolved[0].freq, t);

    resolved.forEach((note, i) => {
      const dur = note.duration ?? 0.3;
      if (note.waveform && note.waveform !== osc.type) osc.type = note.waveform;

      if (i === 0) {
        osc.frequency.setValueAtTime(note.freq, t);
      } else if (note.glide) {
        osc.frequency.linearRampToValueAtTime(note.freq, t + dur);
      } else {
        osc.frequency.setValueAtTime(note.freq, t);
      }
      t += dur;
    });

    osc.start();
    osc.stop(t);
    return { osc, gain: g, stop: () => osc.stop() };
  }
}

let synth = null; // created lazily on first user gesture (mute button click)
let muted = true;

function playSound(notes, opts) {
  if (!muted && synth) synth.playSequence(notes, opts);
}

const board = new Board(document.getElementById("grid"), {
  onColumnClick: (column) => {
    const msg = { type: "move", payload: { column } };
    console.log(`sent: ${JSON.stringify(msg)}`);
    ws.send(JSON.stringify(msg));
  },
  onBuildTopRow: (topRow) => {
    const linkSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>`;

    const linkButton = document.createElement("button");
    linkButton.className = "link-toggle";
    linkButton.title = "Copy link";
    linkButton.innerHTML = linkSvg;
    linkButton.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(window.location.href);
    });
    topRow.appendChild(linkButton);

    const volumeMutedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416zM399 239C389.6 248.4 389.6 263.6 399 272.9L446 319.9L399 366.9C389.6 376.3 389.6 391.5 399 400.8C408.4 410.1 423.6 410.2 432.9 400.8L479.9 353.8L526.9 400.8C536.3 410.2 551.5 410.2 560.8 400.8C570.1 391.4 570.2 376.2 560.8 366.9L513.8 319.9L560.8 272.9C570.2 263.5 570.2 248.3 560.8 239C551.4 229.7 536.2 229.6 526.9 239L479.9 286L432.9 239C423.5 229.6 408.3 229.6 399 239z"/></svg>`;

    const volumeHighSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M533.6 96.5C523.3 88.1 508.2 89.7 499.8 100C491.4 110.3 493 125.4 503.3 133.8C557.5 177.8 592 244.8 592 320C592 395.2 557.5 462.2 503.3 506.3C493 514.7 491.5 529.8 499.8 540.1C508.1 550.4 523.3 551.9 533.6 543.6C598.5 490.7 640 410.2 640 320C640 229.8 598.5 149.2 533.6 96.5zM473.1 171C462.8 162.6 447.7 164.2 439.3 174.5C430.9 184.8 432.5 199.9 442.8 208.3C475.3 234.7 496 274.9 496 320C496 365.1 475.3 405.3 442.8 431.8C432.5 440.2 431 455.3 439.3 465.6C447.6 475.9 462.8 477.4 473.1 469.1C516.3 433.9 544 380.2 544 320.1C544 260 516.3 206.3 473.1 171.1zM412.6 245.5C402.3 237.1 387.2 238.7 378.8 249C370.4 259.3 372 274.4 382.3 282.8C393.1 291.6 400 305 400 320C400 335 393.1 348.4 382.3 357.3C372 365.7 370.5 380.8 378.8 391.1C387.1 401.4 402.3 402.9 412.6 394.6C434.1 376.9 448 350.1 448 320C448 289.9 434.1 263.1 412.6 245.5zM80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416z"/></svg>`;

    const muteButton = document.createElement("button");
    muteButton.innerHTML = muted ? volumeMutedSvg : volumeHighSvg;
    muteButton.className = "mute-toggle";
    muteButton.title = "Toggle Sound";
    muteButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!synth) synth = new SynthPlayer();
      synth.ctx.resume();
      muted = !muted;
      muteButton.innerHTML = muted ? volumeMutedSvg : volumeHighSvg;
    });
    topRow.appendChild(muteButton);
  },
});

const gameId = location.pathname.split("/").filter(Boolean)[1]; // /game/<id>
const ws = new WebSocket(
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/${gameId}`,
);

ws.addEventListener("open", () => console.log("ws open"));
ws.addEventListener("close", () => console.log("ws close"));
ws.addEventListener("error", (e) => console.log("ws error", e));

function applyPresence(presence) {
  board.setActive(!!(presence?.player1Connected && presence?.player2Connected));
}

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "init": {
      board.setRole(msg.role);
      const { rows, columns } = msg.state.dimensions;
      board.build(rows, columns);
      board.loadState(msg.state.board);
      board.setTurn(msg.state.turn);
      applyPresence(msg.presence);
      if (msg.state.line) {
        board.highlightLine(msg.state.line);
        board.setGameOver(true);
      }
      console.log(`received: ${JSON.stringify(msg)}`);
      break;
    }

    case "presence": {
      applyPresence(msg.presence);
      if (msg.event === "connected") {
        playSound(
          [
            { freq: "C4", duration: 0.1 },
            { freq: "G4", duration: 0.15 },
          ],
          { waveform: "sine", gain: 0.2 },
        );
      } else {
        playSound(
          [
            { freq: "G4", duration: 0.1 },
            { freq: "C4", duration: 0.15 },
          ],
          { waveform: "sine", gain: 0.2 },
        );
      }
      console.log(`received: ${JSON.stringify(msg)}`);
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
            ? [{ freq: "C5", duration: 0.15 }, { freq: "E5", duration: 0.15 }, { freq: "G5", duration: 0.25 }]
            : [{ freq: "G4", duration: 0.15 }, { freq: "E4", duration: 0.15 }, { freq: "C4", duration: 0.3 }],
          { waveform: "sine", gain: 0.25 },
        );
      } else {
        playSound([{ freq: msg.role === "player1" ? "C5" : "E5", duration: 0.12 }], { waveform: "triangle", gain: 0.25 });
      }
      board.setTurn(msg.role === "player1" ? "player2" : "player1");
      break;
    }

    case "error":
      playSound(
        [
          { freq: "A3", duration: 0.15 },
          { freq: "Ab3", duration: 0.2 },
        ],
        { waveform: "sawtooth", gain: 0.2 },
      );
      console.log(`received: ${JSON.stringify(msg)}`);
      break;

    default:
      console.log(`unhandled message: ${JSON.stringify(msg)}`);
  }
});
