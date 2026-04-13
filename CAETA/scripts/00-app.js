import { THREE, OrbitControls } from './lib/10-deps.js';
import { DATA } from './10-data.js';
import { installGlobalErrorHandlers } from './core/10-errors.js';
import { getDomRefs } from './core/20-dom.js';
import { normalizeBoothId, escapeHtml, normalizeSearchText } from './utils/10-id.js';
import { groupKeyFromMesh, uniqueValidBoothIds as baseUniqueValidBoothIds, selectedGroupKeysFrom as baseSelectedGroupKeysFrom } from './utils/20-groups.js';
import { searchIndexTextForMesh as baseSearchIndexTextForMesh, searchScoreForMesh, searchResultsForQuery as baseSearchResultsForQuery } from './features/10-search-utils.js';
import { normalizeCategoryLabel, colorForCategoryLabel as baseColorForCategoryLabel, buildCategoryLegendEntries } from './features/50-category-utils.js';
import { buildStatePayload as makeStatePayload, buildShareUrl as makeShareUrl, parseStateFromUrl as parseUrlState } from './features/80-url-state.js';
import { fmtMeta as formatMeshMeta } from './features/30-meta-utils.js';
import { setupTexturesAndLabels } from './visuals/10-textures-and-labels.js';
import { setupHallArchitecture } from './visuals/20-hall-architecture.js';
import { setupLayoutAndOverlay } from './visuals/30-layout-and-overlay.js';
import { setupSelectionCore } from './features/40-selection-core.js';
import { setupCategoryLayer } from './features/60-category-layer.js';
import { setupDrawer } from './features/70-drawer.js';
import { setupPersistence } from './features/90-persistence.js';
import { setupActionMenu } from './features/100-action-menu.js';
import { setupSearchUi } from './features/20-search-ui.js';

installGlobalErrorHandlers(document);

