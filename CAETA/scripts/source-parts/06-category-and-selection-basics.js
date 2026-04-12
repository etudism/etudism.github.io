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
    const keys = new Set();
    ids.forEach((id) => {
      const mesh = boothById.get(id);
      if (!mesh) return;
      keys.add(mesh.userData.info?.group_key || mesh.userData.id);
    });
    return keys;
  }

  function getSelectionTierByMesh(mesh) {
    const key = mesh.userData.info?.group_key || mesh.userData.id;
    if (selectedGroupKeysFrom(selectedPrimaryIds).has(key)) return 'primary';
    if (selectedGroupKeysFrom(selectedSecondaryIds).has(key)) return 'secondary';
    return null;
  }

  function updateSelectionSummary() {
    const summary = `最優先 ${selectedPrimaryIds.length}件 / 気になる ${selectedSecondaryIds.length}件`;
    if (drawerSummaryText) drawerSummaryText.textContent = summary;
    if (drawerPrimaryCount) drawerPrimaryCount.textContent = `${selectedPrimaryIds.length}件`;
    if (drawerSecondaryCount) drawerSecondaryCount.textContent = `${selectedSecondaryIds.length}件`;
    renderDrawerLists();
  }

  function normalizeCategoryLabel(category) {
    const raw = String(category || '').trim();
    if (!raw) return '未分類';
    const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
    return parts[1] || parts[0] || '未分類';
  }

  function categoryLabelForMesh(mesh) {
    return normalizeCategoryLabel(mesh?.userData?.info?.category);
  }

  function hashString(value) {
    let hash = 0;
    const source = String(value || '');
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  function colorForCategoryLabel(label) {
    const key = normalizeCategoryLabel(label);
    if (categoryColorCache.has(key)) return categoryColorCache.get(key).clone();
    const hash = hashString(key);
    const hue = (hash % 360) / 360;
    const saturation = 0.54 + ((hash >> 3) % 12) / 100;
    const lightness = 0.56 + ((hash >> 7) % 10) / 100;
    const color = new THREE.Color().setHSL(hue, Math.min(0.7, saturation), Math.min(0.72, lightness));
    categoryColorCache.set(key, color.clone());
    return color;
  }

  function categoryMaterialForMesh(mesh) {
    if (!mesh || mesh.userData.base === 'empty') return emptyInfoMaterial;
    const label = categoryLabelForMesh(mesh);
    if (!categoryMaterialCache.has(label)) {
      const color = colorForCategoryLabel(label);
      const emissive = color.clone().multiplyScalar(0.18);
      categoryMaterialCache.set(label, new THREE.MeshStandardMaterial({
        color,
        emissive,
        emissiveIntensity: 0.16
      }));
    }
    return categoryMaterialCache.get(label);
  }

  function categoryLegendHoverMaterialForLabel(label) {
    const key = normalizeCategoryLabel(label);
    if (!categoryLegendHoverMaterialCache.has(key)) {
      const color = colorForCategoryLabel(key).clone();
      const boosted = color.clone().offsetHSL(0, 0.02, 0.08);
      const emissive = color.clone().lerp(new THREE.Color(0xffffff), 0.22).multiplyScalar(0.72);
      categoryLegendHoverMaterialCache.set(key, new THREE.MeshStandardMaterial({
        color: boosted,
        emissive,
        emissiveIntensity: 0.92
      }));
    }
    return categoryLegendHoverMaterialCache.get(key);
  }

  function categoryLegendEntries() {
    const counts = new Map();
    boothMeshes.forEach((mesh) => {
      if (!mesh || mesh.userData.base === 'empty') return;
      const label = categoryLabelForMesh(mesh);
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count, color: '#' + colorForCategoryLabel(label).getHexString() }))
      .sort((a, b) => (b.count - a.count) || a.label.localeCompare(b.label, 'ja'));
  }

  function setLegendHoveredCategory(label) {
    const next = label ? normalizeCategoryLabel(label) : null;
    if (legendHoveredCategory === next) return;
    legendHoveredCategory = next;
    refreshMaterials();
    if (categoryLegendList) {
      categoryLegendList.querySelectorAll('.category-legend-item').forEach((el) => {
        el.classList.toggle('is-hovered', !!next && el.dataset.category === next);
      });
    }
  }

  function renderCategoryLegend() {
    if (!categoryLegendList) return;
    const entries = categoryLegendEntries();
    categoryLegendList.innerHTML = '';
    entries.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-legend-item';
      button.dataset.category = entry.label;
      button.innerHTML = `
        <span class="category-legend-swatch" style="background:${entry.color}"></span>
        <span class="category-legend-label">${entry.label}</span>
        <span class="category-legend-count">${entry.count}件</span>
      `;
      const activate = () => setLegendHoveredCategory(entry.label);
      const deactivate = () => {
        if (legendHoveredCategory === entry.label) setLegendHoveredCategory(null);
      };
      button.addEventListener('pointerenter', activate);
      button.addEventListener('pointerleave', deactivate);
      button.addEventListener('focus', activate);
      button.addEventListener('blur', deactivate);
      categoryLegendList.appendChild(button);
    });
  }

  function updateCategoryLegendVisibility() {
    if (!categoryLegend) return;
    const visible = !!categoryLayerVisible;
    categoryLegend.hidden = !visible;
    categoryLegend.setAttribute('aria-hidden', String(!visible));
    categoryLegend.classList.toggle('is-visible', visible);
    if (!visible && legendHoveredCategory) setLegendHoveredCategory(null);
  }

  function updateCategoryLayerButton() {
    if (!categoryLayerBtn) return;
    categoryLayerBtn.classList.toggle('is-active', categoryLayerVisible);
    categoryLayerBtn.setAttribute('aria-pressed', String(categoryLayerVisible));
    categoryLayerBtn.title = categoryLayerVisible ? 'カテゴリレイヤー ON' : 'カテゴリレイヤー OFF';
  }

  function setCategoryLayerVisible(next, { save = true } = {}) {
    categoryLayerVisible = !!next;
    updateCategoryLayerButton();
    updateCategoryLegendVisibility();
    refreshMaterials();
    if (save) saveState();
  }

  
