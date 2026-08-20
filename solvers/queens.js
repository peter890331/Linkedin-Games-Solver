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
      const closeBtn = document.querySelector('[aria-label="Close"], [aria-label="關閉"]');
      if (closeBtn) click(closeBtn);

      const section = document.querySelector('[aria-label="Press enter to gameboard"], [aria-label*="Enter"]') || document;
      if (section) {
        for (const div of section.querySelectorAll('div, section')) {
          const len = div.children.length;
          if (len >= 25 && len <= 144 && Number.isInteger(Math.sqrt(len))) return true;
        }
      }
      if (i >= 5 && !section) return false;
      for (const btn of document.querySelectorAll('button')) {
        const text = btn.textContent.trim().toLowerCase();
        if (text === 'play' || text === 'start' || text === '開始' || text === '遊玩') click(btn);
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
    for (const d of document.querySelectorAll('[role="dialog"]')) {
      const close = d.querySelector('button');
      if (close) click(close);
    }
    for (const btn of document.querySelectorAll('button')) {
      if (btn.textContent.trim() === '\u00d7' || btn.getAttribute('aria-label') === 'Close' || btn.getAttribute('aria-label') === '關閉') {
        click(btn);
      }
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
      const ariaLabel = el.getAttribute('aria-label') || '';
      const hasQueen = /queen|皇后|王后|reine|reina|königin|regina|rainha|koningin|królowa|kraliçe|vezir|королева|ферзь|ratu|クイーン|퀸|ملكة|रानी|drottning|dronning|kuningatar|královna|regină/i.test(ariaLabel);
      
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