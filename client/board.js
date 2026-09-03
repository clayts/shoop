"use strict";

const CSS_VARIABLES = {
  cellSize: "--cell-size",
  cellScale: "--cell-scale",
  waveIndex: "--wave-index",
  previewScale: "--preview-scale",
  discColumn: "--col",
  discRow: "--row",
  presenceDotScale: "--dot-scale",
  highlightLineX: "--x",
  highlightLineY: "--y",
  highlightLineAngle: "--angle",
};

export const ICONS = {
  restart: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M544.1 256L552 256C565.3 256 576 245.3 576 232L576 88C576 78.3 570.2 69.5 561.2 65.8C552.2 62.1 541.9 64.2 535 71L483.3 122.8C439 86.1 382 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6C143.2 199.5 223.3 128 320 128C364.4 128 405.2 143 437.7 168.3L391 215C384.1 221.9 382.1 232.2 385.8 241.2C389.5 250.2 398.3 256 408 256L544.1 256zM573.5 356.5C576 339 563.8 322.8 546.4 320.3C529 317.8 512.7 330 510.2 347.4C496.9 440.4 416.8 511.9 320.1 511.9C275.7 511.9 234.9 496.9 202.4 471.6L249 425C255.9 418.1 257.9 407.8 254.2 398.8C250.5 389.8 241.7 384 232 384L88 384C74.7 384 64 394.7 64 408L64 552C64 561.7 69.8 570.5 78.8 574.2C87.8 577.9 98.1 575.8 105 569L156.8 517.2C201 553.9 258 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg>`,
  person: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z"/></svg>`,
  link: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M451.5 160C434.9 160 418.8 164.5 404.7 172.7C388.9 156.7 370.5 143.3 350.2 133.2C378.4 109.2 414.3 96 451.5 96C537.9 96 608 166 608 252.5C608 294 591.5 333.8 562.2 363.1L491.1 434.2C461.8 463.5 422 480 380.5 480C294.1 480 224 410 224 323.5C224 322 224 320.5 224.1 319C224.6 301.3 239.3 287.4 257 287.9C274.7 288.4 288.6 303.1 288.1 320.8C288.1 321.7 288.1 322.6 288.1 323.4C288.1 374.5 329.5 415.9 380.6 415.9C405.1 415.9 428.6 406.2 446 388.8L517.1 317.7C534.4 300.4 544.2 276.8 544.2 252.3C544.2 201.2 502.8 159.8 451.7 159.8zM307.2 237.3C305.3 236.5 303.4 235.4 301.7 234.2C289.1 227.7 274.7 224 259.6 224C235.1 224 211.6 233.7 194.2 251.1L123.1 322.2C105.8 339.5 96 363.1 96 387.6C96 438.7 137.4 480.1 188.5 480.1C205 480.1 221.1 475.7 235.2 467.5C251 483.5 269.4 496.9 289.8 507C261.6 530.9 225.8 544.2 188.5 544.2C102.1 544.2 32 474.2 32 387.7C32 346.2 48.5 306.4 77.8 277.1L148.9 206C178.2 176.7 218 160.2 259.5 160.2C346.1 160.2 416 230.8 416 317.1C416 318.4 416 319.7 416 321C415.6 338.7 400.9 352.6 383.2 352.2C365.5 351.8 351.6 337.1 352 319.4C352 318.6 352 317.9 352 317.1C352 283.4 334 253.8 307.2 237.5z"/></svg>`,
  cross: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/></svg>`,
  tick: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6"/></svg>`,
  volumeMuted: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416zM399 239C389.6 248.4 389.6 263.6 399 272.9L446 319.9L399 366.9C389.6 376.3 389.6 391.5 399 400.8C408.4 410.1 423.6 410.2 432.9 400.8L479.9 353.8L526.9 400.8C536.3 410.2 551.5 410.2 560.8 400.8C570.2 391.4 570.2 376.2 560.8 366.9L513.8 319.9L560.8 272.9C570.2 263.5 570.2 248.3 560.8 239C551.4 229.7 536.2 229.6 526.9 239L479.9 286L432.9 239C423.5 229.6 408.3 229.6 399 239z"/></svg>`,
  volumeHigh: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="1em" height="1em" fill="currentColor"><path d="M533.6 96.5C523.3 88.1 508.2 89.7 499.8 100C491.4 110.3 493 125.4 503.3 133.8C557.5 177.8 592 244.8 592 320C592 395.2 557.5 462.2 503.3 506.3C493 514.7 491.5 529.8 499.8 540.1C508.1 550.4 523.3 551.9 533.6 543.6C598.5 490.7 640 410.2 640 320C640 229.8 598.5 149.2 533.6 96.5zM473.1 171C462.8 162.6 447.7 164.2 439.3 174.5C430.9 184.8 432.5 199.9 442.8 208.3C475.3 234.7 496 274.9 496 320C496 365.1 475.3 405.3 442.8 431.8C432.5 440.2 431 455.3 439.3 465.6C447.6 475.9 462.8 477.4 473.1 469.1C516.3 433.9 544 380.2 544 320.1C544 260 516.3 206.3 473.1 171.1zM412.6 245.5C402.3 237.1 387.2 238.7 378.8 249C370.4 259.3 372 274.4 382.3 282.8C393.1 291.6 400 305 400 320C400 335 393.1 348.4 382.3 357.3C372 365.7 370.5 380.8 378.8 391.1C387.1 401.4 402.3 402.9 412.6 394.6C434.1 376.9 448 350.1 448 320C448 289.9 434.1 263.1 412.6 245.5zM80 416L128 416L262.1 535.2C268.5 540.9 276.7 544 285.2 544C304.4 544 320 528.4 320 509.2L320 130.8C320 111.6 304.4 96 285.2 96C276.7 96 268.5 99.1 262.1 104.8L128 224L80 224C53.5 224 32 245.5 32 272L32 368C32 394.5 53.5 416 80 416z"/></svg>`,
  spinner: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" fill="currentColor"><!--!Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2026 Fonticons, Inc.--><path d="M272 112C272 85.5 293.5 64 320 64C346.5 64 368 85.5 368 112C368 138.5 346.5 160 320 160C293.5 160 272 138.5 272 112zM272 528C272 501.5 293.5 480 320 480C346.5 480 368 501.5 368 528C368 554.5 346.5 576 320 576C293.5 576 272 554.5 272 528zM112 272C138.5 272 160 293.5 160 320C160 346.5 138.5 368 112 368C85.5 368 64 346.5 64 320C64 293.5 85.5 272 112 272zM480 320C480 293.5 501.5 272 528 272C554.5 272 576 293.5 576 320C576 346.5 554.5 368 528 368C501.5 368 480 346.5 480 320zM139 433.1C157.8 414.3 188.1 414.3 206.9 433.1C225.7 451.9 225.7 482.2 206.9 501C188.1 519.8 157.8 519.8 139 501C120.2 482.2 120.2 451.9 139 433.1zM139 139C157.8 120.2 188.1 120.2 206.9 139C225.7 157.8 225.7 188.1 206.9 206.9C188.1 225.7 157.8 225.7 139 206.9C120.2 188.1 120.2 157.8 139 139zM501 433.1C519.8 451.9 519.8 482.2 501 501C482.2 519.8 451.9 519.8 433.1 501C414.3 482.2 414.3 451.9 433.1 433.1C451.9 414.3 482.2 414.3 501 433.1z"><animateTransform attributeName="transform" type="rotate" from="0 320 320" to="360 320 320" dur="2s" repeatCount="indefinite"/></path></svg>`,


  // <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50" width="1em" height="1em" fill="none" stroke="currentColor" stroke-linecap="round"><circle cx="25" cy="25" r="20" stroke-width="4" stroke-opacity="0.25"/><path d="M25 5a20 20 0 0 1 20 20" stroke-width="4"><animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite"/></path></svg>
};

