export function normalizeCategoryLabel(category) {
  const raw = String(category || '').trim();
  if (!raw) return '未分類';
  const parts = raw.split('|').map((part) => part.trim()).filter(Boolean);
  return parts[1] || parts[0] || '未分類';
}

export function hashString(value) {
  let hash = 0;
  const source = String(value || '');
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorForCategoryLabel(label, categoryColorCache, THREE, normalizeCategoryLabel) {
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

export function buildCategoryLegendEntries({ boothMeshes, categoryLabelForMesh, colorForCategoryLabel }) {
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
