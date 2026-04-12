export function executePart(ctx, partName, partCode) {
  const runner = new Function(
    'ctx',
    `
      with (ctx) {
        ${partCode}
      }
    `
  );
  return runner(ctx);
}
