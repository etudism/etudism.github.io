function makeRectObject(page, spec) {
    const group = ensureHall(page);
    const pageData = pageDataByPage.get(page);
    const x = pageData.w * spec.xRatio;
    const y = pageData.h * spec.yRatio;
    const w = pageData.w * spec.wRatio;
    const h = pageData.h * spec.hRatio;
    const geo = pageToScene(page, [x - w / 2, y - h / 2, w, h]);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: spec.color, transparent: true, opacity: 0.96 })
    );
    mesh.scale.set(geo.w, BOOTH_H, geo.h);
    mesh.position.set(geo.x, BOOTH_H / 2, geo.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { kind: 'special', page, label: spec.label };
    mesh.renderOrder = 3;
    group.add(mesh);

    let textMesh;
    if (!spec.sublabel && String(spec.label).includes('\n')) {
      const compactLabel = String(spec.label).replace(/\n/g, '');
      textMesh = makeVerticalTopTextMesh(compactLabel, {
        color: spec.textColor || '#ffffff',
        worldW: Math.max(geo.w * 0.72, 2.2),
        worldH: Math.max(geo.h * 0.88, 10),
        width: 256,
        height: 1024,
      });
    } else {
      const textLines = spec.sublabel ? [spec.label, spec.sublabel] : [spec.label];
      textMesh = makeGroundTextMesh(textLines, {
        color: spec.textColor || '#ffffff',
        worldW: Math.max(geo.w * 0.82, 28),
        worldH: Math.max(geo.h * 0.55, 10),
        fontSize: spec.sublabel ? 40 : 48
      });
    }
    textMesh.position.set(geo.x, BOOTH_H + 0.08, geo.z);
    textMesh.userData.page = page;
    group.add(textMesh);
  }

  function makeFrameWalls(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const group = ensureHall(pageInfo.page);
    const portalDefs = HALL_PORTALS[pageInfo.page];
    const toZ = (ratio) => pageInfo.h * ratio - frame.cy;
    const rightEdgeX = frame.w / 2 - FRAME_WALL_T / 2;
    const entranceZ = toZ(portalDefs.entrance.yRatio);
    const exitZ = toZ(portalDefs.exit.yRatio);

    const markerX = rightEdgeX - 7.5;
    const entranceMarker = makePortalTriangleMesh({ color: '#ef4444', size: 15, direction: 'left', y: 0.26 });
    entranceMarker.position.set(markerX, 0.26, entranceZ);
    group.add(entranceMarker);
    const exitMarker = makePortalTriangleMesh({ color: '#2563eb', size: 15, direction: 'right', y: 0.26 });
    exitMarker.position.set(markerX, 0.26, exitZ);
    group.add(exitMarker);
  }

  function getAreaLabelOffset(band) {
    const label = String(band.label);
    const eastShiftPage1 = new Set(['B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T']);
    const eastShiftPage2 = new Set(['い','う','え','お','か','き','く','け','こ','さ','し','す','せ','そ','た','ち','つ','て','と']);
    let dx = 0;
    let dy = 0;

    if ((band.page === 1 && eastShiftPage1.has(label)) || (band.page === 2 && eastShiftPage2.has(label))) {
      dx += 10;
    }

    if (band.page === 1 && label === 'A') {
      dy -= 10;
    }
    if (band.page === 2 && label === 'あ') {
      dy -= 10;
    }
    if (band.page === 1 && label === 'X') {
      dx -= 14;
    }
    if (band.page === 2 && label === 'ね') {
      dx -= 14;
    }

    return { dx, dy };
  }

  function hallReferenceTexture(pageInfo) {
    if (pageTextureCache.has(pageInfo.page)) return pageTextureCache.get(pageInfo.page);
    const texture = new THREE.TextureLoader().load(pageInfo.image);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    pageTextureCache.set(pageInfo.page, texture);
    return texture;
  }


  function makePageTopLabelTexture(pageInfo) {
    if (pageLabelTextureCache.has(pageInfo.page)) return pageLabelTextureCache.get(pageInfo.page);

    const frame = getHallFrame(pageInfo.page);
    const texW = 4096;
    const texH = Math.max(256, Math.round(texW * frame.h / frame.w));
    const canvas = document.createElement('canvas');
    canvas.width = texW;
    canvas.height = texH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, texW, texH);

    const sx = texW / frame.w;
    const sy = texH / frame.h;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const pageBooths = DATA.booths.filter((booth) => booth.page === pageInfo.page);
    for (const booth of pageBooths) {
      const [x, y, w, h] = booth.bbox;
      const cx = (x + w / 2 - frame.x0) * sx;
      const cy = (y + h / 2 - frame.y0) * sy;
      const text = String(booth.n);
      const maxW = Math.max(6, w * sx * 0.64);
      const maxH = Math.max(6, h * sy * 0.54);
      let fontSize = Math.min(maxH, maxW / Math.max(0.64, text.length * 0.58));
      fontSize = Math.max(7, fontSize);

      ctx.font = `600 ${fontSize}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.fillStyle = '#111827';
      ctx.fillText(text, cx, cy + fontSize * 0.01);
    }

    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    pageLabelTextureCache.set(pageInfo.page, texture);
    return texture;
  }


  function getHallFrame(page) {
    const pageData = DATA.pages.find((p) => p.page === page);
    const ratios = HALL_FRAMES[page] || HALL_FRAMES[1];
    const x0 = pageData.w * ratios.x0Ratio;
    const y0 = pageData.h * ratios.y0Ratio;
    const x1 = pageData.w * ratios.x1Ratio;
    const y1 = pageData.h * ratios.y1Ratio;
    return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }

  function pagePointToLocal(page, xPage, yPage) {
    const frame = getHallFrame(page);
    return { x: xPage - frame.cx, z: yPage - frame.cy };
  }

  function pageToScene(page, bbox) {
    const frame = getHallFrame(page);
    const [x, y, w, h] = bbox;
    const cx = x + w / 2 - frame.cx;
    const cz = y + h / 2 - frame.cy;
    return { x: cx, z: cz, w, h };
  }

  function layoutX(page) {
    return HALL_OFFSETS[layoutMode][page];
  }

  function ensureHall(page) {
    if (hallGroups.has(page)) return hallGroups.get(page);
    const g = new THREE.Group();
    scene.add(g);
    hallGroups.set(page, g);
    return g;
  }

  function makeZoneMesh(page, band) {
    const group = ensureHall(page);
    const geo = pageToScene(page, band.bbox);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(geo.w, geo.h),
      new THREE.MeshStandardMaterial({ color: labelColor(page, band.label), transparent: true, opacity: 0.56, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })
    );
    mesh.receiveShadow = true;
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(geo.x, ZONE_Y, geo.z);
    mesh.userData.page = page;
    mesh.renderOrder = 1;
    group.add(mesh);
    bandMeshes.push(mesh);
  }

  function makeHallBase(pageInfo) {
    const frame = getHallFrame(pageInfo.page);
    const group = ensureHall(pageInfo.page);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(frame.w, frame.h),
      new THREE.MeshStandardMaterial({ color: 0xf3f4f6, transparent: true, opacity: 0.9 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    floor.userData.page = pageInfo.page;
    floor.renderOrder = 0;
    group.add(floor);

    const labelPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(frame.w, frame.h),
      new THREE.MeshBasicMaterial({
        map: makePageTopLabelTexture(pageInfo),
        transparent: true,
        alphaTest: 0.08,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
      })
    );
    labelPlane.rotation.x = -Math.PI / 2;
    labelPlane.position.y = LABEL_PLANE_Y;
    labelPlane.userData.page = pageInfo.page;
    labelPlane.renderOrder = 4;
    labelPlane.raycast = () => {};
    group.add(labelPlane);
  }

  DATA.pages.forEach(makeHallBase);
  DATA.pages.forEach(makeHallArchitecture);
  DATA.pages.forEach(makeFrameWalls);

  DATA.bands.forEach((band) => {
    const group = ensureHall(band.page);
    const [lx, ly] = band.labelPos;
    const { dx, dy } = getAreaLabelOffset(band);
    const local = pagePointToLocal(band.page, lx + dx, ly + dy);
    const textMesh = makeAreaLabelGroundMesh(band);
    textMesh.position.set(local.x, 0.08, local.z);
    textMesh.userData.page = band.page;
    areaLabelMeshes.push(textMesh);
    group.add(textMesh);
  });

  DATA.pages.forEach((pageInfo) => {
    const group = ensureHall(pageInfo.page);
    const specials = SPECIAL_OBJECTS[pageInfo.page] || {};
    Object.values(specials).forEach((spec) => makeRectObject(pageInfo.page, spec));
    const hallName = makeHallNameSprite(String(pageInfo.hall), {
      width: 642,
      height: 162,
      fontSize: 66,
      color: '#000000'
    });
    const frame = getHallFrame(pageInfo.page);
    hallName.position.set(0, BOOTH_H + 26, -frame.h * 0.5 - 40);
    hallName.userData.page = pageInfo.page;
    hallName.renderOrder = 8;
    group.add(hallName);
  });

  DATA.booths.forEach((booth) => {
    const group = ensureHall(booth.page);
    const geo = pageToScene(booth.page, booth.bbox);
    const mesh = new THREE.Mesh(boothGeometry, booth.page === 2 ? hall2Material : hall1Material);
    mesh.scale.set(geo.w, BOOTH_H, geo.h);
    mesh.position.set(geo.x, BOOTH_H / 2, geo.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { ...booth, page: booth.page, base: 'normal' };
    mesh.renderOrder = 2;
    group.add(mesh);
    boothMeshes.push(mesh);
    boothById.set(booth.id.toUpperCase(), mesh);
    const groupKey = booth.info?.group_key || booth.id;
    if (!groupMembers.has(groupKey)) groupMembers.set(groupKey, []);
    groupMembers.get(groupKey).push(mesh);
  });

  function applyLayout() {
    hallGroups.forEach((group, page) => {
      group.position.x = layoutX(page);
    });
  }
  applyLayout();

  function rebuildOverlayData() {
    overlayBoothLabels = [];
    overlayAreaLabels = [];
  }
  rebuildOverlayData();
  overlayDirty = true;

  function projectToScreen(x, y, z) {
    tempVec.set(x, y, z).project(camera);
    if (tempVec.z < -1 || tempVec.z > 1) return null;
    const sx = (tempVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-tempVec.y * 0.5 + 0.5) * window.innerHeight;
    if (sx < -30 || sx > window.innerWidth + 30 || sy < -30 || sy > window.innerHeight + 30) return null;
    return { x: sx, y: sy };
  }

  function drawTextLabel(text, x, y, fontSizePx, fillStyle, strokeStyle, lineWidth) {
    labelCtx.font = `700 ${fontSizePx}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
    labelCtx.lineJoin = 'round';
    labelCtx.textAlign = 'center';
    labelCtx.textBaseline = 'middle';
    labelCtx.strokeStyle = strokeStyle;
    labelCtx.lineWidth = lineWidth;
    labelCtx.strokeText(text, x, y);
    labelCtx.fillStyle = fillStyle;
    labelCtx.fillText(text, x, y);
  }

  function perspectiveLabelSizePx(x, y, z, worldSize) {
    const effectiveFov = THREE.MathUtils.degToRad(camera.getEffectiveFOV());
    const focalPx = window.innerHeight / (2 * Math.tan(effectiveFov / 2));
    const distance = camera.position.distanceTo(tempVec.set(x, y, z));
    if (!Number.isFinite(distance) || distance <= 0.0001) return 0;
    return worldSize * focalPx / distance;
  }

  function renderOverlayLabels() {
    if (labelCtx) labelCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }

  
