import type * as ThreeNS from "three";

type Three = typeof ThreeNS;

/** Valores que a linha do tempo do scroll (GSAP) anima. A cena só lê daqui; nada avança sozinho além de movimentos discretos do ambiente. */
export type LogoState = {
  camX: number;
  camY: number;
  camZ: number;
  lookX: number;
  lookY: number;
  lookZ: number;
  fov: number;
  /** 0 = peças da logo dispersas no espaço, 1 = logo montada. */
  assemble: number;
  /** 0 = montada, 1 = vista explodida (camadas separadas em profundidade). */
  explode: number;
  /** Voltas do anel azul (1 = uma volta completa). */
  ring: number;
  /** Barras das 24 horas do dia anterior: 0 a 1. */
  bars: number;
  /** Intensidade do brilho (bloom e halo). */
  glow: number;
  /** 0 = luz fria da noite, 1 = luz quente do amanhecer. */
  warm: number;
  spin: number;
  tilt: number;
  logoY: number;
  logoX: number;
  logoScale: number;
};

export const INITIAL_STATE: LogoState = {
  camX: 0,
  camY: 0.5,
  camZ: 22,
  lookX: 0,
  lookY: 0,
  lookZ: 0,
  fov: 34,
  assemble: 0,
  explode: 0,
  ring: 0,
  bars: 0,
  glow: 0.7,
  warm: 0,
  spin: 0,
  tilt: 0,
  logoY: 0,
  logoX: 0,
  logoScale: 1,
};

export type LogoSceneHandle = {
  state: LogoState;
  frame: (time: number) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

type Part = { id: "ring" | "check" | "mark" | "s" | "i" | "g" | "o"; color: number; emissive: number; emissiveIntensity: number };

const PARTS: Part[] = [
  { id: "ring", color: 0x0a6cf0, emissive: 0x0050d0, emissiveIntensity: 0.55 },
  { id: "mark", color: 0xdfe7f5, emissive: 0x000000, emissiveIntensity: 0 },
  { id: "check", color: 0x00d8f0, emissive: 0x00d8f0, emissiveIntensity: 1.6 },
  { id: "s", color: 0xdfe7f5, emissive: 0x000000, emissiveIntensity: 0 },
  { id: "i", color: 0xdfe7f5, emissive: 0x000000, emissiveIntensity: 0 },
  { id: "g", color: 0xdfe7f5, emissive: 0x000000, emissiveIntensity: 0 },
  { id: "o", color: 0xdfe7f5, emissive: 0x000000, emissiveIntensity: 0 },
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("logo"));
    im.src = url;
  });
}

/** Desfoque separável (caixa, duas passadas) sobre um campo w×h em [0,1]. */
function blur(src: Float32Array, w: number, h: number, radius: number, passes = 2): Float32Array {
  let a = src;
  for (let p = 0; p < passes; p++) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      let acc = 0;
      for (let x = -radius; x <= radius; x++) acc += a[y * w + Math.min(Math.max(x, 0), w - 1)];
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = acc / (2 * radius + 1);
        acc += a[y * w + Math.min(x + radius + 1, w - 1)] - a[y * w + Math.max(x - radius, 0)];
      }
    }
    const out = new Float32Array(w * h);
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -radius; y <= radius; y++) acc += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        out[y * w + x] = acc / (2 * radius + 1);
        acc += tmp[Math.min(y + radius + 1, h - 1) * w + x] - tmp[Math.max(y - radius, 0) * w + x];
      }
    }
    a = out;
  }
  return a;
}

