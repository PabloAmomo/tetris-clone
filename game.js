const [BOARD, SCORE, LEVEL, NEXTPIECE] = ['board', 'score', 'level', 'next-piece'].map((id) => document.getElementById(id));
const BOARD_SIZE = { width: 10, height: 24 };
const INITIAL_STATE = { board: [[]], score: 0, level: 1, speed: 1000, lines: 0, nextPiece: '', gameOver: false, piece: null, lastTime: 0, restartKey: 'r' };
const GAME_STATE = { ...INITIAL_STATE };
const MOVEMENTS = { DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', DROP: ' ' };
const SCORES = [0, 40, 100, 300, 1200]; // Max. 4 lines at once (Because the max piece height is 4)
const EMPTY_PIECE = { piece: null, rotation: 0, x: 0, y: 0, pieceEl: null, refresh: false, maxRotation: 0 };

const init = () => {
  // Add event listeners
  document.addEventListener('keydown', (e) => keyPressed(e.key, e));
  document.getElementById('board-container').addEventListener('click', (e) => keyPressed(GAME_STATE.restartKey, e));
  document.querySelectorAll('.button[data-key]').forEach((button) => button.addEventListener('click', (e) => keyPressed(button.getAttribute('data-key'), e)));
    
  if (isMobile()) {
    const buttons = document.getElementById('buttons');
    buttons.classList.remove('d-none');
    buttons.classList.add('d-flex');
  }

  // Start game
  startGame();
};



const startGame = () => {
  // Reset game state
  Object.assign(GAME_STATE, { ...INITIAL_STATE, piece: { ...EMPTY_PIECE }, nextPiece: { ...EMPTY_PIECE } });

  // Update stats
  updateStats();

  // Clear board and reset game over
  GAME_STATE.board = [...Array(BOARD_SIZE.height).keys()].map((i) => [...Array(BOARD_SIZE.width).keys()].map((i) => 0));
  BOARD.innerHTML = '';
  document.body.classList.remove('game-over');
  // Create first piece
  Object.assign(GAME_STATE.nextPiece, { ...EMPTY_PIECE, ...newRandomPiece({ width: GAME_STATE.board[0].length }) });
  nextPiece();

  // Start loop
  loop();
};

const checkCompleteRows = () => {
  // Check if line is complete and remove it
  let lineCount = 0;
  for (let y = 0; y < GAME_STATE.board.length; y++) {
    if (GAME_STATE.board[y].join('').indexOf('0') == -1) {
      // Remove cells and push down above cells
      const cells = document.querySelectorAll('.persisted.cell.filled');
      cells.forEach((cell) => {
        const posY = parseInt(cell.getAttribute('data-y'));
        if (posY == y) cell.remove();
        else if (posY < y) { cell.setAttribute('data-y', posY + 1); cell.style.top = `${posY + 1}em`; }
      });
      GAME_STATE.board.splice(y, 1);
      GAME_STATE.board.unshift([...Array(GAME_STATE.board[0].length).keys()].map((i) => 0));

      // Count lines removed (For score and level)
      GAME_STATE.lines++;
      lineCount++;
    }
  }

  // Add score (Using original Nintendo scoring system)
  GAME_STATE.score += SCORES[lineCount];

  // Return lines removed
  return lineCount;
};

const updateBoardCell = (piece, cell, offsetX, offsetY) => {
  // Update board cell position
  const absoluteX = piece.x + offsetX;
  const absoluteY = piece.y + offsetY;
  GAME_STATE.board[absoluteY][absoluteX] = piece.piece;
  cell.classList.add('position-absolute', 'persisted');
  cell.setAttribute('data-y', absoluteY);
  cell.style.top = `${absoluteY}em`;
  cell.style.left = `${absoluteX}em`;
  BOARD.appendChild(cell);
};

const nextPiece = () => {
  // Use next piece and create a new one
  GAME_STATE.lastTime = Date.now();
  GAME_STATE.nextPiece.pieceEl && GAME_STATE.nextPiece.pieceEl.remove();
  GAME_STATE.nextPiece.pieceEl = null;
  GAME_STATE.piece = JSON.parse(JSON.stringify(GAME_STATE.nextPiece));
  Object.assign(GAME_STATE.nextPiece, { ...EMPTY_PIECE, ...newRandomPiece({ width: GAME_STATE.board[0].length }) });
  NEXTPIECE.innerHTML = '';
  drawPiece({ ...GAME_STATE.nextPiece, x: 0, y: 0 }, NEXTPIECE);
  drawPiece(GAME_STATE.piece, BOARD);
};

const loop = () => {
  // If game over, stop loop
  if (GAME_STATE.gameOver) return;

  // Loop
  window.requestAnimationFrame(loop);

  // Game started - add new random piece
  if (GAME_STATE.piece.piece === null) nextPiece();

  // Check if piece is at end
  const pieceAtEnd = checkCollition({ ...GAME_STATE.piece, y: GAME_STATE.piece.y + 1 });

  // Check if need to move piece down
  const isTimeout = Date.now() - GAME_STATE.lastTime > GAME_STATE.speed;

  // Move piece down
  if (isTimeout && !pieceAtEnd) {
    GAME_STATE.lastTime = Date.now();
    keyPressed(MOVEMENTS.DOWN);
    drawPiece(GAME_STATE.piece, BOARD);
    return;
  }

  // Update piece position
  drawPiece(GAME_STATE.piece, BOARD);

  // Check if game is over
  if (pieceAtEnd && GAME_STATE.piece.y === 0) {
    GAME_STATE.gameOver = true;
    document.body.classList.add('game-over');
    return;
  }

  // Persist piece in board and add new piece
  if (isTimeout && pieceAtEnd) {
    const piece = getPiece({ ...GAME_STATE.piece });

    // Save piece in board
    for (let y = 0; y < piece.height; y++) {
      for (let x = 0; x < piece.width; x++) {
        if (piece.piece[y][x] === 1) {
          // Create cell with the same current piece color
          updateBoardCell(GAME_STATE.piece, createPieceCell(GAME_STATE.piece.piece, true), x, y);
        }
      }
    }

    // Remove current piece and add new piece
    // GAME_STATE.lastTime = Date.now();
    GAME_STATE.piece.pieceEl.remove();
    nextPiece();
    // Object.assign(GAME_STATE.piece, newRandomPiece({ width: GAME_STATE.board[0].length }));
    drawPiece(GAME_STATE.piece, BOARD);
  }

  // Check finished lines and score
  const rowsDeleted = checkCompleteRows();

  // If no lines deleted, then not need to update stats or change level
  if (rowsDeleted === 0) return;

  // Check if need to increase level and update next level
  if (GAME_STATE.lines > 10 * GAME_STATE.level) {
    GAME_STATE.level++;
    GAME_STATE.lines = 0;
    GAME_STATE.speed -= 100;
    if (GAME_STATE.speed < 100) GAME_STATE.speed = 100;
  }

  // Update stats
  updateStats();
};

const createDiv = (...className) => {
  // Create div element with class names
  const div = document.createElement('div');
  div.classList.add(...className);
  return div;
};

const updateStats = () => {
  // Update game stats (score and level)
  SCORE.innerHTML = completeWithZero(GAME_STATE.score, 5);
  LEVEL.innerHTML = completeWithZero(GAME_STATE.level, 3);
};

const checkCollition = ({ piece, x, y, rotation }) => {
  // Get piece
  const { piece: rPiece, width, height } = getPiece({ piece, rotation });

  // Check if piece is out of board
  const bWidth = GAME_STATE.board[0].length;
  const bHeight = GAME_STATE.board.length;
  if (x < 0 || x > bWidth - width || y > bHeight - height || x + width - bWidth > 0 || y + height - bHeight > 0) return true;

  // Check if piece collides with other pieces
  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      if (rPiece[i][j] === 1 && GAME_STATE.board[y + i][x + j] !== 0) return true;
    }
  }

  // No collition
  return false;
};

