void (async () => {
  const DELAY = 30;

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function click(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  async function waitForBoard() {
    for (let i = 0; i < 50; i++) {
      const section = document.querySelector('[aria-label="Press enter to gameboard"], [aria-label*="Enter"]') || document;
      if (section && section !== document) {
        for (const div of section.querySelectorAll('div, section')) {
          const len = div.children.length;
          if (len >= 25 && len <= 144 && Number.isInteger(Math.sqrt(len))) return true;
        }
      }
      if (i >= 5 && (!section || section === document)) return false;
      
      for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
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

    await sleep(300);
    for (const d of document.querySelectorAll('[role="dialog"], [role="alertdialog"]')) {
      const closeBtn = d.querySelector('button.artdeco-modal__dismiss, button[data-test-modal-close-btn]');
      if (closeBtn) click(closeBtn);
    }
    await sleep(500);

    const section = document.querySelector('[aria-label="Press enter to gameboard"], [aria-label*="Enter"]') || document;
    let gridContainer = null;
    for (const div of section.querySelectorAll('div, section')) {
      const len = div.children.length;
      if (len >= 25 && len <= 144 && Number.isInteger(Math.sqrt(len))) { gridContainer = div; break; }
    }

    if (!gridContainer) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const cellEls = [...gridContainer.children];
    const SIZE = Math.round(Math.sqrt(cellEls.length));

    const cells = cellEls.map((el, i) => {
      const hasQueen = !!el.querySelector('svg');
      
      let bgColor = window.getComputedStyle(el).backgroundColor;
      if (!bgColor || bgColor === 'rgba(0, 0, 0, 0)' || bgColor === 'transparent') {
        const child = el.firstElementChild;
        if (child) bgColor = window.getComputedStyle(child).backgroundColor;
      }

      return {
        row: Math.floor(i / SIZE),
        col: i % SIZE,
        color: bgColor || 'unknown',
        hasQueen,
        el,
      };
    });

    const queenCount = cells.filter(c => c.hasQueen).length;
    if (queenCount === SIZE) {
      window.__linkedinSolverResult = { success: true, message: 'Queens solved!' };
      return;
    }

    const colors = [...new Set(cells.map(c => c.color))];
    const colorToId = {};
    colors.forEach((c, i) => colorToId[c] = i);
    const regionGrid = [];
    for (let r = 0; r < SIZE; r++) {
      regionGrid.push([]);
      for (let c = 0; c < SIZE; c++) {
        regionGrid[r].push(colorToId[cells[r * SIZE + c].color]);
      }
    }

    function solve() {
      const queens = new Array(SIZE).fill(-1);

      function isSafe(row, col) {
        for (let r = 0; r < row; r++) {
          const c = queens[r];
          if (c === col) return false;
          if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return false;
        }
        const region = regionGrid[row][col];
        for (let r = 0; r < row; r++) {
          if (regionGrid[r][queens[r]] === region) return false;
        }
        return true;
      }

      function bt(row) {
        if (row === SIZE) return true;
        for (let col = 0; col < SIZE; col++) {
          if (isSafe(row, col)) {
            queens[row] = col;
            if (bt(row + 1)) return true;
            queens[row] = -1;
          }
        }
        return false;
      }

      if (bt(0)) return queens;
      return null;
    }

    const solution = solve();
    if (!solution) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const toPlace = [];
    for (let row = 0; row < SIZE; row++) {
      const col = solution[row];
      const cell = cells[row * SIZE + col];
      if (!cell.hasQueen) toPlace.push(cell);
    }

    window.__linkedinSolverResult = { success: true, message: 'Queens solved!' };

    for (const cell of toPlace) {
      click(cell.el);
      await sleep(DELAY);
      click(cell.el);
      await sleep(DELAY);
    }
  } catch (err) {
    window.__linkedinSolverResult = { error: 'Error!' };
  }
})();