// Reads a numeric CSS custom property from the document root, falling back
// to `fallback` if it isn't set or isn't a number.
function readRootCssNumber(propertyName, fallback) {
  const value = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(propertyName));
  return Number.isNaN(value) ? fallback : value;
}

// ============================================================================
// Board: renders the grid, the toolbar rows, and the preview/placement discs.
// Also tracks the small bits of game/session state (role, turn, local vs.
// networked, spectating) needed to answer "is it my turn?" and "should this
// connection's role follow the turn?".
// ============================================================================
export class Board {
  constructor(container, { onColumnClick, onRestart, onConstructTopRow: onConstructTopRow }) {
    this.container = container;
    this.wrapper = container.parentElement;
    this.onRestart = onRestart;
    this.onConstructTopRow = onConstructTopRow;

    this.padding = readRootCssNumber("--padding", 0);
    this.gap = readRootCssNumber("--gap", 0);
    this.discScale = readRootCssNumber("--disc-scale", 0.85);
    this.scaleDurationMs = readRootCssNumber("--scale-duration", 0.1) * 1000;
    this.cellSize = 0;

    this.role = null;
    this.currentTurn = null;
    this.active = false; // both players connected
    this.gameOver = false;
    this.isLocal = false; // "pass and play": one connection moves for both colours

    this.container.addEventListener("click", (event) => {
      // Which column (if any) the click landed in.
      const bounds = this.container.getBoundingClientRect();
      const column = Math.floor((event.clientX - bounds.left) / (this.cellSize + this.gap));
      if (column >= 0 && column < this.columns) onColumnClick(column);
    });

    this.resizeSettleMs = 150; // how long to wait after the last resize event before resuming animations
    this.resizeSettleTimer = null;

    this.handleResize = () => {
      document.body.classList.add("resizing");
      window.clearTimeout(this.resizeSettleTimer);
      this.resizeSettleTimer = window.setTimeout(() => {
        document.body.classList.remove("resizing");
      }, this.resizeSettleMs);

      this.layout();
    };
    window.addEventListener("resize", this.handleResize);
  }

