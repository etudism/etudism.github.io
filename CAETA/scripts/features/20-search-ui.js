export function setupSearchUi({
  document,
  boothSearchInput,
  boothSearchResultsList,
  boothSearchResults,
  boothSearchMeta,
  boothSearchCount,
  boothMeshes,
  escapeHtml,
  normalizeSearchText,
  searchIndexTextForMesh,
  searchScoreForMesh,
  drawerItemDataFromId,
  refreshMaterials,
  setPinnedMesh,
  refreshInfoPanel,
  focusMesh,
  showToast,
  saveState,
  setHoveredMesh,
  getSearchQuery,
  setSearchQuery,
  getSearchResultIds,
  setSearchResultIds,
  getHoveredSearchBoothId,
  setHoveredSearchBoothId,
}) {
  function searchResultsForQuery(query) {
    const normalizedQuery = normalizeSearchText(query);
    const tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
    if (!tokens.length) return [];
    return boothMeshes
      .filter((mesh) => {
        const haystack = searchIndexTextForMesh(mesh, normalizeSearchText);
        return tokens.every((token) => haystack.includes(token));
      })
      .map((mesh) => ({
        mesh,
        id: mesh.userData.id,
        score: searchScoreForMesh(mesh, normalizedQuery, tokens, normalizeSearchText),
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
    const hasQuery = !!getSearchQuery();
    const count = getSearchResultIds().length;
    boothSearchCount.textContent = hasQuery ? `${count}件ヒット` : '0件';
    boothSearchMeta.classList.toggle('is-visible', hasQuery);
    boothSearchResults.classList.toggle('is-visible', hasQuery);
    if (!hasQuery) return;
    if (!count) {
      boothSearchResultsList.innerHTML = '<div class="search-result-empty">一致するブースが見つかりませんでした。</div>';
      return;
    }
    const visibleIds = getSearchResultIds().slice(0, 80);
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
        setHoveredSearchBoothId(item.id);
        refreshMaterials();
      });
      button.addEventListener('pointerleave', () => {
        if (getHoveredSearchBoothId() === item.id) {
          setHoveredSearchBoothId(null);
          refreshMaterials();
        }
      });
      button.addEventListener('focus', () => {
        setHoveredSearchBoothId(item.id);
        refreshMaterials();
      });
      button.addEventListener('blur', () => {
        if (getHoveredSearchBoothId() === item.id) {
          setHoveredSearchBoothId(null);
          refreshMaterials();
        }
      });
      button.addEventListener('click', () => {
        const mesh = item.mesh;
        setHoveredSearchBoothId(item.id);
        setHoveredMesh(mesh);
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
    setSearchQuery(String(query || '').trim());
    const results = searchResultsForQuery(getSearchQuery());
    setSearchResultIds(results.map((entry) => entry.id));
    setHoveredSearchBoothId(null);
    renderSearchResults();
    refreshMaterials();
  }

  function clearSearch({ focusInput = false } = {}) {
    setSearchQuery('');
    setSearchResultIds([]);
    setHoveredSearchBoothId(null);
    if (boothSearchInput) boothSearchInput.value = '';
    renderSearchResults();
    refreshMaterials();
    if (focusInput) boothSearchInput?.focus();
  }

  return {
    renderSearchResults,
    updateSearch,
    clearSearch,
  };
}
