export function setupPersistence({
  STORAGE_KEY,
  URL_STATE_VERSION,
  makeStatePayload,
  makeShareUrl,
  parseUrlState,
  getPinnedMesh,
  getSelectedPrimaryIds,
  getSelectedSecondaryIds,
  getCategoryLayerVisible,
  getThemeMode,
  serializeCameraState,
  uniqueValidBoothIds,
  normalizeBoothId,
  camera,
  controls,
}) {
  let persistTimer = null;

  function buildStatePayload() {
    return makeStatePayload({
      pinnedMesh: getPinnedMesh(),
      selectedPrimaryIds: getSelectedPrimaryIds(),
      selectedSecondaryIds: getSelectedSecondaryIds(),
      categoryLayerVisible: getCategoryLayerVisible(),
      themeMode: getThemeMode(),
      serializeCameraState,
      uniqueValidBoothIds: (ids) => uniqueValidBoothIds(ids),
    });
  }

  function buildShareUrl() {
    return makeShareUrl({
      href: window.location.href,
      payload: buildStatePayload(),
      urlStateVersion: URL_STATE_VERSION,
    });
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
    return parseUrlState({
      search: window.location.search,
      urlStateVersion: URL_STATE_VERSION,
      normalizeBoothId,
      uniqueValidBoothIds: (ids) => uniqueValidBoothIds(ids),
    });
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

  return {
    buildStatePayload,
    buildShareUrl,
    parseStateFromUrl,
    saveState,
    loadState,
    applyCameraState,
    updateAddressBarFromState,
  };
}
