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
      if (cells.length >= 16) {
        const hasContent = [...cells].some(c =>
          c.querySelector('[data-testid="filled-cell"]') ||
          c.querySelector('[data-cell-content]') ||
          c.children.length >= 1 ||
          (c.textContent.trim() && /^\d+$/.test(c.textContent.trim()))
        );
        if (hasContent) return true;
      }
      
      if (i >= 5 && cells.length === 0) return false;
      
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

    const cellEls = [...document.querySelectorAll('[data-cell-idx]')]
      .sort((a, b) => parseInt(a.dataset.cellIdx) - parseInt(b.dataset.cellIdx));
    const SIZE = Math.round(Math.sqrt(cellEls.length));
    const TOTAL = SIZE * SIZE;

    const cellMap = {};
    cellEls.forEach(cell => {
      const idx = parseInt(cell.dataset.cellIdx);
      cellMap[idx] = { 
        row: Math.floor(idx / SIZE), 
        col: idx % SIZE, 
        el: cell 
      };
    });

    const conn = {};
    function resetConn() {
      for (let i = 0; i < TOTAL; i++) {
        conn[`${Math.floor(i / SIZE)},${i % SIZE}`] = new Set();
      }
    }
    
    function avgDeg() {
      const totalEdges = Object.values(conn).reduce((s, c) => s + c.size, 0);
      const totalNodes = Object.keys(conn).length;
      return totalEdges / totalNodes;
    }

    function buildFullGrid() {
      resetConn();
      for (let i = 0; i < TOTAL; i++) {
        const row = Math.floor(i / SIZE);
        const col = i % SIZE;
        const key = `${row},${col}`;
        
        if (row > 0)        conn[key].add(`${row - 1},${col}`);
        if (row < SIZE - 1) conn[key].add(`${row + 1},${col}`);
        if (col > 0)        conn[key].add(`${row},${col - 1}`);
        if (col < SIZE - 1) conn[key].add(`${row},${col + 1}`);
      }
    }

    let fiberWaypoints = null;
    
    function findFiberKey(el) {
      const isFiber = k => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance');
      let key = Object.keys(el).find(isFiber);
      if (key) return key;
      
      try { key = Object.getOwnPropertyNames(el).find(isFiber); } catch(_) {}
      if (key) return key;
      
      try { for (const k in el) { if (isFiber(k)) return k; } } catch(_) {}
      return null;
    }

    function findPropsKey(el) {
      const isProps = k => k.startsWith('__reactProps');
      let key = Object.keys(el).find(isProps);
      if (key) return key;
      
      try { key = Object.getOwnPropertyNames(el).find(isProps); } catch(_) {}
      if (key) return key;
      
      try { for (const k in el) { if (isProps(k)) return k; } } catch(_) {}
      return null;
    }

    function tryReactFiber() {
      const fiberKey = findFiberKey(cellEls[0]);
      const propsKey = findPropsKey(cellEls[0]);

      if (!fiberKey && !propsKey) return false;

      let wallsArr = null;
      if (fiberKey) {
        for (const cell of cellEls) {
          let current = cell[fiberKey];
          for (let i = 0; i < 20 && current; i++) {
            const props = current.memoizedProps;
            if (props && Array.isArray(props.walls)) {
              wallsArr = props.walls;
              break;
            }
            current = current.return;
          }
          if (wallsArr !== null) break;
        }
      }

      fiberWaypoints = {};
      for (const cell of cellEls) {
        if (fiberKey) {
          let current = cell[fiberKey];
          for (let i = 0; i < 20 && current; i++) {
            const props = current.memoizedProps;
            if (props && props.sequenceNo !== undefined && props.idx !== undefined) {
              if (props.sequenceNo >= 0) fiberWaypoints[props.sequenceNo + 1] = props.idx;
              break;
            }
            current = current.return;
          }
        }
        if (propsKey && Object.keys(fiberWaypoints).length === 0) {
          const p = cell[propsKey];
          if (p && p.sequenceNo !== undefined && p.idx !== undefined && p.sequenceNo >= 0) {
            fiberWaypoints[p.sequenceNo + 1] = p.idx;
          }
        }
      }

      buildFullGrid();

      if (wallsArr) {
        for (const wall of wallsArr) {
          const idx = wall.cellIdx;
          const row = Math.floor(idx / SIZE);
          const col = idx % SIZE;
          const key = `${row},${col}`;
          const dir = wall.direction || '';
          
          if (dir.includes('DOWN')) {
            const nkey = `${row + 1},${col}`;
            if (conn[key]) conn[key].delete(nkey);
            if (conn[nkey]) conn[nkey].delete(key);
          } else if (dir.includes('RIGHT')) {
            const nkey = `${row},${col + 1}`;
            if (conn[key]) conn[key].delete(nkey);
            if (conn[nkey]) conn[nkey].delete(key);
          }
        }
      }

      return Object.keys(fiberWaypoints).length >= 2;
    }

    function tryConnectors() {
      resetConn();
      cellEls.forEach(cell => {
        const idx = parseInt(cell.dataset.cellIdx);
        const row = Math.floor(idx / SIZE);
        const col = idx % SIZE;
        const key = `${row},${col}`;
        const cellRect = cell.getBoundingClientRect();
        const cellW = cellRect.width;
        const cellH = cellRect.height;
        
        [...cell.children].forEach(k => {
          const kRect = k.getBoundingClientRect();
          const w = kRect.width;
          const h = kRect.height;
          
          if (w < 5 || h < 5) return;
          if (Math.abs(w - h) < Math.min(w, h) * 0.15) return;
          
          const relL = kRect.left - cellRect.left;
          const relT = kRect.top - cellRect.top;
          
          if (w < h) {
            if (relL > cellW * 0.4 && col < SIZE - 1) conn[key].add(`${row},${col + 1}`);
            if (relL < cellW * 0.1 && col > 0)        conn[key].add(`${row},${col - 1}`);
          } else {
            if (relT > cellH * 0.4 && row < SIZE - 1) conn[key].add(`${row + 1},${col}`);
            if (relT < cellH * 0.1 && row > 0)        conn[key].add(`${row - 1},${col}`);
          }
        });
      });
      return avgDeg() > 0 && avgDeg() <= 3.5;
    }

    function tryBorders() {
      resetConn();
      const allBorders = [];
      cellEls.forEach(cell => {
        const target = cell.children[0] || cell;
        const s = getComputedStyle(target);
        const borders = [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth];
        borders.forEach(b => allBorders.push(parseFloat(b) || 0));
      });
      
      const uniqueBorders = [...new Set(allBorders.map(b => Math.round(b * 10) / 10))].sort((a, b) => a - b);
      if (uniqueBorders.length < 2 || uniqueBorders[uniqueBorders.length - 1] - uniqueBorders[0] < 1) return false;
      const threshold = (uniqueBorders[0] + uniqueBorders[uniqueBorders.length - 1]) / 2;

      cellEls.forEach(cell => {
        const idx = parseInt(cell.dataset.cellIdx);
        const row = Math.floor(idx / SIZE);
        const col = idx % SIZE;
        const key = `${row},${col}`;
        const target = cell.children[0] || cell;
        const s = getComputedStyle(target);
        
        const bt = parseFloat(s.borderTopWidth) || 0;
        const br = parseFloat(s.borderRightWidth) || 0;
        const bb = parseFloat(s.borderBottomWidth) || 0;
        const bl = parseFloat(s.borderLeftWidth) || 0;
        
        if (row > 0 && bt < threshold)        conn[key].add(`${row - 1},${col}`);
        if (col < SIZE - 1 && br < threshold) conn[key].add(`${row},${col + 1}`);
        if (row < SIZE - 1 && bb < threshold) conn[key].add(`${row + 1},${col}`);
        if (col > 0 && bl < threshold)        conn[key].add(`${row},${col - 1}`);
      });
      return avgDeg() > 0 && avgDeg() <= 3.0;
    }

    let mode = 'none';
    const attempts = [
      { name: 'fiber',     fn: tryReactFiber },
      { name: 'connector', fn: tryConnectors },
      { name: 'border',    fn: tryBorders },
    ];

    for (const { fn } of attempts) {
      if (fn()) { 
        mode = 'success'; 
        break; 
      }
    }

    function tryPositionGaps() {
      resetConn();
      const rects = {};
      cellEls.forEach(cell => {
        const idx = parseInt(cell.dataset.cellIdx);
        const rect = cell.getBoundingClientRect();
        rects[idx] = { 
          left: rect.left, 
          top: rect.top, 
          right: rect.right, 
          bottom: rect.bottom 
        };
      });

      const hGaps = [];
      const vGaps = [];
      for (let i = 0; i < TOTAL; i++) {
        const row = Math.floor(i / SIZE);
        const col = i % SIZE;
        
        if (col < SIZE - 1) {
          const right = rects[i + 1];
          if (right) hGaps.push(right.left - rects[i].right);
        }
        if (row < SIZE - 1) {
          const below = rects[i + SIZE];
          if (below) vGaps.push(below.top - rects[i].bottom);
        }
      }

      const allGaps = [...hGaps, ...vGaps].sort((a, b) => a - b);
      if (allGaps.length === 0) return false;
      
      const uniqueGaps = [...new Set(allGaps.map(g => Math.round(g * 2) / 2))].sort((a, b) => a - b);
      if (uniqueGaps.length < 2 || (uniqueGaps[uniqueGaps.length - 1] - uniqueGaps[0]) < 1) {
        return false;
      }
      const gapThreshold = (uniqueGaps[0] + uniqueGaps[uniqueGaps.length - 1]) / 2;

      for (let i = 0; i < TOTAL; i++) {
        const row = Math.floor(i / SIZE);
        const col = i % SIZE;
        const key = `${row},${col}`;
        
        if (col < SIZE - 1) {
          const gap = rects[i + 1] ? rects[i + 1].left - rects[i].right : 999;
          if (gap < gapThreshold) {
            conn[key].add(`${row},${col + 1}`);
            conn[`${row},${col + 1}`].add(key);
          }
        }
        if (row < SIZE - 1) {
          const gap = rects[i + SIZE] ? rects[i + SIZE].top - rects[i].bottom : 999;
          if (gap < gapThreshold) {
            conn[key].add(`${row + 1},${col}`);
            conn[`${row + 1},${col}`].add(key);
          }
        }
      }
      return avgDeg() > 0;
    }

    function tryWallChildren() {
      buildFullGrid();
      let wallsFound = 0;

      cellEls.forEach(cell => {
        const idx = parseInt(cell.dataset.cellIdx);
        const row = Math.floor(idx / SIZE);
        const col = idx % SIZE;
        const key = `${row},${col}`;
        const cellRect = cell.getBoundingClientRect();

        [...cell.children].forEach(kid => {
          const s = getComputedStyle(kid);
          const bg = s.backgroundColor;
          const w = parseFloat(s.width);
          const h = parseFloat(s.height);
          const kRect = kid.getBoundingClientRect();

          if (s.display === 'none' || s.visibility === 'hidden') return;
          if (w < 3 && h < 3) return;

          const isDark = bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
          const isNarrow = (w < 8 || h < 8);

          if (!isDark || !isNarrow) return;

          const relLeft = kRect.left - cellRect.left;
          const relTop = kRect.top - cellRect.top;
          const relRight = kRect.right - cellRect.right;
          const relBottom = kRect.bottom - cellRect.bottom;

          if (h < w) {
            if (relTop < 5 && row > 0) {
              const nkey = `${row - 1},${col}`;
              conn[key].delete(nkey);
              conn[nkey]?.delete(key);
              wallsFound++;
            } else if (relBottom < 5 && row < SIZE - 1) {
              const nkey = `${row + 1},${col}`;
              conn[key].delete(nkey);
              conn[nkey]?.delete(key);
              wallsFound++;
            }
          } else {
            if (relLeft < 5 && col > 0) {
              const nkey = `${row},${col - 1}`;
              conn[key].delete(nkey);
              conn[nkey]?.delete(key);
              wallsFound++;
            } else if (relRight < 5 && col < SIZE - 1) {
              const nkey = `${row},${col + 1}`;
              conn[key].delete(nkey);
              conn[nkey]?.delete(key);
              wallsFound++;
            }
          }
        });
      });

      return wallsFound > 0 && avgDeg() > 0 && avgDeg() < 3.8;
    }

    if (mode === 'none') {
      if (tryPositionGaps() || tryWallChildren()) {
        mode = 'success';
      }
    }

    if (mode === 'none') {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const numberPos = {};
    let maxNum = 0;

    if (fiberWaypoints && Object.keys(fiberWaypoints).length >= 2) {
      for (const [seqStr, cellIdx] of Object.entries(fiberWaypoints)) {
        const n = parseInt(seqStr);
        const row = Math.floor(cellIdx / SIZE);
        const col = cellIdx % SIZE;
        numberPos[n] = { row: row, col: col };
        maxNum = Math.max(maxNum, n);
      }
    } else {
      cellEls.forEach(cell => {
        const idx = parseInt(cell.dataset.cellIdx);
        const row = Math.floor(idx / SIZE);
        const col = idx % SIZE;
        const numEl = cell.querySelector('[data-cell-content]');
        
        if (numEl) {
          const n = parseInt(numEl.textContent.trim());
          if (!isNaN(n)) { 
            numberPos[n] = { row: row, col: col }; 
            maxNum = Math.max(maxNum, n); 
            return; 
          }
        }
        
        const text = cell.textContent.trim();
        if (text && /^\d+$/.test(text)) {
          const n = parseInt(text);
          numberPos[n] = { row: row, col: col };
          maxNum = Math.max(maxNum, n);
        }
      });
    }

    let finalConn;
    if (fiberWaypoints) {
      finalConn = conn;
    } else {
      finalConn = {};
      for (const key in conn) {
        finalConn[key] = new Set();
      }
      for (const key in conn) {
        for (const nkey of conn[key]) {
          if (conn[nkey]?.has(key)) {
            finalConn[key].add(nkey);
            finalConn[nkey].add(key);
          }
        }
      }
    }

    const active = new Set();
    if (numberPos[1]) {
      const startKey = `${numberPos[1].row},${numberPos[1].col}`;
      const queue = [startKey];
      active.add(startKey);
      
      while (queue.length > 0) {
        const cur = queue.shift();
        for (const nkey of (finalConn[cur] || [])) {
          if (!active.has(nkey)) {
            active.add(nkey);
            queue.push(nkey);
          }
        }
      }
    }

    const totalActive = active.size;
    const waypoints = [];
    
    for (let n = 1; n <= maxNum; n++) {
      if (numberPos[n]) waypoints.push(numberPos[n]);
    }

    if (waypoints.length < 2) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    function getNeighbors(row, col) {
      const key = `${row},${col}`;
      const result = [];
      for (const nkey of (finalConn[key] || [])) {
        if (active.has(nkey)) {
          const [nr, nc] = nkey.split(',').map(Number);
          result.push({ row: nr, col: nc });
        }
      }
      return result;
    }

    function solve() {
      const deadline = performance.now() + 10000;
      const path = [waypoints[0]];
      const visited = new Set([`${waypoints[0].row},${waypoints[0].col}`]);
      
      let nextWp = 1;
      let iterations = 0;
      
      function bt() {
        if (++iterations % 5000 === 0 && performance.now() > deadline) return false;
        if (path.length === totalActive) return nextWp >= waypoints.length;
        const curr = path[path.length - 1];

        const candidates = [];
        for (const next of getNeighbors(curr.row, curr.col)) {
          const key = `${next.row},${next.col}`;
          if (visited.has(key)) continue;
          
          const wpIdx = waypoints.findIndex((w, i) => i >= nextWp && w.row === next.row && w.col === next.col);
          if (wpIdx !== -1 && wpIdx !== nextWp) continue;
          
          let degree = 0;
          for (const nn of getNeighbors(next.row, next.col)) {
            if (!visited.has(`${nn.row},${nn.col}`)) degree++;
          }
          candidates.push({ next: next, key: key, wpIdx: wpIdx, degree: degree, isWp: wpIdx === nextWp });
        }
        
        candidates.sort((a, b) => {
          if (a.isWp !== b.isWp) return a.isWp ? -1 : 1;
          return a.degree - b.degree;
        });

        for (const { next, key, isWp } of candidates) {
          visited.add(key); 
          path.push(next);
          const oldWp = nextWp;
          
          if (isWp) nextWp++;
          if (bt()) return true;
          
          nextWp = oldWp; 
          path.pop(); 
          visited.delete(key);
        }
        return false;
      }
      return bt() ? path : null;
    }

    const solution = solve();
    if (!solution) {
      window.__linkedinSolverResult = { error: 'Error!' };
      return;
    }

    const cellIndices = solution.map(s => (s.row * SIZE) + s.col);
    
    window.__linkedinSolverResult = {
      success: true,
      needsCDP: true,
      cellIndices: cellIndices,
      message: 'Zip solved!'
    };
  } catch (err) {
    window.__linkedinSolverResult = { error: 'Error!' };
  }
})();