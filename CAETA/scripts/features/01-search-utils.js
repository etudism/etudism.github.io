export function searchIndexTextForMesh(mesh, normalizeSearchText) {
  if (!mesh) return '';
  if (mesh.userData.searchIndexText) return mesh.userData.searchIndexText;
  const info = mesh.userData.info || {};
  const hall = mesh.userData.page === 1 ? '南1・2ホール' : '南3・4ホール';
  const source = [
    mesh.userData.id,
    mesh.userData.label,
    mesh.userData.band,
    info.booth_no_range,
    info.booth_name,
    info.reading,
    info.category,
    info.description,
    hall,
  ].filter(Boolean).join(' ');
  const normalized = normalizeSearchText(source);
  mesh.userData.searchIndexText = normalized;
  return normalized;
}

export function searchScoreForMesh(mesh, normalizedQuery, tokens, normalizeSearchText) {
  const info = mesh.userData.info || {};
  const boothId = normalizeSearchText(mesh.userData.id);
  const range = normalizeSearchText(info.booth_no_range);
  const name = normalizeSearchText(info.booth_name);
  const category = normalizeSearchText(info.category);
  let score = 0;
  if (normalizedQuery && boothId === normalizedQuery) score += 240;
  else if (normalizedQuery && range === normalizedQuery) score += 220;
  else if (normalizedQuery && boothId.startsWith(normalizedQuery)) score += 170;
  else if (normalizedQuery && range.startsWith(normalizedQuery)) score += 160;
  if (normalizedQuery && name.includes(normalizedQuery)) score += 120;
  if (normalizedQuery && category.includes(normalizedQuery)) score += 70;
  score += Math.max(0, 40 - boothId.length);
  score += Math.max(0, 20 - name.length * 0.1);
  score += tokens.length * 5;
  return score;
}

export function searchResultsForQuery(query, boothMeshes, helpers) {
  const { normalizeSearchText, searchIndexTextForMesh, searchScoreForMesh } = helpers;
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
