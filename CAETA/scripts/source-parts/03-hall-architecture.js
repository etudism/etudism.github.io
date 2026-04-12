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

  function makeWallTextPanel(lines, options = {}) {
    const width = options.width || 420;
    const height = options.height || 260;
    const texture = createTextTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = options.bg || '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (options.border) {
        ctx.strokeStyle = options.border;
        ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, w - 6, h - 6);
      }
      const list = Array.isArray(lines) ? lines : [lines];
      const gap = options.lineGap || 48;
      const startY = h / 2 - ((list.length - 1) * gap) / 2;
      list.forEach((line, idx) => {
        ctx.fillStyle = Array.isArray(options.colors) ? (options.colors[idx] || options.color || '#111827') : (options.color || '#111827');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = options.fonts?.[idx] || `800 ${idx === list.length - 1 ? 94 : 32}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
        ctx.fillText(line, w / 2, startY + idx * gap);
      });
    }, width, height);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(options.worldW || 18, options.worldH || 24),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
  }

  function makeHallPillarSign(number) {
    const texture = createTextTexture((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(17,24,39,0.18)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, w - 6, h - 6);
      ctx.fillStyle = '#16a34a';
      ctx.fillRect(28, 26, 104, 92);
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 28px Inter, "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('South', 80, 56);
      ctx.fillText('南', 80, 89);
      ctx.fillStyle = '#111827';
      ctx.font = '800 120px Inter, "Hiragino Sans", "Yu Gothic", sans-serif';
      ctx.fillText(String(number), 240, 78);
    }, 360, 150);
    return new THREE.Mesh(
      new THREE.PlaneGeometry(18, 7.5),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, depthWrite: false })
    );
  }

  function makeIntervals(min, max, gaps) {
    const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
    const out = [];
    let cursor = min;
    for (const [g0, g1] of sorted) {
      if (g0 > cursor) out.push([cursor, g0]);
      cursor = Math.max(cursor, g1);
    }
    if (cursor < max) out.push([cursor, max]);
    return out.filter(([a, b]) => b - a > 4);
  }

  function addRightWallSegments(parent, frame, lowerWallH, wallT, gaps, material) {
    const x = frame.w / 2 - wallT / 2;
    const minZ = -frame.h / 2;
    const maxZ = frame.h / 2;
    const intervals = makeIntervals(minZ, maxZ, gaps.map(({ center, size }) => [center - size / 2, center + size / 2]));
    intervals.forEach(([a, b]) => {
      addArchBox(parent, { x, y: lowerWallH / 2, z: (a + b) / 2, w: wallT, h: lowerWallH, d: b - a, material });
    });
  }

  function addDoorFrame(parent, options = {}) {
    const side = options.side || 'right';
    const w = options.w || 18;
    const h = options.h || 16;
    const frameDepth = 1.5;
    const frameThick = 1.1;
    const y = h / 2 + 0.2;
    let x = options.x || 0;
    let z = options.z || 0;
    let frameRy = 0;
    if (side === 'right') x = options.wallX - 0.25;
    if (side === 'left') x = options.wallX + 0.25;
    if (side === 'back') z = options.wallZ + 0.25;
    if (side === 'front') z = options.wallZ - 0.25;
    if (side === 'right' || side === 'left') frameRy = Math.PI / 2;

    addArchBox(parent, { x, y, z, w, h, d: frameDepth, material: hallArchitectureMaterials.trim, ry: frameRy });
    addArchBox(parent, { x, y, z, w: w - frameThick * 2.2, h: h - frameThick * 2.2, d: frameDepth + 0.2, material: options.glass ? hallArchitectureMaterials.glass : hallArchitectureMaterials.blackBox, ry: frameRy });
    addArchBox(parent, { x, y: y + h / 2 + 2.6, z, w: w + 3, h: 1.2, d: frameDepth + 0.6, material: hallArchitectureMaterials.wallDark, ry: frameRy });
    if (options.exitLabel) {
      const exitMesh = makeWallTextPanel(['EXIT'], {
        width: 220,
        height: 82,
        bg: '#22c55e',
        color: '#ffffff',
        worldW: 9.2,
        worldH: 3.4,
        fonts: ['800 44px Inter, "Hiragino Sans", "Yu Gothic", sans-serif']
      });
      exitMesh.position.set(x, y + h / 2 + 5.3, z);
      if (side === 'right') exitMesh.rotation.y = -Math.PI / 2;
      if (side === 'left') exitMesh.rotation.y = Math.PI / 2;
      if (side === 'back') exitMesh.rotation.y = Math.PI;
      parent.add(exitMesh);
    }
  }

  function addShutter(parent, options = {}) {
    const side = options.side || 'right';
    const w = options.w || 24;
    const h = options.h || 18;
    const slatCount = 10;
    const slatGap = h / slatCount;
    let x = options.x || 0;
    let z = options.z || 0;
    let ry = 0;
    if (side === 'right' || side === 'left') ry = Math.PI / 2;
    const wallX = options.wallX || 0;
    const wallZ = options.wallZ || 0;
    if (side === 'right') x = wallX - 0.35;
    if (side === 'left') x = wallX + 0.35;
    if (side === 'back') z = wallZ + 0.35;
    if (side === 'front') z = wallZ - 0.35;
    addArchBox(parent, { x, y: h / 2, z, w, h, d: 1.1, material: hallArchitectureMaterials.shutter, ry });
    for (let i = 1; i < slatCount; i++) {
      addArchBox(parent, { x, y: i * slatGap, z, w: w - 0.6, h: 0.15, d: 1.24, material: hallArchitectureMaterials.wallDark, ry });
    }
    addArchBox(parent, { x, y: h + 1.2, z, w: w + 2.4, h: 1.1, d: 1.8, material: hallArchitectureMaterials.wallDark, ry });
  }

  function createLatticeBeam(length, options = {}) {
    const group = new THREE.Group();
    const width = options.width || 4.2;
    const height = options.height || 6.6;
    const segments = options.segments || 10;
    addArchBox(group, { x: 0, y: height / 2, z: 0, w: length, h: 0.8, d: width, material: options.material || hallArchitectureMaterials.steel });
    addArchBox(group, { x: 0, y: -height / 2, z: 0, w: length, h: 0.8, d: width, material: options.material || hallArchitectureMaterials.steel });
    const step = length / segments;
    for (let i = 0; i <= segments; i++) {
      const x = -length / 2 + i * step;
      addArchBox(group, { x, y: 0, z: 0, w: 0.45, h: height - 0.4, d: width * 0.7, material: hallArchitectureMaterials.steelDark });
    }
    const diagLen = Math.sqrt(step * step + height * height) + 0.4;
    const angle = Math.atan2(height, step);
    for (let i = 0; i < segments; i++) {
      const cx = -length / 2 + step * (i + 0.5);
      const diagA = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.38, 0.38), hallArchitectureMaterials.steelDark);
      diagA.position.set(cx, 0, 0);
      diagA.rotation.z = angle * (i % 2 === 0 ? 1 : -1);
      group.add(diagA);
      const diagB = new THREE.Mesh(new THREE.BoxGeometry(diagLen, 0.38, 0.38), hallArchitectureMaterials.steelDark);
      diagB.position.set(cx, 0, 0);
      diagB.rotation.z = angle * (i % 2 === 0 ? -1 : 1);
      group.add(diagB);
    }
    return group;
  }

  function addLatticeBeam(parent, axis, length, x, y, z, options = {}) {
    const beam = createLatticeBeam(length, options);
    beam.position.set(x, y, z);
    if (axis === 'z') beam.rotation.y = Math.PI / 2;
    parent.add(beam);
    return beam;
  }

  function buildWoodCeiling(parent, frame, spec) {
    const roof = new THREE.Group();
    parent.add(roof);
    addArchBox(roof, { x: 0, y: spec.roofY + 2.2, z: 0, w: frame.w + 18, h: 4.4, d: frame.h + 18, material: hallArchitectureMaterials.woodInset });
    const xCount = 10;
    const zCount = 12;
    const cellW = frame.w / xCount;
    const cellH = frame.h / zCount;
    for (let i = 1; i < xCount; i++) {
      const x = -frame.w / 2 + i * cellW;
      addArchBox(roof, { x, y: spec.beamY, z: 0, w: 2.9, h: 6.2, d: frame.h + 10, material: hallArchitectureMaterials.wood });
    }
    for (let i = 1; i < zCount; i++) {
      const z = -frame.h / 2 + i * cellH;
      addArchBox(roof, { x: 0, y: spec.beamY, z, w: frame.w + 10, h: 6.2, d: 2.9, material: hallArchitectureMaterials.wood });
    }
    for (let ix = 0; ix < xCount; ix++) {
      for (let iz = 0; iz < zCount; iz++) {
        const x = -frame.w / 2 + cellW * (ix + 0.5);
        const z = -frame.h / 2 + cellH * (iz + 0.5);
        if ((ix + iz) % 2 === 0) {
          addArchBox(roof, { x, y: spec.roofY + 0.15, z, w: cellW - 5.8, h: 1.2, d: cellH - 5.8, material: hallArchitectureMaterials.woodInset });
        }
        if ((ix + iz) % 3 === 0) {
          addArchPlane(roof, { x, y: spec.beamY - 3.7, z, w: Math.min(10, cellW - 10), h: 2.6, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 5 });
        }
      }
    }
    const serviceXs = [-0.36, -0.10, 0.16, 0.38].map((r) => r * frame.w);
    serviceXs.forEach((x) => addArchBox(roof, { x, y: spec.roofY + 4.2, z: 0, w: 8.4, h: 3.0, d: frame.h + 16, material: hallArchitectureMaterials.blackBox }));
    return roof;
  }

  function buildSteelCeiling(parent, frame, spec) {
    const roof = new THREE.Group();
    parent.add(roof);
    addArchBox(roof, { x: 0, y: spec.roofY + 8, z: 0, w: frame.w + 24, h: 3.6, d: frame.h + 24, material: hallArchitectureMaterials.wall });
    addArchBox(roof, { x: 0, y: spec.beamY - 17, z: -frame.h * 0.36, w: frame.w + 16, h: 5.2, d: 8, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: 0, y: spec.beamY - 17, z: frame.h * 0.36, w: frame.w + 16, h: 5.2, d: 8, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: -frame.w * 0.30, y: spec.beamY - 11, z: 0, w: 8, h: 4.8, d: frame.h + 10, material: hallArchitectureMaterials.steelDark });
    addArchBox(roof, { x: frame.w * 0.12, y: spec.beamY - 11, z: 0, w: 8, h: 4.8, d: frame.h + 10, material: hallArchitectureMaterials.steelDark });
    [-0.32, -0.12, 0.08, 0.28].map((r) => r * frame.h).forEach((z) => {
      addLatticeBeam(roof, 'x', frame.w + 18, 0, spec.beamY, z, { width: 4.6, height: 8.0, segments: 12, material: hallArchitectureMaterials.steel });
    });
    [-0.32, -0.05, 0.24].map((r) => r * frame.w).forEach((x) => {
      addLatticeBeam(roof, 'z', frame.h + 20, x, spec.beamY + 7, 0, { width: 4.2, height: 7.0, segments: 14, material: hallArchitectureMaterials.steel });
    });
    const lightXs = [-0.30, -0.08, 0.14, 0.36].map((r) => r * frame.w);
    const lightZs = [-0.30, -0.08, 0.14, 0.36].map((r) => r * frame.h);
    lightXs.forEach((x) => {
      lightZs.forEach((z) => {
        const cluster = new THREE.Group();
        [[-3.4, -1.2], [3.4, -1.2], [-3.4, 1.2], [3.4, 1.2]].forEach(([dx, dz]) => {
          addArchPlane(cluster, { x: dx, y: 0, z: dz, w: 5.4, h: 1.5, rx: -Math.PI / 2, material: hallArchitectureMaterials.ceilingLight, renderOrder: 5 });
        });
        cluster.position.set(x, spec.beamY - 8.6, z);
        roof.add(cluster);
      });
    });
    [
      [-frame.w * 0.12, spec.beamY - 18, -frame.h * 0.10],
      [frame.w * 0.10, spec.beamY - 20, frame.h * 0.08],
      [frame.w * 0.28, spec.beamY - 22, -frame.h * 0.22]
    ].forEach(([x, y, z]) => {
      addArchBox(roof, { x, y, z, w: 4.2, h: 4.2, d: 7.0, material: hallArchitectureMaterials.blackBox });
    });
    return roof;
  }

  function addHallNumberTowers(parent, frame, spec) {
    const towerX = frame.w / 2 - 6;
    const towerZs = [-frame.h * 0.31, frame.h * 0.29];
    towerZs.forEach((z, idx) => {
      addArchBox(parent, { x: towerX, y: 23, z, w: 10, h: 46, d: 36, material: hallArchitectureMaterials.signBack });
      const signMesh = makeHallPillarSign(spec.signNumbers[idx] || spec.signNumbers[0]);
      signMesh.position.set(towerX - 5.2, 24, z);
      signMesh.rotation.y = -Math.PI / 2;
      parent.add(signMesh);
    });
  }

  function buildCommonHallEnvelope(parent, pageInfo, frame, spec) {
    const wallT = 6;
    const xMin = -frame.w / 2;
    const xMax = frame.w / 2;
    const zMin = -frame.h / 2;
    const zMax = frame.h / 2;
    const entranceZ = pageInfo.h * HALL_PORTALS[pageInfo.page].entrance.yRatio - frame.cy;
    const exitZ = pageInfo.h * HALL_PORTALS[pageInfo.page].exit.yRatio - frame.cy;
    const portalGaps = [
      { center: entranceZ, size: 40 },
      { center: exitZ, size: 40 }
    ];

    addArchBox(parent, { x: 0, y: 0.04, z: 0, w: frame.w, h: 0.08, d: frame.h, material: hallArchitectureMaterials.concrete, receiveShadow: true });
    addArchBox(parent, { x: 0, y: spec.lowerWallH / 2, z: zMin + wallT / 2, w: frame.w, h: spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wall });
    addArchBox(parent, { x: 0, y: spec.lowerWallH / 2, z: zMax - wallT / 2, w: frame.w, h: spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wall });
    addArchBox(parent, { x: xMin + wallT / 2, y: spec.lowerWallH / 2, z: 0, w: wallT, h: spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wall });
    addRightWallSegments(parent, frame, spec.lowerWallH, wallT, portalGaps, hallArchitectureMaterials.wall);

    addArchBox(parent, { x: 0, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: zMin + wallT / 2, w: frame.w, h: spec.wallH - spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: 0, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: zMax - wallT / 2, w: frame.w, h: spec.wallH - spec.lowerWallH, d: wallT, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: xMin + wallT / 2, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: 0, w: wallT, h: spec.wallH - spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wallPanel });
    addArchBox(parent, { x: xMax - wallT / 2, y: spec.wallH - (spec.wallH - spec.lowerWallH) / 2, z: 0, w: wallT, h: spec.wallH - spec.lowerWallH, d: frame.h, material: hallArchitectureMaterials.wallPanel });

    addArchBox(parent, { x: 0, y: spec.lowerWallH + 9, z: zMin + wallT * 0.7, w: frame.w - 16, h: 2.2, d: 1.8, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: 0, y: spec.lowerWallH + 9, z: zMax - wallT * 0.7, w: frame.w - 16, h: 2.2, d: 1.8, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: xMin + wallT * 0.7, y: spec.lowerWallH + 9, z: 0, w: 1.8, h: 2.2, d: frame.h - 20, material: hallArchitectureMaterials.wallDark });
    addArchBox(parent, { x: xMax - wallT * 0.7, y: spec.lowerWallH + 9, z: 0, w: 1.8, h: 2.2, d: frame.h - 20, material: hallArchitectureMaterials.wallDark });

    [[xMin + wallT / 2, zMin + wallT / 2], [xMin + wallT / 2, zMax - wallT / 2], [xMax - wallT / 2, zMin + wallT / 2], [xMax - wallT / 2, zMax - wallT / 2]].forEach(([x, z]) => {
      addArchBox(parent, { x, y: spec.wallH / 2, z, w: wallT + 1.8, h: spec.wallH, d: wallT + 1.8, material: hallArchitectureMaterials.trim });
    });

    spec.columns.forEach(([rx, rz]) => {
      const x = rx * frame.w;
      const z = rz * frame.h;
      addArchCylinder(parent, { x, y: spec.wallH / 2, z, radius: 4.2, h: spec.wallH, material: hallArchitectureMaterials.column });
      addArchBox(parent, { x, y: spec.wallH + 2.8, z, w: 13.5, h: 2.4, d: 13.5, material: hallArchitectureMaterials.wallDark });
    });

    spec.exitDoors.forEach((door) => {
      if (door.side === 'right') addDoorFrame(parent, { side: 'right', z: door.ratio * frame.h, wallX: xMax - wallT, w: 18, h: 15, glass: true, exitLabel: false });
      if (door.side === 'left') addDoorFrame(parent, { side: 'left', z: door.ratio * frame.h, wallX: xMin + wallT, w: 18, h: 15, glass: true, exitLabel: false });
      if (door.side === 'back') addDoorFrame(parent, { side: 'back', x: door.ratio * frame.w, wallZ: zMin + wallT, w: 20, h: 15, glass: true, exitLabel: false });
      if (door.side === 'front') addDoorFrame(parent, { side: 'front', x: door.ratio * frame.w, wallZ: zMax - wallT, w: 20, h: 15, glass: true, exitLabel: false });
    });

    spec.shutters.forEach((sh) => {
      if (sh.side === 'right') addShutter(parent, { side: 'right', z: sh.ratio * frame.h, wallX: xMax - wallT, w: sh.w, h: sh.h });
      if (sh.side === 'left') addShutter(parent, { side: 'left', z: sh.ratio * frame.h, wallX: xMin + wallT, w: sh.w, h: sh.h });
      if (sh.side === 'back') addShutter(parent, { side: 'back', x: sh.ratio * frame.w, wallZ: zMin + wallT, w: sh.w, h: sh.h });
      if (sh.side === 'front') addShutter(parent, { side: 'front', x: sh.ratio * frame.w, wallZ: zMax - wallT, w: sh.w, h: sh.h });
    });

    portalGaps.forEach(({ center }) => {
      addArchBox(parent, { x: xMax - wallT * 0.6, y: spec.lowerWallH + 2.2, z: center, w: 3.2, h: 2.8, d: 30, material: hallArchitectureMaterials.wallDark });
      addArchBox(parent, { x: xMax - wallT * 0.5, y: spec.lowerWallH / 2, z: center - 13, w: 0.7, h: spec.lowerWallH, d: 1.2, material: hallArchitectureMaterials.trim });
      addArchBox(parent, { x: xMax - wallT * 0.5, y: spec.lowerWallH / 2, z: center + 13, w: 0.7, h: spec.lowerWallH, d: 1.2, material: hallArchitectureMaterials.trim });
    });

    addHallNumberTowers(parent, frame, spec);
  }

  function makeHallArchitecture(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const spec = HALL_ARCH_SPECS[pageInfo.page] || HALL_ARCH_SPECS[1];
    const group = ensureHall(pageInfo.page);
    const archGroup = new THREE.Group();
    archGroup.userData.page = pageInfo.page;
    group.add(archGroup);
    hallArchitectureGroups.set(pageInfo.page, archGroup);
    buildCommonHallEnvelope(archGroup, pageInfo, frame, spec);
    if (spec.style === 'wood') buildWoodCeiling(archGroup, frame, spec);
    else buildSteelCeiling(archGroup, frame, spec);
  }

  function updateHallArchitectureVisibility(force = false) {
    const autoVisible = hallModelVisible;
    if (!force && autoVisible === hallAutoArchitectureVisible) return;
    hallAutoArchitectureVisible = autoVisible;
    hallArchitectureGroups.forEach((group) => {
      group.visible = autoVisible;
    });
    overlayDirty = true;
  }

  function setHallModelVisible(nextVisible) {
    hallModelVisible = !!nextVisible;
    if (hallModelBtn) {
      hallModelBtn.classList.toggle('is-active', hallModelVisible);
      hallModelBtn.setAttribute('aria-pressed', String(hallModelVisible));
      hallModelBtn.title = hallModelVisible ? '会場モデルOFF' : '会場モデルON';
    }
    if (guide) guide.visible = !hallModelVisible;
    areaLabelMeshes.forEach((mesh) => { mesh.visible = true; });
    updateHallArchitectureVisibility(true);
  }

  
