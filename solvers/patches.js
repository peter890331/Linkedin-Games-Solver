void (async () => {
  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
  }

  async function waitForBoard() {
    for (let i = 0; i < 50; i++) {
      const cells = document.querySelectorAll('[data-cell-idx]');
      const board1 = document.querySelector('[data-testid="patches-game-board"]');
      const board2 = document.querySelector('[data-testid="interactive-grid"]');
      const patchesBoard = board1 || board2;

      if (patchesBoard && cells.length >= 16) return true;
      if (i >= 5 && cells.length === 0 && !patchesBoard) return false;

      const clickWords = ['play', 'start', 'play now', 'play again', 'continue', 'got it', 'ok', "let's go"];
      const closeLabels = ['Close', 'Dismiss', '關閉'];

      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const text = btn.textContent.trim().toLowerCase();
        const label = btn.getAttribute('aria-label');
        
        if (clickWords.includes(text)) click(btn);
        if (closeLabels.includes(label)) click(btn);
      }

      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      for (const d of dialogs) {
        const closeBtn = d.querySelector('button[aria-label="Close"], button[aria-label="Dismiss"], button[aria-label="關閉"], button');
        if (closeBtn) click(closeBtn);
      }

      await sleep(100);
    }
    return false;
  }

  try {
    if (!(await waitForBoard())) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const cellEls = [...document.querySelectorAll('[data-cell-idx]')]
      .sort((a, b) => parseInt(a.dataset.cellIdx) - parseInt(b.dataset.cellIdx));

    const fiberKey = Object.keys(cellEls[0]).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    let solution = null;
    let gridCols = null;
    let current = cellEls[0][fiberKey];

    for (let i = 0; i < 40 && current; i++) {
      const mp = current.memoizedProps;
      if (mp?.game?.puzzle?.patchesGamePuzzle) {
        const pgp = mp.game.puzzle.patchesGamePuzzle;
        solution = pgp.solution;
        gridCols = pgp.gridCols;
        break;
      }
      current = current.return;
    }

    if (!solution || !Array.isArray(solution) || solution.length === 0) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const COLS = gridCols || Math.round(Math.sqrt(cellEls.length));
    const drags = [];

    for (const region of solution) {
      const cellIdxes = region.cellIdxes;
      const rows = cellIdxes.map(i => Math.floor(i / COLS));
      const cols = cellIdxes.map(i => i % COLS);

      const minRow = Math.min(...rows);
      const maxRow = Math.max(...rows);
      const minCol = Math.min(...cols);
      const maxCol = Math.max(...cols);

      const topLeftIdx = (minRow * COLS) + minCol;
      const botRightIdx = (maxRow * COLS) + maxCol;

      const r1 = cellEls[topLeftIdx].getBoundingClientRect();
      const r2 = cellEls[botRightIdx].getBoundingClientRect();

      const fromX = Math.round(r1.left + r1.width / 2);
      const fromY = Math.round(r1.top + r1.height / 2);
      const toX = Math.round(r2.left + r2.width / 2);
      const toY = Math.round(r2.top + r2.height / 2);

      drags.push({
        from: [fromX, fromY],
        to: [toX, toY],
      });
    }

    window.__linkedinSolverResult = {
      success: true,
      needsCDP: true,
      cdpType: 'drag',
      drags: drags,
      message: 'Patches solved!',
    };
  } catch (err) {
    window.__linkedinSolverResult = { error: 'Error!' };
  }
})();