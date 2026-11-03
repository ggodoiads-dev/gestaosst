import type * as ThreeNS from "three";

type Three = typeof ThreeNS;

/** Nomes dos pontos da rede logística que aparecem como etiquetas na tela, na ordem do caminho da câmera. */
export const HUBS = [
  { name: "Recebimento", x: -78, z: 66 },
  { name: "Armazém", x: -28, z: 22 },
  { name: "Expedição", x: 26, z: -16 },
  { name: "Cliente", x: 74, z: -62 },
] as const;
const SIDE_HUBS = [
  { x: -66, z: -34 },
  { x: 56, z: 54 },
] as const;

export type SceneHandle = {
  /** Atualiza a cena para um progresso de scroll (0 a 1) e o tempo em segundos. */
  frame: (progress: number, time: number) => void;
  resize: (w: number, h: number) => void;
  /** Posição, em pixels, das etiquetas dos pontos da rede (ou null se estão fora de quadro). */
  hubScreen: () => ({ x: number; y: number; depth: number } | null)[];
  dispose: () => void;
};

/** Ruído de valor suave (determinístico) para o relevo. */
function makeNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ seed;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const noise = (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = smooth(x - xi);
    const yf = smooth(y - yi);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x: number, y: number) => {
    let amp = 1;
    let freq = 1;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < 5; o++) {
      sum += noise(x * freq, y * freq) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2.03;
    }
    return sum / norm;
  };
}

/**
 * Rede logística em 3D: um relevo noturno com curvas de nível luminosas, rodovias, caminhões de luz entre os pontos (recebimento, armazém, expedição, cliente) e
 * uma câmera que percorre o caminho da carga conforme o scroll. Procedural (sem arquivo de modelo) e com brilho (bloom) para o acabamento de cinema.
 */
