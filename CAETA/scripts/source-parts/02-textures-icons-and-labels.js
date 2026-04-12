function labelColor(page, label) {
    const key = page + '-' + label;
    if (labelColorCache.has(key)) return labelColorCache.get(key);
    const chars = Array.from(label);
    const code = chars.reduce((a, c) => a + c.codePointAt(0), page * 37);
    const baseHue = page === 1 ? 205 : 25;
    const hue = (baseHue + (code * 17) % 90) % 360;
    const color = new THREE.Color(`hsl(${hue} 68% 82%)`);
    labelColorCache.set(key, color);
    return color;
  }

  function createTextTexture(drawFn, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    drawFn(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  }

  function makeBadgeSprite(text, options = {}) {
    const w = options.width || 180;
    const h = options.height || 86;
    const tail = options.tail || 16;
    const texture = createTextTexture((ctx, width, height) => {
      const bodyH = height - tail;
      const r = 22;
      const tailW = 24;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.bg || 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = options.stroke || 'rgba(15,23,42,0.18)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.arcTo(width, 0, width, bodyH, r);
      ctx.arcTo(width, bodyH, width / 2 + tailW / 2, bodyH, r);
      ctx.lineTo(width / 2 + tailW / 2, bodyH);
      ctx.lineTo(width / 2, height - 2);
      ctx.lineTo(width / 2 - tailW / 2, bodyH);
      ctx.arcTo(0, bodyH, 0, 0, r);
      ctx.arcTo(0, 0, width, 0, r);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = options.color || '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 40}px sans-serif`;
      ctx.fillText(text, width / 2, bodyH / 2 + 1);
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.34, h * 0.34, 1);
    return sprite;
  }

  function makeHallNameSprite(text, options = {}) {
    const w = options.width || 220;
    const h = options.height || 62;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 24}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      ctx.fillText(text, width / 2, height / 2 + 1);
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.26, h * 0.26, 1);
    return sprite;
  }
  function makeFlatTextSprite(text, options = {}) {
    const w = options.width || 320;
    const h = options.height || 92;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#111827';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 ${options.fontSize || 34}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
      const lines = Array.isArray(text) ? text : [text];
      const gap = options.lineGap || (options.fontSize || 34) * 1.08;
      const startY = height / 2 - ((lines.length - 1) * gap) / 2;
      lines.forEach((line, idx) => ctx.fillText(line, width / 2, startY + idx * gap));
    }, w, h);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(w * 0.18, h * 0.18, 1);
    return sprite;
  }

  function roundedRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function makeIconCanvas(kind, { size = 160, fill = '#ffffff', stroke = '#ffffff', bg = 'rgba(255,255,255,0.96)', bgStroke = 'rgba(255,255,255,0.22)' } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;
    const box = size * 0.72;
    const x = (size - box) / 2;
    const y = (size - box) / 2;
    const radius = size * 0.2;

    ctx.clearRect(0, 0, size, size);

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.22)';
    ctx.shadowBlur = size * 0.08;
    ctx.shadowOffsetY = size * 0.035;
    roundedRectPath(ctx, x, y, box, box, radius);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.restore();

    roundedRectPath(ctx, x, y, box, box, radius);
    ctx.lineWidth = size * 0.015;
    ctx.strokeStyle = bgStroke;
    ctx.stroke();

    let iconPath = 'M7 4.5h10a1.5 1.5 0 0 1 1.5 1.5v13.5l-6.5-4.2-6.5 4.2V6A1.5 1.5 0 0 1 7 4.5z';
    if (kind === 'heart') {
      iconPath = 'M12 20.5s-7-4.35-7-10.1c0-2.53 1.9-4.4 4.35-4.4 1.48 0 2.57.69 3.65 2.02 1.08-1.33 2.17-2.02 3.65-2.02 2.45 0 4.35 1.87 4.35 4.4 0 5.75-7 10.1-7 10.1z';
    } else if (kind === 'clear') {
      iconPath = 'M7 7l10 10M17 7L7 17';
    }

    ctx.save();
    const iconBox = size * (kind === 'clear' ? 0.32 : 0.345);
    const iconScale = iconBox / 24;
    const iconOffsetY = kind === 'heart' ? size * 0.004 : size * 0.002;
    ctx.translate(cx - 12 * iconScale, cy - 12 * iconScale + iconOffsetY);
    ctx.scale(iconScale, iconScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = stroke;
    ctx.fillStyle = fill;
    const path = new Path2D(iconPath);
    ctx.lineWidth = kind === 'clear' ? 2.2 : (kind === 'heart' ? 1.8 : 1.65);
    ctx.stroke(path);
    ctx.restore();

    return canvas;
  }

  function actionTierVisual(tier, hovered = false) {
    const alpha = hovered ? 0.78 : 1;
    if (tier === 'primary') return { bg: `rgba(239,68,68,${alpha})`, bgStroke: `rgba(239,68,68,${alpha})` };
    if (tier === 'secondary') return { bg: `rgba(245,158,11,${alpha})`, bgStroke: `rgba(245,158,11,${alpha})` };
    return { bg: `rgba(107,114,128,${alpha})`, bgStroke: `rgba(107,114,128,${alpha})` };
  }

  function makeActionIconSprite(kind, options = {}) {
    const tier = options.tier || 'primary';
    const visual = actionTierVisual(tier, false);
    const canvas = makeIconCanvas(kind, {
      size: 320,
      fill: 'rgba(255,255,255,0.98)',
      stroke: 'rgba(255,255,255,0.98)',
      bg: visual.bg,
      bgStroke: visual.bgStroke
    });
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const sprite = new THREE.Mesh(new THREE.PlaneGeometry(25.6, 25.6), material);
    sprite.renderOrder = 999;
    sprite.userData.kind = kind;
    sprite.userData.tier = tier;
    return sprite;
  }

  function setActionIconSpriteVisual(sprite, { hovered = false, active = false } = {}) {
    if (!sprite?.material) return;
    const visual = actionTierVisual(sprite.userData.tier, hovered);
    const canvas = makeIconCanvas(sprite.userData.kind || 'heart', {
      size: hovered ? 352 : 320,
      fill: 'rgba(255,255,255,0.98)',
      stroke: 'rgba(255,255,255,0.98)',
      bg: visual.bg,
      bgStroke: visual.bgStroke
    });
    const nextTexture = new THREE.CanvasTexture(canvas);
    nextTexture.needsUpdate = true;
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    const prevTexture = sprite.material.map;
    sprite.material.map = nextTexture;
    sprite.material.opacity = 1;
    const scale = hovered ? 30.4 : (active ? 28.2 : 25.6);
    sprite.scale.set(scale / 25.6, scale / 25.6, 1);
    prevTexture?.dispose?.();
  }

  function makeGroundTextMesh(textLines, options = {}) {
    const w = options.width || 420;
    const h = options.height || 120;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      const lines = Array.isArray(textLines) ? textLines : [textLines];
      const fontSize = options.fontSize || 48;
      const gap = options.lineGap || fontSize * 1.02;
      const startY = height / 2 - ((lines.length - 1) * gap) / 2;

      if (options.bg) {
        const padX = options.bgPadX || Math.round(width * 0.055);
        const padY = options.bgPadY || Math.round(height * 0.12);
        const radius = options.bgRadius || Math.round(Math.min(width, height) * 0.16);
        const x = padX;
        const y = padY;
        const rw = width - padX * 2;
        const rh = height - padY * 2;
        ctx.fillStyle = options.bg;
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + rw - radius, y);
        ctx.quadraticCurveTo(x + rw, y, x + rw, y + radius);
        ctx.lineTo(x + rw, y + rh - radius);
        ctx.quadraticCurveTo(x + rw, y + rh, x + rw - radius, y + rh);
        ctx.lineTo(x + radius, y + rh);
        ctx.quadraticCurveTo(x, y + rh, x, y + rh - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
      }

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      lines.forEach((line, idx) => {
        ctx.font = `800 ${idx === 0 ? fontSize : Math.round(fontSize * 0.58)}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;
        if (options.stroke) {
          ctx.strokeStyle = options.stroke;
          ctx.lineWidth = options.strokeWidth || Math.max(6, Math.round(fontSize * 0.14));
          ctx.lineJoin = 'round';
          ctx.strokeText(line, width / 2, startY + idx * gap);
        }
        ctx.fillStyle = options.color || '#111827';
        ctx.fillText(line, width / 2, startY + idx * gap);
      });
    }, w, h);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(options.worldW || 44, options.worldH || 12),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: 0.06 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    return mesh;
  }

  function makeVerticalTopTextMesh(text, options = {}) {
    const chars = Array.from(text.replace(/\s+/g, ''));
    const worldW = options.worldW || 8;
    const worldH = options.worldH || 24;
    const texW = options.width || 256;
    const texH = options.height || 1024;
    const texture = createTextTexture((ctx, width, height) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = options.color || '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = options.paddingX || Math.round(width * 0.14);
      const paddingY = options.paddingY || Math.round(height * 0.08);
      const usableW = width - paddingX * 2;
      const usableH = height - paddingY * 2;
      const step = usableH / chars.length;

      // Width-constrained so each character fits inside the sign width like the PDF.
      const fontSize = Math.floor(Math.min(usableW * 0.86, step * 0.78));
      ctx.font = `800 ${fontSize}px Inter, "Hiragino Sans", "Yu Gothic", sans-serif`;

      const cx = width / 2;
      for (let i = 0; i < chars.length; i++) {
        const cy = paddingY + step * (i + 0.5);
        ctx.fillText(chars[i], cx, cy);
      }
    }, texW, texH);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(worldW, worldH),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, alphaTest: 0.06 })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 7;
    return mesh;
  }


  function makeAreaLabelGroundMesh(band) {
    const label = String(band.label || '');
    const [, , bboxW, bboxH] = band.bbox;
    const isVertical = bboxH > bboxW * 1.8;
    let mesh;

    if (isVertical) {
      mesh = makeVerticalTopTextMesh(label, {
        color: '#0f172a',
        worldW: Math.max(4.2, Math.min(6.2, bboxW * 1.15)),
        worldH: Math.max(10.5, Math.min(22, bboxH * 0.72)),
        width: 256,
        height: 1024
      });
    } else {
      mesh = makeGroundTextMesh(label, {
        color: '#0f172a',
        stroke: 'rgba(255,255,255,0.96)',
        strokeWidth: 18,
        worldW: label.length <= 1 ? 9.8 : 18,
        worldH: label.length <= 1 ? 9.8 : 8.5,
        width: label.length <= 1 ? 512 : 1024,
        height: label.length <= 1 ? 512 : 320,
        fontSize: label.length <= 1 ? 220 : 110
      });
    }

    mesh.position.y = 0.08;
    mesh.renderOrder = 6;
    mesh.raycast = () => {};
    return mesh;
  }


  function makePortalTriangleMesh(options = {}) {
    const size = options.size || 9;
    const h = Math.sqrt(3) * 0.5 * size;
    const dir = options.direction === 'left' ? -1 : 1;
    const shape = new THREE.Shape();
    shape.moveTo(dir * (size * 0.5), 0);
    shape.lineTo(-dir * (size * 0.5), -h * 0.5);
    shape.lineTo(-dir * (size * 0.5), h * 0.5);
    shape.closePath();
    const material = new THREE.MeshBasicMaterial({
      color: options.color || '#ef4444',
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 1
    });
    material.polygonOffset = true;
    material.polygonOffsetFactor = -2;
    material.polygonOffsetUnits = -2;
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = options.y || 0.26;
    mesh.renderOrder = 1;
    return mesh;
  }


  const hallArchitectureGroups = new Map();
  const hallGroups = new Map();
  const boothMeshes = [];
  const boothById = new Map();
  const groupMembers = new Map();
  const areaLabelMeshes = [];
  let hallModelVisible = false;
  let hallAutoArchitectureVisible = true;
  const HALL_ARCH_SPECS = {
    1: {
      style: 'wood',
      wallH: 58,
      lowerWallH: 24,
      roofY: 66,
      beamY: 61,
      signNumbers: ['1', '2'],
      columns: [
        [-0.26, -0.20],
        [-0.26, 0.12],
        [0.02, -0.20],
        [0.02, 0.12]
      ],
      shutters: [
        { side: 'right', ratio: -0.34, w: 28, h: 18 },
        { side: 'right', ratio: -0.04, w: 28, h: 18 },
        { side: 'back', ratio: 0.24, w: 30, h: 18 }
      ],
      exitDoors: [
        { side: 'left', ratio: 0.22 },
        { side: 'back', ratio: -0.18 },
        { side: 'right', ratio: 0.34 }
      ]
    },
    2: {
      style: 'steel',
      wallH: 88,
      lowerWallH: 28,
      roofY: 98,
      beamY: 79,
      signNumbers: ['3', '4'],
      columns: [
        [-0.28, -0.24],
        [-0.28, 0.10],
        [0.00, -0.24],
        [0.00, 0.10]
      ],
      shutters: [
        { side: 'right', ratio: -0.30, w: 26, h: 22 },
        { side: 'right', ratio: 0.30, w: 26, h: 22 }
      ],
      exitDoors: [
        { side: 'left', ratio: 0.18 },
        { side: 'back', ratio: -0.24 },
        { side: 'right', ratio: 0.06 }
      ]
    }
  };

  function createConcreteTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e8e4de';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * size;
      const y = Math.random() * size;
      const a = 0.018 + Math.random() * 0.035;
      const g = 205 + Math.floor(Math.random() * 28);
      ctx.fillStyle = `rgba(${g},${g},${g},${a})`;
      const r = Math.random() * 1.6 + 0.35;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(140,140,140,0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const p = (size / 4) * i;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 11);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;
    return texture;
  }

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

  