function grayCanvas(field: Float32Array, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.round(Math.min(Math.max(field[i], 0), 1) * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Mapa de normais (espaço tangente) a partir de um campo de altura, por Sobel. */
function normalCanvas(height: Float32Array, w: number, h: number, strength: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  const at = (x: number, y: number) => height[Math.min(Math.max(y, 0), h - 1) * w + Math.min(Math.max(x, 0), w - 1)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      // canvas tem y para baixo e o UV do three tem y para cima: inverte dy
      let nx = -dx * strength;
      let ny = dy * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = Math.round((nx * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Cena da apresentação: a logo do SIGO em 3D. A imagem da logo é separada por cor em peças (anel, marca, check e as quatro letras); cada peça vira uma malha em relevo
 * com bisel (mapa de altura desfocado + mapa de normais) e material verniz, para ter profundidade e reflexo reais. Pode ser trocada por qualquer logo no mesmo formato.
 */
export async function createLogoScene(THREE: Three, canvas: HTMLCanvasElement, opts: { logoUrl: string; hours: number[] | null; quality?: "high" | "low" }): Promise<LogoSceneHandle> {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoomEnvironment }, img] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
    loadImage(opts.logoUrl),
  ]);

  const low = opts.quality === "low";
  const tick = () => new Promise<void>((r) => setTimeout(r, 0));
  const state: LogoState = { ...INITIAL_STATE };
  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const scene = new THREE.Scene();
  const NIGHT = new THREE.Color(0x01081c);
  const DAWN = new THREE.Color(0x1b2250);
  scene.background = NIGHT.clone();
  scene.fog = new THREE.FogExp2(0x01081c, 0.018);
  const camera = new THREE.PerspectiveCamera(state.fov, 1, 0.1, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  // Em aparelho fraco não há pós-processamento (brilho): renderiza direto, bem mais leve.
  const composer = low ? null : new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.88);
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }

  // ---- luzes
  const key = new THREE.DirectionalLight(0xdbe9ff, 1.25);
  key.position.set(5, 7, 9);
  scene.add(key);
  const rim = new THREE.PointLight(0x3dd8ff, 150, 60, 1.5);
  rim.position.set(-8, 2, -4);
  scene.add(rim);
  const warm = new THREE.PointLight(0xffa24a, 0, 60, 1.5);
  warm.position.set(6, 1.5, 7);
  scene.add(warm);
  const under = new THREE.PointLight(0x2f7cf6, 60, 40, 1.6);
  under.position.set(0, -5, 5);
  scene.add(under);

  // ---- peças da logo
  const cv = document.createElement("canvas");
  cv.width = img.naturalWidth;
  cv.height = img.naturalHeight;
  const cx = cv.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(img, 0, 0);
  const W = cv.width;
  const H = cv.height;
  const px = cx.getImageData(0, 0, W, H).data;

  const cls = new Uint8Array(W * H); // 0 nada, 1 anel, 2 check, 3 branco
  const whiteCols = new Array<number>(W).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      const a = px[i + 3];
      if (a < 60) continue;
      let c = 0;
      if (r > 190 && g > 190 && b > 190) c = 3;
      else if (r < 90 && g > 170 && b > 190) c = 2;
      else if (r < 90 && g > 70 && g < 170 && b > 170) c = 1;
      else {
        // contorno suavizado: assume a classe do vizinho dominante, tratado depois; aqui entra como o canal mais forte
        c = b > 150 && r < 120 ? (g > 150 ? 2 : 1) : 3;
      }
      cls[y * W + x] = c;
      if (c === 3) whiteCols[x]++;
    }
  }
  // letras e marca: corridas de colunas com branco, ignorando ruído de poucos pixels
  const runs: [number, number][] = [];
  let st = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && whiteCols[x] > 3;
    if (on && st < 0) st = x;
    if (!on && st >= 0) {
      runs.push([st, x - 1]);
      st = -1;
    }
  }
  const letterRuns = runs.filter((r) => r[1] - r[0] > 12).slice(-4);
  const markRun: [number, number] = [0, (letterRuns[0]?.[0] ?? 290) - 6];

  const idOf = (part: Part["id"], x: number, c: number) => {
    switch (part) {
      case "ring":
        return c === 1;
      case "check":
        return c === 2;
      case "mark":
        return c === 3 && x >= markRun[0] && x <= markRun[1];
      case "s":
        return c === 3 && letterRuns[0] && x >= letterRuns[0][0] - 3 && x <= letterRuns[0][1] + 3;
      case "i":
        return c === 3 && letterRuns[1] && x >= letterRuns[1][0] - 3 && x <= letterRuns[1][1] + 3;
      case "g":
        return c === 3 && letterRuns[2] && x >= letterRuns[2][0] - 3 && x <= letterRuns[2][1] + 3;
      case "o":
        return c === 3 && letterRuns[3] && x >= letterRuns[3][0] - 3 && x <= letterRuns[3][1] + 3;
    }
  };

  const SCALE = 12 / W; // a logo inteira tem 12 unidades de largura
  const logo = new THREE.Group();
  scene.add(logo);
  const DEPTH = 0.9;
  type Piece = { mesh: ThreeNS.Mesh; home: ThreeNS.Vector3; scatter: ThreeNS.Vector3; scatterRot: ThreeNS.Euler; exploreZ: number; id: Part["id"] };
  const pieces: Piece[] = [];
  const rnd = rand(5);
  const explodeZ: Record<Part["id"], number> = { ring: -2.8, mark: 1.8, check: 4.2, s: 2.2, i: 3.4, g: 1.2, o: 2.8 };

  for (const part of PARTS) {
    await tick(); // cede o fio principal entre as peças, para a página não congelar enquanto monta
    // caixa delimitadora da peça
    let minX = W;
    let maxX = 0;
    let minY = H;
    let maxY = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (cls[y * W + x] && idOf(part.id, x, cls[y * W + x])) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX) continue;
    const pad = 10;
    minX = Math.max(minX - pad, 0);
    minY = Math.max(minY - pad, 0);
    maxX = Math.min(maxX + pad, W - 1);
    maxY = Math.min(maxY + pad, H - 1);
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const mask = new Float32Array(bw * bh);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const gx = minX + x;
        const gy = minY + y;
        const c = cls[gy * W + gx];
        if (c && idOf(part.id, gx, c)) mask[y * bw + x] = 1;
      }
    }
    const alphaField = blur(mask, bw, bh, 1, 1);
    const heightField = blur(mask, bw, bh, 5, 3);
    const alphaMap = track(new THREE.CanvasTexture(grayCanvas(alphaField, bw, bh)));
    const dispMap = track(new THREE.CanvasTexture(grayCanvas(heightField, bw, bh)));
    const normalMap = track(new THREE.CanvasTexture(normalCanvas(heightField, bw, bh, 9)));
    for (const t of [alphaMap, dispMap, normalMap]) {
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.generateMipmaps = false;
    }
    const segX = Math.min(Math.ceil(bw / (low ? 4 : 3)), low ? 110 : 170);
    const segY = Math.min(Math.ceil(bh / (low ? 4 : 3)), low ? 64 : 96);
    const geo = track(new THREE.PlaneGeometry(bw * SCALE, bh * SCALE, segX, segY));
    const params = {
      color: part.color,
      roughness: 0.2,
      metalness: 0.2,
      emissive: part.emissive,
      emissiveIntensity: part.emissiveIntensity,
      normalMap,
      normalScale: new THREE.Vector2(1.4, 1.4),
      alphaMap,
      alphaTest: 0.5,
      displacementMap: dispMap,
      displacementScale: DEPTH,
      displacementBias: -0.02,
      side: THREE.DoubleSide,
    };
    const material = track(low ? new THREE.MeshStandardMaterial(params) : new THREE.MeshPhysicalMaterial({ ...params, clearcoat: 1, clearcoatRoughness: 0.12 }));
    const mesh = new THREE.Mesh(geo, material);
    const cxl = ((minX + maxX) / 2 - W / 2) * SCALE;
    const cyl = -((minY + maxY) / 2 - H / 2) * SCALE;
    const home = new THREE.Vector3(cxl, cyl, 0);
    mesh.position.copy(home);
    logo.add(mesh);
    const ang = rnd() * Math.PI * 2;
    const radius = 7 + rnd() * 9;
    pieces.push({
      mesh,
      home,
      scatter: new THREE.Vector3(Math.cos(ang) * radius, Math.sin(ang) * radius * 0.6, -4 + rnd() * 14 - 4),
      scatterRot: new THREE.Euler((rnd() - 0.5) * 4, (rnd() - 0.5) * 4, (rnd() - 0.5) * 5),
      exploreZ: explodeZ[part.id],
      id: part.id,
    });
  }

  // ---- halo atrás da logo (cresce e esquenta no amanhecer)
  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.3, "rgba(255,255,255,0.4)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return track(new THREE.CanvasTexture(c));
  })();
  const haloMat = track(new THREE.SpriteMaterial({ map: glowTex, color: 0x2f7cf6, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  const halo = new THREE.Sprite(haloMat);
  halo.position.set(0, 0, -5);
  halo.scale.set(40, 26, 1);
  scene.add(halo);

  // ---- poeira e estrelas
  const PN = low ? 500 : 1100;
  const pGeo = track(new THREE.BufferGeometry());
  const base = new Float32Array(PN * 3);
  for (let i = 0; i < PN; i++) {
    // só atrás e ao redor da logo: poeira perto demais da câmera vira mancha
    base[i * 3] = (rnd() - 0.5) * 70;
    base[i * 3 + 1] = (rnd() - 0.5) * 34;
    base[i * 3 + 2] = -3 - rnd() * 34;
  }
  pGeo.setAttribute("position", new THREE.BufferAttribute(base.slice(), 3));
  const pMat = track(new THREE.PointsMaterial({ size: 0.16, map: glowTex, color: 0x9fdcff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const dust = new THREE.Points(pGeo, pMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---- barras: as 24 horas do último dia fechado (dado real)
  const hours = opts.hours;
  const barCount = 24;
  const barGeo = track(new THREE.BoxGeometry(0.34, 1, 0.34));
  const barMat = track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.3, emissive: 0x2f7cf6, emissiveIntensity: 0.9 }));
  const bars = new THREE.InstancedMesh(barGeo, barMat, barCount);
  const heights = new Float32Array(barCount);
  const maxH = hours ? Math.max(...hours, 1) : 1;
  const peak = hours ? hours.indexOf(Math.max(...hours)) : -1;
  const col = new THREE.Color();
  for (let i = 0; i < barCount; i++) {
    heights[i] = hours ? 0.25 + (hours[i] / maxH) * 3.6 : 0.2;
    col.setHex(i === peak && hours && hours[i] > 0 ? 0xffc400 : 0x7fe3ff);
    bars.setColorAt(i, col);
  }
  if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
  bars.visible = !!hours;
  scene.add(bars);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v3 = new THREE.Vector3();
  const sc = new THREE.Vector3();

  const ease = (t: number) => t * t * (3 - 2 * t);
  const lookAt = new THREE.Vector3();

  return {
    state,
    frame(time) {
      const a = ease(Math.min(Math.max(state.assemble, 0), 1));
      const ex = ease(Math.min(Math.max(state.explode, 0), 1));
      // o deslocamento lateral só vale em tela larga (em tela estreita a logo fica centralizada)
      logo.position.set(state.logoX * Math.min(Math.max((camera.aspect - 1) / 0.78, 0), 1), state.logoY, 0);
      logo.scale.setScalar(state.logoScale);
      logo.rotation.set(state.tilt + Math.sin(time * 0.35) * 0.015, state.spin + Math.sin(time * 0.27) * 0.04, 0);

      for (const p of pieces) {
        p.mesh.position.set(
          p.home.x + (p.scatter.x - p.home.x) * (1 - a) + Math.sin(time * 0.4 + p.home.x) * 0.25 * (1 - a),
          p.home.y + (p.scatter.y - p.home.y) * (1 - a) + Math.cos(time * 0.35 + p.home.y) * 0.25 * (1 - a),
          p.home.z + p.scatter.z * (1 - a) + p.exploreZ * ex,
        );
        p.mesh.rotation.set(p.scatterRot.x * (1 - a), p.scatterRot.y * (1 - a), p.scatterRot.z * (1 - a) + (p.id === "ring" ? state.ring * Math.PI * 2 : 0));
        if (p.id === "check") {
          const mat = p.mesh.material as ThreeNS.MeshStandardMaterial;
          mat.emissiveIntensity = 1.4 + Math.sin(time * 2.2) * 0.5 + state.glow;
        }
      }

      // barras
      const arc = Math.PI * 0.92;
      for (let i = 0; i < barCount; i++) {
        const t = i / (barCount - 1);
        const ang = Math.PI / 2 + (t - 0.5) * arc;
        const r = 8.4;
        const h = Math.max(heights[i] * ease(state.bars), 0.001);
        v3.set(Math.cos(ang) * r * 1.5, -3.3 + h / 2, -Math.sin(ang) * r + 2);
        q.identity();
        sc.set(1, h, 1);
        m4.compose(v3, q, sc);
        bars.setMatrixAt(i, m4);
      }
      bars.instanceMatrix.needsUpdate = true;
      bars.visible = !!hours && state.bars > 0.02;

      // luz, cor e brilho
      const w = Math.min(Math.max(state.warm, 0), 1);
      (scene.background as ThreeNS.Color).copy(NIGHT).lerp(DAWN, w);
      (scene.fog as ThreeNS.FogExp2).color.copy(scene.background as ThreeNS.Color);
      warm.intensity = 300 * w;
      rim.intensity = 150 * (1 - w * 0.5);
      haloMat.color.setHex(0x2f7cf6).lerp(new THREE.Color(0xffa24a), w);
      haloMat.opacity = 0.1 + state.glow * 0.1 + w * 0.1;
      halo.scale.set(26 + state.glow * 8 + w * 12, 17 + state.glow * 5 + w * 8, 1);
      bloom.strength = 0.25 + state.glow * 0.25;
      dust.rotation.y = time * 0.02 + state.spin * 0.2;

      // câmera
      const sway = 0.07;
      // em telas mais estreitas a câmera se afasta para a logo caber
      const fitZ = Math.max(1, 1.7 / camera.aspect);
      camera.position.set(state.camX + Math.sin(time * 0.3) * sway, state.camY + Math.cos(time * 0.27) * sway, state.camZ * fitZ);
      lookAt.set(state.lookX, state.lookY, state.lookZ);
      camera.lookAt(lookAt);
      if (Math.abs(camera.fov - state.fov) > 0.01) {
        camera.fov = state.fov;
        camera.updateProjectionMatrix();
      }
      if (composer) composer.render();
      else renderer.render(scene, camera);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      composer?.setSize(w, h);
      bloom.setSize(Math.floor(w / 2), Math.floor(h / 2));
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      bars.dispose();
      composer?.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
