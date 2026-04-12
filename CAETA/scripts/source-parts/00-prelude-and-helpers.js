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

  
