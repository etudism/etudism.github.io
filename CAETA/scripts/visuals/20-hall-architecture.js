export function setupHallArchitecture({
  THREE,
  DATA,
  HALL_ARCH_SPECS,
  hallGroups,
  hallArchitectureGroups,
  createConcreteTexture,
  makeGroundTextMesh,
  ensureHall,
  _pageToScene,
  getHallFrame,
  _BOOTH_H,
}) {
  const hallArchitectureMaterials = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xe7e3dd, map: createConcreteTexture(), roughness: 1.0, metalness: 0.0 }),
    wall: new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.96, metalness: 0.02 }),
    wallPanel: new THREE.MeshStandardMaterial({ color: 0xc8ced7, roughness: 0.95, metalness: 0.04 }),
    wallDark: new THREE.MeshStandardMaterial({ color: 0x8f97a1, roughness: 0.92, metalness: 0.06 }),
    column: new THREE.MeshStandardMaterial({ color: 0xd6dae0, roughness: 0.95, metalness: 0.03 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.9, metalness: 0.1 }),
    shutter: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, roughness: 0.86, metalness: 0.12 }),
    wood: new THREE.MeshStandardMaterial({ color: 0x6f4e35, roughness: 0.95, metalness: 0.02 }),
    woodInset: new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.96, metalness: 0.05 }),
    ceilingLight: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    steel: new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.84, metalness: 0.22 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x2f353d, roughness: 0.94, metalness: 0.14 }),
    blackBox: new THREE.MeshStandardMaterial({ color: 0x1f252c, roughness: 0.96, metalness: 0.08 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xbfd4e5, roughness: 0.12, metalness: 0.18, transparent: true, opacity: 0.35 }),
    signBack: new THREE.MeshStandardMaterial({ color: 0xbcc3cc, roughness: 0.96, metalness: 0.02 })
  };

  function addArchBox(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      options.material || hallArchitectureMaterials.wall
    );
    mesh.scale.set(options.w || 1, options.h || 1, options.d || 1);
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
    mesh.castShadow = !!options.castShadow;
    mesh.receiveShadow = !!options.receiveShadow;
    mesh.renderOrder = options.renderOrder || 0;
    parent.add(mesh);
    return mesh;
  }

  function addArchCylinder(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(options.radius || 1, options.radius || 1, options.h || 1, options.radialSegments || 18),
      options.material || hallArchitectureMaterials.column
    );
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.castShadow = !!options.castShadow;
    mesh.receiveShadow = !!options.receiveShadow;
    parent.add(mesh);
    return mesh;
  }

  function addArchPlane(parent, options = {}) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(options.w || 1, options.h || 1),
      options.material || hallArchitectureMaterials.ceilingLight
    );
    mesh.position.set(options.x || 0, options.y || 0, options.z || 0);
    mesh.rotation.set(options.rx || 0, options.ry || 0, options.rz || 0);
    mesh.renderOrder = options.renderOrder || 0;
    parent.add(mesh);
    return mesh;
  }

  function makeWallTextPanel(text, options = {}) {
    const lines = Array.isArray(text) ? text : [text];
    const texture = makeGroundTextMesh(lines, {
      color: options.color || '#111827',
      bg: options.bg || 'rgba(255,255,255,0.92)',
      worldW: options.worldW || 22,
      worldH: options.worldH || 7,
      width: options.width || 768,
      height: options.height || 256,
      fontSize: options.fontSize || 56,
      lineGap: options.lineGap || (options.fontSize || 56) * 0.9,
    });
    texture.rotation.x = 0;
    texture.geometry.dispose();
    texture.geometry = new THREE.PlaneGeometry(options.worldW || 22, options.worldH || 7);
    texture.material = new THREE.MeshBasicMaterial({ map: texture.material.map, transparent: true, depthWrite: false, alphaTest: 0.06, side: THREE.DoubleSide });
    return texture;
  }

  function makeHallPillarSign(number, options = {}) {
    const group = new THREE.Group();
    const base = addArchBox(group, { w: 8, h: 7, d: 2.2, y: 3.5, material: hallArchitectureMaterials.signBack, castShadow: true, receiveShadow: true });
    const text = makeGroundTextMesh(number, {
      color: options.color || '#0f172a',
      worldW: 6.5,
      worldH: 5.2,
      width: 512,
      height: 400,
      fontSize: 220,
      stroke: 'rgba(255,255,255,0.86)',
      strokeWidth: 18
    });
    text.rotation.x = 0;
    text.position.set(0, 3.55, 1.12);
    group.add(base, text);
    return group;
  }

  function makeIntervals(total, targetCount) {
    if (targetCount <= 1) return [0];
    const step = total / (targetCount - 1);
    return Array.from({ length: targetCount }, (_, i) => -total / 2 + i * step);
  }

  function addRightWallSegments(group, frame, wallH, lowerWallH, doorOpenings, material) {
    const rightX = frame.w / 2 - 1.2;
    const gaps = [...doorOpenings].sort((a, b) => a - b);
    const zMin = -frame.h / 2;
    const zMax = frame.h / 2;
    let cursor = zMin;
    const gapHalf = 18;
    gaps.forEach((center) => {
      const start = Math.max(zMin, center - gapHalf);
      if (start > cursor) addArchBox(group, { x: rightX, y: lowerWallH / 2, z: (cursor + start) / 2, w: 2.4, h: lowerWallH, d: start - cursor, material, castShadow: true, receiveShadow: true });
      cursor = Math.min(zMax, center + gapHalf);
    });
    if (cursor < zMax) addArchBox(group, { x: rightX, y: lowerWallH / 2, z: (cursor + zMax) / 2, w: 2.4, h: lowerWallH, d: zMax - cursor, material, castShadow: true, receiveShadow: true });
    addArchBox(group, { x: rightX, y: lowerWallH + (wallH - lowerWallH) / 2, z: 0, w: 2.4, h: wallH - lowerWallH, d: frame.h, material, castShadow: true, receiveShadow: true });
  }

  function addDoorFrame(group, side, ratio, frame, wallH, options = {}) {
    const openingW = options.w || 16;
    const openingH = options.h || 18;
    const trimT = options.trimT || 1.1;
    const material = options.material || hallArchitectureMaterials.trim;
    const posRatio = ratio;
    if (side === 'left' || side === 'right') {
      const x = side === 'left' ? -frame.w / 2 + trimT / 2 : frame.w / 2 - trimT / 2;
      const z = posRatio * frame.h / 2;
      addArchBox(group, { x, y: openingH / 2, z: z - openingW / 2 - trimT / 2, w: trimT, h: openingH, d: trimT, material, castShadow: true, receiveShadow: true });
      addArchBox(group, { x, y: openingH / 2, z: z + openingW / 2 + trimT / 2, w: trimT, h: openingH, d: trimT, material, castShadow: true, receiveShadow: true });
      addArchBox(group, { x, y: openingH + trimT / 2, z, w: trimT, h: trimT, d: openingW + trimT * 2, material, castShadow: true, receiveShadow: true });
    } else {
      const z = side === 'front' ? -frame.h / 2 + trimT / 2 : frame.h / 2 - trimT / 2;
      const x = posRatio * frame.w / 2;
      addArchBox(group, { x: x - openingW / 2 - trimT / 2, y: openingH / 2, z, w: trimT, h: openingH, d: trimT, material, castShadow: true, receiveShadow: true });
      addArchBox(group, { x: x + openingW / 2 + trimT / 2, y: openingH / 2, z, w: trimT, h: openingH, d: trimT, material, castShadow: true, receiveShadow: true });
      addArchBox(group, { x, y: openingH + trimT / 2, z, w: openingW + trimT * 2, h: trimT, d: trimT, material, castShadow: true, receiveShadow: true });
    }
  }

  function addShutter(group, side, ratio, frame, options = {}) {
    const w = options.w || 26;
    const h = options.h || 18;
    const thickness = 0.9;
    const material = hallArchitectureMaterials.shutter;
    const slatMaterial = hallArchitectureMaterials.trim;
    const slatGap = 1.3;
    if (side === 'right' || side === 'left') {
      const x = side === 'left' ? -frame.w / 2 + thickness / 2 : frame.w / 2 - thickness / 2;
      const z = ratio * frame.h / 2;
      addArchBox(group, { x, y: h / 2, z, w: thickness, h, d: w, material, castShadow: true, receiveShadow: true });
      for (let y = 2; y < h; y += slatGap) addArchBox(group, { x: x + (side === 'left' ? 0.1 : -0.1), y, z, w: thickness * 0.35, h: 0.18, d: w - 1.2, material: slatMaterial });
    } else {
      const z = side === 'front' ? -frame.h / 2 + thickness / 2 : frame.h / 2 - thickness / 2;
      const x = ratio * frame.w / 2;
      addArchBox(group, { x, y: h / 2, z, w, h, d: thickness, material, castShadow: true, receiveShadow: true });
      for (let y = 2; y < h; y += slatGap) addArchBox(group, { x, y, z: z + (side === 'front' ? 0.1 : -0.1), w: w - 1.2, h: 0.18, d: thickness * 0.35, material: slatMaterial });
    }
  }

  function createLatticeBeam(length = 1) {
    const group = new THREE.Group();
    addArchBox(group, { x: 0, y: 0, z: 0, w: length, h: 0.8, d: 0.8, material: hallArchitectureMaterials.steel, castShadow: true, receiveShadow: true });
    const braceCount = Math.max(2, Math.floor(length / 14));
    const step = length / braceCount;
    for (let i = 0; i < braceCount; i++) {
      const x = -length / 2 + step * (i + 0.5);
      addArchBox(group, { x, y: 0, z: 0, w: 0.35, h: 2.1, d: 0.35, material: hallArchitectureMaterials.steelDark, castShadow: true, receiveShadow: true, rz: Math.PI / 6 });
      addArchBox(group, { x, y: 0, z: 0, w: 0.35, h: 2.1, d: 0.35, material: hallArchitectureMaterials.steelDark, castShadow: true, receiveShadow: true, rz: -Math.PI / 6 });
    }
    return group;
  }

  function addLatticeBeam(parent, { x = 0, y = 0, z = 0, length = 10, ry = 0 } = {}) {
    const beam = createLatticeBeam(length);
    beam.position.set(x, y, z);
    beam.rotation.y = ry;
    parent.add(beam);
    return beam;
  }

  function buildWoodCeiling(group, frame, roofY, beamY) {
    addArchBox(group, { x: 0, y: roofY, z: 0, w: frame.w, h: 1.8, d: frame.h, material: hallArchitectureMaterials.woodInset, castShadow: true, receiveShadow: true });
    const beamSpacing = 28;
    for (let z = -frame.h / 2 + 10; z < frame.h / 2; z += beamSpacing) {
      addArchBox(group, { x: 0, y: beamY, z, w: frame.w, h: 3.8, d: 2.2, material: hallArchitectureMaterials.wood, castShadow: true, receiveShadow: true });
    }
    const lightRows = 5;
    const lightCols = 3;
    const xOffsets = makeIntervals(frame.w * 0.72, lightCols);
    const zOffsets = makeIntervals(frame.h * 0.70, lightRows);
    zOffsets.forEach((z) => xOffsets.forEach((x) => addArchPlane(group, { x, y: roofY - 1.05, z, w: 30, h: 8, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 1 })));
  }

  function buildSteelCeiling(group, frame, roofY, beamY) {
    addArchBox(group, { x: 0, y: roofY, z: 0, w: frame.w, h: 1.2, d: frame.h, material: hallArchitectureMaterials.blackBox, castShadow: true, receiveShadow: true });
    const spanCount = 4;
    const beamXs = makeIntervals(frame.w * 0.88, spanCount);
    beamXs.forEach((x) => addLatticeBeam(group, { x, y: beamY, z: 0, length: frame.h * 1.01, ry: Math.PI / 2 }));
    const transverseCount = 5;
    const beamZs = makeIntervals(frame.h * 0.84, transverseCount);
    beamZs.forEach((z) => addLatticeBeam(group, { x: 0, y: beamY + 2.2, z, length: frame.w * 0.98, ry: 0 }));
    const lightRows = 4;
    const lightCols = 3;
    const xOffsets = makeIntervals(frame.w * 0.66, lightCols);
    const zOffsets = makeIntervals(frame.h * 0.68, lightRows);
    zOffsets.forEach((z) => xOffsets.forEach((x) => {
      addArchPlane(group, { x, y: roofY - 0.8, z, w: 24, h: 7, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 1 });
      addArchBox(group, { x, y: roofY - 0.45, z, w: 25, h: 0.25, d: 8, material: hallArchitectureMaterials.trim });
    }));
  }

  function addHallNumberTowers(group, frame, numbers, style = 'wood') {
    const material = style === 'wood' ? hallArchitectureMaterials.wood : hallArchitectureMaterials.steel;
    const xBase = -frame.w / 2 + 22;
    const zBase = -frame.h / 2 + 26;
    numbers.forEach((num, idx) => {
      const tower = new THREE.Group();
      addArchBox(tower, { x: 0, y: 20, z: 0, w: 6.5, h: 40, d: 6.5, material, castShadow: true, receiveShadow: true });
      const sign = makeHallPillarSign(num, { color: style === 'wood' ? '#0f172a' : '#111827' });
      sign.position.set(0, 18, 3.6);
      tower.add(sign);
      tower.position.set(xBase + idx * 18, 0, zBase);
      group.add(tower);
    });
  }

  function buildCommonHallEnvelope(group, frame, spec, page) {
    const wallThickness = 2.4;
    addArchBox(group, { x: 0, y: spec.lowerWallH / 2, z: -frame.h / 2 + wallThickness / 2, w: frame.w, h: spec.lowerWallH, d: wallThickness, material: hallArchitectureMaterials.wall, castShadow: true, receiveShadow: true });
    addArchBox(group, { x: 0, y: spec.lowerWallH + (spec.wallH - spec.lowerWallH) / 2, z: -frame.h / 2 + wallThickness / 2, w: frame.w, h: spec.wallH - spec.lowerWallH, d: wallThickness, material: hallArchitectureMaterials.wallPanel, castShadow: true, receiveShadow: true });
    addArchBox(group, { x: -frame.w / 2 + wallThickness / 2, y: spec.wallH / 2, z: 0, w: wallThickness, h: spec.wallH, d: frame.h, material: hallArchitectureMaterials.wall, castShadow: true, receiveShadow: true });
    addArchBox(group, { x: 0, y: spec.wallH / 2, z: frame.h / 2 - wallThickness / 2, w: frame.w, h: spec.wallH, d: wallThickness, material: hallArchitectureMaterials.wallPanel, castShadow: true, receiveShadow: true });
    const portalDefs = {
      entrance: { z: (DATA.pages.find((p) => p.page === page).h * (page === 1 ? 0.23065 : 0.32255)) - frame.cy },
      exit: { z: (DATA.pages.find((p) => p.page === page).h * (page === 1 ? 0.70736 : 0.75570)) - frame.cy },
    };
    addRightWallSegments(group, frame, spec.wallH, spec.lowerWallH, [portalDefs.entrance.z, portalDefs.exit.z], hallArchitectureMaterials.wall);
    addDoorFrame(group, 'right', portalDefs.entrance.z / (frame.h / 2), frame, spec.lowerWallH, { material: hallArchitectureMaterials.trim });
    addDoorFrame(group, 'right', portalDefs.exit.z / (frame.h / 2), frame, spec.lowerWallH, { material: hallArchitectureMaterials.trim });
    spec.exitDoors.forEach((door) => addDoorFrame(group, door.side, door.ratio, frame, spec.lowerWallH, { material: hallArchitectureMaterials.trim }));
    spec.shutters.forEach((shutter) => addShutter(group, shutter.side, shutter.ratio, frame, { w: shutter.w, h: shutter.h }));
    spec.columns.forEach(([xRatio, zRatio]) => addArchCylinder(group, {
      x: frame.w * xRatio,
      y: spec.wallH / 2,
      z: frame.h * zRatio,
      radius: page === 1 ? 7.2 : 8.4,
      h: spec.wallH,
      radialSegments: 22,
      castShadow: true,
      receiveShadow: true,
    }));
    const sideBraces = makeIntervals(frame.h * 0.86, 5);
    sideBraces.forEach((z) => addArchBox(group, { x: frame.w / 2 - 0.8, y: spec.wallH - 6, z, w: 1.1, h: 4.2, d: 6, material: hallArchitectureMaterials.trim }));
    const backBraces = makeIntervals(frame.w * 0.86, 5);
    backBraces.forEach((x) => addArchBox(group, { x, y: spec.wallH - 8, z: frame.h / 2 - 0.8, w: 6, h: 4.2, d: 1.1, material: hallArchitectureMaterials.trim }));
  }

  function makeHallArchitecture(pageInfo) {
    if (hallArchitectureGroups.has(pageInfo.page)) return hallArchitectureGroups.get(pageInfo.page);
    const frame = getHallFrame(pageInfo.page);
    const spec = HALL_ARCH_SPECS[pageInfo.page] || HALL_ARCH_SPECS[1];
    const group = new THREE.Group();
    group.userData.page = pageInfo.page;
    group.visible = false;
    ensureHall(pageInfo.page).add(group);
    hallArchitectureGroups.set(pageInfo.page, group);

    buildCommonHallEnvelope(group, frame, spec, pageInfo.page);
    if (spec.style === 'wood') buildWoodCeiling(group, frame, spec.roofY, spec.beamY);
    else buildSteelCeiling(group, frame, spec.roofY, spec.beamY);
    addHallNumberTowers(group, frame, spec.signNumbers, spec.style);
    return group;
  }

  function updateHallArchitectureVisibility({ hallModelVisible, hallAutoArchitectureVisible }, force = false) {
    hallArchitectureGroups.forEach((group) => {
      group.visible = !!(hallModelVisible && hallAutoArchitectureVisible);
      group.traverse((child) => {
        if (child.isMesh || child.isSprite) child.visible = group.visible;
      });
    });
    if (!force) hallGroups.forEach((group) => {
      group.visible = true;
    });
  }

  return {
    hallArchitectureMaterials,
    addArchBox,
    addArchCylinder,
    addArchPlane,
    makeWallTextPanel,
    makeHallPillarSign,
    makeIntervals,
    addRightWallSegments,
    addDoorFrame,
    addShutter,
    createLatticeBeam,
    addLatticeBeam,
    buildWoodCeiling,
    buildSteelCeiling,
    addHallNumberTowers,
    buildCommonHallEnvelope,
    makeHallArchitecture,
    updateHallArchitectureVisibility,
  };
}
