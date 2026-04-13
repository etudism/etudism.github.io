export function setupCategoryLayer({
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
  refreshMaterials,
  saveState,
  getCategoryLayerVisible,
  setCategoryLayerVisibleValue,
  getLegendHoveredCategory,
  setLegendHoveredCategoryValue,
}) {
  function categoryLabelForMesh(mesh) {
    return normalizeCategoryLabel(mesh?.userData?.info?.category);
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
        emissiveIntensity: 0.16,
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
        emissiveIntensity: 0.92,
      }));
    }
    return categoryLegendHoverMaterialCache.get(key);
  }

  function setLegendHoveredCategory(label) {
    const next = label ? normalizeCategoryLabel(label) : null;
    if (getLegendHoveredCategory() === next) return;
    setLegendHoveredCategoryValue(next);
    refreshMaterials();
    if (categoryLegendList) {
      categoryLegendList.querySelectorAll('.category-legend-item').forEach((el) => {
        el.classList.toggle('is-hovered', !!next && el.dataset.category === next);
      });
    }
  }

  function renderCategoryLegend() {
    if (!categoryLegendList) return;
    const entries = buildCategoryLegendEntries({
      boothMeshes,
      categoryLabelForMesh,
      colorForCategoryLabel,
    });
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
        if (getLegendHoveredCategory() === entry.label) setLegendHoveredCategory(null);
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
    const visible = !!getCategoryLayerVisible();
    categoryLegend.hidden = !visible;
    categoryLegend.setAttribute('aria-hidden', String(!visible));
    categoryLegend.classList.toggle('is-visible', visible);
    if (!visible && getLegendHoveredCategory()) setLegendHoveredCategory(null);
  }

  function updateCategoryLayerButton() {
    if (!categoryLayerBtn) return;
    const visible = !!getCategoryLayerVisible();
    categoryLayerBtn.classList.toggle('is-active', visible);
    categoryLayerBtn.setAttribute('aria-pressed', String(visible));
    categoryLayerBtn.title = visible ? 'カテゴリレイヤー ON' : 'カテゴリレイヤー OFF';
  }

  function setCategoryLayerVisible(next, { save = true } = {}) {
    setCategoryLayerVisibleValue(!!next);
    updateCategoryLayerButton();
    updateCategoryLegendVisibility();
    refreshMaterials();
    if (save) saveState();
  }

  return {
    categoryLabelForMesh,
    categoryMaterialForMesh,
    categoryLegendHoverMaterialForLabel,
    renderCategoryLegend,
    updateCategoryLegendVisibility,
    updateCategoryLayerButton,
    setCategoryLayerVisible,
  };
}
