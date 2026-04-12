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
  
