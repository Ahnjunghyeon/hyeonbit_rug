// Hover is admitted only before a button is held; never steal an external drag.
function createInputPolicy() {
  let mode = 'none', blocked = false;
  return {
    update({ allowed = false, ctrl = false, alt = false, shift = false, hovered = false, buttons = 0 } = {}) {
      const desired = !allowed ? 'none' : ctrl && !alt ? 'cut' : alt && !ctrl ? 'move' : !ctrl && !alt && !shift && hovered ? 'move' : 'none';
      if (!buttons) { blocked = false; mode = desired; }
      else if (blocked || desired === 'none' || desired !== mode) { blocked = true; mode = 'none'; }
      return mode;
    },
    reset() { mode = 'none'; blocked = true; }
  };
}
module.exports = { createInputPolicy };