const keyPressed = (key, evt) => {
  // Avoid default behaviour
  if (evt) { evt.preventDefault(); evt.stopPropagation(); }

  // Check if movement is valid
  switch (key) {
    case GAME_STATE.restartKey:
      if (GAME_STATE.gameOver) setTimeout(startGame, 50);
      break;

    case MOVEMENTS.LEFT:
      if (checkCollition({ ...GAME_STATE.piece, x: GAME_STATE.piece.x - 1 })) return;
      GAME_STATE.piece.x--;
      GAME_STATE.piece.refresh = true;
      break;

    case MOVEMENTS.RIGHT:
      if (checkCollition({ ...GAME_STATE.piece, x: GAME_STATE.piece.x + 1 })) return;
      GAME_STATE.piece.x++;
      GAME_STATE.piece.refresh = true;
      break;

    case MOVEMENTS.DOWN:
      if (checkCollition({ ...GAME_STATE.piece, y: GAME_STATE.piece.y + 1 })) return;
      GAME_STATE.piece.y++;
      GAME_STATE.piece.refresh = true;
      break;

    case MOVEMENTS.UP:
      let rotation = GAME_STATE.piece.rotation + 1;
      rotation > GAME_STATE.piece.maxRotation && (rotation = 0);
      if (checkCollition({ ...GAME_STATE.piece, rotation })) return;
      GAME_STATE.piece.rotation = rotation;
      GAME_STATE.piece.refresh = true;
      break;

    case MOVEMENTS.DROP:
      // Let piece fall to the bottom
      for (let i = GAME_STATE.piece.y; i < GAME_STATE.board.length; i++) {
        if (checkCollition({ ...GAME_STATE.piece, y: i + 1 })) {
          GAME_STATE.piece.y = i;
          GAME_STATE.piece.refresh = true;
          GAME_STATE.lastTime = 0; // Force refresh and add piece to board
          break;
        }
      }
      break;
  }
};