  get centeredColumn() {
    return (this.columns - 1) / 2;
  }

  setRole(role) {
    this.role = role;
  }

  // Called once, from the server's initial message, to record whether this
  // is a local ("pass and play") game, then sets the starting role.
  setGameMode(local, role) {
    this.isLocal = !!local;
    this.setRole(role);
  }

  // Sets whose turn it is and refreshes the preview. In local ("pass and
  // play") games, role is kept glued to whichever side is currently up, so
  // clicks/preview/colours always follow the active player instead of a
  // fixed side; the preview is also recreated so its scale-in animation
  // plays for each turn.
  applyTurn(turn) {
    if (this.isLocal) this.setRole(turn);
    this.setTurn(turn, { recreatePreview: this.isLocal });
  }

  setTurn(turn, { recreatePreview = false } = {}) {
    const turnChanged = this.currentTurn !== turn;
    this.currentTurn = turn;

    if (recreatePreview && turnChanged) {
      this.previewDisc?.remove();
      this.previewDisc = null;
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
    const isPlayer1Connected = !!presence?.player1Connected;
    const isPlayer2Connected = !!presence?.player2Connected;

    // Player dots always stay visible: while waiting for a player to connect,
    // show a spinner in place of their icon rather than hiding the dot.
    this.presenceElements.player1.style.setProperty(CSS_VARIABLES.presenceDotScale, 1);
    this.presenceElements.player1.innerHTML = isPlayer1Connected ? ICONS.person : ICONS.spinner;

    this.presenceElements.player2.style.setProperty(CSS_VARIABLES.presenceDotScale, 1);
    this.presenceElements.player2.innerHTML = isPlayer2Connected ? ICONS.person : ICONS.spinner;

    // If we're mid local-reconnect, keep showing our own spinner regardless
    // of what the server last reported (it doesn't know we've dropped yet).
    if (this.reconnecting && this.role) {
      this.presenceElements[this.role].style.setProperty(CSS_VARIABLES.presenceDotScale, 1);
      this.presenceElements[this.role].innerHTML = ICONS.spinner;
    }
  }

  // Updates connection/active state and the presence dots together.
  applyPresence(presence) {
    this.lastPresence = presence;
    this.setActive(!!(presence?.player1Connected && presence?.player2Connected));
    this.updatePresence(presence);
  }

  // Called when this client's own socket drops/reconnects (as opposed to the
  // opponent's, which comes from the server via applyPresence). Forces our
  // own presence dot to the spinner and shows a "Reconnecting..." label in
  // the bottom row until the connection is restored.
  setReconnecting(reconnecting) {
    this.reconnecting = reconnecting;

    if (this.reconnectingLabel) {
      this.reconnectingLabel.style.display = reconnecting ? "inline-flex" : "none";
    }

    if (reconnecting && this.role) {
      this.presenceElements[this.role].style.setProperty(CSS_VARIABLES.presenceDotScale, 1);
      this.presenceElements[this.role].innerHTML = ICONS.spinner;
    } else if (!reconnecting && this.lastPresence) {
      // Restore whatever the server last told us, now that we're not
      // forcing our own dot to the spinner anymore.
      this.updatePresence(this.lastPresence);
    }
  }

  // Builds an empty rows x columns board, plus an invisible row above (toolbar)
  // and below (restart control + hover preview). Row 0 is the bottom row.
  construct(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.stacks = Array.from({ length: columns }, () => []);
    this.gameOver = false;

    this.container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    const topRow = document.createElement("div");
    topRow.className = "top-row";
    topRow.style.gridColumn = "1 / -1";

    // Presence status (left side): dots for player1 and player2.
    const presenceStatus = document.createElement("div");
    presenceStatus.className = "presence-status";
    presenceStatus.innerHTML = `
      <span class="presence-dot presence-player1">${ICONS.spinner}</span>
      <span class="presence-dot presence-player2">${ICONS.spinner}</span>
    `;
    topRow.appendChild(presenceStatus);
    this.presenceElements = {
      player1: presenceStatus.querySelector(".presence-player1"),
      player2: presenceStatus.querySelector(".presence-player2"),
    };

    // Right side (link/mute buttons): populated by the caller.
    const rightGroup = document.createElement("div");
    rightGroup.className = "top-row-right";
    topRow.appendChild(rightGroup);
    this.onConstructTopRow?.(rightGroup);
    fragment.appendChild(topRow);

    // Cells, bottom row first so the entrance wave animates upward.
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.column = columnIndex;
        cell.dataset.row = rows - 1 - rowIndex;
        cell.style.setProperty(CSS_VARIABLES.waveIndex, rows - 1 - rowIndex); // bottom row animates first
        cell.style.setProperty(CSS_VARIABLES.cellScale, 0);
        fragment.appendChild(cell);
      }
    }

