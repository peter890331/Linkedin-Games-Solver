const GAME_URLS = {
  sudoku: 'https://www.linkedin.com/games/mini-sudoku/',
  tango: 'https://www.linkedin.com/games/tango/',
  queens: 'https://www.linkedin.com/games/queens/',
  zip: 'https://www.linkedin.com/games/zip/',
  patches: 'https://www.linkedin.com/games/patches/',
};

function setStatus(type, text) {
  const el = document.getElementById('status');
  const icon = document.getElementById('status-icon');
  const textEl = document.getElementById('status-text');
  el.className = `status ${type}`;
  textEl.textContent = text;
  icon.textContent = type === 'solving' ? '\u23F3' : type === 'success' ? '\u2705' : '\u274C';
}

function disableButtons(disabled) {
  document.querySelectorAll('button').forEach(btn => btn.disabled = disabled);
}

async function waitForTabLoad(tabId) {
  return new Promise(resolve => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 15000);
  });
}

async function pollForResult(tabId, maxAttempts, intervalMs) {
  let lastError = null;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    try {
      const checks = await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        world: 'MAIN',
        func: () => window.__linkedinSolverResult,
      });
      for (const check of checks) {
        if (check?.result?.success || check?.result?.needsCDP) return check.result;
        if (check?.result?.error) lastError = check.result;
      }
    } catch {
      return null;
    }
  }
  return lastError;
}

async function solveGame(game) {
  const capitalizedGame = game.charAt(0).toUpperCase() + game.slice(1);
  setStatus('solving', `Opening ${capitalizedGame}...`);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const gameSlug = GAME_URLS[game].replace('https://www.linkedin.com', '');
    const isOnPage = tab.url && tab.url.includes(gameSlug);

    if (!isOnPage) {
      await chrome.tabs.update(tab.id, { url: GAME_URLS[game] });
      await waitForTabLoad(tab.id);
      await new Promise(r => setTimeout(r, 1000));
    }

    setStatus('solving', `Solving ${capitalizedGame}...`);

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        world: 'MAIN',
        func: () => { window.__linkedinSolverResult = null; },
      });
    } catch (e) {
      return { error: 'Error!' };
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        world: 'MAIN',
        files: [`solvers/${game}.js`],
      });
    } catch (e) {
      return { error: 'Error!' };
    }

    setStatus('solving', `Waiting for ${capitalizedGame}...`);

    const result = await pollForResult(tab.id, 200, 100);

    if (result && result.needsCDP && result.cellIndices) {
      setStatus('solving', `Executing ${capitalizedGame}...`);
      try {
        const cdpResult = await chrome.runtime.sendMessage({
          type: 'ZIP_SOLVE',
          tabId: tab.id,
          cellIndices: result.cellIndices,
        });
        if (cdpResult && cdpResult.error) {
          return { error: 'Error!' };
        }
      } catch (e) {
        return { error: 'Error!' };
      }
    } else if (result && result.needsCDP && result.drags) {
      setStatus('solving', `Executing ${capitalizedGame}...`);
      try {
        const cdpResult = await chrome.runtime.sendMessage({
          type: 'PATCHES_SOLVE',
          tabId: tab.id,
          drags: result.drags,
        });
        if (cdpResult && cdpResult.error) {
          return { error: 'Error!' };
        }
      } catch (e) {
        return { error: 'Error!' };
      }
    } else if (result && result.success) {
      return result;
    } else {
      return { error: 'Error!' };
    }

    return { success: true };
  } catch (err) {
    return { error: 'Error!' };
  }
}

document.querySelectorAll('.game-card').forEach(btn => {
  if (btn.id === 'solve-all-btn') return;
  btn.addEventListener('click', async () => {
    disableButtons(true);
    const game = btn.dataset.game;
    const capitalizedGame = game.charAt(0).toUpperCase() + game.slice(1);
    const res = await solveGame(game);
    if (res && res.error) {
      setStatus('error', 'Error!');
    } else {
      setStatus('success', `${capitalizedGame} solved!`);
    }
    disableButtons(false);
  });
});

document.getElementById('solve-all-btn').addEventListener('click', async () => {
  disableButtons(true);
  const games = ['sudoku', 'tango', 'queens', 'zip', 'patches'];
  
  for (const game of games) {
    const capitalizedGame = game.charAt(0).toUpperCase() + game.slice(1);
    setStatus('solving', `Processing ${capitalizedGame}...`);
    const res = await solveGame(game);
    if (res && res.error) {
      setStatus('error', 'Error!');
      disableButtons(false);
      return;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  setStatus('success', 'All games solved!');
  disableButtons(false);

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.update(tab.id, { url: 'https://www.linkedin.com/games/' });
    }
  } catch (e) {}
});

function updateCountdown() {
  const now = new Date();
  const ptString = now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" });
  const ptDate = new Date(ptString);
  
  const ptMidnight = new Date(ptDate);
  ptMidnight.setHours(24, 0, 0, 0);
  
  const diff = ptMidnight - ptDate;
  
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  
  const el = document.getElementById('countdown');
  if (el) {
    el.textContent = `Next games in: ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
}

updateCountdown();
setInterval(updateCountdown, 1000);

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    for (const [game, url] of Object.entries(GAME_URLS)) {
      const slug = url.replace('https://www.linkedin.com', '');
      if (tab.url.includes(slug)) {
        disableButtons(true);
        const capitalizedGame = game.charAt(0).toUpperCase() + game.slice(1);
        const res = await solveGame(game);
        if (res && res.error) {
          setStatus('error', 'Error!');
        } else {
          setStatus('success', res?.message || `${capitalizedGame} solved!`);
        }
        disableButtons(false);
        return;
      }
    }
  } catch {}
})();