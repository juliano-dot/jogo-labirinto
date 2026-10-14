const boardEl = document.getElementById('gameBoard');
const coinCountEl = document.getElementById('coinCount');
const timerEl = document.getElementById('timer');
const movesEl = document.getElementById('moves');
const levelCountEl = document.getElementById('levelCount');
const scoreCountEl = document.getElementById('scoreCount');
const messageEl = document.getElementById('message');
const resetBtn = document.getElementById('resetBtn');
const directionButtons = document.querySelectorAll('.dir-btn');
const playerNameEl = document.getElementById('playerName');
const rankingListEl = document.getElementById('rankingList');
const clearRankingBtn = document.getElementById('clearRankingBtn');

const LEVELS = [
  { size: 11, coins: 3 },
  { size: 15, coins: 5 },
  { size: 19, coins: 7 },
  { size: 23, coins: 9 },
  { size: 27, coins: 12 },
];

const STORAGE_KEY = 'labirinto-ranking';

let maze = [];
let player = { x: 1, y: 1 };
let exitCell = { x: 1, y: 1 };
let coinPositions = new Set();
let totalCoins = 0;
let levelIndex = 0;
let totalScore = 0;
let mazeSize = LEVELS[0].size;
let targetCoins = LEVELS[0].coins;
let moves = 0;
let elapsedSeconds = 0;
let timerId = null;
let gameWon = false;
let transitioning = false;
let scoreRecorded = false;

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

function loadRanking() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    return [];
  }
}

function saveRanking(scoreValue) {
  if (!scoreValue || scoreValue <= 0 || scoreRecorded) {
    return;
  }

  const playerName = playerNameEl.value.trim() || 'Jogador';
  const ranking = loadRanking();
  const updated = [...ranking, { name: playerName, score: scoreValue }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  renderRanking(updated);
  scoreRecorded = true;
}

function renderRanking(data = loadRanking()) {
  rankingListEl.innerHTML = '';

  if (!data.length) {
    rankingListEl.innerHTML = '<li><span>Sem pontuações</span><strong>0</strong></li>';
    return;
  }

  data.forEach((entry, index) => {
    const item = document.createElement('li');
    item.innerHTML = `<span>${index + 1}. ${entry.name}</span><strong>${entry.score}</strong>`;
    rankingListEl.appendChild(item);
  });
}

function buildMaze() {
  const grid = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(1));

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

      if (nx > 0 && ny > 0 && nx < mazeSize - 1 && ny < mazeSize - 1 && grid[ny][nx] === 1) {
        grid[cy + y / 2][cx + x / 2] = 0;
        carve(nx, ny);
      }
    }
  }

  function addExtraRoutes() {
    const extraRoutes = Math.max(10, Math.floor((mazeSize * mazeSize) / 8));

    for (let i = 0; i < extraRoutes; i += 1) {
      const x = 1 + Math.floor(Math.random() * (mazeSize - 2));
      const y = 1 + Math.floor(Math.random() * (mazeSize - 2));

      if (grid[y][x] !== 0) {
        continue;
      }

      const directions = shuffle([
        { x: 2, y: 0 },
        { x: -2, y: 0 },
        { x: 0, y: 2 },
        { x: 0, y: -2 },
      ]);

      const option = directions.find(({ x: dx, y: dy }) => {
        const nx = x + dx;
        const ny = y + dy;

        if (nx <= 0 || ny <= 0 || nx >= mazeSize - 1 || ny >= mazeSize - 1) {
          return false;
        }

        return grid[ny][nx] === 1;
      });

      if (option) {
        grid[y + option.y / 2][x + option.x / 2] = 0;
        grid[y + option.y][x + option.x] = 0;
      }
    }
  }

  carve(1, 1);
  addExtraRoutes();

  const openCells = [];
  for (let y = 1; y < mazeSize - 1; y += 1) {
    for (let x = 1; x < mazeSize - 1; x += 1) {
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

      if (nx <= 0 || ny <= 0 || nx >= mazeSize - 1 || ny >= mazeSize - 1) {
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

  const coinList = shuffle(candidates).slice(0, targetCoins);
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
  levelCountEl.textContent = `${levelIndex + 1}/${LEVELS.length}`;
  scoreCountEl.textContent = String(totalScore);
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

function startLevel(levelNumber) {
  levelIndex = levelNumber;
  mazeSize = LEVELS[levelIndex].size;
  targetCoins = LEVELS[levelIndex].coins;
  moves = 0;
  elapsedSeconds = 0;
  gameWon = false;
  transitioning = false;
  buildMaze();
  renderBoard();
  updateHud();
  setMessage(`Nível ${levelIndex + 1}: colete ${targetCoins} moedas e encontre a saída!`);
  startTimer();
}

function resetRun() {
  totalScore = 0;
  scoreRecorded = false;
  localStorage.removeItem(STORAGE_KEY);
  renderRanking();
  startLevel(0);
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
  boardEl.style.gridTemplateColumns = `repeat(${mazeSize}, minmax(0, 1fr))`;
  boardEl.innerHTML = '';

  for (let y = 0; y < mazeSize; y += 1) {
    for (let x = 0; x < mazeSize; x += 1) {
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

function giveLevelPoints() {
  return Math.max(250, 1200 - elapsedSeconds * 7 - moves * 4 + targetCoins * 60);
}

function continueToNextLevel() {
  if (levelIndex < LEVELS.length - 1) {
    setTimeout(() => {
      startLevel(levelIndex + 1);
    }, 1200);
    return;
  }

  setMessage(`Você venceu todos os níveis! Pontuação final: ${totalScore}.`);
}

function completeLevel() {
  if (transitioning) {
    return;
  }

  transitioning = true;
  gameWon = true;
  stopTimer();

  const pointsEarned = giveLevelPoints();
  totalScore += pointsEarned;
  updateHud();

  if (levelIndex < LEVELS.length - 1) {
    setMessage(`Nível ${levelIndex + 1} concluído! +${pointsEarned} pontos. Próximo mapa...`);
    continueToNextLevel();
  } else {
    saveRanking(totalScore);
    setMessage(`Parabéns! Você venceu todos os níveis em ${moves} movimentos. Pontos: ${totalScore}.`);
  }
}

function tryMove(dx, dy) {
  if (gameWon || transitioning) {
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
    completeLevel();
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

resetBtn.addEventListener('click', resetRun);

clearRankingBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  renderRanking();
});

playerNameEl.addEventListener('input', () => {
  renderRanking();
});

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

renderRanking();
resetRun();
