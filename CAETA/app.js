import * as THREE from 'https://esm.sh/three@0.161.0';
import { OrbitControls } from 'https://esm.sh/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { DATA } from './data.js';

const app = document.getElementById('app');
const bottomDrawer = document.getElementById('bottomDrawer');
const drawerPeek = document.getElementById('drawerPeek');
const drawerTitle = document.getElementById('drawerTitle');
const drawerSummaryText = document.getElementById('drawerSummaryText');
const drawerPrimaryCount = document.getElementById('drawerPrimaryCount');
const drawerSecondaryCount = document.getElementById('drawerSecondaryCount');
const drawerPrimaryList = document.getElementById('drawerPrimaryList');
const drawerSecondaryList = document.getElementById('drawerSecondaryList');
const drawerShareBtn = document.getElementById('drawerShareBtn');
const drawerClearBtn = document.getElementById('drawerClearBtn');
const topViewBtn = document.getElementById('topViewBtn');
const resetViewBtn = document.getElementById('resetViewBtn');
const hallModelBtn = document.getElementById('hallModelBtn');
const categoryLayerBtn = document.getElementById('categoryLayerBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const categoryLegend = document.getElementById('categoryLegend');
const categoryLegendList = document.getElementById('categoryLegendList');
const boothSearchInput = document.getElementById('boothSearchInput');
const boothSearchClearBtn = document.getElementById('boothSearchClear');
const boothSearchMeta = document.getElementById('boothSearchMeta');
const boothSearchCount = document.getElementById('boothSearchCount');
const boothSearchResults = document.getElementById('boothSearchResults');
const boothSearchResultsList = document.getElementById('boothSearchResultsList');
const placeholder = document.getElementById('placeholder');
const detail = document.getElementById('detail');
const boothIdEl = document.getElementById('boothId');
const boothNameEl = document.getElementById('boothName');
const boothMetaEl = document.getElementById('boothMeta');
const boothDescEl = document.getElementById('boothDesc');
const linkRow = document.getElementById('linkRow');
const markPrimaryBtn = document.getElementById('markPrimaryBtn');
const markSecondaryBtn = document.getElementById('markSecondaryBtn');
const toast = document.getElementById('toast');
const errorBox = document.getElementById('errorBox');

const boothActionMenu = document.getElementById('boothActionMenu');
const menuBoothId = document.getElementById('menuBoothId');
const menuNodes = boothActionMenu ? Array.from(boothActionMenu.querySelectorAll('.action-node')) : [];

const labelCanvas = document.getElementById('labelCanvas');
const labelCtx = labelCanvas ? labelCanvas.getContext('2d') : null;
let overlayDpr = 1;
let overlayBoothLabels = [];
let overlayAreaLabels = [];
let overlayDirty = true;

function resizeLabelCanvas() {
  if (!labelCanvas || !labelCtx) return;
  overlayDpr = Math.min(window.devicePixelRatio || 1, 2);
  labelCanvas.width = Math.max(1, Math.floor(window.innerWidth * overlayDpr));
  labelCanvas.height = Math.max(1, Math.floor(window.innerHeight * overlayDpr));
  labelCanvas.style.width = `${window.innerWidth}px`;
  labelCanvas.style.height = `${window.innerHeight}px`;
  labelCtx.setTransform(overlayDpr, 0, 0, overlayDpr, 0, 0);
  overlayDirty = true;
  labelCtx.textAlign = 'center';
  labelCtx.textBaseline = 'middle';
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function showError(err) {
  errorBox.style.display = 'block';
  errorBox.textContent = '描画エラー\n' + (err && err.stack ? err.stack : String(err));
}

try {
  if (drawerTitle) drawerTitle.textContent = `全${DATA.booths.length}ブース`;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf5f5f5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  app.appendChild(renderer.domElement);
  if (labelCtx) resizeLabelCanvas();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 5, 4000);
  camera.position.set(0, 820, 980);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);
  controls.minDistance = 180;
  controls.maxDistance = 2400;
  controls.maxPolarAngle = Math.PI;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
  controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;

  scene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const light1 = new THREE.DirectionalLight(0xffffff, 1.3);
  light1.position.set(700, 1400, 800);
  light1.castShadow = true;
  light1.shadow.mapSize.width = 2048;
  light1.shadow.mapSize.height = 2048;
  scene.add(light1);
  const light2 = new THREE.DirectionalLight(0xffffff, 0.45);
  light2.position.set(-700, 900, -800);
  scene.add(light2);

  const guide = new THREE.GridHelper(4200, 84, 0xcccccc, 0xe5e7eb);
  guide.position.y = -0.01;
  scene.add(guide);
  const guideMaterials = Array.isArray(guide.material) ? guide.material : [guide.material];
  guideMaterials.forEach((material) => {
    if (!material) return;
    material.transparent = true;
    material.opacity = 0.48;
    material.depthWrite = false;
  });

  function updateThemeVisuals() {
    const isDark = themeMode === 'dark';
    scene.background = new THREE.Color(isDark ? 0x08111f : 0xf5f5f5);
    if (guideMaterials[0]?.color) guideMaterials[0].color.setHex(isDark ? 0x475569 : 0xcccccc);
    if (guideMaterials[1]?.color) guideMaterials[1].color.setHex(isDark ? 0x334155 : 0xe5e7eb);
    guideMaterials.forEach((material) => {
      if (!material) return;
      material.opacity = isDark ? 0.34 : 0.48;
    });
    overlayDirty = true;
  }

  function updateThemeToggleButton() {
    if (!themeToggleBtn) return;
    const isDark = themeMode === 'dark';
    themeToggleBtn.classList.toggle('is-dark', isDark);
    themeToggleBtn.classList.toggle('is-active', isDark);
    themeToggleBtn.setAttribute('aria-pressed', String(isDark));
    themeToggleBtn.title = isDark ? 'ライトモードに切り替え' : 'ダークモードに切り替え';
  }

  function applyThemeMode(next, { save = true } = {}) {
    themeMode = next === 'dark' ? 'dark' : 'light';
    document.documentElement.dataset.theme = themeMode;
    updateThemeToggleButton();
    updateThemeVisuals();
    if (save) saveState();
  }

  const PAGE_W = DATA.pages[0].w;
  const PAGE_H = DATA.pages[0].h;
  const GAP = 45;
  const FRAME_WALL_H = 8;
  const FRAME_WALL_T = 2.6;
  const PORTAL_OPEN_HALF = 24;
  const BOOTH_H = 6.0;
  const LABEL_PLANE_Y = BOOTH_H + 0.06;
  const ZONE_Y = 0.12;
  const HALL_OFFSETS = { sideBySide: { 1: -(PAGE_W/2 + GAP/2), 2: PAGE_W/2 + GAP/2 }, stacked: { 1: 0, 2: 0 } };
  let layoutMode = 'sideBySide';
  const ROUTE_GRID = 6;
  const ROUTE_PADDING = 1.5;
  const ROUTE_Y = 12.0;
  const ROUTE_OUTER_MARGIN = 18;
  const ROUTE_TUBE_RADIUS = 1.05;
  const ROUTE_MARKER_RADIUS = 1.55;
  const ROUTE_ARROW_SPACING = 120;
  const ROUTE_CORNER_RADIUS = 8;
  const routeGroup = new THREE.Group();
  scene.add(routeGroup);
  const routeStyle = {};
  const routeNodeByPage = new Map();
  const routeGridByPage = new Map();
  const pageDataByPage = new Map(DATA.pages.map((page) => [page.page, page]));
  const HALL_PORTALS = {
    1: {
      entrance: { xRatio: 0.94102, yRatio: 0.23065 },
      exit: { xRatio: 0.94428, yRatio: 0.70736 }
    },
    2: {
      entrance: { xRatio: 0.94562, yRatio: 0.32255 },
      exit: { xRatio: 0.94856, yRatio: 0.75570 }
    }
  };

  const SPECIAL_OBJECTS = {
    1: {
      office: { type: 'rect', xRatio: 0.93023, yRatio: 0.42078, wRatio: 0.02326, hRatio: 0.07613, color: 0x22aee8, label: '事\n務\n局\n本\n部', textColor: '#ffffff' },
      reading: { type: 'rect', xRatio: 0.73304, yRatio: 0.85562, wRatio: 0.32849, hRatio: 0.10219, color: 0xe7a0a0, label: '試し読みコーナー', sublabel: '12:00〜16:30', textColor: '#ffffff' }
    },
    2: {
      office: { type: 'rect', xRatio: 0.93411, yRatio: 0.42833, wRatio: 0.02326, hRatio: 0.07613, color: 0x22aee8, label: '事\n務\n局\n本\n部', textColor: '#ffffff' },
      reading: { type: 'rect', xRatio: 0.74079, yRatio: 0.86562, wRatio: 0.32849, hRatio: 0.10219, color: 0xe7a0a0, label: '試し読みコーナー', sublabel: '12:00〜16:30', textColor: '#ffffff' }
    }
  };

  const HALL_FRAMES = {
    1: { x0Ratio: 0.06695, y0Ratio: 0.07065, x1Ratio: 0.94421, y1Ratio: 0.95504 },
    2: { x0Ratio: 0.07043, y0Ratio: 0.07016, x1Ratio: 0.94840, y1Ratio: 0.95504 }
  };

  const hall1Material = new THREE.MeshStandardMaterial({ color: 0xbfe7ff });
  const hall2Material = new THREE.MeshStandardMaterial({ color: 0xd7ecff });
  const categoryBaseMaterialFallback = new THREE.MeshStandardMaterial({ color: 0xcbd5e1 });
  const categoryMaterialCache = new Map();
  const categoryLegendHoverMaterialCache = new Map();
  const categoryColorCache = new Map();
  const hoverMaterial = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.22 });
  const primaryMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.16 });
  const secondaryMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x9a3412, emissiveIntensity: 0.14 });
  const selectedGlowMaterial = new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x2563eb, emissiveIntensity: 0.55 });
  const searchMatchMaterial = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.24 });
  const searchHoverMaterial = new THREE.MeshStandardMaterial({ color: 0x10b981, emissive: 0x047857, emissiveIntensity: 0.44 });
  const selectedPrimaryMaterial = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0x991b1b, emissiveIntensity: 0.24 });
  const selectedSecondaryMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0x9a3412, emissiveIntensity: 0.22 });
  const emptyInfoMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f7fb });
  const boothGeometry = new THREE.BoxGeometry(1, 1, 1);
  const tempVec = new THREE.Vector3();
  const pageTextureCache = new Map();
  const pageLabelTextureCache = new Map();

  const labelColorCache = new Map();
  function labelColor(page, label) {
    const key = page + '-' + label;
    if (labelColorCache.has(key)) return labelColorCache.get(key);
    const chars = Array.from(label);
    const code = chars.reduce((a, c) => a + c.codePointAt(0), page * 37);
    const baseHue = page === 1 ? 205 : 25;
    const hue = (baseHue + (code * 17) % 90) % 360;
    const color = new THREE.Color(`hsl(${hue} 68% 82%)`);
    labelColorCache.set(key, color);
    return color;
  }

  function createTextTexture(drawFn, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function makeBadgeSprite(text, options = {}) {
    const w = options.width || 180;
    const h = options.height || 86;
    const tail = options.tail || 16;
    const texture = createTextTexture((ctx, width, height) => {
      const bodyH = height - tail;
      const r = 22;
      const tailW = 24;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.bg || 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = options.stroke || 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(width, 0, width, bodyH, r);
      ctx.arcTo(width, bodyH, width / 2 + tailW / 2, bodyH, r);
      ctx.lineTo(width / 2 + tailW / 2, bodyH);
      ctx.lineTo(width / 2, height - 2);
      ctx.lineTo(width / 2 - tailW / 2, bodyH);
      ctx.arcTo(0, bodyH, 0, 0, r);
      ctx.arcTo(0, 0, width, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = options.color || '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 40}px sans-serif`;
      ctx.fillText(text, width / 2, bodyH / 2 + 1);
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.34, h * 0.34, 1);
    return sprite;
  }

  function makeHallNameSprite(text, options = {}) {
    const w = options.width || 220;
    const h = options.height || 62;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 24}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.fillText(text, width / 2, height / 2 + 1);
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.26, h * 0.26, 1);
    return sprite;
  }
  function makeFlatTextSprite(text, options = {}) {
    const w = options.width || 320;
    const h = options.height || 92;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 34}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      const lines = Array.isArray(text) ? text : [text];
      const gap = options.lineGap || (options.fontSize || 34) * 1.08;
      const startY = height / 2 - ((lines.length - 1) * gap) / 2;
      lines.forEach((line, idx) => ctx.fillText(line, width / 2, startY + idx * gap));
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.18, h * 0.18, 1);
    return sprite;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function makeIconCanvas(kind, { size = 160, fill = '#ffffff', stroke = '#ffffff', bg = 'rgba(255,255,255,0.96)', bgStroke = 'rgba(255,255,255,0.22)' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const box = size * 0.72;
    const x = (size - box) / 2;
    const y = (size - box) / 2;
    const radius = size * 0.2;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.035;
    roundedRectPath(ctx, x, y, box, box, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    roundedRectPath(ctx, x, y, box, box, radius);
    ctx.lineWidth = size * 0.015;
    ctx.strokeStyle = bgStroke;
    ctx.stroke();

    let iconPath = 'M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13.5l-6.5-4.2-6.5 4.2V6A1.5 1.5 0 0 1 7 4.5z';
    if (kind === 'heart') {
      iconPath = 'M12 20.5s-7-4.35-7-10.1c0-2.53 1.9-4.4 4.35-4.4 1.48 0 2.57.69 3.65 2.02 1.08-1.33 2.17-2.02 3.65-2.02 2.45 0 4.35 1.87 4.35 4.4 0 5.75-7 10.1-7 10.1z';
    } else if (kind === 'clear') {
      iconPath = 'M7 7l10 10M17 7L7 17';
    }

    ctx.save();
    const iconBox = size * (kind === 'clear' ? 0.32 : 0.345);
    const iconScale = iconBox / 24;
    const iconOffsetY = kind === 'heart' ? size * 0.004 : size * 0.002;
    ctx.translate(cx - 12 * iconScale, cy - 12 * iconScale + iconOffsetY);
    ctx.scale(iconScale, iconScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    const path = new Path2D(iconPath);
    ctx.lineWidth = kind === 'clear' ? 2.2 : (kind === 'heart' ? 1.8 : 1.65);
    ctx.stroke(path);
    ctx.restore();

    return canvas;
  }

  function actionTierVisual(tier, hovered = false) {
    const alpha = hovered ? 0.78 : 1;
    if (tier === 'primary') return { bg: `rgba(239,68,68,${alpha})`, bgStroke: `rgba(239,68,68,${alpha})` };
    if (tier === 'secondary') return { bg: `rgba(245,158,11,${alpha})`, bgStroke: `rgba(245,158,11,${alpha})` };
    return { bg: `rgba(107,114,128,${alpha})`, bgStroke: `rgba(107,114,128,${alpha})` };
  }

  function makeActionIconSprite(kind, options = {}) {
    const tier = options.tier || 'primary';
    const visual = actionTierVisual(tier, false);
    const canvas = makeIconCanvas(kind, {
      size: 320,
      fill: 'rgba(255,255,255,0.98)',
      stroke: 'rgba(255,255,255,0.98)',
      bg: visual.bg,
      bgStroke: visual.bgStroke
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 25.6), material);
    sprite.renderOrder = 999;
    sprite.userData.kind = kind;
    sprite.userData.tier = tier;
    return sprite;
  }

  function setActionIconSpriteVisual(sprite, { hovered = false, active = false } = {}) {
    if (!sprite?.material) return;
    const visual = actionTierVisual(sprite.userData.tier, hovered);
    const canvas = makeIconCanvas(sprite.userData.kind || 'heart', {
      size: hovered ? 352 : 320,
      fill: 'rgba(255,255,255,0.98)',
      stroke: 'rgba(255,255,255,0.98)',
      bg: visual.bg,
      bgStroke: visual.bgStroke
    });
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.needsUpdate = true;
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    const prevTexture = sprite.material.map;
    sprite.material.map = nextTexture;
    sprite.material.opacity = 1;
    const scale = hovered ? 30.4 : (active ? 28.2 : 25.6);
    sprite.scale.set(scale / 25.6, scale / 25.6, 1);
    prevTexture?.dispose?.();
  }

  function makeGroundTextMesh(textLines, options = {}) {
    const w = options.width || 420;
    const h = options.height || 120;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      const lines = Array.isArray(textLines) ? textLines : [textLines];
      const fontSize = options.fontSize || 48;
      const gap = options.lineGap || fontSize * 1.02;
      const startY = height / 2 - ((lines.length - 1) * gap) / 2;

      if (options.bg) {
        const padX = options.bgPadX || Math.round(width * 0.055);
        const padY = options.bgPadY || Math.round(height * 0.12);
        const radius = options.bgRadius || Math.round(Math.min(width, height) * 0.16);
        const x = padX;
        const y = padY;
        const rw = width - padX * 2;
        const rh = height - padY * 2;
        ctx.fillStyle = options.bg;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + rw - radius, y);
        ctx.quadraticCurveTo(x + rw, y, x + rw, y + radius);
        ctx.lineTo(x + rw, y + rh - radius);
        ctx.quadraticCurveTo(x + rw, y + rh, x + rw - radius, y + rh);
        ctx.lineTo(x + radius, y + rh);
        ctx.quadraticCurveTo(x, y + rh, x, y + rh - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, idx) => {
        ctx.font = `800 ${idx === 0 ? fontSize : Math.round(fontSize * 0.58)}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
        if (options.stroke) {
          ctx.strokeStyle = options.stroke;
          ctx.lineWidth = options.strokeWidth || Math.max(6, Math.round(fontSize * 0.14));
          ctx.lineJoin = 'round';
          ctx.strokeText(line, width / 2, startY + idx * gap);
        }
        ctx.fillStyle = options.color || '#111827';
        ctx.fillText(line, width / 2, startY + idx * gap);
      });
    }, w, h);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(options.worldW || 44, options.worldH || 12),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: 0.06 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    return mesh;
  }

  function makeVerticalTopTextMesh(text, options = {}) {
    const chars = Array.from(text.replace(/\s+/g, ''));
    const worldW = options.worldW || 8;
    const worldH = options.worldH || 24;
    const texW = options.width || 256;
    const texH = options.height || 1024;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = options.paddingX || Math.round(width * 0.14);
      const paddingY = options.paddingY || Math.round(height * 0.08);
      const usableW = width - paddingX * 2;
      const usableH = height - paddingY * 2;
      const step = usableH / chars.length;

      // Width-constrained so each character fits inside the sign width like the PDF.
      const fontSize = Math.floor(Math.min(usableW * 0.86, step * 0.78));
      ctx.font = `800 ${fontSize}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;

      const cx = width / 2;
      for (let i = 0; i < chars.length; i++) {
        const cy = paddingY + step * (i + 0.5);
        ctx.fillText(chars[i], cx, cy);
      }
    }, texW, texH);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: 0.06 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    return mesh;
  }


  function makeAreaLabelGroundMesh(band) {
    const label = String(band.label || '');
    const [, , bboxW, bboxH] = band.bbox;
    const isVertical = bboxH > bboxW * 1.8;
    let mesh;

    if (isVertical) {
      mesh = makeVerticalTopTextMesh(label, {
        color: '#0f172a',
        worldW: Math.max(4.2, Math.min(6.2, bboxW * 1.15)),
        worldH: Math.max(10.5, Math.min(22, bboxH * 0.72)),
        width: 256,
        height: 1024
      });
    } else {
      mesh = makeGroundTextMesh(label, {
        color: '#0f172a',
        stroke: 'rgba(255,255,255,0.96)',
        strokeWidth: 18,
        worldW: label.length <= 1 ? 9.8 : 18,
        worldH: label.length <= 1 ? 9.8 : 8.5,
        width: label.length <= 1 ? 512 : 1024,
        height: label.length <= 1 ? 512 : 320,
        fontSize: label.length <= 1 ? 220 : 110
      });
    }

    mesh.position.y = 0.08;
    mesh.renderOrder = 6;
    mesh.raycast = () => {};
    return mesh;
  }


  function makePortalTriangleMesh(options = {}) {
    const size = options.size || 9;
    const h = Math.sqrt(3) * 0.5 * size;
    const dir = options.direction === 'left' ? -1 : 1;
    const shape = new THREE.Shape();
    shape.moveTo(dir * (size * 0.5), 0);
    shape.lineTo(-dir * (size * 0.5), -h * 0.5);
    shape.lineTo(-dir * (size * 0.5), h * 0.5);
    shape.closePath();
    const material = new THREE.MeshBasicMaterial({
      color: options.color || '#ef4444',
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 1
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = options.y || 0.26;
    mesh.renderOrder = 1;
    return mesh;
  }


  const hallArchitectureGroups = new Map();
  const hallGroups = new Map();
  const boothMeshes = [];
  const boothById = new Map();
  const groupMembers = new Map();
  const areaLabelMeshes = [];
  let hallModelVisible = false;
  let hallAutoArchitectureVisible = true;
  const HALL_ARCH_SPECS = {
    1: {
      style: 'wood',
      wallH: 58,
      lowerWallH: 24,
      roofY: 66,
      beamY: 61,
      signNumbers: ['1', '2'],
      columns: [
        [-0.26, -0.20],
        [-0.26, 0.12],
        [0.02, -0.20],
        [0.02, 0.12]
      ],
      shutters: [
        { side: 'right', ratio: -0.34, w: 28, h: 18 },
        { side: 'right', ratio: -0.04, w: 28, h: 18 },
        { side: 'back', ratio: 0.24, w: 30, h: 18 }
      ],
      exitDoors: [
        { side: 'left', ratio: 0.22 },
        { side: 'back', ratio: -0.18 },
        { side: 'right', ratio: 0.34 }
      ]
    },
    2: {
      style: 'steel',
      wallH: 88,
      lowerWallH: 28,
      roofY: 98,
      beamY: 79,
      signNumbers: ['3', '4'],
      columns: [
        [-0.28, -0.24],
        [-0.28, 0.10],
        [0.00, -0.24],
        [0.00, 0.10]
      ],
      shutters: [
        { side: 'right', ratio: -0.30, w: 26, h: 22 },
        { side: 'right', ratio: 0.30, w: 26, h: 22 }
      ],
      exitDoors: [
        { side: 'left', ratio: 0.18 },
        { side: 'back', ratio: -0.24 },
        { side: 'right', ratio: 0.06 }
      ]
    }
  };

  function createConcreteTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e4de';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = 0.018 + Math.random() * 0.035;
      const g = 205 + Math.floor(Math.random() * 28);
      ctx.fillStyle = `rgba(${g},${g},${g},${a})`;
      const r = Math.random() * 1.6 + 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(140,140,140,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 11);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    return texture;
  }

  const hallArchitectureMaterials = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xe7e3dd, map: createConcreteTexture(), roughness: 1.0, metalness: 0.0 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.96, metalness: 0.02 }),
    wallPanel: new THREE.MeshStandardMaterial({ color: 0xc8ced7, roughness: 0.95, metalness: 0.04 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x8f97a1, roughness: 0.92, metalness: 0.06 }),
    column: new THREE.MeshStandardMaterial({ color: 0xd6dae0, roughness: 0.95, metalness: 0.03 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9, metalness: 0.1 }),
    shutter: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.86, metalness: 0.12 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6f4e35, roughness: 0.95, metalness: 0.02 }),
    woodInset: new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.96, metalness: 0.05 }),
    ceilingLight: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.84, metalness: 0.22 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2f353d, roughness: 0.94, metalness: 0.14 }),
    blackBox: new THREE.MeshStandardMaterial({ color: 0x1f252c, roughness: 0.96, metalness: 0.08 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd4e5, roughness: 0.12, metalness: 0.18, transparent: true, opacity: 0.35 }),
    signBack: new THREE.MeshStandardMaterial({ color: 0xbcc3cc, roughness: 0.96, metalness: 0.02 })
  };

  function addArchBox(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      options.material || hallArchitectureMaterials.wall
    );
    mesh.scale.set(options.w || 1, options.h || 1, options.d || 1);
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
    mesh.castShadow = !!options.castShadow;
    mesh.receiveShadow = !!options.receiveShadow;
    mesh.renderOrder = options.renderOrder || 0;
    parent.add(mesh);
    return mesh;
  }

  function addArchCylinder(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(options.radius || 1, options.radius || 1, options.h || 1, options.radialSegments || 18),
      options.material || hallArchitectureMaterials.column
    );
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.castShadow = !!options.castShadow;
    mesh.receiveShadow = !!options.receiveShadow;
    parent.add(mesh);
    return mesh;
  }

  function addArchPlane(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(options.w || 1, options.h || 1),
      options.material || hallArchitectureMaterials.ceilingLight
    );
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
    mesh.renderOrder = options.renderOrder || 0;
    parent.add(mesh);
    return mesh;
  }

  function makeWallTextPanel(lines, options = {}) {
    const width = options.width || 420;
    const height = options.height || 260;
    const texture = createTextTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = options.bg || '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (options.border) {
        ctx.strokeStyle = options.border;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }
      const list = Array.isArray(lines) ? lines : [lines];
      const gap = options.lineGap || 48;
      const startY = h / 2 - ((list.length - 1) * gap) / 2;
      list.forEach((line, idx) => {
        ctx.fillStyle = Array.isArray(options.colors) ? (options.colors[idx] || options.color || '#111827') : (options.color || '#111827');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = options.fonts?.[idx] || `800 ${idx === list.length - 1 ? 94 : 32}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
        ctx.fillText(line, w / 2, startY + idx * gap);
      });
    }, width, height);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(options.worldW || 18, options.worldH || 24),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
  }

  function makeHallPillarSign(number) {
    const texture = createTextTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(17,24,39,0.18)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(28, 26, 104, 92);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px Inter, "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('South', 80, 56);
      ctx.fillText('南', 80, 89);
      ctx.fillStyle = '#111827';
      ctx.font = '800 120px Inter, "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.fillText(String(number), 240, 78);
    }, 360, 150);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(18, 7.5),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
  }

  function makeIntervals(min, max, gaps) {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    const out = [];
    let cursor = min;
    for (const [g0, g1] of sorted) {
      if (g0 > cursor) out.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (cursor < max) out.push([cursor, max]);
    return out.filter(([a, b]) => b - a > 4);
  }

  function addRightWallSegments(parent, frame, lowerWallH, wallT, gaps, material) {
    const x = frame.w / 2 - wallT / 2;
    const minZ = -frame.h / 2;
    const maxZ = frame.h / 2;
    const intervals = makeIntervals(minZ, maxZ, gaps.map(({ center, size }) => [center - size / 2, center + size / 2]));
    intervals.forEach(([a, b]) => {
      addArchBox(parent, { x, y: lowerWallH / 2, z: (a + b) / 2, w: wallT, h: lowerWallH, d: b - a, material });
    });
  }

  function addDoorFrame(parent, options = {}) {
    const side = options.side || 'right';
    const w = options.w || 18;
    const h = options.h || 16;
    const frameDepth = 1.5;
    const frameThick = 1.1;
    const y = h / 2 + 0.2;
    let x = options.x || 0;
    let z = options.z || 0;
    let frameRy = 0;
    if (side === 'right') x = options.wallX - 0.25;
    if (side === 'left') x = options.wallX + 0.25;
    if (side === 'back') z = options.wallZ + 0.25;
    if (side === 'front') z = options.wallZ - 0.25;
    if (side === 'right' || side === 'left') frameRy = Math.PI / 2;

    addArchBox(parent, { x, y, z, w, h, d: frameDepth, material: hallArchitectureMaterials.trim, ry: frameRy });
    addArchBox(parent, { x, y, z, w: w - frameThick * 2.2, h: h - frameThick * 2.2, d: frameDepth + 0.2, material: options.glass ? hallArchitectureMaterials.glass : hallArchitectureMaterials.blackBox, ry: frameRy });
    addArchBox(parent, { x, y: y + h / 2 + 2.6, z, w: w + 3, h: 1.2, d: frameDepth + 0.6, material: hallArchitectureMaterials.wallDark, ry: frameRy });
    if (options.exitLabel) {
      const exitMesh = makeWallTextPanel(['EXIT'], {
        width: 220,
        height: 82,
        bg: '#22c55e',
        color: '#ffffff',
        worldW: 9.2,
        worldH: 3.4,
        fonts: ['800 44px Inter, "Hiragino Sans", "Yu Gothic", sans-serif']
      });
      exitMesh.position.set(x, y + h / 2 + 5.3, z);
      if (side === 'right') exitMesh.rotation.y = -Math.PI / 2;
      if (side === 'left') exitMesh.rotation.y = Math.PI / 2;
      if (side === 'back') exitMesh.rotation.y = Math.PI;
      parent.add(exitMesh);
    }
  }

  function addShutter(parent, options = {}) {
    const side = options.side || 'right';
    const w = options.w || 24;
    const h = options.h || 18;
    const slatCount = 10;
    const slatGap = h / slatCount;
    let x = options.x || 0;
    let z = options.z || 0;
    let ry = 0;
    if (side === 'right' || side === 'left') ry = Math.PI / 2;
    const wallX = options.wallX || 0;
    const wallZ = options.wallZ || 0;
    if (side === 'right') x = wallX - 0.35;
    if (side === 'left') x = wallX + 0.35;
    if (side === 'back') z = wallZ + 0.35;
    if (side === 'front') z = wallZ - 0.35;
    addArchBox(parent, { x, y: h / 2, z, w, h, d: 1.1, material: hallArchitectureMaterials.shutter, ry });
    for (let i = 1; i < slatCount; i++) {
      addArchBox(parent, { x, y: i * slatGap, z, w: w - 0.6, h: 0.15, d: 1.24, material: hallArchitectureMaterials.wallDark, ry });
    }
    addArchBox(parent, { x, y: h + 1.2, z, w: w + 2.4, h: 1.1, d: 1.8, material: hallArchitectureMaterials.wallDark, ry });
  }

  function createLatticeBeam(length, options = {}) {
    const group = new THREE.Group();
    const width = options.width || 4.2;
    const height = options.height || 6.6;
    const segments = options.segments || 10;
    addArchBox(group, { x: 0, y: height / 2, z: 0, w: length, h: 0.8, d: width, material: options.material || hallArchitectureMaterials.steel });
    addArchBox(group, { x: 0, y: -height / 2, z: 0, w: length, h: 0.8, d: width, material: options.material || hallArchitectureMaterials.steel });
    const step = length / segments;
    for (let i = 0; i <= segments; i++) {
      const x = -length / 2 + i * step;
      addArchBox(group, { x, y: 0, z: 0, w: 0.45, h: height - 0.4, d: width * 0.7, material: hallArchitectureMaterials.steelDark });
    }
    const diagLen = Math.sqrt(step * step + height * height) + 0.4;
    const angle = Math.atan2(height, step);
    for (let i = 0; i < segments; i++) {
      const cx = -length / 2 + step * (i + 0.5);
      const diagA = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.38, 0.38), hallArchitectureMaterials.steelDark);
      diagA.position.set(cx, 0, 0);
      diagA.rotation.z = angle * (i % 2 === 0 ? 1 : -1);
      group.add(diagA);
      const diagB = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.38, 0.38), hallArchitectureMaterials.steelDark);
      diagB.position.set(cx, 0, 0);
      diagB.rotation.z = angle * (i % 2 === 0 ? -1 : 1);
      group.add(diagB);
    }
    return group;
  }

  function addLatticeBeam(parent, axis, length, x, y, z, options = {}) {
    const beam = createLatticeBeam(length, options);
    beam.position.set(x, y, z);
    if (axis === 'z') beam.rotation.y = Math.PI / 2;
    parent.add(beam);
    return beam;
  }

  function buildWoodCeiling(parent, frame, spec) {
    const roof = new THREE.Group();
    parent.add(roof);
    addArchBox(roof, { x: 0, y: spec.roofY + 2.2, z: 0, w: frame.w + 18, h: 4.4, d: frame.h + 18, material: hallArchitectureMaterials.woodInset });
    const xCount = 10;
    const zCount = 12;
    const cellW = frame.w / xCount;
    const cellH = frame.h / zCount;
    for (let i = 1; i < xCount; i++) {
      const x = -frame.w / 2 + i * cellW;
      addArchBox(roof, { x, y: spec.beamY, z: 0, w: 2.9, h: 6.2, d: frame.h + 10, material: hallArchitectureMaterials.wood });
    }
    for (let i = 1; i < zCount; i++) {
      const z = -frame.h / 2 + i * cellH;
      addArchBox(roof, { x: 0, y: spec.beamY, z, w: frame.w + 10, h: 6.2, d: 2.9, material: hallArchitectureMaterials.wood });
    }
    for (let ix = 0; ix < xCount; ix++) {
      for (let iz = 0; iz < zCount; iz++) {
        const x = -frame.w / 2 + cellW * (ix + 0.5);
        const z = -frame.h / 2 + cellH * (iz + 0.5);
        if ((ix + iz) % 2 === 0) {
          addArchBox(roof, { x, y: spec.roofY + 0.15, z, w: cellW - 5.8, h: 1.2, d: cellH - 5.8, material: hallArchitectureMaterials.woodInset });
        }
        if ((ix + iz) % 3 === 0) {
          addArchPlane(roof, { x, y: spec.beamY - 3.7, z, w: Math.min(10, cellW - 10), h: 2.6, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 5 });
        }
      }
    }
    const serviceXs = [-0.36, -0.10, 0.16, 0.38].map((r) => r * frame.w);
    serviceXs.forEach((x) => addArchBox(roof, { x, y: spec.roofY + 4.2, z: 0, w: 8.4, h: 3.0, d: frame.h + 16, material: hallArchitectureMaterials.blackBox }));
    return roof;
  }

  function buildSteelCeiling(parent, frame, spec) {
    const roof = new THREE.Group();
    parent.add(roof);
    addArchBox(roof, { x: 0, y: spec.roofY + 8, z: 0, w: frame.w + 24, h: 3.6, d: frame.h + 24, material: hallArchitectureMaterials.wall });
    addArchBox(roof, { x: 0, y: spec.beamY - 17, z: -frame.h * 0.36, w: frame.w + 16, h: 5.2, d: 8, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: 0, y: spec.beamY - 17, z: frame.h * 0.36, w: frame.w + 16, h: 5.2, d: 8, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: -frame.w * 0.30, y: spec.beamY - 11, z: 0, w: 8, h: 4.8, d: frame.h + 10, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: frame.w * 0.12, y: spec.beamY - 11, z: 0, w: 8, h: 4.8, d: frame.h + 10, material: hallArchitectureMaterials.steelDark });
    [-0.32, -0.12, 0.08, 0.28].map((r) => r * frame.h).forEach((z) => {
      addLatticeBeam(roof, 'x', frame.w + 18, 0, spec.beamY, z, { width: 4.6, height: 8.0, segments: 12, material: hallArchitectureMaterials.steel });
    });
    [-0.32, -0.05, 0.24].map((r) => r * frame.w).forEach((x) => {
      addLatticeBeam(roof, 'z', frame.h + 20, x, spec.beamY + 7, 0, { width: 4.2, height: 7.0, segments: 14, material: hallArchitectureMaterials.steel });
    });
    const lightXs = [-0.30, -0.08, 0.14, 0.36].map((r) => r * frame.w);
    const lightZs = [-0.30, -0.08, 0.14, 0.36].map((r) => r * frame.h);
    lightXs.forEach((x) => {
      lightZs.forEach((z) => {
        const cluster = new THREE.Group();
        [[-3.4, -1.2], [3.4, -1.2], [-3.4, 1.2], [3.4, 1.2]].forEach(([dx, dz]) => {
          addArchPlane(cluster, { x: dx, y: 0, z: dz, w: 5.4, h: 1.5, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 5 });
        });
        cluster.position.set(x, spec.beamY - 8.6, z);
        roof.add(cluster);
      });
    });
    [
      [-frame.w * 0.12, spec.beamY - 18, -frame.h * 0.10],
      [frame.w * 0.10, spec.beamY - 20, frame.h * 0.08],
      [frame.w * 0.28, spec.beamY - 22, -frame.h * 0.22]
    ].forEach(([x, y, z]) => {
      addArchBox(roof, { x, y, z, w: 4.2, h: 4.2, d: 7.0, material: hallArchitectureMaterials.blackBox });
    });
    return roof;
  }

  function addHallNumberTowers(parent, frame, spec) {
    const towerX = frame.w / 2 - 6;
    const towerZs = [-frame.h * 0.31, frame.h * 0.29];
    towerZs.forEach((z, idx) => {
      addArchBox(parent, { x: towerX, y: 23, z, w: 10, h: 46, d: 36, material: hallArchitectureMaterials.signBack });
      const signMesh = makeHallPillarSign(spec.signNumbers[idx] || spec.signNumbers[0]);
      signMesh.position.set(towerX - 5.2, 24, z);
      signMesh.rotation.y = -Math.PI / 2;
      parent.add(signMesh);
    });
  }

  function buildCommonHallEnvelope(parent, pageInfo, frame, spec) {
    const wallT = 6;
    const xMin = -frame.w / 2;
    const xMax = frame.w / 2;
    const zMin = -frame.h / 2;
    const zMax = frame.h / 2;
    const entranceZ = pageInfo.h * HALL_PORTALS[pageInfo.page].entrance.yRatio - frame.cy;
    const exitZ = pageInfo.h * HALL_PORTALS[pageInfo.page].exit.yRatio - frame.cy;
    const portalGaps = [
      { center: entranceZ, size: 40 },
      { center: exitZ, size: 40 }
    ];

    addArchBox(parent, { x: 0, y: 0.04, z: 0, w: frame.w, h: 0.08, d: frame.h, material: hallArchitectureMaterials.concrete, receiveShadow: true });
    addArchBox(parent, { x: 0, y: spec.lowerWallH / 2, z: zMin + wallT / 2, w: frame.w, h: spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wall });
    addArchBox(parent, { x: 0, y: spec.lowerWallH / 2, z: zMax - wallT / 2, w: frame.w, h: spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wall });
    addArchBox(parent, { x: xMin + wallT / 2, y: spec.lowerWallH / 2, z: 0, w: wallT, h: spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wall });
    addRightWallSegments(parent, frame, spec.lowerWallH, wallT, portalGaps, hallArchitectureMaterials.wall);

    addArchBox(parent, { x: 0, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: zMin + wallT / 2, w: frame.w, h: spec.wallH - spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: 0, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: zMax - wallT / 2, w: frame.w, h: spec.wallH - spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: xMin + wallT / 2, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: 0, w: wallT, h: spec.wallH - spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: xMax - wallT / 2, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: 0, w: wallT, h: spec.wallH - spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wallPanel });

    addArchBox(parent, { x: 0, y: spec.lowerWallH + 9, z: zMin + wallT * 0.7, w: frame.w - 16, h: 2.2, d: 1.8, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: 0, y: spec.lowerWallH + 9, z: zMax - wallT * 0.7, w: frame.w - 16, h: 2.2, d: 1.8, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: xMin + wallT * 0.7, y: spec.lowerWallH + 9, z: 0, w: 1.8, h: 2.2, d: frame.h - 20, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: xMax - wallT * 0.7, y: spec.lowerWallH + 9, z: 0, w: 1.8, h: 2.2, d: frame.h - 20, material: hallArchitectureMaterials.wallDark });

    [[xMin + wallT / 2, zMin + wallT / 2], [xMin + wallT / 2, zMax - wallT / 2], [xMax - wallT / 2, zMin + wallT / 2], [xMax - wallT / 2, zMax - wallT / 2]].forEach(([x, z]) => {
      addArchBox(parent, { x, y: spec.wallH / 2, z, w: wallT + 1.8, h: spec.wallH, d: wallT + 1.8, material: hallArchitectureMaterials.trim });
    });

    spec.columns.forEach(([rx, rz]) => {
      const x = rx * frame.w;
      const z = rz * frame.h;
      addArchCylinder(parent, { x, y: spec.wallH / 2, z, radius: 4.2, h: spec.wallH, material: hallArchitectureMaterials.column });
      addArchBox(parent, { x, y: spec.wallH + 2.8, z, w: 13.5, h: 2.4, d: 13.5, material: hallArchitectureMaterials.wallDark });
    });

    spec.exitDoors.forEach((door) => {
      if (door.side === 'right') addDoorFrame(parent, { side: 'right', z: door.ratio * frame.h, wallX: xMax - wallT, w: 18, h: 15, glass: true, exitLabel: false });
      if (door.side === 'left') addDoorFrame(parent, { side: 'left', z: door.ratio * frame.h, wallX: xMin + wallT, w: 18, h: 15, glass: true, exitLabel: false });
      if (door.side === 'back') addDoorFrame(parent, { side: 'back', x: door.ratio * frame.w, wallZ: zMin + wallT, w: 20, h: 15, glass: true, exitLabel: false });
      if (door.side === 'front') addDoorFrame(parent, { side: 'front', x: door.ratio * frame.w, wallZ: zMax - wallT, w: 20, h: 15, glass: true, exitLabel: false });
    });

    spec.shutters.forEach((sh) => {
      if (sh.side === 'right') addShutter(parent, { side: 'right', z: sh.ratio * frame.h, wallX: xMax - wallT, w: sh.w, h: sh.h });
      if (sh.side === 'left') addShutter(parent, { side: 'left', z: sh.ratio * frame.h, wallX: xMin + wallT, w: sh.w, h: sh.h });
      if (sh.side === 'back') addShutter(parent, { side: 'back', x: sh.ratio * frame.w, wallZ: zMin + wallT, w: sh.w, h: sh.h });
      if (sh.side === 'front') addShutter(parent, { side: 'front', x: sh.ratio * frame.w, wallZ: zMax - wallT, w: sh.w, h: sh.h });
    });

    portalGaps.forEach(({ center }) => {
      addArchBox(parent, { x: xMax - wallT * 0.6, y: spec.lowerWallH + 2.2, z: center, w: 3.2, h: 2.8, d: 30, material: hallArchitectureMaterials.wallDark });
      addArchBox(parent, { x: xMax - wallT * 0.5, y: spec.lowerWallH / 2, z: center - 13, w: 0.7, h: spec.lowerWallH, d: 1.2, material: hallArchitectureMaterials.trim });
      addArchBox(parent, { x: xMax - wallT * 0.5, y: spec.lowerWallH / 2, z: center + 13, w: 0.7, h: spec.lowerWallH, d: 1.2, material: hallArchitectureMaterials.trim });
    });

    addHallNumberTowers(parent, frame, spec);
  }

  function makeHallArchitecture(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const spec = HALL_ARCH_SPECS[pageInfo.page] || HALL_ARCH_SPECS[1];
    const group = ensureHall(pageInfo.page);
    const archGroup = new THREE.Group();
    archGroup.userData.page = pageInfo.page;
    group.add(archGroup);
    hallArchitectureGroups.set(pageInfo.page, archGroup);
    buildCommonHallEnvelope(archGroup, pageInfo, frame, spec);
    if (spec.style === 'wood') buildWoodCeiling(archGroup, frame, spec);
    else buildSteelCeiling(archGroup, frame, spec);
  }

  function updateHallArchitectureVisibility(force = false) {
    const autoVisible = hallModelVisible;
    if (!force && autoVisible === hallAutoArchitectureVisible) return;
    hallAutoArchitectureVisible = autoVisible;
    hallArchitectureGroups.forEach((group) => {
      group.visible = autoVisible;
    });
    overlayDirty = true;
  }

  function setHallModelVisible(nextVisible) {
    hallModelVisible = !!nextVisible;
    if (hallModelBtn) {
      hallModelBtn.classList.toggle('is-active', hallModelVisible);
      hallModelBtn.setAttribute('aria-pressed', String(hallModelVisible));
      hallModelBtn.title = hallModelVisible ? '会場モデルOFF' : '会場モデルON';
    }
    if (guide) guide.visible = !hallModelVisible;
    areaLabelMeshes.forEach((mesh) => { mesh.visible = true; });
    updateHallArchitectureVisibility(true);
  }

  function makeRectObject(page, spec) {
    const group = ensureHall(page);
    const pageData = pageDataByPage.get(page);
    const x = pageData.w * spec.xRatio;
    const y = pageData.h * spec.yRatio;
    const w = pageData.w * spec.wRatio;
    const h = pageData.h * spec.hRatio;
    const geo = pageToScene(page, [x - w / 2, y - h / 2, w, h]);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: spec.color, transparent: true, opacity: 0.96 })
    );
    mesh.scale.set(geo.w, BOOTH_H, geo.h);
    mesh.position.set(geo.x, BOOTH_H / 2, geo.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'special', page, label: spec.label };
    mesh.renderOrder = 3;
    group.add(mesh);

    let textMesh;
    if (!spec.sublabel && String(spec.label).includes('\n')) {
      const compactLabel = String(spec.label).replace(/\n/g, '');
      textMesh = makeVerticalTopTextMesh(compactLabel, {
        color: spec.textColor || '#ffffff',
        worldW: Math.max(geo.w * 0.72, 2.2),
        worldH: Math.max(geo.h * 0.88, 10),
        width: 256,
        height: 1024,
      });
    } else {
      const textLines = spec.sublabel ? [spec.label, spec.sublabel] : [spec.label];
      textMesh = makeGroundTextMesh(textLines, {
        color: spec.textColor || '#ffffff',
        worldW: Math.max(geo.w * 0.82, 28),
        worldH: Math.max(geo.h * 0.55, 10),
        fontSize: spec.sublabel ? 40 : 48
      });
    }
    textMesh.position.set(geo.x, BOOTH_H + 0.08, geo.z);
    textMesh.userData.page = page;
    group.add(textMesh);
  }

  function makeFrameWalls(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const group = ensureHall(pageInfo.page);
    const portalDefs = HALL_PORTALS[pageInfo.page];
    const toZ = (ratio) => pageInfo.h * ratio - frame.cy;
    const rightEdgeX = frame.w / 2 - FRAME_WALL_T / 2;
    const entranceZ = toZ(portalDefs.entrance.yRatio);
    const exitZ = toZ(portalDefs.exit.yRatio);

    const markerX = rightEdgeX - 7.5;
    const entranceMarker = makePortalTriangleMesh({ color: '#ef4444', size: 15, direction: 'left', y: 0.26 });
    entranceMarker.position.set(markerX, 0.26, entranceZ);
    group.add(entranceMarker);
    const exitMarker = makePortalTriangleMesh({ color: '#2563eb', size: 15, direction: 'right', y: 0.26 });
    exitMarker.position.set(markerX, 0.26, exitZ);
    group.add(exitMarker);
  }

  function getAreaLabelOffset(band) {
    const label = String(band.label);
    const eastShiftPage1 = new Set(['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T']);
    const eastShiftPage2 = new Set(['い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と']);
    let dx = 0;
    let dy = 0;

    if ((band.page === 1 && eastShiftPage1.has(label)) || (band.page === 2 && eastShiftPage2.has(label))) {
      dx += 10;
    }

    if (band.page === 1 && label === 'A') {
      dy -= 10;
    }
    if (band.page === 2 && label === 'あ') {
      dy -= 10;
    }
    if (band.page === 1 && label === 'X') {
      dx -= 14;
    }
    if (band.page === 2 && label === 'ね') {
      dx -= 14;
    }

    return { dx, dy };
  }

  function hallReferenceTexture(pageInfo) {
    if (pageTextureCache.has(pageInfo.page)) return pageTextureCache.get(pageInfo.page);
    const texture = new THREE.TextureLoader().load(pageInfo.image);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    pageTextureCache.set(pageInfo.page, texture);
    return texture;
  }


  function makePageTopLabelTexture(pageInfo) {
    if (pageLabelTextureCache.has(pageInfo.page)) return pageLabelTextureCache.get(pageInfo.page);

    const frame = getHallFrame(pageInfo.page);
    const texW = 4096;
    const texH = Math.max(256, Math.round(texW * frame.h / frame.w));
    const canvas = document.createElement('canvas');
    canvas.width = texW;
    canvas.height = texH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, texW, texH);

    const sx = texW / frame.w;
    const sy = texH / frame.h;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const pageBooths = DATA.booths.filter((booth) => booth.page === pageInfo.page);
    for (const booth of pageBooths) {
      const [x, y, w, h] = booth.bbox;
      const cx = (x + w / 2 - frame.x0) * sx;
      const cy = (y + h / 2 - frame.y0) * sy;
      const text = String(booth.n);
      const maxW = Math.max(6, w * sx * 0.64);
      const maxH = Math.max(6, h * sy * 0.54);
      let fontSize = Math.min(maxH, maxW / Math.max(0.64, text.length * 0.58));
      fontSize = Math.max(7, fontSize);

      ctx.font = `600 ${fontSize}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.fillStyle = '#111827';
      ctx.fillText(text, cx, cy + fontSize * 0.01);
    }

    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    pageLabelTextureCache.set(pageInfo.page, texture);
    return texture;
  }


  function getHallFrame(page) {
    const pageData = DATA.pages.find((p) => p.page === page);
    const ratios = HALL_FRAMES[page] || HALL_FRAMES[1];
    const x0 = pageData.w * ratios.x0Ratio;
    const y0 = pageData.h * ratios.y0Ratio;
    const x1 = pageData.w * ratios.x1Ratio;
    const y1 = pageData.h * ratios.y1Ratio;
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  function pagePointToLocal(page, xPage, yPage) {
    const frame = getHallFrame(page);
    return { x: xPage - frame.cx, z: yPage - frame.cy };
  }

  function pageToScene(page, bbox) {
    const frame = getHallFrame(page);
    const [x, y, w, h] = bbox;
    const cx = x + w / 2 - frame.cx;
    const cz = y + h / 2 - frame.cy;
    return { x: cx, z: cz, w, h };
  }

  function layoutX(page) {
    return HALL_OFFSETS[layoutMode][page];
  }

  function ensureHall(page) {
    if (hallGroups.has(page)) return hallGroups.get(page);
    const g = new THREE.Group();
    scene.add(g);
    hallGroups.set(page, g);
    return g;
  }

  function makeZoneMesh(page, band) {
    const group = ensureHall(page);
    const geo = pageToScene(page, band.bbox);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(geo.w, geo.h),
      new THREE.MeshStandardMaterial({ color: labelColor(page, band.label), transparent: true, opacity: 0.56, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(geo.x, ZONE_Y, geo.z);
    mesh.userData.page = page;
    mesh.renderOrder = 1;
    group.add(mesh);
    bandMeshes.push(mesh);
  }

  function makeHallBase(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const group = ensureHall(pageInfo.page);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(frame.w, frame.h),
      new THREE.MeshStandardMaterial({ color: 0xf3f4f6, transparent: true, opacity: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    floor.userData.page = pageInfo.page;
    floor.renderOrder = 0;
    group.add(floor);

    const labelPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(frame.w, frame.h),
      new THREE.MeshBasicMaterial({
        map: makePageTopLabelTexture(pageInfo),
        transparent: true,
        alphaTest: 0.08,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      })
    );
    labelPlane.rotation.x = -Math.PI / 2;
    labelPlane.position.y = LABEL_PLANE_Y;
    labelPlane.userData.page = pageInfo.page;
    labelPlane.renderOrder = 4;
    labelPlane.raycast = () => {};
    group.add(labelPlane);
  }

  DATA.pages.forEach(makeHallBase);
  DATA.pages.forEach(makeHallArchitecture);
  DATA.pages.forEach(makeFrameWalls);

  DATA.bands.forEach((band) => {
    const group = ensureHall(band.page);
    const [lx, ly] = band.labelPos;
    const { dx, dy } = getAreaLabelOffset(band);
    const local = pagePointToLocal(band.page, lx + dx, ly + dy);
    const textMesh = makeAreaLabelGroundMesh(band);
    textMesh.position.set(local.x, 0.08, local.z);
    textMesh.userData.page = band.page;
    areaLabelMeshes.push(textMesh);
    group.add(textMesh);
  });

  DATA.pages.forEach((pageInfo) => {
    const group = ensureHall(pageInfo.page);
    const specials = SPECIAL_OBJECTS[pageInfo.page] || {};
    Object.values(specials).forEach((spec) => makeRectObject(pageInfo.page, spec));
    const hallName = makeHallNameSprite(String(pageInfo.hall), {
      width: 642,
      height: 162,
      fontSize: 66,
      color: '#000000'
    });
    const frame = getHallFrame(pageInfo.page);
    hallName.position.set(0, BOOTH_H + 26, -frame.h * 0.5 - 40);
    hallName.userData.page = pageInfo.page;
    hallName.renderOrder = 8;
    group.add(hallName);
  });

  DATA.booths.forEach((booth) => {
    const group = ensureHall(booth.page);
    const geo = pageToScene(booth.page, booth.bbox);
    const mesh = new THREE.Mesh(boothGeometry, booth.page === 2 ? hall2Material : hall1Material);
    mesh.scale.set(geo.w, BOOTH_H, geo.h);
    mesh.position.set(geo.x, BOOTH_H / 2, geo.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...booth, page: booth.page, base: 'normal' };
    mesh.renderOrder = 2;
    group.add(mesh);
    boothMeshes.push(mesh);
    boothById.set(booth.id.toUpperCase(), mesh);
    const groupKey = booth.info?.group_key || booth.id;
    if (!groupMembers.has(groupKey)) groupMembers.set(groupKey, []);
    groupMembers.get(groupKey).push(mesh);
  });

  function applyLayout() {
    hallGroups.forEach((group, page) => {
      group.position.x = layoutX(page);
    });
  }
  applyLayout();

  function rebuildOverlayData() {
    overlayBoothLabels = [];
    overlayAreaLabels = [];
  }
  rebuildOverlayData();
  overlayDirty = true;

  function projectToScreen(x, y, z) {
    tempVec.set(x, y, z).project(camera);
    if (tempVec.z < -1 || tempVec.z > 1) return null;
    const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;
    if (sx < -30 || sx > window.innerWidth + 30 || sy < -30 || sy > window.innerHeight + 30) return null;
    return { x: sx, y: sy };
  }

  function drawTextLabel(text, x, y, fontSizePx, fillStyle, strokeStyle, lineWidth) {
    labelCtx.font = `700 ${fontSizePx}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
    labelCtx.lineJoin = 'round';
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.strokeStyle = strokeStyle;
    labelCtx.lineWidth = lineWidth;
    labelCtx.strokeText(text, x, y);
    labelCtx.fillStyle = fillStyle;
    labelCtx.fillText(text, x, y);
  }

  function perspectiveLabelSizePx(x, y, z, worldSize) {
    const effectiveFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
    const focalPx = window.innerHeight / (2 * Math.tan(effectiveFov / 2));
    const distance = camera.position.distanceTo(tempVec.set(x, y, z));
    if (!Number.isFinite(distance) || distance <= 0.0001) return 0;
    return worldSize * focalPx / distance;
  }

  function renderOverlayLabels() {
    if (labelCtx) labelCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  function groupKeyFromMesh(mesh) {
    return mesh?.userData?.info?.group_key || mesh?.userData?.id || null;
  }

  function groupRepresentativeMesh(groupKey) {
    const members = groupMembers.get(groupKey) || [];
    return members[0] || null;
  }

  function selectedGroupKeysInTier(ids) {
    const keys = [];
    const seen = new Set();
    ids.forEach((id) => {
      const mesh = boothById.get(normalizeBoothId(id));
      if (!mesh) return;
      const key = groupKeyFromMesh(mesh);
      if (!key || seen.has(key)) return;
      seen.add(key);
      keys.push(key);
    });
    return keys;
  }

  function getPageObstacles(page) {
    return DATA.booths
      .filter((booth) => booth.page === page)
      .map((booth) => {
        const geo = pageToScene(page, booth.bbox);
        return {
          minX: geo.x - geo.w / 2 - ROUTE_PADDING,
          maxX: geo.x + geo.w / 2 + ROUTE_PADDING,
          minZ: geo.z - geo.h / 2 - ROUTE_PADDING,
          maxZ: geo.z + geo.h / 2 + ROUTE_PADDING
        };
      });
  }

  function buildRouteGridForPage(page) { return null; }
  function getRouteGrid(page) { return null; }
  function nodeToLocalPoint(grid, index) { return null; }
  function localPointToGlobal(page, point) { return null; }
  function pointToNodeIndex(page, point) { return null; }
  function getMeshRouteAnchors(mesh) { return []; }
  function reconstructPath(cameFrom, current) { return []; }
  function findPathOnPage(page, startIndex, endIndex) { return null; }
  function simplifyLocalPath(points) { return Array.isArray(points) ? points.slice() : []; }
  function makeHallTransferLegs(fromPage, toPage) { return []; }
  function bestPathBetweenMeshes(meshA, meshB, transferTier = 'secondary') { return null; }
  function clearRouteGroup() {
    while (routeGroup.children.length) {
      const child = routeGroup.children.pop();
      routeGroup.remove(child);
      if (child.geometry) child.geometry.dispose?.();
      if (child.material) {
        if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose?.());
        else child.material.dispose?.();
      }
    }
  }
  function rebuildRoutes() {
    clearRouteGroup();
  }

const STORAGE_KEY = 'bunfree_tokyo42_viewer_state_v1';
  const DEFAULT_CAMERA_POS = new THREE.Vector3(0, 820, 980);
  const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0, 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoveredMesh = null;
  let pinnedMesh = null;
  let selectedPrimaryIds = [];
  let selectedSecondaryIds = [];
  let categoryLayerVisible = false;
  let themeMode = 'light';
  let legendHoveredCategory = null;
  let drawerDragState = null;
  let drawerDragSuppressUntil = 0;
  let needsRaycast = false;
  let restoreState = null;
  let persistTimer = null;
  let gestureState = null;
  let menuGesture = null;
  let pointerDownState = null;
  let actionMenuState = null;
  let actionIconSprites = [];
  let actionIconGroup = null;
  let hoveredActionIconTier = null;
  let isDrawerOpen = false;
  let drawerPointerStartY = null;
  const SWIPE_THRESHOLD = 44;
  const TAP_THRESHOLD = 14;
  const MENU_DEADZONE = 28;
  const URL_STATE_VERSION = '1';
  let searchQuery = '';
  let searchResultIds = [];
  let hoveredSearchBoothId = null;

  function serializeCameraState() {
    return {
      position: {
        x: Number(camera.position.x.toFixed(2)),
        y: Number(camera.position.y.toFixed(2)),
        z: Number(camera.position.z.toFixed(2))
      },
      target: {
        x: Number(controls.target.x.toFixed(2)),
        y: Number(controls.target.y.toFixed(2)),
        z: Number(controls.target.z.toFixed(2))
      }
    };
  }

  function normalizeBoothId(value) {
    return String(value || '').trim().toUpperCase();
  }


  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function searchIndexTextForMesh(mesh) {
    if (!mesh) return '';
    if (mesh.userData.searchIndexText) return mesh.userData.searchIndexText;
    const info = mesh.userData.info || {};
    const hall = mesh.userData.page === 1 ? '南1・2ホール' : '南3・4ホール';
    const source = [
      mesh.userData.id,
      mesh.userData.label,
      mesh.userData.band,
      info.booth_no_range,
      info.booth_name,
      info.reading,
      info.category,
      info.description,
      hall
    ].filter(Boolean).join(' ');
    const normalized = normalizeSearchText(source);
    mesh.userData.searchIndexText = normalized;
    return normalized;
  }

  function searchScoreForMesh(mesh, normalizedQuery, tokens) {
    const info = mesh.userData.info || {};
    const boothId = normalizeSearchText(mesh.userData.id);
    const range = normalizeSearchText(info.booth_no_range);
    const name = normalizeSearchText(info.booth_name);
    const category = normalizeSearchText(info.category);
    let score = 0;
    if (normalizedQuery && boothId === normalizedQuery) score += 240;
    else if (normalizedQuery && range === normalizedQuery) score += 220;
    else if (normalizedQuery && boothId.startsWith(normalizedQuery)) score += 170;
    else if (normalizedQuery && range.startsWith(normalizedQuery)) score += 160;
    if (normalizedQuery && name.includes(normalizedQuery)) score += 120;
    if (normalizedQuery && category.includes(normalizedQuery)) score += 70;
    score += Math.max(0, 40 - boothId.length);
    score += Math.max(0, 20 - name.length * 0.1);
    score += tokens.length * 5;
    return score;
  }

  function searchResultsForQuery(query) {
    const normalizedQuery = normalizeSearchText(query);
    const tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
    if (!tokens.length) return [];
    return boothMeshes
      .filter((mesh) => {
        const haystack = searchIndexTextForMesh(mesh);
        return tokens.every((token) => haystack.includes(token));
      })
      .map((mesh) => ({
        mesh,
        id: mesh.userData.id,
        score: searchScoreForMesh(mesh, normalizedQuery, tokens)
      }))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.mesh.userData.page !== b.mesh.userData.page) return a.mesh.userData.page - b.mesh.userData.page;
        return a.id.localeCompare(b.id, 'ja');
      });
  }

  function renderSearchResults() {
    if (!boothSearchResultsList || !boothSearchResults || !boothSearchMeta || !boothSearchCount) return;
    boothSearchResultsList.innerHTML = '';
    const hasQuery = !!searchQuery;
    const count = searchResultIds.length;
    boothSearchCount.textContent = hasQuery ? `${count}件ヒット` : '0件';
    boothSearchMeta.classList.toggle('is-visible', hasQuery);
    boothSearchResults.classList.toggle('is-visible', hasQuery);
    if (!hasQuery) return;
    if (!count) {
      boothSearchResultsList.innerHTML = '<div class="search-result-empty">一致するブースが見つかりませんでした。</div>';
      return;
    }
    const visibleIds = searchResultIds.slice(0, 80);
    visibleIds.forEach((id) => {
      const item = drawerItemDataFromId(id);
      if (!item) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result-item';
      button.dataset.id = item.id;
      button.innerHTML = `
        <div class="search-result-top">
          <div class="search-result-id">${escapeHtml(item.id)}</div>
          <div class="search-result-hall">${escapeHtml(item.hall)}</div>
        </div>
        <div class="search-result-name">${escapeHtml(item.boothName)}</div>
        <div class="search-result-meta">${escapeHtml(item.category)}</div>
      `;
      button.addEventListener('pointerenter', () => {
        hoveredSearchBoothId = item.id;
        refreshMaterials();
      });
      button.addEventListener('pointerleave', () => {
        if (hoveredSearchBoothId === item.id) {
          hoveredSearchBoothId = null;
          refreshMaterials();
        }
      });
      button.addEventListener('focus', () => {
        hoveredSearchBoothId = item.id;
        refreshMaterials();
      });
      button.addEventListener('blur', () => {
        if (hoveredSearchBoothId === item.id) {
          hoveredSearchBoothId = null;
          refreshMaterials();
        }
      });
      button.addEventListener('click', () => {
        const mesh = item.mesh;
        hoveredSearchBoothId = item.id;
        hoveredMesh = mesh;
        setPinnedMesh(mesh);
        refreshMaterials();
        refreshInfoPanel();
        focusMesh(mesh);
        showToast(`${item.id} を表示しました`);
        saveState();
      });
      boothSearchResultsList.appendChild(button);
    });
    if (count > visibleIds.length) {
      const more = document.createElement('div');
      more.className = 'search-result-empty';
      more.textContent = `上位 ${visibleIds.length} 件を表示中です。`;
      boothSearchResultsList.appendChild(more);
    }
  }

  function updateSearch(query) {
    searchQuery = String(query || '').trim();
    const results = searchResultsForQuery(searchQuery);
    searchResultIds = results.map((entry) => entry.id);
    hoveredSearchBoothId = null;
    renderSearchResults();
    refreshMaterials();
  }

  function clearSearch({ focusInput = false } = {}) {
    searchQuery = '';
    searchResultIds = [];
    hoveredSearchBoothId = null;
    if (boothSearchInput) boothSearchInput.value = '';
    renderSearchResults();
    refreshMaterials();
    if (focusInput) boothSearchInput?.focus();
  }

  function uniqueValidBoothIds(values) {
    const out = [];
    const seen = new Set();
    (values || []).forEach((value) => {
      const id = normalizeBoothId(value);
      if (!id || seen.has(id) || !boothById.has(id)) return;
      seen.add(id);
      out.push(id);
    });
    return out;
  }

  function selectedGroupKeysFrom(ids) {
    const keys = new Set();
    ids.forEach((id) => {
      const mesh = boothById.get(id);
      if (!mesh) return;
      keys.add(mesh.userData.info?.group_key || mesh.userData.id);
    });
    return keys;
  }

  function getSelectionTierByMesh(mesh) {
    const key = mesh.userData.info?.group_key || mesh.userData.id;
    if (selectedGroupKeysFrom(selectedPrimaryIds).has(key)) return 'primary';
    if (selectedGroupKeysFrom(selectedSecondaryIds).has(key)) return 'secondary';
    return null;
  }

  function updateSelectionSummary() {
    const summary = `最優先 ${selectedPrimaryIds.length}件 / 気になる ${selectedSecondaryIds.length}件`;
    if (drawerSummaryText) drawerSummaryText.textContent = summary;
    if (drawerPrimaryCount) drawerPrimaryCount.textContent = `${selectedPrimaryIds.length}件`;
    if (drawerSecondaryCount) drawerSecondaryCount.textContent = `${selectedSecondaryIds.length}件`;
    renderDrawerLists();
  }

  function normalizeCategoryLabel(category) {
    const raw = String(category || '').trim();
    if (!raw) return '未分類';
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
    return parts[1] || parts[0] || '未分類';
  }

  function categoryLabelForMesh(mesh) {
    return normalizeCategoryLabel(mesh?.userData?.info?.category);
  }

  function hashString(value) {
    let hash = 0;
    const source = String(value || '');
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function colorForCategoryLabel(label) {
    const key = normalizeCategoryLabel(label);
    if (categoryColorCache.has(key)) return categoryColorCache.get(key).clone();
    const hash = hashString(key);
    const hue = (hash % 360) / 360;
    const saturation = 0.54 + ((hash >> 3) % 12) / 100;
    const lightness = 0.56 + ((hash >> 7) % 10) / 100;
    const color = new THREE.Color().setHSL(hue, Math.min(0.7, saturation), Math.min(0.72, lightness));
    categoryColorCache.set(key, color.clone());
    return color;
  }

  function categoryMaterialForMesh(mesh) {
    if (!mesh || mesh.userData.base === 'empty') return emptyInfoMaterial;
    const label = categoryLabelForMesh(mesh);
    if (!categoryMaterialCache.has(label)) {
      const color = colorForCategoryLabel(label);
      const emissive = color.clone().multiplyScalar(0.18);
      categoryMaterialCache.set(label, new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.16
      }));
    }
    return categoryMaterialCache.get(label);
  }

  function categoryLegendHoverMaterialForLabel(label) {
    const key = normalizeCategoryLabel(label);
    if (!categoryLegendHoverMaterialCache.has(key)) {
      const color = colorForCategoryLabel(key).clone();
      const boosted = color.clone().offsetHSL(0, 0.02, 0.08);
      const emissive = color.clone().lerp(new THREE.Color(0xffffff), 0.22).multiplyScalar(0.72);
      categoryLegendHoverMaterialCache.set(key, new THREE.MeshStandardMaterial({
        color: boosted,
        emissive,
        emissiveIntensity: 0.92
      }));
    }
    return categoryLegendHoverMaterialCache.get(key);
  }

  function categoryLegendEntries() {
    const counts = new Map();
    boothMeshes.forEach((mesh) => {
      if (!mesh || mesh.userData.base === 'empty') return;
      const label = categoryLabelForMesh(mesh);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, color: '#' + colorForCategoryLabel(label).getHexString() }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, 'ja'));
  }

  function setLegendHoveredCategory(label) {
    const next = label ? normalizeCategoryLabel(label) : null;
    if (legendHoveredCategory === next) return;
    legendHoveredCategory = next;
    refreshMaterials();
    if (categoryLegendList) {
      categoryLegendList.querySelectorAll('.category-legend-item').forEach((el) => {
        el.classList.toggle('is-hovered', !!next && el.dataset.category === next);
      });
    }
  }

  function renderCategoryLegend() {
    if (!categoryLegendList) return;
    const entries = categoryLegendEntries();
    categoryLegendList.innerHTML = '';
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-legend-item';
      button.dataset.category = entry.label;
      button.innerHTML = `
        <span class="category-legend-swatch" style="background:${entry.color}"></span>
        <span class="category-legend-label">${entry.label}</span>
        <span class="category-legend-count">${entry.count}件</span>
      `;
      const activate = () => setLegendHoveredCategory(entry.label);
      const deactivate = () => {
        if (legendHoveredCategory === entry.label) setLegendHoveredCategory(null);
      };
      button.addEventListener('pointerenter', activate);
      button.addEventListener('pointerleave', deactivate);
      button.addEventListener('focus', activate);
      button.addEventListener('blur', deactivate);
      categoryLegendList.appendChild(button);
    });
  }

  function updateCategoryLegendVisibility() {
    if (!categoryLegend) return;
    const visible = !!categoryLayerVisible;
    categoryLegend.hidden = !visible;
    categoryLegend.setAttribute('aria-hidden', String(!visible));
    categoryLegend.classList.toggle('is-visible', visible);
    if (!visible && legendHoveredCategory) setLegendHoveredCategory(null);
  }

  function updateCategoryLayerButton() {
    if (!categoryLayerBtn) return;
    categoryLayerBtn.classList.toggle('is-active', categoryLayerVisible);
    categoryLayerBtn.setAttribute('aria-pressed', String(categoryLayerVisible));
    categoryLayerBtn.title = categoryLayerVisible ? 'カテゴリレイヤー ON' : 'カテゴリレイヤー OFF';
  }

  function setCategoryLayerVisible(next, { save = true } = {}) {
    categoryLayerVisible = !!next;
    updateCategoryLayerButton();
    updateCategoryLegendVisibility();
    refreshMaterials();
    if (save) saveState();
  }

  function drawerItemDataFromId(id) {
    const mesh = boothById.get(normalizeBoothId(id));
    if (!mesh) return null;
    const info = mesh.userData.info || {};
    return {
      id: mesh.userData.id,
      boothName: info.booth_name || '名称未設定',
      category: info.category || 'カテゴリ未設定',
      hall: mesh.userData.page === 1 ? '南1・2ホール' : '南3・4ホール',
      mesh
    };
  }

  function getSelectionArrayByTier(tier) {
    return tier === 'secondary' ? selectedSecondaryIds : selectedPrimaryIds;
  }

  function moveSelectionBetweenTiers(fromTier, fromIndex, toTier, toIndex) {
    const fromList = getSelectionArrayByTier(fromTier);
    const toList = getSelectionArrayByTier(toTier);
    if (!fromList || !toList) return false;
    if (fromIndex < 0 || fromIndex >= fromList.length) return false;
    const [moved] = fromList.splice(fromIndex, 1);
    if (!moved) return false;
    const normalizedToIndex = Math.max(0, Math.min(toIndex, toList.length));
    if (fromList === toList && fromIndex < normalizedToIndex) {
      toList.splice(normalizedToIndex - 1, 0, moved);
    } else {
      toList.splice(normalizedToIndex, 0, moved);
    }
    selectedPrimaryIds = uniqueValidBoothIds(selectedPrimaryIds);
    selectedSecondaryIds = uniqueValidBoothIds(selectedSecondaryIds);
    return true;
  }

  function clearDrawerDropTargets() {
    document.querySelectorAll('.drawer-list-wrap.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
  }

  function cleanupDrawerDrag() {
    if (drawerDragState?.ghost?.parentNode) drawerDragState.ghost.parentNode.removeChild(drawerDragState.ghost);
    if (drawerDragState?.placeholder?.parentNode) drawerDragState.placeholder.parentNode.removeChild(drawerDragState.placeholder);
    drawerDragState?.originButton?.classList.remove('is-dragging-origin');
    clearDrawerDropTargets();
    drawerDragState = null;
  }

  function drawerDropContextFromPoint(clientX, clientY) {
    const wrap = document.elementFromPoint(clientX, clientY)?.closest('.drawer-list-wrap');
    if (!wrap) return null;
    const tier = wrap.dataset.tier || 'primary';
    const list = wrap.querySelector('.drawer-list');
    if (!list) return { wrap, list: null, tier, index: 0 };
    const itemButton = document.elementFromPoint(clientX, clientY)?.closest('.drawer-item');
    if (itemButton && list.contains(itemButton)) {
      const li = itemButton.closest('li');
      const items = Array.from(list.children).filter((child) => child !== drawerDragState?.placeholder);
      const itemIndex = items.indexOf(li);
      const rect = li.getBoundingClientRect();
      const insertAfter = clientY > rect.top + rect.height / 2;
      return { wrap, list, tier, index: itemIndex + (insertAfter ? 1 : 0) };
    }
    return { wrap, list, tier, index: list.children.length };
  }

  function updateDrawerDrag(clientX, clientY) {
    if (!drawerDragState?.dragging) return;
    drawerDragState.lastClientX = clientX;
    drawerDragState.lastClientY = clientY;
    drawerDragState.ghost.style.transform = `translate(${clientX - drawerDragState.offsetX}px, ${clientY - drawerDragState.offsetY}px)`;
    clearDrawerDropTargets();
    const context = drawerDropContextFromPoint(clientX, clientY);
    if (!context) return;
    context.wrap.classList.add('is-drop-target');
    const { list, index } = context;
    const placeholder = drawerDragState.placeholder;
    if (!list) {
      context.wrap.appendChild(placeholder);
      return;
    }
    const items = Array.from(list.children).filter((child) => child !== placeholder);
    if (index >= items.length) list.appendChild(placeholder);
    else list.insertBefore(placeholder, items[index]);
  }

  function finishDrawerDrag(cancelled = false) {
    if (!drawerDragState) return;
    const state = drawerDragState;
    const didDrag = !!state.dragging;
    if (!cancelled && didDrag) {
      const wrap = state.placeholder.parentElement?.closest('.drawer-list-wrap');
      const tier = wrap?.dataset.tier || state.fromTier;
      const list = wrap?.querySelector('.drawer-list');
      const index = list ? Array.from(list.children).indexOf(state.placeholder) : 0;
      const changed = moveSelectionBetweenTiers(state.fromTier, state.fromIndex, tier, index);
      if (changed) {
        refreshMaterials();
        rebuildRoutes();
        saveState(true);
      }
      drawerDragSuppressUntil = performance.now() + 320;
    }
    cleanupDrawerDrag();
  }

  function startDrawerDrag(event, button, item, tier, index) {
    const rect = button.getBoundingClientRect();
    const ghost = button.cloneNode(true);
    ghost.classList.add('drawer-drag-ghost');
    ghost.style.width = `${rect.width}px`;
    document.body.appendChild(ghost);

    const placeholder = document.createElement('li');
    placeholder.className = 'drawer-drag-placeholder';
    placeholder.style.height = `${rect.height}px`;
    const originLi = button.closest('li');
    originLi?.parentNode?.insertBefore(placeholder, originLi.nextSibling);

    button.classList.add('is-dragging-origin');
    drawerDragState = {
      pointerId: event.pointerId,
      item,
      fromTier: tier,
      fromIndex: index,
      originButton: button,
      originLi,
      ghost,
      placeholder,
      offsetX: Math.min(28, rect.width / 2),
      offsetY: Math.min(20, rect.height / 2),
      startClientX: event.clientX,
      startClientY: event.clientY,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      dragging: true
    };
    updateDrawerDrag(event.clientX, event.clientY);
  }

  function onDrawerItemPointerDown(event, button, item, tier, index) {
    if (event.button !== undefined && event.button !== 0) return;
    if (drawerDragState) return;
    const startX = event.clientX;
    const startY = event.clientY;
    const onMove = (moveEvent) => {
      if (drawerDragState?.pointerId && moveEvent.pointerId !== drawerDragState.pointerId) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!drawerDragState) {
        if (Math.hypot(dx, dy) < 6) return;
        startDrawerDrag(moveEvent, button, item, tier, index);
      } else {
        updateDrawerDrag(moveEvent.clientX, moveEvent.clientY);
      }
    };
    const onEnd = (endEvent) => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (drawerDragState) finishDrawerDrag(false);
    };
    const onCancel = () => {
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('pointercancel', onCancel, true);
      if (drawerDragState) finishDrawerDrag(true);
    };
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onEnd, true);
    window.addEventListener('pointercancel', onCancel, true);
  }

  function renderDrawerList(container, ids, emptyText) {
    if (!container) return;
    container.innerHTML = '';
    const items = ids.map(drawerItemDataFromId).filter(Boolean);
    const tier = container.dataset.tier || 'primary';
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'drawer-empty';
      empty.textContent = emptyText;
      container.appendChild(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'drawer-list';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.dataset.id = item.id;
      li.dataset.tier = tier;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'drawer-item';
      button.innerHTML = `
        <div class="drawer-item-top">
          <span class="drawer-item-id">${item.id}</span>
          <span class="drawer-item-hall">${item.hall}</span>
        </div>
        <div class="drawer-item-name">${item.boothName}</div>
        <div class="drawer-item-meta">${item.category}</div>
      `;
      button.addEventListener('pointerdown', (event) => onDrawerItemPointerDown(event, button, item, tier, index));
      button.addEventListener('click', () => {
        if (performance.now() < drawerDragSuppressUntil) return;
        setPinnedMesh(item.mesh);
        hoveredMesh = item.mesh;
        refreshMaterials();
        focusMesh(item.mesh);
        if (window.innerWidth <= 900) setDrawerOpen(false);
        showToast(`${item.id} を表示しました`);
        saveState();
      });
      li.appendChild(button);
      list.appendChild(li);
    });
    container.appendChild(list);
  }

  function renderDrawerLists() {
    renderDrawerList(drawerPrimaryList, selectedPrimaryIds, 'まだ選択されていません。');
    renderDrawerList(drawerSecondaryList, selectedSecondaryIds, 'まだ選択されていません。');
  }

  function setDrawerOpen(next) {
    isDrawerOpen = !!next;
    bottomDrawer?.classList.toggle('is-open', isDrawerOpen);
    bottomDrawer?.setAttribute('aria-expanded', String(isDrawerOpen));
    drawerPeek?.setAttribute('aria-expanded', String(isDrawerOpen));
  }

  function toggleDrawer() {
    setDrawerOpen(!isDrawerOpen);
  }

  function buildStatePayload() {
    return {
      version: 1,
      pinnedBoothId: pinnedMesh?.userData?.id || null,
      searchQuery: '',
      primaryBoothIds: uniqueValidBoothIds(selectedPrimaryIds),
      secondaryBoothIds: uniqueValidBoothIds(selectedSecondaryIds),
      categoryLayerVisible,
      themeMode,
      camera: serializeCameraState(),
      savedAt: Date.now()
    };
  }

  function buildShareUrl() {
    const payload = buildStatePayload();
    const params = new URLSearchParams();
    const primary = payload.primaryBoothIds;
    const secondary = payload.secondaryBoothIds;
    if (primary.length || secondary.length || payload.categoryLayerVisible || payload.themeMode === 'dark') params.set('v', URL_STATE_VERSION);
    if (primary.length) params.set('p', primary.join(','));
    if (secondary.length) params.set('s', secondary.join(','));
    if (payload.categoryLayerVisible) params.set('c', '1');
    if (payload.themeMode === 'dark') params.set('t', 'd');
    const url = new URL(window.location.href);
    url.search = params.toString();
    url.hash = '';
    return url.toString();
  }

  function updateAddressBarFromState() {
    try {
      const url = new URL(buildShareUrl());
      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (next === current) return;
      history.replaceState(null, '', next);
    } catch (err) {
      console.warn('address bar update failed', err);
    }
  }

  function parseStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return null;
    if (params.get('v') && params.get('v') !== URL_STATE_VERSION) return null;
    return {
      version: 1,
      pinnedBoothId: normalizeBoothId((params.get('p') || '').split(',')[0] || (params.get('s') || '').split(',')[0] || ''),
      searchQuery: '',
      primaryBoothIds: uniqueValidBoothIds((params.get('p') || '').split(',')),
      secondaryBoothIds: uniqueValidBoothIds((params.get('s') || '').split(',')),
      categoryLayerVisible: params.get('c') === '1',
      themeMode: params.get('t') === 'd' ? 'dark' : 'light',
      camera: null,
      source: 'url'
    };
  }

  function saveState(immediate = false) {
    const run = () => {
      try {
        const payload = buildStatePayload();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        updateAddressBarFromState();
      } catch (err) {
        console.warn('state save failed', err);
      }
    };

    if (immediate) {
      clearTimeout(persistTimer);
      run();
      return;
    }
    clearTimeout(persistTimer);
    persistTimer = setTimeout(run, 180);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1) return null;
      return parsed;
    } catch (err) {
      console.warn('state restore failed', err);
      return null;
    }
  }

  function applyCameraState(savedCamera) {
    if (!savedCamera?.position || !savedCamera?.target) return;
    camera.position.set(savedCamera.position.x, savedCamera.position.y, savedCamera.position.z);
    controls.target.set(savedCamera.target.x, savedCamera.target.y, savedCamera.target.z);
    controls.update();
  }


  function previewStateForMesh(mesh) {
    if (!mesh || !actionMenuState?.mesh) return null;
    const previewKey = actionMenuState.mesh.userData.info?.group_key || actionMenuState.mesh.userData.id;
    const key = mesh.userData.info?.group_key || mesh.userData.id;
    if (previewKey !== key) return null;
    return actionMenuState.previewTier || null;
  }

  function setActionMenuPreview(tier) {
    if (!actionMenuState) return;
    actionMenuState.previewTier = tier || null;
    hoveredActionIconTier = tier || null;
    if (boothActionMenu) boothActionMenu.dataset.preview = tier || '';
    menuNodes.forEach((node) => node.classList.toggle('is-active', !!tier && node.dataset.tier === tier));
    refreshMaterials();
    if (actionMenuState.mesh) {
      setDetail(actionMenuState.mesh);
      syncActionIconsToSelection(actionMenuState.mesh);
    }
  }

  function resolveMenuTier(clientX, clientY) {
    if (!actionMenuState) return null;
    const dx = clientX - actionMenuState.centerX;
    const dy = clientY - actionMenuState.centerY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const dist = Math.hypot(dx, dy);
    if (dist < MENU_DEADZONE) return null;
    if (absY >= absX && dy < 0) return 'primary';
    if (dy >= 0 && dx < 0) return 'secondary';
    if (dy >= 0 && dx >= 0) return 'clear';
    return null;
  }

  function clearActionIconSprites() {
    hoveredActionIconTier = null;
    actionIconSprites.forEach((sprite) => {
      sprite.material?.map?.dispose?.();
      sprite.material?.dispose?.();
      sprite.geometry?.dispose?.();
    });
    actionIconSprites = [];
    if (actionIconGroup) {
      actionIconGroup.parent?.remove(actionIconGroup);
      actionIconGroup = null;
    }
  }

  function updateActionIconLayout(mesh) {
    if (!mesh || !actionIconGroup || !actionIconSprites.length) return;
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(18, Math.min(28, Math.max(size.x, size.z) * 1.02));

    // Keep the triangle centroid exactly on the booth center in screen space.
    // To do that, place the whole billboard group on the same camera ray as the booth center,
    // moving it only slightly toward the camera so the projected centroid never drifts.
    const rayToCamera = new THREE.Vector3().subVectors(camera.position, center);
    if (rayToCamera.lengthSq() > 1e-8) {
      rayToCamera.normalize();
    } else {
      rayToCamera.set(0, 0, 1);
    }
    const towardCameraOffset = Math.max(4.0, Math.min(8.0, Math.max(size.x, size.y, size.z) * 0.22));
    const groupPos = center.clone().addScaledVector(rayToCamera, towardCameraOffset);
    actionIconGroup.position.copy(groupPos);
    actionIconGroup.quaternion.copy(camera.quaternion);

    const angleMap = {
      // Equilateral triangle with centroid at the group origin:
      // primary = top, secondary = bottom-left, clear = bottom-right.
      primary: Math.PI / 2,
      secondary: Math.PI / 2 + (Math.PI * 2 / 3),
      clear: Math.PI / 2 + (Math.PI * 4 / 3)
    };

    actionIconSprites.forEach((sprite) => {
      const angle = angleMap[sprite.userData.tier] ?? 0;
      const offX = Math.cos(angle) * radius;
      const offY = Math.sin(angle) * radius;
      sprite.position.set(offX, offY, 0);
      sprite.renderOrder = 999;
      if (sprite.material) {
        sprite.material.depthTest = false;
        sprite.material.depthWrite = false;
        sprite.material.transparent = true;
        sprite.material.needsUpdate = true;
      }
    });
  }

  function syncActionIconsToSelection(mesh) {
    if (!mesh) return;
    const tier = getSelectionTierByMesh(mesh);
    actionIconSprites.forEach((sprite) => {
      const active = tier !== 'clear' && sprite.userData.tier === tier;
      const hovered = sprite.userData.tier === hoveredActionIconTier;
      setActionIconSpriteVisual(sprite, { active, hovered });
    });
  }

  function positionActionMenu(clientX, clientY) {
    return { x: clientX, y: clientY };
  }

  function closeActionMenu({ keepPreview = false } = {}) {
    if (!keepPreview && actionMenuState) actionMenuState.previewTier = null;
    actionMenuState = null;
    menuGesture = null;
    controls.enabled = true;
    clearActionIconSprites();
    if (boothActionMenu) {
      boothActionMenu.classList.remove('is-open');
      boothActionMenu.setAttribute('aria-hidden', 'true');
      boothActionMenu.dataset.preview = '';
    }
    menuNodes.forEach((node) => node.classList.remove('is-active'));
    refreshMaterials();
  }

  function openActionMenu(mesh, clientX, clientY) {
    if (!mesh) return;
    clearActionIconSprites();
    actionMenuState = {
      mesh,
      centerX: clientX,
      centerY: clientY,
      previewTier: null
    };
    actionIconGroup = new THREE.Group();
    actionIconGroup.renderOrder = 999;
    const primarySprite = makeActionIconSprite('heart', { tier: 'primary' });
    primarySprite.userData = { ...primarySprite.userData, role: 'action-icon', tier: 'primary' };
    const secondarySprite = makeActionIconSprite('bookmark', { tier: 'secondary' });
    secondarySprite.userData = { ...secondarySprite.userData, role: 'action-icon', tier: 'secondary' };
    const clearSprite = makeActionIconSprite('clear', { tier: 'clear' });
    clearSprite.userData = { ...clearSprite.userData, role: 'action-icon', tier: 'clear' };
    actionIconGroup.add(primarySprite);
    actionIconGroup.add(secondarySprite);
    actionIconGroup.add(clearSprite);
    scene.add(actionIconGroup);
    actionIconSprites = [primarySprite, secondarySprite, clearSprite];
    updateActionIconLayout(mesh);
    syncActionIconsToSelection(mesh);
    setActionMenuPreview(null);
    overlayDirty = true;
  }

  function raycastActionIconAtClient(clientX, clientY) {
    if (!actionIconSprites.length) return null;
    updatePointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(actionIconSprites, false);
    return hits.length ? hits[0].object : null;
  }

  function commitActionMenuSelection(tier) {
    if (!actionMenuState?.mesh) return;
    const mesh = actionMenuState.mesh;
    const boothId = normalizeBoothId(mesh.userData.id);
    if (tier === 'primary') {
      applyTierSelection(mesh, 'primary', { toastMessage: `${boothId} を最優先に設定しました` });
    } else if (tier === 'secondary') {
      applyTierSelection(mesh, 'secondary', { toastMessage: `${boothId} を気になるに設定しました` });
    } else if (tier === 'clear') {
      removeBoothIdFromSelections(boothId);
      refreshMaterials();
      refreshInfoPanel();
      rebuildRoutes();
      showToast(`${boothId} の選択を解除しました`);
      saveState();
    }
    syncActionIconsToSelection(mesh);
    closeActionMenu();
  }

  function materialFor(mesh, state) {
    if (mesh.userData.base === 'empty') return emptyInfoMaterial;
    if (state === 'legend-hover') return categoryLegendHoverMaterialForLabel(categoryLabelForMesh(mesh));
    if (state === 'selected-primary') return selectedPrimaryMaterial;
    if (state === 'selected-secondary') return selectedSecondaryMaterial;
    if (state === 'selected') return selectedGlowMaterial;
    if (state === 'primary') return primaryMaterial;
    if (state === 'secondary') return secondaryMaterial;
    if (state === 'hover') return hoverMaterial;
    if (state === 'search-hover') return searchHoverMaterial;
    if (state === 'search-match') return searchMatchMaterial;
    if (categoryLayerVisible) return categoryMaterialForMesh(mesh) || categoryBaseMaterialFallback;
    return mesh.userData.page === 2 ? hall2Material : hall1Material;
  }

  function refreshMaterials() {
    const hoverKey = hoveredMesh ? (hoveredMesh.userData.info?.group_key || hoveredMesh.userData.id) : null;
    const pinnedKey = pinnedMesh ? (pinnedMesh.userData.info?.group_key || pinnedMesh.userData.id) : null;
    const hoveredSearchKey = hoveredSearchBoothId ? ((boothById.get(normalizeBoothId(hoveredSearchBoothId))?.userData?.info?.group_key) || normalizeBoothId(hoveredSearchBoothId)) : null;
    const searchKeys = new Set(searchResultIds.map((id) => {
      const mesh = boothById.get(normalizeBoothId(id));
      return mesh ? (mesh.userData.info?.group_key || mesh.userData.id) : normalizeBoothId(id);
    }));
    const primaryKeys = selectedGroupKeysFrom(selectedPrimaryIds);
    const secondaryKeys = selectedGroupKeysFrom(selectedSecondaryIds);
    boothMeshes.forEach((mesh) => {
      const key = mesh.userData.info?.group_key || mesh.userData.id;
      const previewState = previewStateForMesh(mesh);
      let state = 'base';
      if (previewState === 'primary') state = key === pinnedKey ? 'selected-primary' : 'primary';
      else if (previewState === 'secondary') state = key === pinnedKey ? 'selected-secondary' : 'secondary';
      else if (previewState === 'clear') state = key === pinnedKey ? 'selected' : 'base';
      else if (key === pinnedKey && primaryKeys.has(key)) state = 'selected-primary';
      else if (key === pinnedKey && secondaryKeys.has(key)) state = 'selected-secondary';
      else if (key === pinnedKey) state = 'selected';
      else if (primaryKeys.has(key)) state = 'primary';
      else if (secondaryKeys.has(key)) state = 'secondary';
      else if (hoverKey && key === hoverKey) state = 'hover';
      else if (categoryLayerVisible && legendHoveredCategory && categoryLabelForMesh(mesh) === legendHoveredCategory) state = 'legend-hover';
      else if (hoveredSearchKey && key === hoveredSearchKey) state = 'search-hover';
      else if (searchKeys.has(key)) state = 'search-match';
      mesh.material = materialFor(mesh, state);
    });
    updateSelectionSummary();
    if (actionMenuState?.mesh) syncActionIconsToSelection(actionMenuState.mesh);
  }

  function fmtMeta(mesh) {
    const info = mesh.userData.info;
    const lines = [];
    lines.push(`エリア: ${mesh.userData.label}`);
    lines.push(`ブース番号: ${mesh.userData.id}`);
    if (info?.booth_no_range && info.booth_no_range !== mesh.userData.id) lines.push(`範囲: ${info.booth_no_range}`);
    if (info?.reading) lines.push(`読み: ${info.reading}`);
    if (info?.category) lines.push(`カテゴリ: ${info.category}`);
    const previewTier = previewStateForMesh(mesh);
    const tier = previewTier || getSelectionTierByMesh(mesh);
    if (tier === 'primary') lines.push(`選択状態: 最優先${previewTier ? '（プレビュー中）' : ''}`);
    else if (tier === 'secondary') lines.push(`選択状態: 気になる${previewTier ? '（プレビュー中）' : ''}`);
    else if (tier === 'clear' && previewTier) lines.push('選択状態: 解除（プレビュー中）');
    lines.push(`ホール: ${mesh.userData.page === 1 ? '南1・2ホール' : '南3・4ホール'}`);
    return lines.join('\n');
  }


  function currentInfoMesh() {
    return hoveredMesh || pinnedMesh || null;
  }

  function updateInfoActionButtons(mesh) {
    if (!markPrimaryBtn || !markSecondaryBtn) return;
    const target = pinnedMesh;
    const tier = target ? getSelectionTierByMesh(target) : null;
    markPrimaryBtn.classList.toggle('active', tier === 'primary');
    markSecondaryBtn.classList.toggle('active', tier === 'secondary');
    markPrimaryBtn.disabled = !target;
    markSecondaryBtn.disabled = !target;
  }

  function updateSelectionBadge(mesh) {
    if (!selectionBadge) return;
    if (!mesh) {
      selectionBadge.dataset.tier = 'hover';
      selectionBadge.textContent = '未選択';
      return;
    }
    const tier = getSelectionTierByMesh(mesh);
    const isPinned = !!pinnedMesh && (pinnedMesh.userData.info?.group_key || pinnedMesh.userData.id) === (mesh.userData.info?.group_key || mesh.userData.id);
    if (tier === 'primary') {
      selectionBadge.dataset.tier = 'primary';
      selectionBadge.textContent = isPinned ? '選択中 / 最優先' : 'ホバー / 最優先';
    } else if (tier === 'secondary') {
      selectionBadge.dataset.tier = 'secondary';
      selectionBadge.textContent = isPinned ? '選択中 / 気になる' : 'ホバー / 気になる';
    } else if (isPinned) {
      selectionBadge.dataset.tier = 'selected';
      selectionBadge.textContent = '選択中';
    } else {
      selectionBadge.dataset.tier = 'hover';
      selectionBadge.textContent = 'ホバー中';
    }
  }

  function setDetail(mesh) {
    const info = mesh?.userData?.info;
    placeholder.style.display = mesh ? 'none' : 'block';
    detail.style.display = mesh ? 'block' : 'none';
    updateInfoActionButtons(mesh);
    updateSelectionBadge(mesh);
    if (!mesh) return;
    boothIdEl.textContent = mesh.userData.id;
    boothNameEl.textContent = info?.booth_name || 'CSV上の詳細情報はありません';
    boothMetaEl.textContent = fmtMeta(mesh);
    boothDescEl.textContent = info?.description || 'このブースに対応するCSV詳細は見つかりませんでした。';
    linkRow.innerHTML = '';
    if (info) {
      [
        ['詳細', info.detail_url],
        ['Web', info.website_url],
        ['X', info.twitter_url],
        ['Instagram', info.instagram_url],
      ].filter(([,url]) => url).forEach(([label, url]) => {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noreferrer noopener';
        a.textContent = label;
        linkRow.appendChild(a);
      });
    }
  }

  function refreshInfoPanel() {
    setDetail(currentInfoMesh());
  }

  function findFocusPosition(mesh) {
    const v = mesh.getWorldPosition(new THREE.Vector3());
    const offset = new THREE.Vector3(0, 200, 210);
    return { target: v.clone(), pos: v.clone().add(offset) };
  }

  let camTween = null;
  function animateCamera(targetPos, targetLook) {
    camTween = {
      startPos: camera.position.clone(),
      startLook: controls.target.clone(),
      endPos: targetPos.clone(),
      endLook: targetLook.clone(),
      t: 0
    };
  }

  function focusMesh(mesh) {
    const focus = findFocusPosition(mesh);
    animateCamera(focus.pos, focus.target);
  }

  function removeBoothIdFromSelections(boothId) {
    const id = normalizeBoothId(boothId);
    const targetMesh = boothById.get(id);
    const targetKey = targetMesh ? (targetMesh.userData.info?.group_key || targetMesh.userData.id) : id;
    const keep = (value) => {
      const mesh = boothById.get(normalizeBoothId(value));
      const key = mesh ? (mesh.userData.info?.group_key || mesh.userData.id) : value;
      return key !== targetKey;
    };
    selectedPrimaryIds = selectedPrimaryIds.filter(keep);
    selectedSecondaryIds = selectedSecondaryIds.filter(keep);
  }

  function setPinnedMesh(mesh) {
    pinnedMesh = mesh || null;
    if (pinnedMesh) openActionMenu(pinnedMesh, window.innerWidth * 0.5, window.innerHeight * 0.5);
    else closeActionMenu();
    refreshInfoPanel();
    overlayDirty = true;
  }

  function updatePointerFromClient(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  function raycastBoothAtClient(clientX, clientY) {
    updatePointerFromClient(clientX, clientY);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(boothMeshes, false);
    return hits.length ? hits[0].object : null;
  }

  function clearMeshSelection(mesh) {
    if (!mesh) return;
    closeActionMenu();
    const boothId = normalizeBoothId(mesh.userData.id);
    removeBoothIdFromSelections(boothId);
    setPinnedMesh(mesh);
    hoveredMesh = mesh;
    refreshMaterials();
    rebuildRoutes();
    saveState();
  }

  function completeGesture(event) {
    const state = gestureState;
    if (!state || event.pointerId !== state.pointerId) return;
    gestureState = null;
    controls.enabled = true;
    try { renderer.domElement.releasePointerCapture?.(event.pointerId); } catch (err) {}
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const dist = Math.hypot(dx, dy);
    const boothId = state.mesh.userData.id;

    if (dist <= TAP_THRESHOLD) {
      setPinnedMesh(state.mesh);
      hoveredMesh = state.mesh;
      refreshMaterials();
      openActionMenu(state.mesh, event.clientX, event.clientY);
      showToast(`${boothId} の方向メニューを開きました`);
      saveState();
      return;
    }

    setPinnedMesh(state.mesh);
    hoveredMesh = state.mesh;
    refreshMaterials();
    saveState();
  }

  function applyTierSelection(mesh, tier, { focus = false, toastMessage = '' } = {}) {
    if (!mesh) return;
    closeActionMenu();
    const boothId = normalizeBoothId(mesh.userData.id);
    const currentTier = getSelectionTierByMesh(mesh);

    if (currentTier === tier) {
      setPinnedMesh(mesh);
      refreshMaterials();
      refreshInfoPanel();
      rebuildRoutes();
      if (focus) focusMesh(mesh);
      if (toastMessage) showToast(toastMessage);
      saveState();
      return;
    }

    removeBoothIdFromSelections(boothId);
    if (tier === 'primary') selectedPrimaryIds.push(boothId);
    else selectedSecondaryIds.push(boothId);

    selectedPrimaryIds = uniqueValidBoothIds(selectedPrimaryIds);
    selectedSecondaryIds = uniqueValidBoothIds(selectedSecondaryIds);
    setPinnedMesh(mesh);
    hoveredMesh = null;
    refreshMaterials();
    refreshInfoPanel();
    rebuildRoutes();
    if (focus) focusMesh(mesh);
    if (toastMessage) showToast(toastMessage);
    saveState();
  }
  function clearSelection() {
    closeActionMenu();
    selectedPrimaryIds = [];
    selectedSecondaryIds = [];
    pinnedMesh = null;
    hoveredMesh = null;
    refreshMaterials();
    refreshInfoPanel();
    rebuildRoutes();
    showToast('選択中ブースを解除しました');
    saveState();
  }


  markPrimaryBtn?.addEventListener('click', () => {
    if (!pinnedMesh) return;
    applyTierSelection(pinnedMesh, 'primary', { toastMessage: `${normalizeBoothId(pinnedMesh.userData.id)} を最優先に設定しました` });
  });

  markSecondaryBtn?.addEventListener('click', () => {
    if (!pinnedMesh) return;
    applyTierSelection(pinnedMesh, 'secondary', { toastMessage: `${normalizeBoothId(pinnedMesh.userData.id)} を気になるに設定しました` });
  });

  drawerPeek?.addEventListener('click', toggleDrawer);
  drawerPeek?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDrawer(); } });
  drawerPeek?.addEventListener('pointerdown', (e) => { drawerPointerStartY = e.clientY; });
  drawerPeek?.addEventListener('pointerup', (e) => {
    if (drawerPointerStartY == null) return;
    const dy = e.clientY - drawerPointerStartY;
    if (dy <= -24) setDrawerOpen(true);
    else if (dy >= 24) setDrawerOpen(false);
    drawerPointerStartY = null;
  });
  drawerPeek?.addEventListener('pointercancel', () => { drawerPointerStartY = null; });

  boothSearchInput?.addEventListener('input', (event) => {
    updateSearch(event.target.value);
  });

  boothSearchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      clearSearch({ focusInput: true });
    }
  });

  boothSearchClearBtn?.addEventListener('click', () => {
    clearSearch({ focusInput: true });
  });


  topViewBtn.addEventListener('click', () => {
    closeActionMenu();
    animateCamera(new THREE.Vector3(0, 1400, 0.01), new THREE.Vector3(0, 0, 0));
    saveState();
  });

  resetViewBtn.addEventListener('click', () => {
    closeActionMenu();
    animateCamera(DEFAULT_CAMERA_POS.clone(), DEFAULT_CAMERA_TARGET.clone());
    saveState();
  });

  hallModelBtn?.addEventListener('click', () => {
    closeActionMenu();
    setHallModelVisible(!hallModelVisible);
  });

  categoryLayerBtn?.addEventListener('click', () => {
    closeActionMenu();
    setCategoryLayerVisible(!categoryLayerVisible);
    showToast(categoryLayerVisible ? 'カテゴリレイヤーをONにしました' : 'カテゴリレイヤーをOFFにしました');
  });

  themeToggleBtn?.addEventListener('click', () => {
    closeActionMenu();
    const next = themeMode === 'dark' ? 'light' : 'dark';
    applyThemeMode(next);
    showToast(next === 'dark' ? 'ダークモードに切り替えました' : 'ライトモードに切り替えました');
  });

  drawerShareBtn?.addEventListener('click', async () => {
    closeActionMenu();
    const url = buildShareUrl();
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('共有リンクをコピーしました');
      } else {
        window.prompt('このURLをコピーしてください', url);
      }
    } catch (err) {
      console.warn('share failed', err);
      window.prompt('このURLをコピーしてください', url);
    }
  });

  drawerClearBtn?.addEventListener('click', () => {
    closeActionMenu();
    const ok = window.confirm('選択を全解除しますか？');
    if (!ok) return;
    clearSelection();
  });

  renderer.domElement.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    pointerDownState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      mesh: raycastBoothAtClient(event.clientX, event.clientY)
    };
  });

  renderer.domElement.addEventListener('pointermove', (event) => {
    const hoveredIcon = raycastActionIconAtClient(event.clientX, event.clientY);
    const nextPreviewTier = hoveredIcon?.userData?.tier || null;
    if (actionMenuState && nextPreviewTier !== (actionMenuState.previewTier || null)) {
      setActionMenuPreview(nextPreviewTier);
      overlayDirty = true;
    }
    if (hoveredIcon) {
      if (hoveredMesh) {
        hoveredMesh = null;
        refreshMaterials();
        refreshInfoPanel();
        overlayDirty = true;
      }
      needsRaycast = false;
      return;
    }
    updatePointerFromClient(event.clientX, event.clientY);
    needsRaycast = true;
  });

  renderer.domElement.addEventListener('pointerup', (event) => {
    const state = pointerDownState;
    pointerDownState = null;
    if (!state || event.pointerId !== state.pointerId) return;
    const dx = event.clientX - state.startX;
    const dy = event.clientY - state.startY;
    const dist = Math.hypot(dx, dy);
    const isTap = dist <= TAP_THRESHOLD;
    const tappedIcon = isTap ? raycastActionIconAtClient(event.clientX, event.clientY) : null;
    if (tappedIcon?.userData?.tier) {
      commitActionMenuSelection(tappedIcon.userData.tier);
      saveState();
      return;
    }
    if (!isTap) return;
    const upMesh = raycastBoothAtClient(event.clientX, event.clientY);
    if (state.mesh && upMesh === state.mesh) {
      setPinnedMesh(state.mesh);
      hoveredMesh = state.mesh;
      refreshMaterials();
      refreshInfoPanel();
      saveState();
      return;
    }
    if (!upMesh) {
      hoveredMesh = null;
      setPinnedMesh(null);
      refreshMaterials();
      refreshInfoPanel();
      saveState();
    }
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    if (actionMenuState?.previewTier) {
      setActionMenuPreview(null);
      overlayDirty = true;
    }
  });

  renderer.domElement.addEventListener('pointercancel', () => {
    pointerDownState = null;
    if (actionMenuState?.previewTier) {
      setActionMenuPreview(null);
      overlayDirty = true;
    }
  });

  renderer.domElement.addEventListener('pointerleave', () => {
    hoveredMesh = null;
    refreshMaterials();
    refreshInfoPanel();
    overlayDirty = true;
  });

  function doRaycast() {
    if (gestureState || menuGesture) return;
    const hoveredIcon = raycastActionIconAtClient(
      ((pointer.x + 1) * 0.5) * renderer.domElement.getBoundingClientRect().width + renderer.domElement.getBoundingClientRect().left,
      ((-pointer.y + 1) * 0.5) * renderer.domElement.getBoundingClientRect().height + renderer.domElement.getBoundingClientRect().top
    );
    if (hoveredIcon) {
      if (hoveredMesh !== null) {
        hoveredMesh = null;
        refreshMaterials();
        refreshInfoPanel();
        overlayDirty = true;
      }
      return;
    }
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(boothMeshes, false);
    const mesh = hits.length ? hits[0].object : null;
    if (mesh !== hoveredMesh) {
      hoveredMesh = mesh;
      refreshMaterials();
      refreshInfoPanel();
      overlayDirty = true;
    }
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (labelCtx) resizeLabelCanvas();
    overlayDirty = true;
    saveState();
  });

  controls.addEventListener('change', () => { needsRaycast = true; overlayDirty = true; });
  controls.addEventListener('end', () => saveState());
  window.addEventListener('pagehide', () => saveState(true));
  window.addEventListener('beforeunload', () => saveState(true));

  function tickCamTween() {
    if (!camTween) return;
    camTween.t += 0.06;
    const t = Math.min(1, 1 - Math.pow(1 - camTween.t, 3));
    overlayDirty = true;
    camera.position.lerpVectors(camTween.startPos, camTween.endPos, t);
    controls.target.lerpVectors(camTween.startLook, camTween.endLook, t);
    if (camTween.t >= 1) {
      camTween = null;
      saveState();
    }
  }

  restoreState = parseStateFromUrl() || loadState();

  if (restoreState?.source === 'url') {
    showToast('共有リンクの状態を反映しました');
  }


  if (restoreState?.camera) {
    applyCameraState(restoreState.camera);
  } else {
    animateCamera(DEFAULT_CAMERA_POS.clone(), DEFAULT_CAMERA_TARGET.clone());
  }

  themeMode = restoreState?.themeMode === 'dark' ? 'dark' : 'light';
  applyThemeMode(themeMode, { save: false });
  setDetail(null);

  selectedPrimaryIds = uniqueValidBoothIds(restoreState?.primaryBoothIds || []);
  selectedSecondaryIds = uniqueValidBoothIds(restoreState?.secondaryBoothIds || []);
  categoryLayerVisible = !!restoreState?.categoryLayerVisible;
  renderCategoryLegend();
  renderSearchResults();
  updateCategoryLayerButton();
  updateCategoryLegendVisibility();
  refreshMaterials();
  rebuildRoutes();

  if (restoreState?.pinnedBoothId) {
    const restoredMesh = boothById.get(normalizeBoothId(restoreState.pinnedBoothId));
    if (restoredMesh) {
      setPinnedMesh(restoredMesh);
      if (!restoreState?.camera) {
        focusMesh(restoredMesh);
      }
    }
  }

  updateAddressBarFromState();
  setHallModelVisible(false);
  setDrawerOpen(false);
  renderDrawerLists();

  function animate() {
    requestAnimationFrame(animate);
    if (needsRaycast) {
      doRaycast();
      needsRaycast = false;
    }
    tickCamTween();
    controls.update();
    if (actionMenuState?.mesh) updateActionIconLayout(actionMenuState.mesh);
    updateHallArchitectureVisibility();
    renderer.render(scene, camera);
    if (labelCtx && overlayDirty) {
      renderOverlayLabels();
      overlayDirty = false;
    }
  }
  animate();
} catch (err) {
  console.error(err);
  showError(err);
}