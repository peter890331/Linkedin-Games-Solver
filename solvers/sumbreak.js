void (async () => {
  const scriptStartTime = performance.now();

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function getWebElapsed() {
    const elements = document.querySelectorAll('span, div, p');
    for (const el of elements) {
      const text = el.textContent.trim();
      const match = text.match(/^(\d+):(\d{2})$/);
      if (match) {
        return (parseInt(match[1]) * 60 + parseInt(match[2])) * 1000;
      }
    }
    return null;
  }

  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
  }

  async function waitForBoard() {
    for (let i = 0; i < 50; i++) {
      const board = document.querySelector('[data-numo-rows][data-numo-columns]');
      const cells = document.querySelectorAll('[data-numo-index]');

      if (board && cells.length >= 4) return true;
      if (i >= 5 && cells.length === 0 && !board) return false;

      const clickWords = ['play', 'start', 'play now', 'play again', 'continue', 'got it', 'ok', "let's go", '開始', '遊玩', '繼續'];
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

    const board = document.querySelector('[data-numo-rows][data-numo-columns]');
    const ROWS = parseInt(board.getAttribute('data-numo-rows'));
    const COLS = parseInt(board.getAttribute('data-numo-columns'));
    const TOTAL = ROWS * COLS;

    const cellEls = [...document.querySelectorAll('[data-numo-index]')]
      .sort((a, b) => parseInt(a.getAttribute('data-numo-index')) - parseInt(b.getAttribute('data-numo-index')));

    if (cellEls.length !== TOTAL) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const grid = new Array(TOTAL).fill(0);
    for (let i = 0; i < TOTAL; i++) {
      const btn = cellEls[i].querySelector('button[data-numo-kind]');
      const kind = btn ? btn.getAttribute('data-numo-kind') : null;

      if (kind === 'wildcard') {
        grid[i] = -1;
        continue;
      }

      const svgCell = document.querySelector(`[data-numo-svg-cell="${i}"]`);
      const labelEl = svgCell ? svgCell.querySelector('text[data-numo-label="true"]') : null;
      if (labelEl) {
        const val = parseInt(labelEl.textContent.trim());
        if (!isNaN(val) && val > 0) {
          grid[i] = val;
          continue;
        }
      }

      if (kind === 'number') {
        const label = btn.getAttribute('aria-label') || '';
        const match = label.match(/\d+/);
        if (match) grid[i] = parseInt(match[0]);
      }
    }

    const tileCount = grid.filter(v => v !== 0).length;
    if (tileCount <= 1) {
      window.__linkedinSolverResult = { success: true, message: 'Sumbreak solved!' };
      return;
    }

    const dirs = [
      [-1,  0],
      [ 1,  0],
      [ 0, -1],
      [ 0,  1],
    ];

    function hasOddMin(state, count) {
      if (count <= 1) return false;
      let minVal = Infinity;
      let minCount = 0;

      for (let i = 0; i < TOTAL; i++) {
        const v = state[i];
        if (v === -1) return false;
        if (v === 0) continue;
        if (v < minVal) {
          minVal = v;
          minCount = 1;
        } else if (v === minVal) {
          minCount++;
        }
      }

      return minCount % 2 !== 0;
    }

    function solve() {
      const deadline = performance.now() + 10000;
      const visited = new Set();
      const moves = [];
      let iterations = 0;

      function bt(state, remaining) {
        if (++iterations % 5000 === 0 && performance.now() > deadline) return false;
        if (remaining === 1) return true;
        if (hasOddMin(state, remaining)) return false;

        const key = state.join(',');
        if (visited.has(key)) return false;
        visited.add(key);

        for (let i = 0; i < TOTAL; i++) {
          const val = state[i];
          if (val === 0) continue;

          const r = Math.floor(i / COLS);
          const c = i % COLS;

          for (const [dr, dc] of dirs) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;

            const j = (nr * COLS) + nc;
            const target = state[j];
            if (target === 0) continue;

            let newVal = 0;
            if (val > 0 && target === val) {
              newVal = val * 2;
            } else if (val === -1 && target > 0) {
              newVal = target * 2;
            } else if (val > 0 && target === -1) {
              newVal = val * 2;
            } else {
              continue;
            }

            state[i] = 0;
            state[j] = newVal;
            moves.push([i, j]);

            if (bt(state, remaining - 1)) return true;

            moves.pop();
            state[i] = val;
            state[j] = target;
          }
        }

        return false;
      }

      return bt([...grid], tileCount) ? moves : null;
    }

    const solution = solve();
    if (!solution) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const drags = [];
    for (const [fromIdx, toIdx] of solution) {
      const r1 = cellEls[fromIdx].getBoundingClientRect();
      const r2 = cellEls[toIdx].getBoundingClientRect();

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
      message: 'Sumbreak solved!',
    };
  } catch (err) {
    window.__linkedinSolverResult = { error: 'Error!' };
  }
})();