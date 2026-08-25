void (async () => {
  const scriptStartTime = performance.now();
  const SUN = 0;
  const MOON = 1;

  function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click',     { bubbles: true }));
  }

  async function waitForBoard() {
    const boardSelectors = '[aria-label="Gameboard"], [aria-label*="Game"], [data-testid="tango-gameboard-wrapper"]';
    
    for (let i = 0; i < 50; i++) {
      const board = document.querySelector(boardSelectors) || document;
      if (board) {
        const cells = [...board.querySelectorAll('[data-testid^="cell-"]')]
          .filter(el => /^cell-\d+$/.test(el.getAttribute('data-testid')));
        if (cells.length >= 16) return true;
      }
      if (i >= 5 && !board) return false;
      
      const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]');
      for (const d of dialogs) {
        const primaryBtn = d.querySelector('button.artdeco-button--primary');
        if (primaryBtn) click(primaryBtn);
        
        const closeBtn = d.querySelector('button.artdeco-modal__dismiss, button[data-test-modal-close-btn]');
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

    const boardSelectors = '[aria-label="Gameboard"], [aria-label*="Game"], [data-testid="tango-gameboard-wrapper"]';
    const board = document.querySelector(boardSelectors) || document;
    if (!board) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const cellEls = [...board.querySelectorAll('[data-testid^="cell-"]')]
      .filter(el => /^cell-\d+$/.test(el.getAttribute('data-testid')))
      .sort((a, b) => {
        const ai = parseInt(a.getAttribute('data-testid').replace('cell-', ''));
        const bi = parseInt(b.getAttribute('data-testid').replace('cell-', ''));
        return ai - bi;
      });

    const SIZE = Math.round(Math.sqrt(cellEls.length));
    if (SIZE * SIZE !== cellEls.length) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const grid = [];
    const prefilled = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      const svg = cellEls[i].querySelector('svg');
      const label = svg ? (svg.getAttribute('aria-label') || '') : '';
      const hasSunShape = !!cellEls[i].querySelector('path#Sun, g#Sun');
      const hasMoonShape = !!cellEls[i].querySelector('path#Moon, g#Moon');

      const isSun = hasSunShape || /sun|太陽|sol|soleil|sonne|zon|aurinko|güneş/i.test(label);
      const isMoon = hasMoonShape || /moon|月亮|luna|lune|mond|maan|kuu|ay/i.test(label);

      if (isSun) {
        grid.push(SUN);
        prefilled.push(true);
      } else if (isMoon) {
        grid.push(MOON);
        prefilled.push(true);
      } else {
        grid.push(-1);
        prefilled.push(false);
      }
    }

    if (grid.every(v => v !== -1)) {
      window.__linkedinSolverResult = { success: true, message: 'Tango solved!' };
      return;
    }

    function idx(r, c) {
      return (r * SIZE) + c;
    }

    const constraints = [];
    const seen = new Set();
    const edgeEls = board.querySelectorAll('[data-testid="edge-equal"], [data-testid="edge-cross"]');

    for (const e of edgeEls) {
      const type = e.getAttribute('data-testid') === 'edge-equal' ? 'same' : 'diff';
      const cellEl = e.closest('[data-testid^="cell-"]');

      if (cellEl) {
        const cellIdx = parseInt(cellEl.getAttribute('data-testid').replace('cell-', ''));
        const cellRow = Math.floor(cellIdx / SIZE);
        const cellCol = cellIdx % SIZE;

        const cellRect = cellEl.getBoundingClientRect();
        const edgeRect = e.getBoundingClientRect();
        const dx = (edgeRect.left + (edgeRect.width / 2)) - (cellRect.left + (cellRect.width / 2));
        const dy = (edgeRect.top + (edgeRect.height / 2)) - (cellRect.top + (cellRect.height / 2));

        let r2 = cellRow;
        let c2 = cellCol;
        if (Math.abs(dx) > Math.abs(dy)) {
          c2 += dx > 0 ? 1 : -1;
        } else {
          r2 += dy > 0 ? 1 : -1;
        }

        if (r2 >= 0 && r2 < SIZE && c2 >= 0 && c2 < SIZE) {
          const idx1 = idx(cellRow, cellCol);
          const idx2 = idx(r2, c2);
          const key = `${Math.min(idx1, idx2)}-${Math.max(idx1, idx2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            constraints.push({ type: type, i1: idx1, i2: idx2 });
          }
        }
      } else {
        const edgeRect = e.getBoundingClientRect();
        const ecx = edgeRect.left + (edgeRect.width / 2);
        const ecy = edgeRect.top + (edgeRect.height / 2);

        const dists = cellEls.map((c, i) => {
          const r = c.getBoundingClientRect();
          return { i: i, dist: Math.hypot(r.left + (r.width / 2) - ecx, r.top + (r.height / 2) - ecy) };
        }).sort((a, b) => a.dist - b.dist);

        const i1 = dists[0].i;
        const i2 = dists[1].i;
        const key = `${Math.min(i1, i2)}-${Math.max(i1, i2)}`;
        if (!seen.has(key)) {
          seen.add(key);
          constraints.push({ type: type, i1: i1, i2: i2 });
        }
      }
    }

    const half = SIZE / 2;

    function isValidPartial(g) {
      for (let r = 0; r < SIZE; r++) {
        let sunCount = 0;
        let moonCount = 0;
        for (let c = 0; c < SIZE; c++) {
          const v = g[idx(r, c)];
          if (v === SUN) sunCount++;
          if (v === MOON) moonCount++;
        }
        if (sunCount > half || moonCount > half) return false;

        for (let c = 0; c <= SIZE - 3; c++) {
          const a = g[idx(r, c)];
          const b = g[idx(r, c + 1)];
          const cc = g[idx(r, c + 2)];
          if (a !== -1 && a === b && b === cc) return false;
        }
      }

      for (let c = 0; c < SIZE; c++) {
        let sunCount = 0;
        let moonCount = 0;
        for (let r = 0; r < SIZE; r++) {
          const v = g[idx(r, c)];
          if (v === SUN) sunCount++;
          if (v === MOON) moonCount++;
        }
        if (sunCount > half || moonCount > half) return false;

        for (let r = 0; r <= SIZE - 3; r++) {
          const a = g[idx(r, c)];
          const b = g[idx(r + 1, c)];
          const d = g[idx(r + 2, c)];
          if (a !== -1 && a === b && b === d) return false;
        }
      }

      for (const { type, i1, i2 } of constraints) {
        const v1 = g[i1];
        const v2 = g[i2];
        if (v1 === -1 || v2 === -1) continue;
        if (type === 'same' && v1 !== v2) return false;
        if (type === 'diff' && v1 === v2) return false;
      }

      return true;
    }

    function solve(g) {
      const emptyIdx = g.indexOf(-1);
      if (emptyIdx === -1) return true;

      for (const val of [SUN, MOON]) {
        g[emptyIdx] = val;
        if (isValidPartial(g) && solve(g)) return true;
        g[emptyIdx] = -1;
      }
      return false;
    }

    const solution = [...grid];
    if (!solve(solution)) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const toFill = [];
    for (let i = 0; i < SIZE * SIZE; i++) {
      if (!prefilled[i]) toFill.push(i);
    }

    window.__linkedinSolverResult = { success: true, message: 'Tango solved!' };

    for (let fillIdx = 0; fillIdx < toFill.length; fillIdx++) {
      const i = toFill[fillIdx];
      const target = solution[i];
      const clicks = target === SUN ? 1 : 2;
      const clickTarget = cellEls[i].querySelector('div') || cellEls[i];
      
      for (let c = 0; c < clicks; c++) {
        if (fillIdx === toFill.length - 1 && c === clicks - 1) {
          const elapsed = performance.now() - scriptStartTime;
          if (elapsed < 2000) {
            await sleep(2000 - elapsed);
          }
        }
        
        click(clickTarget);
        await sleep(30);
      }
    }
  } catch (err) {
    window.__linkedinSolverResult = { error: 'Error!' };
  }
})();