export function fmtMeta(mesh, options) {
  const { previewTier, tier, hallLabel } = options;
  const info = mesh.userData.info;
  const lines = [];
  lines.push(`エリア: ${mesh.userData.label}`);
  lines.push(`ブース番号: ${mesh.userData.id}`);
  if (info?.booth_no_range && info.booth_no_range !== mesh.userData.id) lines.push(`範囲: ${info.booth_no_range}`);
  if (info?.reading) lines.push(`読み: ${info.reading}`);
  if (info?.category) lines.push(`カテゴリ: ${info.category}`);
  if (tier === 'primary') lines.push(`選択状態: 最優先${previewTier ? '（プレビュー中）' : ''}`);
  else if (tier === 'secondary') lines.push(`選択状態: 気になる${previewTier ? '（プレビュー中）' : ''}`);
  else if (tier === 'clear' && previewTier) lines.push('選択状態: 解除（プレビュー中）');
  lines.push(`ホール: ${hallLabel}`);
  return lines.join('\n');
}
