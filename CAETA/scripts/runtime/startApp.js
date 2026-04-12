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

export function startApp() {
  try {
  const ctx = createRuntimeContext();
  executePart(ctx, part00Name, part00Code);
  executePart(ctx, part01Name, part01Code);
  executePart(ctx, part02Name, part02Code);
  executePart(ctx, part03Name, part03Code);
  executePart(ctx, part04Name, part04Code);
  executePart(ctx, part05Name, part05Code);
  executePart(ctx, part06Name, part06Code);
  executePart(ctx, part07Name, part07Code);
  executePart(ctx, part08Name, part08Code);
  executePart(ctx, part09Name, part09Code);
  executePart(ctx, part10Name, part10Code);
  executePart(ctx, part11Name, part11Code);
  executePart(ctx, part12Name, part12Code);
  } catch (err) {
    console.error(err);
    const errorBox = document.getElementById('errorBox');
    if (errorBox) {
      errorBox.style.display = 'block';
      errorBox.textContent = String(err && err.stack ? err.stack : err);
    }
    throw err;
  }
}
