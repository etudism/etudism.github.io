export function groupKeyFromMesh(mesh) {
  return mesh?.userData?.info?.group_key || mesh?.userData?.id || null;
}

export function groupRepresentativeMesh(groupMembers, groupKey) {
  const members = groupMembers.get(groupKey) || [];
  return members[0] || null;
}

export function selectedGroupKeysInTier(ids, boothById, normalizeBoothId) {
  const keys = [];
  const seen = new Set();
  ids.forEach((id) => {
    const mesh = boothById.get(normalizeBoothId(id));
    if (!mesh) return;
    const key = groupKeyFromMesh(mesh);
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  return keys;
}

export function uniqueValidBoothIds(ids, normalizeBoothId) {
  const seen = new Set();
  const out = [];
  (ids || []).forEach((id) => {
    const norm = normalizeBoothId(id);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    out.push(norm);
  });
  return out;
}

export function selectedGroupKeysFrom(ids, boothById, normalizeBoothId) {
  const keys = new Set();
  ids.forEach((id) => {
    const mesh = boothById.get(normalizeBoothId(id));
    if (!mesh) return;
    keys.add(mesh.userData.info?.group_key || mesh.userData.id);
  });
  return keys;
}
