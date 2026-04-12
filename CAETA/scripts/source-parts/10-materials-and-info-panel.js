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

  