export async function createCinemaScene(THREE: Three, canvas: HTMLCanvasElement): Promise<SceneHandle> {
  const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }, { RoomEnvironment }] = await Promise.all([
    import("three/examples/jsm/postprocessing/EffectComposer.js"),
    import("three/examples/jsm/postprocessing/RenderPass.js"),
    import("three/examples/jsm/postprocessing/UnrealBloomPass.js"),
    import("three/examples/jsm/postprocessing/OutputPass.js"),
    import("three/examples/jsm/environments/RoomEnvironment.js"),
  ]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const disposables: { dispose: () => void }[] = [];
  const scene = new THREE.Scene();
  const FOG = 0x020b22;
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, 0.0105);
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 700);
  scene.add(camera);
  // Reflexos de estúdio para os materiais físicos (o capacete); o relevo e as luzes usam shaders próprios e não são afetados.
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const phaseColors = [0x0b1f4a, 0x0d3470, 0x3a2c5c, 0x020b22].map((c) => new THREE.Color(c));
  const phaseTmp = new THREE.Color();
  const hat = buildHat(THREE, (o) => disposables.push(o));
  camera.add(hat);
  const rim = new THREE.PointLight(0x7fe7ff, 6, 12, 1.5);
  rim.position.set(-1.5, 1.4, -1.2);
  camera.add(rim);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.65, 0.42);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const track = <T extends { dispose: () => void }>(o: T): T => {
    disposables.push(o);
    return o;
  };

  // ---------- relevo
  const noise = makeNoise(11);
  const SIZE = 760;
  const hubs = [...HUBS, ...SIDE_HUBS];
  const heightAt = (x: number, z: number) => {
    let h = (noise(x * 0.016 + 3.3, z * 0.016 + 8.1) - 0.38) * 26;
    h = Math.max(h, -1.5) + (noise(x * 0.06, z * 0.06) - 0.5) * 2.2;
    // pontos da rede ficam em platôs, para as construções assentarem
    for (const hub of hubs) {
      const d = Math.hypot(x - hub.x, z - hub.z);
      const k = Math.min(Math.max((d - 7) / 16, 0), 1);
      h = h * (k * k * (3 - 2 * k)) + 1.2 * (1 - k * k * (3 - 2 * k));
    }
    return h;
  };

  const seg = 380;
  const terrainGeo = track(new THREE.PlaneGeometry(SIZE, SIZE, seg, seg));
  terrainGeo.rotateX(-Math.PI / 2);
  const pos = terrainGeo.attributes.position as ThreeNS.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  terrainGeo.computeVertexNormals();
  const terrainMat = track(
    new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() } },
      vertexShader: /* glsl */ `
        varying vec3 vWorld; varying float vH;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz; vH = position.y;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec3 vWorld; varying float vH;
        uniform float uTime; uniform vec3 uCam;
        void main() {
          float d = distance(vWorld, uCam);
          float fade = exp(-d * 0.0105 * 1.15);
          float a = vH * 0.62;
          float w = max(fwidth(a), 1e-4);
          float minor = 1.0 - smoothstep(0.0, 1.6, abs(fract(a - 0.5) - 0.5) / w);
          float b = vH * 0.62 / 5.0;
          float wb = max(fwidth(b), 1e-4);
          float major = 1.0 - smoothstep(0.0, 2.0, abs(fract(b - 0.5) - 0.5) / wb);
          vec3 base = mix(vec3(0.004, 0.02, 0.07), vec3(0.01, 0.07, 0.16), clamp(vH / 14.0 + 0.2, 0.0, 1.0));
          vec3 col = base;
          col += vec3(0.0, 0.62, 0.95) * minor * 0.30;
          col += vec3(0.1, 0.95, 1.0) * major * 0.85;
          float pulse = 0.5 + 0.5 * sin(uTime * 0.6 - length(vWorld.xz) * 0.05);
          col += vec3(0.0, 0.25, 0.5) * pulse * 0.05;
          gl_FragColor = vec4(col * fade + vec3(0.008, 0.04, 0.1) * (1.0 - fade), 1.0);
        }`,
    }),
  );
  scene.add(new THREE.Mesh(terrainGeo, terrainMat));

  // ---------- texturas de brilho
  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.25, "rgba(255,255,255,0.55)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return track(new THREE.CanvasTexture(c));
  })();

  const points = (count: number, size: number, color: number, opacity: number) => {
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const mat = track(new THREE.PointsMaterial({ size, map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    const p = new THREE.Points(geo, mat);
    p.frustumCulled = false;
    scene.add(p);
    return p;
  };

  // ---------- rodovias
  const roadMat = track(new THREE.MeshBasicMaterial({ color: 0x2ad4ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const makeRoad = (ctrl: [number, number][]) => {
    const v = ctrl.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.35, z));
    const curve = new THREE.CatmullRomCurve3(v, false, "centripetal");
    // reposiciona a curva sobre o relevo
    const dense = curve.getSpacedPoints(220).map((p) => new THREE.Vector3(p.x, heightAt(p.x, p.z) + 0.4, p.z));
    const onGround = new THREE.CatmullRomCurve3(dense, false, "centripetal");
    const tube = track(new THREE.TubeGeometry(onGround, 480, 0.11, 5, false));
    scene.add(new THREE.Mesh(tube, roadMat));
    return onGround;
  };
  const h = HUBS;
  const roads = [
    makeRoad([[h[0].x, h[0].z], [-62, 52], [-48, 40], [-38, 30], [h[1].x, h[1].z]]),
    makeRoad([[h[1].x, h[1].z], [-12, 14], [2, 6], [14, -4], [h[2].x, h[2].z]]),
    makeRoad([[h[2].x, h[2].z], [42, -30], [56, -40], [66, -52], [h[3].x, h[3].z]]),
    makeRoad([[SIDE_HUBS[0].x, SIDE_HUBS[0].z], [-58, -22], [-44, -6], [-34, 8], [h[1].x, h[1].z]]),
    makeRoad([[h[2].x, h[2].z], [34, 2], [44, 24], [52, 42], [SIDE_HUBS[1].x, SIDE_HUBS[1].z]]),
  ];

  // ---------- pontos da rede: feixe de luz, anéis e construções
  const beamMat = track(new THREE.MeshBasicMaterial({ color: 0x35e1ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const beamGeo = track(new THREE.CylinderGeometry(0.4, 2.6, 46, 18, 1, true));
  const ringGeo = track(new THREE.RingGeometry(1, 1.12, 64));
  const rings: ThreeNS.Mesh[] = [];
  const ringMats: ThreeNS.MeshBasicMaterial[] = [];
  const bldGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const bldMat = track(new THREE.MeshBasicMaterial({ color: 0x1b4a94 }));
  const winMat = track(new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
  const rnd = (() => {
    let s = 99;
    return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  })();
  const blds = new THREE.InstancedMesh(bldGeo, bldMat, hubs.length * 26);
  const wins = new THREE.InstancedMesh(bldGeo, winMat, hubs.length * 26);
  const m4 = new THREE.Matrix4();
  let bi = 0;
  hubs.forEach((hub, hi) => {
    const y = heightAt(hub.x, hub.z);
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(hub.x, y + 23, hub.z);
    scene.add(beam);
    for (let r = 0; r < 3; r++) {
      const mat = track(new THREE.MeshBasicMaterial({ color: 0x35e1ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const ring = new THREE.Mesh(ringGeo, mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(hub.x, y + 0.5, hub.z);
      ring.userData = { phase: r / 3 + hi * 0.13 };
      scene.add(ring);
      rings.push(ring);
      ringMats.push(mat);
    }
    // galpões e silos (corpo escuro com uma faixa de janelas acesas)
    for (let k = 0; k < 26; k++) {
      const a = rnd() * Math.PI * 2;
      const dist = 2.5 + rnd() * 8;
      const bx = hub.x + Math.cos(a) * dist;
      const bz = hub.z + Math.sin(a) * dist;
      const w = 1.4 + rnd() * 3.4;
      const d = 1.4 + rnd() * 3.4;
      const hh = 0.8 + rnd() * (hi < 4 ? 3.2 : 2);
      m4.compose(new THREE.Vector3(bx, y + hh / 2, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * Math.PI, 0)), new THREE.Vector3(w, hh, d));
      blds.setMatrixAt(bi, m4);
      m4.compose(new THREE.Vector3(bx, y + hh * 0.62, bz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rnd() * 0 + 0, 0)), new THREE.Vector3(w * 1.03, 0.2, d * 1.03));
      wins.setMatrixAt(bi, m4);
      bi++;
    }
  });
  blds.count = bi;
  wins.count = bi;
  scene.add(blds, wins);

  // ---------- luzes de cidades e poeira
  const cities = points(900, 1.1, 0xffd98a, 0.9);
  {
    const arr = (cities.geometry.attributes.position as ThreeNS.BufferAttribute).array as Float32Array;
    let n = 0;
    while (n < 900) {
      const cx = (rnd() - 0.5) * 250;
      const cz = (rnd() - 0.5) * 250;
      if (heightAt(cx, cz) > 3.5) continue;
      const cluster = 4 + Math.floor(rnd() * 9);
      for (let k = 0; k < cluster && n < 900; k++) {
        const x = cx + (rnd() - 0.5) * 8;
        const z = cz + (rnd() - 0.5) * 8;
        arr[n * 3] = x;
        arr[n * 3 + 1] = heightAt(x, z) + 0.3;
        arr[n * 3 + 2] = z;
        n++;
      }
    }
    (cities.geometry.attributes.position as ThreeNS.BufferAttribute).needsUpdate = true;
  }
  const dust = points(520, 0.5, 0x8fd8ff, 0.5);
  const dustBase = new Float32Array(520 * 3);
  for (let i = 0; i < 520; i++) {
    dustBase[i * 3] = (rnd() - 0.5) * 70;
    dustBase[i * 3 + 1] = rnd() * 26;
    dustBase[i * 3 + 2] = (rnd() - 0.5) * 70;
  }

  // ---------- caminhões de luz (corpo + rastro)
  const TRAIL = 9;
  const trucksPer = 5;
  const truckCount = roads.length * trucksPer;
  const heads = points(truckCount, 2.4, 0xfff0c8, 1);
  const trails = points(truckCount * TRAIL, 1.5, 0xffc766, 0.7);
  const truckT = Array.from({ length: truckCount }, (_, i) => ({ road: Math.floor(i / trucksPer), t: (i % trucksPer) / trucksPer + rnd() * 0.1, speed: 0.012 + rnd() * 0.01, dir: rnd() < 0.5 ? 1 : -1 }));
  const tmp = new THREE.Vector3();

  // ---------- câmera: dois caminhos (posição e alvo) percorridos pelo scroll
  const camPath = new THREE.CatmullRomCurve3(
    [
      [-150, 96, 150],
      [-112, 46, 112],
      [-80, 17, 82],
      [-40, 10, 40],
      [2, 13, 12],
      [46, 16, 2],
      [78, 19, -34],
      [108, 40, -40],
      [112, 58, -4],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const lookPath = new THREE.CatmullRomCurve3(
    [
      [0, 0, 0],
      [-78, 2, 66],
      [-50, 3, 46],
      [-28, 4, 22],
      [14, 4, 0],
      [26, 4, -16],
      [62, 4, -48],
      [70, 4, -52],
      [52, 2, -34],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const camPos = new THREE.Vector3();
  const lookPos = new THREE.Vector3();
  const hubWorld = hubs.slice(0, 4).map((hub) => new THREE.Vector3(hub.x, heightAt(hub.x, hub.z) + 9, hub.z));

  return {
    frame(progress, time) {
      const p = Math.min(Math.max(progress, 0), 1);
      const u = p * p * (3 - 2 * p) * 0.4 + p * 0.6;
      camPath.getPoint(u, camPos);
      lookPath.getPoint(Math.min(u + 0.02, 1), lookPos);
      // respiração suave de câmera na mão
      camPos.x += Math.sin(time * 0.35) * 0.35;
      camPos.y += Math.sin(time * 0.5 + 1) * 0.25;
      camera.position.copy(camPos);
      const roll = Math.sin(p * 9) * 0.05;
      camera.up.set(Math.sin(roll), Math.cos(roll), 0);
      camera.lookAt(lookPos);

      // cor do céu e da névoa percorre o dia (manhã cedo, dia, entardecer, noite)
      const ph = p * (phaseColors.length - 1);
      const pi = Math.min(Math.floor(ph), phaseColors.length - 2);
      phaseTmp.lerpColors(phaseColors[pi], phaseColors[pi + 1], ph - pi);
      (scene.background as ThreeNS.Color).copy(phaseTmp);
      (scene.fog as ThreeNS.FogExp2).color.copy(phaseTmp);

      // capacete: aparece na abertura, some durante a viagem e volta no fechamento
      const sm = (a: number, b: number, x: number) => {
        const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
        return t * t * (3 - 2 * t);
      };
      const heroV = 1 - sm(0.08, 0.2, p);
      const endV = sm(0.84, 0.93, p);
      const vis = Math.max(heroV, endV);
      hat.visible = vis > 0.01;
      hat.scale.setScalar(Math.max(vis, 0.001) * (0.4 + 0.1 * (1 - endV)));
      hat.position.set(0.95 * heroV * (1 - endV), -0.1 + 1.05 * endV, -3.1);
      hat.rotation.set(0.5 + Math.sin(time * 0.6) * 0.04, time * 0.5 + p * 4, 0.05);

      terrainMat.uniforms.uTime.value = time;
      terrainMat.uniforms.uCam.value.copy(camPos);

      rings.forEach((r, i) => {
        const t = (time * 0.35 + (r.userData.phase as number)) % 1;
        const s = 1.5 + t * 15;
        r.scale.set(s, s, 1);
        ringMats[i].opacity = (1 - t) * 0.65;
      });

      // caminhões
      const headArr = (heads.geometry.attributes.position as ThreeNS.BufferAttribute).array as Float32Array;
      const trailArr = (trails.geometry.attributes.position as ThreeNS.BufferAttribute).array as Float32Array;
      truckT.forEach((tr, i) => {
        tr.t = (tr.t + tr.speed * 0.016 * 4 * tr.dir + 1) % 1;
        const road = roads[tr.road];
        for (let k = 0; k < TRAIL; k++) {
          const tt = (tr.t - tr.dir * k * 0.006 + 1) % 1;
          road.getPoint(tt, tmp);
          trailArr[(i * TRAIL + k) * 3] = tmp.x;
          trailArr[(i * TRAIL + k) * 3 + 1] = tmp.y + 0.35;
          trailArr[(i * TRAIL + k) * 3 + 2] = tmp.z;
        }
        road.getPoint(tr.t, tmp);
        headArr[i * 3] = tmp.x;
        headArr[i * 3 + 1] = tmp.y + 0.35;
        headArr[i * 3 + 2] = tmp.z;
      });
      (heads.geometry.attributes.position as ThreeNS.BufferAttribute).needsUpdate = true;
      (trails.geometry.attributes.position as ThreeNS.BufferAttribute).needsUpdate = true;

      // poeira em torno da câmera
      const dustArr = (dust.geometry.attributes.position as ThreeNS.BufferAttribute).array as Float32Array;
      for (let i = 0; i < 520; i++) {
        dustArr[i * 3] = camPos.x + ((dustBase[i * 3] + time * 0.6 * (i % 3 === 0 ? 1 : -0.5) + 35) % 70) - 35;
        dustArr[i * 3 + 1] = camPos.y - 8 + ((dustBase[i * 3 + 1] + time * 0.4) % 26);
        dustArr[i * 3 + 2] = camPos.z + ((dustBase[i * 3 + 2] + time * 0.3 + 35) % 70) - 35;
      }
      (dust.geometry.attributes.position as ThreeNS.BufferAttribute).needsUpdate = true;

      composer.render();
    },
    resize(w, hgt) {
      renderer.setSize(w, hgt, false);
      composer.setSize(w, hgt);
      bloom.setSize(Math.floor(w / 2), Math.floor(hgt / 2));
      camera.aspect = w / Math.max(hgt, 1);
      camera.updateProjectionMatrix();
    },
    hubScreen() {
      const w = renderer.domElement.clientWidth;
      const hh = renderer.domElement.clientHeight;
      return hubWorld.map((v) => {
        const p = v.clone().project(camera);
        if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1.1 || Math.abs(p.y) > 1.1) return null;
        const d = v.distanceTo(camera.position);
        return { x: (p.x * 0.5 + 0.5) * w, y: (-p.y * 0.5 + 0.5) * hh, depth: d };
      });
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      [blds, wins].forEach((m) => m.dispose());
      composer.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}


/** Capacete de segurança procedural: cúpula torneada, aba com viseira e três nervuras, em amarelo de segurança com verniz. */
function buildHat(THREE: Three, onDispose: (o: { dispose: () => void }) => void): ThreeNS.Group {
  const g = new THREE.Group();
  const yellow = new THREE.MeshPhysicalMaterial({ color: 0xeab000, roughness: 0.42, metalness: 0.0, clearcoat: 0.8, clearcoatRoughness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x0f1a2e, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0068d8, roughness: 0.4, metalness: 0.2 });
  onDispose(yellow);
  onDispose(dark);
  onDispose(blue);

  // cúpula
  const profile = [
    [0.0, 0.98],
    [0.3, 0.95],
    [0.58, 0.85],
    [0.82, 0.66],
    [0.97, 0.4],
    [1.03, 0.14],
    [1.04, 0.0],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const domeGeo = new THREE.LatheGeometry([...profile].reverse(), 72);
  onDispose(domeGeo);
  g.add(new THREE.Mesh(domeGeo, yellow));

  // forro interno escuro
  const linerGeo = new THREE.LatheGeometry(profile.map((v) => new THREE.Vector2(v.x * 0.94, v.y * 0.94)), 48);
  onDispose(linerGeo);
  g.add(new THREE.Mesh(linerGeo, dark));

  // aba: contorno circular com projeção à frente (viseira)
  const brim = new THREE.Shape();
  const N = 96;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const front = Math.max(0, Math.cos(a - Math.PI / 2));
    const r = 1.08 + 0.3 * front * front;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) brim.moveTo(x, y);
    else brim.lineTo(x, y);
  }
  const hole = new THREE.Path();
  for (let i = 0; i <= 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const x = Math.cos(a) * 0.96;
    const y = Math.sin(a) * 0.96;
    if (i === 0) hole.moveTo(x, y);
    else hole.lineTo(x, y);
  }
  brim.holes.push(hole);
  const brimGeo = new THREE.ExtrudeGeometry(brim, { depth: 0.045, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3, curveSegments: 48 });
  onDispose(brimGeo);
  const brimMesh = new THREE.Mesh(brimGeo, yellow);
  brimMesh.rotation.x = Math.PI / 2;
  g.add(brimMesh);

  // nervuras: arcos de trás para a frente por cima da cúpula
  for (const off of [-0.34, 0, 0.34]) {
    const pts: ThreeNS.Vector3[] = [];
    for (let i = 0; i <= 28; i++) {
      const ang = -Math.PI / 2 + (i / 28) * Math.PI;
      const y = Math.cos(ang) * 0.93 + 0.04;
      const z = Math.sin(ang) * 0.98;
      pts.push(new THREE.Vector3(off * (0.55 + 0.45 * Math.cos(ang)), Math.max(y, 0.02), z));
    }
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.045, 8, false);
    onDispose(tube);
    g.add(new THREE.Mesh(tube, yellow));
  }

  // faixa azul da marca
  const bandGeo = new THREE.TorusGeometry(1.035, 0.024, 12, 72);
  onDispose(bandGeo);
  const band = new THREE.Mesh(bandGeo, blue);
  band.rotation.x = Math.PI / 2;
  band.position.y = 0.22;
  g.add(band);

  return g;
}