const {
  app,
  bottomDrawer,
  drawerPeek,
  drawerTitle,
  drawerSummaryText,
  drawerPrimaryCount,
  drawerSecondaryCount,
  drawerPrimaryList,
  drawerSecondaryList,
  drawerShareBtn,
  drawerClearBtn,
  topViewBtn,
  resetViewBtn,
  hallModelBtn,
  categoryLayerBtn,
  themeToggleBtn,
  categoryLegend,
  categoryLegendList,
  boothSearchInput,
  boothSearchClearBtn,
  boothSearchMeta,
  boothSearchCount,
  boothSearchResults,
  boothSearchResultsList,
  placeholder,
  detail,
  boothIdEl,
  boothNameEl,
  boothMetaEl,
  boothDescEl,
  selectionBadge,
  linkRow,
  markPrimaryBtn,
  markSecondaryBtn,
  toast,
  errorBox,
  boothActionMenu,
  menuBoothId,
  menuNodes,
  labelCanvas,
} = getDomRefs(document);
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

      const {
        labelColor,
        createTextTexture,
        makeBadgeSprite,
        makeHallNameSprite,
        makeFlatTextSprite,
        roundedRectPath,
        makeIconCanvas,
        actionTierVisual,
        makeActionIconSprite,
        setActionIconSpriteVisual,
        makeGroundTextMesh,
        makeVerticalTopTextMesh,
        makeAreaLabelGroundMesh,
        makePortalTriangleMesh,
        createConcreteTexture,
      } = setupTexturesAndLabels({ THREE, document, renderer });

      const hallArchitectureGroups = new Map();
      const hallGroups = new Map();
      const boothMeshes = [];
      const boothById = new Map();
      function rebuildRoutes() {}

      const groupMembers = new Map();
      const bandMeshes = [];
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

      const layoutHelpers = setupLayoutAndOverlay({
        THREE,
        DATA,
        document,
        renderer,
        scene,
        camera,
        tempVec,
        hallGroups,
        bandMeshes,
        areaLabelMeshes,
        pageDataByPage,
        pageTextureCache,
        pageLabelTextureCache,
        HALL_OFFSETS,
        HALL_PORTALS,
        HALL_FRAMES,
        SPECIAL_OBJECTS,
        BOOTH_H,
        LABEL_PLANE_Y,
        ZONE_Y,
        FRAME_WALL_T,
        ROUTE_PADDING,
        getLayoutMode: () => layoutMode,
        makePortalTriangleMesh,
        makeGroundTextMesh,
        makeVerticalTopTextMesh,
        makeAreaLabelGroundMesh,
        labelColor,
      });
      const {
        getHallFrame,
        pagePointToLocal,
        pageToScene,
        layoutX,
        ensureHall,
        makeZoneMesh,
        hallReferenceTexture,
        makePageTopLabelTexture,
        makeHallBase,
        makeRectObject,
        makeFrameWalls,
        getAreaLabelOffset,
        applyLayout,
        rebuildOverlayData,
        projectToScreen,
        drawTextLabel,
        perspectiveLabelSizePx,
        renderOverlayLabels,
        getPageObstacles,
      } = layoutHelpers;

      const {
        makeHallArchitecture,
        updateHallArchitectureVisibility,
      } = setupHallArchitecture({
        THREE,
        DATA,
        HALL_ARCH_SPECS,
        hallGroups,
        hallArchitectureGroups,
        createConcreteTexture,
        makeGroundTextMesh,
        ensureHall,
        pageToScene,
        getHallFrame,
        BOOTH_H,
      });

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
          color: '#000000',
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

      applyLayout();
      rebuildOverlayData({ overlayBoothLabels, overlayAreaLabels });
      overlayDirty = true;

      function setHallModelVisible(nextVisible) {
        hallModelVisible = !!nextVisible;
        if (hallModelBtn) {
          hallModelBtn.classList.toggle('is-active', hallModelVisible);
          hallModelBtn.setAttribute('aria-pressed', String(hallModelVisible));
          hallModelBtn.title = hallModelVisible ? '会場モデルOFF' : '会場モデルON';
        }
        if (guide) guide.visible = !hallModelVisible;
        areaLabelMeshes.forEach((mesh) => { mesh.visible = true; });
        updateHallArchitectureVisibility({ hallModelVisible, hallAutoArchitectureVisible }, true);
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
      let needsRaycast = false;
      let restoreState = null;
      let gestureState = null;
      let menuGesture = null;
      let pointerDownState = null;
      const SWIPE_THRESHOLD = 44;
      const TAP_THRESHOLD = 14;
      const MENU_DEADZONE = 28;
      const URL_STATE_VERSION = '1';
      let searchQuery = '';
      let searchResultIds = [];
      let hoveredSearchBoothId = null;
      let drawerPointerStartY = null;

      function serializeCameraState() {
        return {
          position: {
            x: Number(camera.position.x.toFixed(2)),
            y: Number(camera.position.y.toFixed(2)),
            z: Number(camera.position.z.toFixed(2)),
          },
          target: {
            x: Number(controls.target.x.toFixed(2)),
            y: Number(controls.target.y.toFixed(2)),
            z: Number(controls.target.z.toFixed(2)),
          },
        };
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
        return baseSelectedGroupKeysFrom(ids, boothById, normalizeBoothId);
      }

      function colorForCategoryLabel(label) {
        return baseColorForCategoryLabel(label, categoryColorCache, THREE, normalizeCategoryLabel);
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
          mesh,
        };
      }

      let renderDrawerLists = () => {};
      let setDrawerOpen = () => {};
      let toggleDrawer = () => {};
      let buildShareUrl = () => window.location.href;
      let parseStateFromUrl = () => null;
      let saveState = () => {};
      let loadState = () => null;
      let applyCameraState = () => {};
      let updateAddressBarFromState = () => {};
      let previewStateForMesh = () => null;
      let openActionMenu = () => {};
      let closeActionMenu = () => {};
      let raycastActionIconAtClient = () => null;
      let updateActionIconLayout = () => {};
      let syncActionIconsToSelection = () => {};
      let commitActionMenuSelection = () => {};
      let getActionMenuState = () => null;

      const selectionCore = setupSelectionCore({
        normalizeBoothId,
        boothById,
        selectedGroupKeysFrom,
        getSelectedPrimaryIds: () => selectedPrimaryIds,
        getSelectedSecondaryIds: () => selectedSecondaryIds,
        setSelectedPrimaryIds: (value) => { selectedPrimaryIds = value; },
        setSelectedSecondaryIds: (value) => { selectedSecondaryIds = value; },
        drawerSummaryText,
        drawerPrimaryCount,
        drawerSecondaryCount,
        renderDrawerLists: () => renderDrawerLists(),
      });
      const { getSelectionTierByMesh, updateSelectionSummary, removeBoothIdFromSelections } = selectionCore;

      const categoryLayerApi = setupCategoryLayer({
        THREE,
        document,
        boothMeshes,
        categoryLegend,
        categoryLegendList,
        categoryLayerBtn,
        emptyInfoMaterial,
        categoryMaterialCache,
        categoryLegendHoverMaterialCache,
        normalizeCategoryLabel,
        colorForCategoryLabel,
        buildCategoryLegendEntries,
        refreshMaterials: () => refreshMaterials(),
        saveState: (...args) => saveState(...args),
        getCategoryLayerVisible: () => categoryLayerVisible,
        setCategoryLayerVisibleValue: (value) => { categoryLayerVisible = value; },
        getLegendHoveredCategory: () => legendHoveredCategory,
        setLegendHoveredCategoryValue: (value) => { legendHoveredCategory = value; },
      });
      const {
        categoryLabelForMesh,
        categoryMaterialForMesh,
        categoryLegendHoverMaterialForLabel,
        renderCategoryLegend,
        updateCategoryLegendVisibility,
        updateCategoryLayerButton,
        setCategoryLayerVisible,
      } = categoryLayerApi;

      const drawerApi = setupDrawer({
        document,
        performance,
        bottomDrawer,
        drawerPeek,
        drawerPrimaryList,
        drawerSecondaryList,
        getSelectedPrimaryIds: () => selectedPrimaryIds,
        getSelectedSecondaryIds: () => selectedSecondaryIds,
        setSelectedPrimaryIds: (value) => { selectedPrimaryIds = value; },
        setSelectedSecondaryIds: (value) => { selectedSecondaryIds = value; },
        uniqueValidBoothIds,
        setPinnedMesh: (mesh) => setPinnedMesh(mesh),
        setHoveredMesh: (mesh) => { hoveredMesh = mesh; },
        refreshMaterials: () => refreshMaterials(),
        focusMesh: (mesh) => focusMesh(mesh),
        showToast,
        saveState: (...args) => saveState(...args),
        drawerItemDataFromId,
      });
      renderDrawerLists = drawerApi.renderDrawerLists;
      setDrawerOpen = drawerApi.setDrawerOpen;
      toggleDrawer = drawerApi.toggleDrawer;

      const persistenceApi = setupPersistence({
        STORAGE_KEY,
        URL_STATE_VERSION,
        makeStatePayload,
        makeShareUrl,
        parseUrlState,
        getPinnedMesh: () => pinnedMesh,
        getSelectedPrimaryIds: () => selectedPrimaryIds,
        getSelectedSecondaryIds: () => selectedSecondaryIds,
        getCategoryLayerVisible: () => categoryLayerVisible,
        getThemeMode: () => themeMode,
        serializeCameraState,
        uniqueValidBoothIds,
        normalizeBoothId,
        camera,
        controls,
      });
      buildShareUrl = persistenceApi.buildShareUrl;
      parseStateFromUrl = persistenceApi.parseStateFromUrl;
      saveState = persistenceApi.saveState;
      loadState = persistenceApi.loadState;
      applyCameraState = persistenceApi.applyCameraState;
      updateAddressBarFromState = persistenceApi.updateAddressBarFromState;

      const actionMenuApi = setupActionMenu({
        THREE,
        scene,
        camera,
        controls,
        raycaster,
        pointer,
        boothActionMenu,
        menuNodes,
        makeActionIconSprite,
        setActionIconSpriteVisual,
        updatePointerFromClient: (clientX, clientY) => updatePointerFromClient(clientX, clientY),
        getSelectionTierByMesh,
        refreshMaterials: () => refreshMaterials(),
        setDetail: (mesh) => setDetail(mesh),
        removeBoothIdFromSelections,
        refreshInfoPanel: () => refreshInfoPanel(),
        rebuildRoutes: () => rebuildRoutes(),
        showToast,
        saveState: (...args) => saveState(...args),
        applyTierSelection: (mesh, tier, options) => applyTierSelection(mesh, tier, options),
        normalizeBoothId,
        markOverlayDirty: () => { overlayDirty = true; },
      });
      previewStateForMesh = actionMenuApi.previewStateForMesh;
      openActionMenu = actionMenuApi.openActionMenu;
      closeActionMenu = actionMenuApi.closeActionMenu;
      raycastActionIconAtClient = actionMenuApi.raycastActionIconAtClient;
      updateActionIconLayout = actionMenuApi.updateActionIconLayout;
      syncActionIconsToSelection = actionMenuApi.syncActionIconsToSelection;
      commitActionMenuSelection = actionMenuApi.commitActionMenuSelection;
      const setActionMenuPreview = actionMenuApi.setActionMenuPreview;
      getActionMenuState = actionMenuApi.getActionMenuState;

      function fmtMeta(mesh) {
        const previewTier = previewStateForMesh(mesh);
        const tier = previewTier || getSelectionTierByMesh(mesh);
        const hallLabel = mesh.userData.page === 1 ? '南1・2ホール' : '南3・4ホール';
        return formatMeshMeta(mesh, { previewTier, tier, hallLabel });
      }

      const searchUiApi = setupSearchUi({
        document,
        boothSearchInput,
        boothSearchResultsList,
        boothSearchResults,
        boothSearchMeta,
        boothSearchCount,
        boothMeshes,
        escapeHtml,
        normalizeSearchText,
        searchIndexTextForMesh: baseSearchIndexTextForMesh,
        searchScoreForMesh,
        drawerItemDataFromId,
        refreshMaterials: () => refreshMaterials(),
        setPinnedMesh: (mesh) => setPinnedMesh(mesh),
        refreshInfoPanel: () => refreshInfoPanel(),
        focusMesh: (mesh) => focusMesh(mesh),
        showToast,
        saveState: (...args) => saveState(...args),
        setHoveredMesh: (mesh) => { hoveredMesh = mesh; },
        getSearchQuery: () => searchQuery,
        setSearchQuery: (value) => { searchQuery = value; },
        getSearchResultIds: () => searchResultIds,
        setSearchResultIds: (value) => { searchResultIds = value; },
        getHoveredSearchBoothId: () => hoveredSearchBoothId,
        setHoveredSearchBoothId: (value) => { hoveredSearchBoothId = value; },
      });
      const { renderSearchResults, updateSearch, clearSearch } = searchUiApi;

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
        const actionMenuState = getActionMenuState();
        if (actionMenuState?.mesh) syncActionIconsToSelection(actionMenuState.mesh);
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
        const actionMenuState = getActionMenuState();
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
        const actionMenuState = getActionMenuState();
        if (actionMenuState?.previewTier) {
          setActionMenuPreview(null);
          overlayDirty = true;
        }
      });

      renderer.domElement.addEventListener('pointercancel', () => {
        pointerDownState = null;
        const actionMenuState = getActionMenuState();
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
        const actionMenuState = getActionMenuState();
        if (actionMenuState?.mesh) updateActionIconLayout(actionMenuState.mesh);
        updateHallArchitectureVisibility({ hallModelVisible, hallAutoArchitectureVisible });
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