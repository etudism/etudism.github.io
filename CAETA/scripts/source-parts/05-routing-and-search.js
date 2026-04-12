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

  
