export function buildStatePayload(options) {
  const {
    pinnedMesh,
    selectedPrimaryIds,
    selectedSecondaryIds,
    categoryLayerVisible,
    themeMode,
    serializeCameraState,
    uniqueValidBoothIds,
  } = options;
  return {
    version: 1,
    pinnedBoothId: pinnedMesh?.userData?.id || null,
    searchQuery: '',
    primaryBoothIds: uniqueValidBoothIds(selectedPrimaryIds),
    secondaryBoothIds: uniqueValidBoothIds(selectedSecondaryIds),
    categoryLayerVisible,
    themeMode,
    camera: serializeCameraState(),
    savedAt: Date.now(),
  };
}

export function buildShareUrl({ href, payload, urlStateVersion }) {
  const params = new URLSearchParams();
  const primary = payload.primaryBoothIds;
  const secondary = payload.secondaryBoothIds;
  if (primary.length || secondary.length || payload.categoryLayerVisible || payload.themeMode === 'dark') params.set('v', urlStateVersion);
  if (primary.length) params.set('p', primary.join(','));
  if (secondary.length) params.set('s', secondary.join(','));
  if (payload.categoryLayerVisible) params.set('c', '1');
  if (payload.themeMode === 'dark') params.set('t', 'd');
  const url = new URL(href);
  url.search = params.toString();
  url.hash = '';
  return url.toString();
}

export function parseStateFromUrl({ search, urlStateVersion, normalizeBoothId, uniqueValidBoothIds }) {
  const params = new URLSearchParams(search);
  if (!params.toString()) return null;
  if (params.get('v') && params.get('v') !== urlStateVersion) return null;
  return {
    version: 1,
    pinnedBoothId: normalizeBoothId((params.get('p') || '').split(',')[0] || (params.get('s') || '').split(',')[0] || ''),
    searchQuery: '',
    primaryBoothIds: uniqueValidBoothIds((params.get('p') || '').split(',')),
    secondaryBoothIds: uniqueValidBoothIds((params.get('s') || '').split(',')),
    categoryLayerVisible: params.get('c') === '1',
    themeMode: params.get('t') === 'd' ? 'dark' : 'light',
    camera: null,
    source: 'url',
  };
}
