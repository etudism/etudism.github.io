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


  
