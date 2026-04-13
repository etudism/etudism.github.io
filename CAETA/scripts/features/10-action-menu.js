export function setupActionMenu({
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
  updatePointerFromClient,
  getSelectionTierByMesh,
  refreshMaterials,
  setDetail,
  removeBoothIdFromSelections,
  refreshInfoPanel,
  rebuildRoutes,
  showToast,
  saveState,
  applyTierSelection,
  normalizeBoothId,
  markOverlayDirty,
}) {
  let actionMenuState = null;
  let actionIconSprites = [];
  let actionIconGroup = null;
  let hoveredActionIconTier = null;

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
    const rayToCamera = new THREE.Vector3().subVectors(camera.position, center);
    if (rayToCamera.lengthSq() > 1e-8) rayToCamera.normalize();
    else rayToCamera.set(0, 0, 1);
    const towardCameraOffset = Math.max(4.0, Math.min(8.0, Math.max(size.x, size.y, size.z) * 0.22));
    const groupPos = center.clone().addScaledVector(rayToCamera, towardCameraOffset);
    actionIconGroup.position.copy(groupPos);
    actionIconGroup.quaternion.copy(camera.quaternion);

    const angleMap = {
      primary: Math.PI / 2,
      secondary: Math.PI / 2 + (Math.PI * 2 / 3),
      clear: Math.PI / 2 + (Math.PI * 4 / 3),
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

  function closeActionMenu({ keepPreview = false } = {}) {
    if (!keepPreview && actionMenuState) actionMenuState.previewTier = null;
    actionMenuState = null;
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
      previewTier: null,
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
    markOverlayDirty();
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

  function getActionMenuState() {
    return actionMenuState;
  }

  return {
    previewStateForMesh,
    openActionMenu,
    closeActionMenu,
    raycastActionIconAtClient,
    updateActionIconLayout,
    syncActionIconsToSelection,
    commitActionMenuSelection,
    setActionMenuPreview,
    getActionMenuState,
  };
}
