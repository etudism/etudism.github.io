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
