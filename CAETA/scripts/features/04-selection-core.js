export function setupSelectionCore({
  normalizeBoothId,
  boothById,
  selectedGroupKeysFrom,
  getSelectedPrimaryIds,
  getSelectedSecondaryIds,
  setSelectedPrimaryIds,
  setSelectedSecondaryIds,
  drawerSummaryText,
  drawerPrimaryCount,
  drawerSecondaryCount,
  renderDrawerLists,
}) {
  function getSelectionTierByMesh(mesh) {
    const key = mesh.userData.info?.group_key || mesh.userData.id;
    if (selectedGroupKeysFrom(getSelectedPrimaryIds()).has(key)) return 'primary';
    if (selectedGroupKeysFrom(getSelectedSecondaryIds()).has(key)) return 'secondary';
    return null;
  }

  function updateSelectionSummary() {
    const primaryIds = getSelectedPrimaryIds();
    const secondaryIds = getSelectedSecondaryIds();
    const summary = `最優先 ${primaryIds.length}件 / 気になる ${secondaryIds.length}件`;
    if (drawerSummaryText) drawerSummaryText.textContent = summary;
    if (drawerPrimaryCount) drawerPrimaryCount.textContent = `${primaryIds.length}件`;
    if (drawerSecondaryCount) drawerSecondaryCount.textContent = `${secondaryIds.length}件`;
    renderDrawerLists();
  }

  function removeBoothIdFromSelections(boothId) {
    const id = normalizeBoothId(boothId);
    const targetMesh = boothById.get(id);
    const targetKey = targetMesh ? (targetMesh.userData.info?.group_key || targetMesh.userData.id) : id;
    const keep = (value) => {
      const mesh = boothById.get(normalizeBoothId(value));
      const key = mesh ? (mesh.userData.info?.group_key || mesh.userData.id) : value;
      return key !== targetKey;
    };
    setSelectedPrimaryIds(getSelectedPrimaryIds().filter(keep));
    setSelectedSecondaryIds(getSelectedSecondaryIds().filter(keep));
  }

  return {
    getSelectionTierByMesh,
    updateSelectionSummary,
    removeBoothIdFromSelections,
  };
}
