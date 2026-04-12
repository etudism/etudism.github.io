import { createRuntimeContext } from './createContext.js';
import { executePart } from './executePart.js';
import { partName as part00Name, partCode as part00Code } from './parts/00-prelude-and-helpers.js';
import { partName as part01Name, partCode as part01Code } from './parts/01-theme-and-scene-state.js';
import { partName as part02Name, partCode as part02Code } from './parts/02-textures-icons-and-labels.js';
import { partName as part03Name, partCode as part03Code } from './parts/03-hall-architecture.js';
import { partName as part04Name, partCode as part04Code } from './parts/04-layout-and-overlay.js';
import { partName as part05Name, partCode as part05Code } from './parts/05-routing-and-search.js';
import { partName as part06Name, partCode as part06Code } from './parts/06-category-and-selection-basics.js';
import { partName as part07Name, partCode as part07Code } from './parts/07-drawer-and-dragdrop.js';
import { partName as part08Name, partCode as part08Code } from './parts/08-url-state-and-persistence.js';
import { partName as part09Name, partCode as part09Code } from './parts/09-action-menu.js';
import { partName as part10Name, partCode as part10Code } from './parts/10-materials-and-info-panel.js';
import { partName as part11Name, partCode as part11Code } from './parts/11-selection-focus-and-events.js';
import { partName as part12Name, partCode as part12Code } from './parts/12-raycast-resize-and-main-loop.js';

const APP_PARTS = [
  [part00Name, part00Code],
  [part01Name, part01Code],
  [part02Name, part02Code],
  [part03Name, part03Code],
  [part04Name, part04Code],
  [part05Name, part05Code],
  [part06Name, part06Code],
  [part07Name, part07Code],
  [part08Name, part08Code],
  [part09Name, part09Code],
  [part10Name, part10Code],
  [part11Name, part11Code],
  [part12Name, part12Code],
];

function buildCombinedCode() {
  return APP_PARTS.map(([name, code]) => `
ctx.__currentPartName = ${JSON.stringify(name)};
window.__CAETA_LAST_PART__ = ctx.__currentPartName;
// ---- ${name} ----
${code}
`).join('\n\n');
}

export function startApp() {
  try {
    const ctx = createRuntimeContext();
    executePart(ctx, 'app.bundle.js', buildCombinedCode() + '\n//# sourceURL=app.bundle.js');
  } catch (err) {
    console.error(err);
    const errorBox = document.getElementById('errorBox');
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.textContent =
        `Part: ${window.__CAETA_LAST_PART__ || 'unknown'}\n` +
        String(err && err.stack ? err.stack : err);
    }
    throw err;
  }
}
