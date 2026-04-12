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

  
