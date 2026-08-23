window.solverUtils = {
  sleep: function(ms) { return new Promise(r => setTimeout(r, ms)); },
  click: function(el) {
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }
};