const newRandomPiece = ({ width }) => {
  const pieces = Object.keys(PIECES);
  const piece = pieces[Math.floor(Math.random() * pieces.length)];
  // Create new piece (Random piece)
  return { ...EMPTY_PIECE, piece, maxRotation: PIECES[piece].length - 1, x: Math.floor(Math.random() * (width - PIECES[piece][0][0].length + 1)), refresh: true};
};

const createPieceCell = (piece, filled) => {
  // Create cell
  const cellEl = createDiv('cell');
  filled && cellEl.classList.add(`cell-${piece}`, 'filled');
  return cellEl;
};

const drawPiece = (piece, onBoard) => {
  // Check if need to refresh
  if (!piece.refresh) return;
  piece.refresh = false;

  // Change position if not rotated
  if (piece.pieceEl) {
    if (piece.rotation === parseInt(piece.pieceEl.getAttribute('data-rotation'))) {
      piece.pieceEl.style.left = piece.x + 'rem';
      piece.pieceEl.style.top = piece.y + 'rem';
      return;
    }
    piece.pieceEl.remove();
  }

  // Draw new piece
  const pieceEl = createDiv('piece', 'position-absolute');
  pieceEl.setAttribute('data-rotation', piece.rotation);
  pieceEl.style.left = piece.x + 'rem';
  pieceEl.style.top = piece.y + 'rem';
  PIECES[piece.piece][piece.rotation].forEach((row) => {
    const rowEl = createDiv('row', 'd-flex', 'd-flex-row');
    row.forEach((cell) => rowEl.appendChild(createPieceCell(piece.piece, cell)));
    pieceEl.appendChild(rowEl);
  });
  piece.pieceEl = pieceEl;

  // Add piece to board
  onBoard.appendChild(pieceEl);
};

// Complete string with zero at left
const completeWithZero = (number, length) => number.toString().padStart(length, '0');
// Get piece with especific rotation
const getPiece = ({ piece, rotation }) => ({ piece: PIECES[piece][rotation], width: PIECES[piece][rotation][0].length, height: PIECES[piece][rotation].length });
// Mobile detection
const isMobile = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Pieces
const PIECES = {
  I: [[[1], [1], [1], [1]], [[1, 1, 1, 1]]],
  J: [[[0, 1],[0, 1],[1, 1]],[[1, 0, 0],[1, 1, 1]],[[1, 1],[1, 0],[1, 0]],[[1, 1, 1],[0, 0, 1]]],
  L: [[[1, 0],[1, 0],[1, 1]],[[1, 1, 1],[1, 0, 0]],[[1, 1],[0, 1],[0, 1]],[[0, 0, 1],[1, 1, 1]]],
  O: [[[1, 1],[1, 1]]],
  S: [[[0, 1, 1],[1, 1, 0]],[[1, 0],[1, 1],[0, 1]]],
  T: [[[0, 1, 0],[1, 1, 1]],[[1, 0],[1, 1],[1, 0]],[[1, 1, 1],[0, 1, 0]],[[0, 1],[1, 1],[0, 1]]],
  Z: [[[1, 1, 0],[0, 1, 1]],[[0, 1],[1, 1],[1, 0]]],
};

export { init };
