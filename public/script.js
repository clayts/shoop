class Board {
  constructor(container, { onColumnHover, onColumnLeave, onColumnClick }) {
    this.container = container;
    this.wrapper = container.parentElement;

    const rootStyles = getComputedStyle(document.documentElement);
    this.padding = parseFloat(rootStyles.getPropertyValue("--padding")) || 0;
    this.gap = parseFloat(rootStyles.getPropertyValue("--gap")) || 0;
    this.cellSize = 0;

    this.container.addEventListener("mousemove", (e) => {
      const column = this.columnAt(e);
      if (column !== null) onColumnHover(column);
    });
    this.container.addEventListener("mouseleave", () => onColumnLeave());
    this.container.addEventListener("click", (e) => {
      const column = this.columnAt(e);
      if (column !== null) onColumnClick(column);
    });

    this.handleResize = () => this.layout();
    window.addEventListener("resize", this.handleResize);
  }

  // Builds an empty rows x columns board. Row 0 is the bottom row.
  build(rows, columns) {
    this.rows = rows;
    this.columns = columns;
    this.stacks = Array.from({ length: columns }, () => []);
    this.cellsByColumn = Array.from({ length: columns }, () => []);

    this.container.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < columns; c++) {
        const row = rows - 1 - r;
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.dataset.column = c;
        cell.dataset.row = row;
        this.cellsByColumn[c][row] = cell;
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
  dropDisc(column, role) {
    const stack = this.stacks[column];
    stack.forEach((disc, row) => this.positionDisc(disc, column, row + 1));

    const disc = this.createDisc(role);
    this.positionDisc(disc, column, -1); // start in the invisible row
    void disc.offsetHeight; // force reflow so the next move animates
    this.positionDisc(disc, column, 0);
    stack.unshift(disc);
  }

  // Shows the preview over a specific column.
  showPreview(column, role) {
    this.previewColumn = column;
    this.previewDisc.className = `circle preview ${role}`;
    this.positionDisc(this.previewDisc, column, -1);
    this.previewDisc.style.display = "block";
  }

  // Shows the preview centered in the invisible row, for when the mouse isn't over a column.
  showCenteredPreview(role) {
    this.showPreview((this.columns - 1) / 2, role);
  }

  hidePreview() {
    this.previewColumn = null;
    this.previewDisc.style.display = "none";
  }

  highlightWinningLine(line) {
    line.forEach(({ column, row }) => {
      this.cellsByColumn[column][row].classList.add("winning");
    });
  }

  // Recomputes cell size to fill the wrapper, keeping cells square and
  // reserving one invisible row at the bottom for the hover preview.
  layout() {
    const availableWidth = this.wrapper.clientWidth - this.padding * 2;
    const availableHeight = this.wrapper.clientHeight - this.padding * 2;

    const widthPerCell = (availableWidth - this.gap * (this.columns - 1)) / this.columns;
    const heightPerCell = (availableHeight - this.gap * this.rows) / (this.rows + 1);
    this.cellSize = Math.max(0, Math.min(widthPerCell, heightPerCell));

    this.container.style.gridTemplateColumns = `repeat(${this.columns}, ${this.cellSize}px)`;
    this.container.style.gridTemplateRows = `repeat(${this.rows + 1}, ${this.cellSize}px)`;
    this.container.style.width = `${this.cellSize * this.columns + this.gap * (this.columns - 1)}px`;
    this.container.style.height = `${this.cellSize * (this.rows + 1) + this.gap * this.rows}px`;

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
    const size = this.cellSize * 0.7;
    const offset = this.cellSize * 0.15;
    disc.style.width = disc.style.height = `${size}px`;
    disc.style.transform =
      `translate(${column * (this.cellSize + this.gap) + offset}px, ${(this.rows - 1 - row) * (this.cellSize + this.gap) + offset}px)`;
  }

  columnAt(event) {
    const rect = this.container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const column = Math.floor(x / (this.cellSize + this.gap));
    return column >= 0 && column < this.columns ? column : null;
  }
}

// --- Game wiring: role, turn tracking, and the websocket connection ---

let myRole = null;
let currentTurn = "player1";
const isMyTurn = () => myRole === currentTurn;

// Shows the centered preview if it's this client's turn, otherwise hides it.
// Called whenever the turn changes, so the preview appears without needing mouse movement.
function updateTurnPreview() {
  if (isMyTurn()) {
    board.showCenteredPreview(myRole);
  } else {
    board.hidePreview();
  }
}

const board = new Board(document.getElementById("grid"), {
  onColumnHover: (column) => isMyTurn() && board.showPreview(column, myRole),
  onColumnLeave: () => isMyTurn() && board.showCenteredPreview(myRole),
  onColumnClick: (column) => {
    if (!isMyTurn()) return;
    const msg = { type: "move", payload: { column } };
    console.log(`sent: ${JSON.stringify(msg)}`);
    ws.send(JSON.stringify(msg));
  },
});

const gameId = location.pathname.split("/").filter(Boolean)[1]; // /game/<id>
const proto = location.protocol === "https:" ? "wss" : "ws";
const ws = new WebSocket(`${proto}://${location.host}/ws/${gameId}`);

ws.addEventListener("open", () => {});
ws.addEventListener("close", () => {});
ws.addEventListener("error", () => {});

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);

  switch (msg.type) {
    case "init": {
      myRole = msg.role;
      currentTurn = msg.state.turn;
      const { rows, columns } = msg.state.dimensions;
      board.build(rows, columns);
      board.loadState(msg.state.board);
      updateTurnPreview();
      console.log(`received: ${JSON.stringify(msg)}`);
      break;
    }

    case "presence":
      console.log(`received: ${JSON.stringify(msg)}`);
      break;

    case "move":
      board.dropDisc(msg.payload.column, currentTurn);
      if (msg.line) board.highlightWinningLine(msg.line);
      currentTurn = currentTurn === "player1" ? "player2" : "player1";
      updateTurnPreview();
      console.log(`received: ${JSON.stringify(msg)}`);
      break;

    case "error":
      console.log(`received: ${JSON.stringify(msg)}`);
      break;

    default:
      console.log(`unhandled message: ${JSON.stringify(msg)}`);
  }
});