    // Bottom row: the restart button, hidden until the game ends.
    const bottomRow = document.createElement("div");
    bottomRow.className = "bottom-row";
    bottomRow.style.gridColumn = "1 / -1";

    this.restartButton = document.createElement("button");
    this.restartButton.className = "restart-toggle";
    this.restartButton.title = "Restart game";
    this.restartButton.style.display = "none";
    this.restartButton.innerHTML = ICONS.restart;

    this.restartButton.addEventListener("click", (event) => {
      event.stopPropagation();
      this.onRestart?.();
    });

    bottomRow.appendChild(this.restartButton);

    this.reconnectingLabel = document.createElement("span");
    this.reconnectingLabel.className = "reconnecting-label";
    this.reconnectingLabel.textContent = "Reconnecting...";
    this.reconnectingLabel.style.display = this.reconnecting ? "inline-flex" : "none";
    bottomRow.appendChild(this.reconnectingLabel);

    fragment.appendChild(bottomRow);

    this.container.appendChild(fragment);

    this.previewDisc = null;
    this.highlightedLineElement = null;
    this.highlightedLineCells = null;

    this.layout();

    // Commit the scale-0 state, then flip to 1 so the transition (with each
    // cell's --wave-index delay) actually plays as a bottom-to-top wave.
    void this.container.offsetHeight;
    this.container
      .querySelectorAll(".cell")
      .forEach((cell) => cell.style.setProperty(CSS_VARIABLES.cellScale, 1));
  }

  // Shrinks existing cells/discs to nothing, then rebuilds an empty board
  // (calling onRebuilt once it's ready) which grows back in via construct()'s
  // usual entrance wave.
  restart(rows, columns, onRebuilt) {
    this.clearHighlight();

    const cells = this.container.querySelectorAll(".cell");
    const discs = this.container.querySelectorAll(".disc");

    if (cells.length === 0 && discs.length === 0) {
      this.construct(rows, columns);
      onRebuilt?.();
      return;
    }

    cells.forEach((cell) => cell.style.setProperty(CSS_VARIABLES.cellScale, 0));
    discs.forEach((disc) => disc.style.setProperty(CSS_VARIABLES.previewScale, 0));

    window.setTimeout(() => {
      this.construct(rows, columns);
      onRebuilt?.();
    }, this.scaleDurationMs);
  }

  // Instantly (no transition) removes any highlighted cells and the
  // highlighted-line, e.g. right before a restart.
  clearHighlight() {
    this.container
      .querySelectorAll(".cell.highlighted")
      .forEach((cell) => cell.classList.remove("highlighted"));
    this.highlightedLineElement?.remove();
    this.highlightedLineElement = null;
    this.highlightedLineCells = null;
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

  // Shifts the column's existing discs up one row, then drops a new disc in:
  // it starts centered (right where the preview sits), slides horizontally
  // into the target column, and only once that arrives does it fall.
  playDisc(column, role) {
    const stack = this.stacks[column];
    stack.forEach((disc, row) => this.positionDisc(disc, column, row + 1));

    const disc = this.createDisc(role);
    this.positionDisc(disc, this.centeredColumn, -1); // start centered, in the invisible row
    void disc.offsetHeight; // force reflow so the slide below actually animates
    this.positionDisc(disc, column, -1); // slide horizontally to the target column

    window.setTimeout(() => {
      // Look up the row at fire time (rather than assuming 0): if another
      // disc landed in this column in the meantime, this one has already
      // been bumped up, and this must land it there instead of undoing that.
      this.positionDisc(disc, column, stack.indexOf(disc));
    }, this.scaleDurationMs);

    stack.unshift(disc);
  }

  // Shows (or hides) the static, centered preview disc. It never tracks the
  // pointer — it always sits above the middle column while it's my turn.
  // The scale-in animation only plays the moment the preview (re)appears.
  showPreview() {
    // My turn only when the game is active, not yet over, and it's my role's turn.
    const isMyTurn = this.active && !this.gameOver && this.role !== null && this.role === this.currentTurn;
    if (!isMyTurn) {
      this.previewDisc?.remove();
      this.previewDisc = null;
      return;
    }

    // Already shown: just keep its colour in sync (local "pass and play"
    // flips role each turn; position never needs to change).
    if (this.previewDisc) {
      this.previewDisc.className = `disc preview ${this.role}`;
      return;
    }

    const disc = document.createElement("div");
    disc.className = `disc preview ${this.role}`;
    disc.style.setProperty(CSS_VARIABLES.previewScale, 0);

    // Insert at the very front (rather than appendChild) so the preview
    // always paints beneath every other disc — including a prior preview,
    // in case one briefly outlives this one during a turn change.
    this.container.insertBefore(disc, this.container.firstChild);
    this.positionDisc(disc, this.centeredColumn, -1);

    this.previewDisc = disc;

    // Force the browser to commit the initial scale of zero, then grow in.
    void disc.offsetHeight;
    disc.style.setProperty(CSS_VARIABLES.previewScale, 1);
  }

  highlightLine(line) {
    line.forEach(({ column, row }) => {
      this.container
        .querySelector(`.cell[data-column="${column}"][data-row="${row}"]`)
        .classList.add("highlighted");
    });

    this.highlightedLineCells = line;
    this.drawHighlightedLine();
  }

  // Pixel center of a cell, in the same coordinate space positionDisc uses.
  cellCenter(column, row) {
    return {
      x: column * (this.cellSize + this.gap) + this.cellSize / 2,
      y: (this.rows - row) * (this.cellSize + this.gap) + this.cellSize / 2,
    };
  }

  // (Re)draws the white highlighted-line between the first and last cell of
  // the winning line. Called after a win and again on every layout() so it
  // tracks the board through resizes.
  drawHighlightedLine() {
    if (!this.highlightedLineCells) return;

    const firstCell = this.highlightedLineCells[0];
    const lastCell = this.highlightedLineCells[this.highlightedLineCells.length - 1];
    const startPoint = this.cellCenter(firstCell.column, firstCell.row);
    const endPoint = this.cellCenter(lastCell.column, lastCell.row);

    const deltaX = endPoint.x - startPoint.x;
    const deltaY = endPoint.y - startPoint.y;
    const length = Math.hypot(deltaX, deltaY);
    const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI;
    const thickness = (this.cellSize * (1 - this.discScale)) / 2; // matches CSS: (cell size - disc size) / 2

    if (!this.highlightedLineElement) {
      this.highlightedLineElement = document.createElement("div");
      this.highlightedLineElement.className = "highlighted-line";
      this.container.insertBefore(this.highlightedLineElement, this.container.firstChild);
    }

    this.highlightedLineElement.style.width = `${length}px`;
    this.highlightedLineElement.style.setProperty(CSS_VARIABLES.highlightLineX, `${startPoint.x}px`);
    this.highlightedLineElement.style.setProperty(CSS_VARIABLES.highlightLineY, `${startPoint.y - thickness / 2}px`);
    this.highlightedLineElement.style.setProperty(CSS_VARIABLES.highlightLineAngle, `${angle}deg`);
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

    this.container.style.setProperty(CSS_VARIABLES.cellSize, `${this.cellSize}px`);
    this.container.style.gridTemplateColumns = `repeat(${this.columns}, ${this.cellSize}px)`;
    this.container.style.gridTemplateRows = `repeat(${totalRows}, ${this.cellSize}px)`;
    this.container.style.width = `${this.cellSize * this.columns + this.gap * (this.columns - 1)}px`;
    this.container.style.height = `${this.cellSize * totalRows + this.gap * (totalRows - 1)}px`;

    this.stacks.forEach((stack, column) => stack.forEach((disc, row) => this.positionDisc(disc, column, row)));

    if (this.previewDisc) {
      this.positionDisc(this.previewDisc, this.centeredColumn, -1);
    }

    this.drawHighlightedLine();
  }

  destroy() {
    window.removeEventListener("resize", this.handleResize);
    window.clearTimeout(this.resizeSettleTimer);
  }

  createDisc(role) {
    const disc = document.createElement("div");
    disc.className = `disc ${role}`;
    this.container.appendChild(disc);
    return disc;
  }

  positionDisc(disc, column, row) {
    disc.style.setProperty(CSS_VARIABLES.discColumn, column);
    disc.style.setProperty(CSS_VARIABLES.discRow, this.rows - row);
  }
}
