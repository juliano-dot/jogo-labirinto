const boardEl = document.getElementById('gameBoard');
const coinCountEl = document.getElementById('coinCount');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const messageEl = document.getElementById('message');
const resetBtn = document.getElementById('resetBtn');
const directionButtons = document.querySelectorAll('.dir-btn');

const MAZE_SIZE = 15;
const TOTAL_COINS = 5;

let maze = [];
let player = { x: 1, y: 1 };
let exitCell = { x: 1, y: 1 };
let coinPositions = new Set();
let totalCoins = 0;
let moves = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameWon = false;

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[randomIndex]] = [copy[randomIndex], copy[i]];
  }
  return copy;
}

function keyOf(x, y) {
  return `${x},${y}`;
}

function buildMaze() {
  const grid = Array.from({ length: MAZE_SIZE }, () => Array(MAZE_SIZE).fill(1));

  function carve(cx, cy) {
    grid[cy][cx] = 0;
    const directions = shuffle([
      { x: 2, y: 0 },
      { x: -2, y: 0 },
      { x: 0, y: 2 },
      { x: 0, y: -2 },
    ]);

    for (const { x, y } of directions) {
      const nx = cx + x;
      const ny = cy + y;

      if (nx > 0 && ny > 0 && nx < MAZE_SIZE - 1 && ny < MAZE_SIZE - 1 && grid[ny][nx] === 1) {
        grid[cy + y / 2][cx + x / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);

  const openCells = [];
  for (let y = 1; y < MAZE_SIZE - 1; y += 1) {
    for (let x = 1; x < MAZE_SIZE - 1; x += 1) {
      if (grid[y][x] === 0) {
        openCells.push({ x, y });
      }
    }
  }

  const start = { x: 1, y: 1 };
  player = { ...start };

  const distances = new Map();
  const queue = [{ ...start }];
  distances.set(keyOf(start.x, start.y), 0);

  let farthest = { ...start };

  while (queue.length > 0) {
    const current = queue.shift();
    farthest = current;

    const directions = [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ];

    for (const { x, y } of directions) {
      const nx = current.x + x;
      const ny = current.y + y;
      const key = keyOf(nx, ny);

      if (nx <= 0 || ny <= 0 || nx >= MAZE_SIZE - 1 || ny >= MAZE_SIZE - 1) {
        continue;
      }

      if (grid[ny][nx] === 0 && !distances.has(key)) {
        distances.set(key, distances.get(keyOf(current.x, current.y)) + 1);
        queue.push({ x: nx, y: ny });
      }
    }
  }

  exitCell = farthest;

  const candidates = openCells.filter(
    (cell) => !(cell.x === start.x && cell.y === start.y) && !(cell.x === exitCell.x && cell.y === exitCell.y),
  );

  const coinList = shuffle(candidates).slice(0, TOTAL_COINS);
  coinPositions = new Set(coinList.map((cell) => keyOf(cell.x, cell.y)));
  totalCoins = coinList.length;

  maze = grid;
}

function formatTime(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function updateHud() {
  const remainingCoins = coinPositions.size;
  coinCountEl.textContent = `${totalCoins - remainingCoins}/${totalCoins}`;
  timerEl.textContent = formatTime(elapsedSeconds);
  movesEl.textContent = String(moves);
}

function setMessage(text) {
  messageEl.textContent = text;
}

function startTimer() {
  clearInterval(timerId);
  timerId = setInterval(() => {
    elapsedSeconds += 1;
    updateHud();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
}

function resetGame() {
  moves = 0;
  elapsedSeconds = 0;
  gameWon = false;
  buildMaze();
  updateHud();
  setMessage('Colete todas as moedas e encontre a saída!');
  startTimer();
  renderBoard();
}

function isWall(x, y) {
  return maze[y]?.[x] === 1;
}

function isExit(x, y) {
  return x === exitCell.x && y === exitCell.y;
}

function hasCoin(x, y) {
  return coinPositions.has(keyOf(x, y));
}

function collectCoinIfNeeded(x, y) {
  if (hasCoin(x, y)) {
    coinPositions.delete(keyOf(x, y));
  }
}

function renderBoard() {
  boardEl.style.gridTemplateColumns = `repeat(${MAZE_SIZE}, minmax(0, 1fr))`;
  boardEl.innerHTML = '';

  for (let y = 0; y < MAZE_SIZE; y += 1) {
    for (let x = 0; x < MAZE_SIZE; x += 1) {
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (isWall(x, y)) {
        cell.classList.add('wall');
      } else {
        if (player.x === x && player.y === y) {
          cell.classList.add('player');
        } else if (isExit(x, y)) {
          cell.classList.add(coinPositions.size === 0 ? 'exit-open' : 'exit-locked');
        } else if (hasCoin(x, y)) {
          cell.classList.add('coin');
        } else {
          cell.classList.add('floor');
        }
      }

      boardEl.appendChild(cell);
    }
  }
}

function tryMove(dx, dy) {
  if (gameWon) {
    return;
  }

  const nextX = player.x + dx;
  const nextY = player.y + dy;

  if (isWall(nextX, nextY)) {
    return;
  }

  if (nextX === exitCell.x && nextY === exitCell.y && coinPositions.size > 0) {
    setMessage(`A saída está fechada! Falta(m) ${coinPositions.size} moeda(s).`);
    return;
  }

  moves += 1;
  player.x = nextX;
  player.y = nextY;
  collectCoinIfNeeded(player.x, player.y);

  if (player.x === exitCell.x && player.y === exitCell.y && coinPositions.size === 0) {
    gameWon = true;
    stopTimer();
    setMessage(`Parabéns! Você venceu em ${moves} movimentos e ${formatTime(elapsedSeconds)}.`);
  } else if (coinPositions.size === 0) {
    setMessage('Todas as moedas foram coletadas! Procure a saída.');
  } else {
    setMessage('Caminho em progresso...');
  }

  updateHud();
  renderBoard();
}

function handleKeydown(event) {
  const keyMap = {
    ArrowUp: [0, -1],
    w: [0, -1],
    W: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    S: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    A: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
    D: [1, 0],
  };

  if (!keyMap[event.key]) {
    return;
  }

  event.preventDefault();
  const [dx, dy] = keyMap[event.key];
  tryMove(dx, dy);
}

resetBtn.addEventListener('click', resetGame);

directionButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const direction = button.dataset.dir;
    const keyMap = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };

    const [dx, dy] = keyMap[direction];
    tryMove(dx, dy);
  });
});

window.addEventListener('keydown', handleKeydown);

resetGame();
