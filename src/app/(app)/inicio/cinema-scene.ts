import type * as ThreeNS from "three";

type Three = typeof ThreeNS;

/** Comprimento do corredor do armazém (m). A câmera entra por uma ponta e termina de frente para a carreta na doca. */
export const CORRIDOR = 96;

/** Palette do mundo: azul-marinho da marca, papelão quente, ciano e amarelo de segurança só nos acentos. */
const C = { navy: 0x001840, floor: 0x061f4a, steel: 0x1d4ed8, steelDark: 0x0b2c6b, carton: [0xcdb88f, 0xbfa97c, 0xb39e72, 0xd8cbb0, 0xc4ae85], blue: 0x0068d8, cyan: 0x00d8f0, lemon: 0xfbeba0, safety: 0xffc400 };

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export type SceneHandle = {
  /** Atualiza a cena para um progresso de scroll (0 a 1) e o tempo em segundos. */
  frame: (progress: number, time: number) => void;
  resize: (w: number, h: number) => void;
  dispose: () => void;
};

/** Monta a cena 3D (procedural, sem arquivo de modelo): corredor de racks com paletes, empilhadeira em movimento e carreta na doca. */
export function createCinemaScene(THREE: Three, canvas: HTMLCanvasElement): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.navy);
  scene.fog = new THREE.FogExp2(C.navy, 0.017);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 220);

  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x0a1d44, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-6, 14, 8);
  scene.add(sun);
  const camLight = new THREE.PointLight(0x9fd6ff, 160, 40, 1.6);
  scene.add(camLight);

  const disposables: { dispose: () => void }[] = [];
  const mat = (color: number, opts: Partial<ThreeNS.MeshStandardMaterialParameters> = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08, ...opts });
    disposables.push(m);
    return m;
  };
  const box = (w: number, h: number, d: number) => {
    const g = new THREE.BoxGeometry(w, h, d);
    disposables.push(g);
    return g;
  };

  // ---- piso, faixas e luz de teto
  const floor = new THREE.Mesh(box(46, 0.2, CORRIDOR + 40), mat(C.floor, { roughness: 0.55, metalness: 0.25 }));
  floor.position.set(0, -0.1, -CORRIDOR / 2 + 8);
  scene.add(floor);

  const lanes = new THREE.InstancedMesh(box(0.14, 0.02, 2.2), new THREE.MeshBasicMaterial({ color: C.safety }), 2 * Math.floor(CORRIDOR / 4));
  const m4 = new THREE.Matrix4();
  let li = 0;
  for (const x of [-2.9, 2.9]) {
    for (let z = 6; z > -CORRIDOR; z -= 4) {
      m4.makeTranslation(x, 0.02, z);
      lanes.setMatrixAt(li++, m4);
    }
  }
  lanes.count = li;
  scene.add(lanes);

  const lights = new THREE.InstancedMesh(box(6, 0.12, 0.5), new THREE.MeshBasicMaterial({ color: 0xdff0ff }), Math.floor(CORRIDOR / 6) + 2);
  let ci = 0;
  for (let z = 4; z > -CORRIDOR - 4; z -= 6) {
    m4.makeTranslation(0, 8.6, z);
    lights.setMatrixAt(ci++, m4);
  }
  lights.count = ci;
  scene.add(lights);

  // ---- racks: colunas, vigas e paletes com caixas
  const bayLen = 3.2;
  const bays = Math.floor(CORRIDOR / bayLen);
  const levels = [0.35, 2.85, 5.35];
  const uprights = new THREE.InstancedMesh(box(0.2, 7.8, 0.2), mat(C.steel, { metalness: 0.2 }), (bays + 1) * 4);
  const beams = new THREE.InstancedMesh(box(bayLen, 0.16, 0.16), mat(C.safety, { roughness: 0.5 }), bays * levels.length * 4);
  const cartons = new THREE.InstancedMesh(box(1, 1, 1), mat(0xffffff, { roughness: 0.9, metalness: 0 }), bays * levels.length * 2 * 2);
  const rnd = rand(7);
  let ui = 0;
  let bi = 0;
  let ki = 0;
  const color = new THREE.Color();
  for (const side of [-1, 1]) {
    const x = side * 5.6;
    for (let b = 0; b <= bays; b++) {
      const z = 6 - b * bayLen;
      for (const dx of [-0.95, 0.95]) {
        m4.makeTranslation(x + dx, 3.9, z);
        uprights.setMatrixAt(ui++, m4);
      }
    }
    for (let b = 0; b < bays; b++) {
      const z = 6 - b * bayLen - bayLen / 2;
      levels.forEach((y) => {
        for (const dx of [-0.95, 0.95]) {
          m4.makeTranslation(x + dx, y, z);
          beams.setMatrixAt(bi++, m4);
        }
        // cada vão guarda um ou dois paletes de caixas
        if (rnd() < 0.88) {
          for (let k = 0; k < 2; k++) {
            if (k === 1 && rnd() < 0.35) continue;
            const w = 1.3 + rnd() * 0.25;
            const h = 1.2 + rnd() * 0.9;
            const d = 1.5 + rnd() * 0.25;
            const zz = z + (k === 0 ? -0.8 : 0.8);
            m4.compose(new THREE.Vector3(x, y + 0.08 + h / 2, zz), new THREE.Quaternion(), new THREE.Vector3(w, h, d));
            cartons.setMatrixAt(ki, m4);
            const r = rnd();
            color.setHex(r < 0.06 ? C.cyan : r < 0.16 ? C.blue : r < 0.22 ? C.lemon : C.carton[Math.floor(rnd() * C.carton.length)]);
            cartons.setColorAt(ki, color);
            ki++;
          }
        }
      });
    }
  }
  uprights.count = ui;
  beams.count = bi;
  cartons.count = ki;
  if (cartons.instanceColor) cartons.instanceColor.needsUpdate = true;
  scene.add(uprights, beams, cartons);

  // ---- doca no fim do corredor: portal luminoso e carreta
  const dockZ = -CORRIDOR + 2;
  const portal = new THREE.Mesh(box(11, 7.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xbfe3ff }));
  portal.position.set(0, 3.75, dockZ - 14);
  scene.add(portal);
  const trailer = new THREE.Group();
  const trailerBody = new THREE.Mesh(box(3.6, 4.1, 13), mat(0xeaf0f8, { roughness: 0.5 }));
  trailerBody.position.set(0, 2.6, -6.2);
  const stripe = new THREE.Mesh(box(3.64, 0.5, 13.04), mat(C.blue));
  stripe.position.set(0, 1.6, -6.2);
  const hollow = new THREE.Mesh(box(3.0, 3.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x0a1b3d }));
  hollow.position.set(0, 2.6, 0.38);
  const glow = new THREE.Mesh(box(2.6, 3.0, 0.1), new THREE.MeshBasicMaterial({ color: C.lemon }));
  glow.position.set(0, 2.6, 0.2);
  trailer.add(trailerBody, stripe, glow, hollow);
  trailer.position.set(0, 0, dockZ - 6);
  scene.add(trailer);

  // ---- empilhadeira que roda pelo corredor
  const forklift = new THREE.Group();
  const fl = (g: ThreeNS.BufferGeometry, m: ThreeNS.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    forklift.add(mesh);
    return mesh;
  };
  const yellow = mat(C.safety, { roughness: 0.45 });
  const dark = mat(0x111827, { roughness: 0.7 });
  fl(box(1.2, 0.9, 2.0), yellow, 0, 0.75, 0.2);
  fl(box(1.25, 0.5, 0.9), dark, 0, 0.85, 0.95);
  for (const sx of [-0.55, 0.55]) {
    fl(box(0.07, 1.7, 0.07), dark, sx, 1.65, -0.45);
    fl(box(0.07, 1.7, 0.07), dark, sx, 1.65, 0.65);
  }
  fl(box(1.2, 0.07, 1.2), dark, 0, 2.5, 0.1);
  for (const sx of [-0.45, 0.45]) fl(box(0.1, 2.4, 0.1), dark, sx, 1.2, -1.05);
  for (const sx of [-0.4, 0.4]) fl(box(0.14, 0.07, 1.4), dark, sx, 0.2, -1.8);
  fl(box(1.1, 0.9, 0.9), mat(C.carton[0], { roughness: 0.9 }), 0, 0.75, -1.75);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14);
  disposables.push(wheelGeo);
  for (const [wx, wz] of [[-0.62, -0.5], [0.62, -0.5], [-0.62, 0.85], [0.62, 0.85]] as const) {
    const wheel = fl(wheelGeo, dark, wx, 0.36, wz);
    wheel.rotation.z = Math.PI / 2;
  }
  forklift.scale.setScalar(1.25);
  scene.add(forklift);

  // ---- loop
  const lookAt = new THREE.Vector3();
  const startZ = 9;
  const endZ = -CORRIDOR + 24;
  return {
    frame(progress, time) {
      const p = Math.min(Math.max(progress, 0), 1);
      const ease = p * p * (3 - 2 * p) * 0.35 + p * 0.65;
      const z = startZ + (endZ - startZ) * ease;
      const sway = Math.sin(p * 7.5) * 0.7;
      camera.position.set(sway, 2.4 + Math.sin(p * 5) * 0.25 + (1 - Math.min(p * 4, 1)) * 1.6, z);
      lookAt.set(sway * 0.4, 2.1, z - 14);
      camera.lookAt(lookAt);
      camLight.position.set(camera.position.x, 5.5, camera.position.z - 2);
      // empilhadeira vai e volta pela faixa direita, sempre à frente da câmera
      const span = 42;
      const t = (time * 0.09) % 2;
      const run = t < 1 ? t : 2 - t;
      forklift.position.set(2.6, 0, z - 8 - run * span);
      forklift.rotation.y = t < 1 ? 0 : Math.PI;
      renderer.render(scene, camera);
    },
    resize(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    },
    dispose() {
      disposables.forEach((d) => d.dispose());
      [lanes, lights, uprights, beams, cartons].forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
