import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { CharacterController } from "./CharacterController.js";

// ======== CONSTANTS ========
const SKY_DAY = 0x87ceeb;
const SKY_NIGHT = 0x0a0a1a;
const SEA_COLOR = 0x1e90ff;

// ======== SCENE ========
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY_DAY);
scene.fog = new THREE.FogExp2(SKY_DAY, 0.004);

// ======== CAMERA ========
const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 10, 15);

// ======== RENDERER ========
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ======== CONTROLS ========
let controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 5;
controls.maxDistance = 60;

// ======== LIGHTING ========
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff7cc, 1.3);
sunLight.position.set(40, 60, 30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 200;
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
scene.add(sunLight);

const sun = new THREE.Mesh(
  new THREE.SphereGeometry(4, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffdd66 })
);
sun.position.set(80, 60, -60);
scene.add(sun);

// ======== BIGGER ISLAND ========
// Make island bigger and bumpier
const islandGeom = new THREE.CircleGeometry(90, 130);
const islandMat = new THREE.MeshToonMaterial({ color: 0xffe4b5 });
const island = new THREE.Mesh(islandGeom, islandMat);
island.rotation.x = -Math.PI / 2;
island.castShadow = true;
scene.add(island);

// Create simple terrain height variation
const pos = islandGeom.attributes.position;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const dist = Math.sqrt(x * x + y * y);
  const height = Math.max(0, 3 - dist * 0.08) + Math.random() * 0.3;
  pos.setZ(i, height);
}
pos.needsUpdate = true;

const loader = new GLTFLoader();

const objects = [
  { file: "Chest.glb", scale: 1.5, pos: [-8, 0, -5], rotY: Math.PI / 3 },
  {
    file: "Chest-with-Gold.glb",
    scale: 1.3,
    pos: [-12, 0, 10],
    rotY: -Math.PI / 4,
  },
  { file: "Coin.glb", scale: 0.7, pos: [-10, 0, 12], rotY: 0 },
  { file: "Parchment.glb", scale: 1.2, pos: [2, 0, 10], rotY: 0 },
  { file: "Scroll.glb", scale: 1.1, pos: [3, 0, 9], rotY: 0 },
  { file: "Statue.glb", scale: 2.5, pos: [10, 0, -10], rotY: Math.PI / 1.5 },
  { file: "Rock.glb", scale: 3.0, pos: [14, 0, 8], rotY: 0 },
  { file: "Rocks.glb", scale: 3.5, pos: [-15, 0, -12], rotY: 0 },
];

objects.forEach((obj) => {
  loader.load(`models/${obj.file}`, (gltf) => {
    const model = gltf.scene;
    const [x, , z] = obj.pos;
    const y = getIslandHeight(x, z) + 0.5; // lift slightly above terrain
    model.position.set(x, y, z);
    model.scale.set(obj.scale, obj.scale, obj.scale);
    model.rotation.y = obj.rotY;
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    scene.add(model);
  });
});

// ======== HEIGHT FUNCTION (for placing objects accurately) ========
function getIslandHeight(x, z) {
  const dist = Math.sqrt(x * x + z * z);
  const baseHeight = Math.max(0, 4 - dist * 0.08);
  const randomVariation = Math.random() * 0.3;
  return baseHeight + randomVariation;
}

// ======== DYNAMIC CAMPFIRE ========

let campfireBase = null;
let campfireFlame = null;
let firePosition = null;

// ======== CAMPFIRE FIXED ========

function createCampfireBase() {
  loader.load("models/Campfire.glb", (gltf) => {
    campfireBase = gltf.scene;
    let placed = false;

    while (!placed) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 15; // near center, open area
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const dist = Math.sqrt(x * x + z * z);

      if (dist < 80 && dist > 10) {
        const y = getIslandHeight(x, z) + 1.0; // lifted slightly above ground

        campfireBase.position.set(x, y, z);
        campfireBase.scale.set(1.5, 1.5, 1.5);
        campfireBase.rotation.y = Math.random() * Math.PI * 2;

        campfireBase.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
          }
        });

        scene.add(campfireBase);
        firePosition = { x, y, z };
        placed = true;
      }
    }
  });
}

// Create the actual flame (appears ONLY at night)
function createCampfireFlame() {
  if (!firePosition) return;

  const flameGeo = new THREE.ConeGeometry(1, 3, 12, 1);
  const flameMat = new THREE.MeshStandardMaterial({
    color: 0xff6600,
    emissive: 0xff4400,
    emissiveIntensity: 1.2,
    transparent: true,
    opacity: 0.9,
  });

  campfireFlame = new THREE.Mesh(flameGeo, flameMat);
  campfireFlame.position.set(firePosition.x, firePosition.y + 2.3, firePosition.z);
  campfireFlame.visible = false; // start hidden (daytime)
  scene.add(campfireFlame);
}

// Start with only sticks visible
createCampfireBase();

// Helper: Turn the flame on or off when night/day switches
// Helper: Turn the flame on or off when night/day switches
function toggleCampfire(isNight) {
  if (isNight) {
    // 🔥 NIGHT: show flame, flicker enabled
    if (!campfireFlame) createCampfireFlame();
    if (campfireFlame) campfireFlame.visible = true;
  } else {
    // ☀️ DAY: hide flame, no flicker
    if (campfireFlame) campfireFlame.visible = false;
  }
}

// ======== BUSHES ========
// Function to create a single bush at (x, z)
function createBush(x, z) {
  const bush = new THREE.Group();

  // Random green tones for variation
  const leafColor = new THREE.Color().setHSL(
    0.33 + Math.random() * 0.05, // hue variation
    0.7,
    0.3 + Math.random() * 0.1 // slight brightness difference
  );
  const bushMat = new THREE.MeshStandardMaterial({
    color: leafColor,
    roughness: 0.9,
  });

  // Randomize size and shape
  const bushSize = 1.5 + Math.random();
  for (let i = 0; i < 3; i++) {
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(bushSize * (0.6 + Math.random() * 0.4), 12, 12),
      bushMat
    );
    sphere.position.set(
      (Math.random() - 0.5) * bushSize,
      Math.random() * 0.3,
      (Math.random() - 0.5) * bushSize
    );
    bush.add(sphere);
  }

  // Position bush slightly above terrain height
  bush.position.set(x, getIslandHeight(x, z) + 0.4, z);

  // Enable shadows
  bush.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  scene.add(bush);
}

// ======== RANDOMIZED BUSHES ========
const BUSH_COUNT = 30;
for (let i = 0; i < BUSH_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 8 + Math.random() * 75; // evenly distributed
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 85 && dist > 5) createBush(x, z);
}

// ======== TREES & ROCKS ACROSS ISLAND ========
function createCoconutTree(x, z, heightBoost = 0) {
  const tree = new THREE.Group();

  const trunkHeight = 14 + Math.random() * 3 + heightBoost;
  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x8b5a2b,
    roughness: 0.8,
  });

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.7, trunkHeight, 12),
    trunkMat
  );
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  // Leaves
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0x1f6b2b,
    emissive: 0x143d18,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  const leafGeo = new THREE.PlaneGeometry(8, 2, 8, 1);
  for (let i = 0; i < 8; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    leaf.position.y = trunkHeight;
    leaf.rotation.y = (i * Math.PI * 2) / 8;
    leaf.rotation.z = -Math.PI / 4;

    const pos = leaf.geometry.attributes.position;
    for (let j = 0; j < pos.count; j++) {
      const lx = pos.getX(j);
      pos.setZ(j, Math.sin((lx / 8) * Math.PI) * 0.7);
    }
    pos.needsUpdate = true;

    leaf.castShadow = true;
    leaf.receiveShadow = true;
    tree.add(leaf);
  }

  // Coconuts
  const coconutGeo = new THREE.SphereGeometry(0.45, 16, 16);
  const coconutMat = new THREE.MeshStandardMaterial({ color: 0xa8d47a });
  for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
    const nut = new THREE.Mesh(coconutGeo, coconutMat);
    const angle = (i * Math.PI * 2) / 3;
    nut.position.set(
      Math.sin(angle) * 0.7,
      trunkHeight - 1.0,
      Math.cos(angle) * 0.7
    );
    nut.castShadow = true;
    nut.receiveShadow = true;
    tree.add(nut);
  }

  // Place tree on terrain
  const terrainY = getIslandHeight(x, z);
  tree.position.set(x, terrainY, z);

  tree.castShadow = true;
  tree.receiveShadow = true;

  scene.add(tree);
}

// ======== TREES RANDOMLY SPREAD ACROSS THE WHOLE ISLAND ========
// ======== RANDOMIZED TREES ========
const TREE_COUNT = 60;
for (let i = 0; i < TREE_COUNT; i++) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 8 + Math.pow(Math.random(), 1.2) * 75;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 85 && dist > 5) {
    const heightBoost = Math.random() * 1.5;
    createCoconutTree(x, z, heightBoost);
  }
}

// ======== RANDOMIZED ROCKS ========
for (let i = 0; i < 20; i++) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(2.5 + Math.random() * 2.5),
    new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 1.0,
      metalness: 0.2,
    })
  );
  const angle = Math.random() * Math.PI * 2;
  const radius = 8 + Math.random() * 78;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 85 && dist > 6) {
    rock.position.set(x, getIslandHeight(x, z), z);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
  }
}

// ======== SEA ========
const seaGeom = new THREE.PlaneGeometry(300, 300, 100, 100);
const seaMat = new THREE.MeshStandardMaterial({
  color: SEA_COLOR,
  transparent: true,
  opacity: 0.9,
  roughness: 0.8,
  metalness: 0.2,
});
const sea = new THREE.Mesh(seaGeom, seaMat);
sea.rotation.x = -Math.PI / 2;
sea.position.y = 0.3;
sea.receiveShadow = true;
scene.add(sea);

// ======== MODELS ========

let girlModel,
  girlController,
  chestModel,
  boat,
  dolphins = [];
let gameWon = false;

// ======== GIRL ========
loader.load("models/girl.glb", (gltf) => {
  girlModel = gltf.scene;
  const x = 0,
    z = 8;
  const y = getIslandHeight(x, z) + 2.4;
  girlModel.position.set(x, y, z);
  girlModel.scale.set(1, 1, 1);
  girlModel.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(girlModel);
  girlController = new CharacterController(girlModel, camera, true);
  spawnChestRandomly();
});

// ======== RANDOM CHEST SPAWN ========
function spawnChestRandomly() {
  if (chestModel) scene.remove(chestModel);
  loader.load("models/Chest-with-Gold.glb", (gltf) => {
    chestModel = gltf.scene;
    const angle = Math.random() * Math.PI * 2;
    const radius = 10 + Math.random() * 40;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = getIslandHeight(x, z) + 0.7;
    chestModel.position.set(x, y, z);
    chestModel.scale.set(1.5, 1.5, 1.5);
    chestModel.rotation.y = Math.random() * Math.PI * 2;
    chestModel.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    scene.add(chestModel);
  });
}
// ======== FAKE CHESTS ========
function addFakeChests() {
  const FAKE_CHEST_COUNT = 4;

  for (let i = 0; i < FAKE_CHEST_COUNT; i++) {
    loader.load("models/Chest.glb", (gltf) => {
      const fake = gltf.scene;
      let placed = false;
      while (!placed) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 10 + Math.random() * 75;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const dist = Math.sqrt(x * x + z * z);
        if (dist < 85) { // inside island
          const y = getIslandHeight(x, z) + 0.7;
          fake.position.set(x, y, z);
          fake.scale.set(1.3, 1.3, 1.3);
          fake.rotation.y = Math.random() * Math.PI * 2;
          fake.traverse(o => {
            if (o.isMesh) o.castShadow = o.receiveShadow = true;
          });
          scene.add(fake);
          placed = true;
        }
      }
    });
  }
}
addFakeChests(); // call once at load


// ======== BOATS ========

// 1️⃣ Main island boat (stationary, decorative)
loader.load("models/Boat.glb", (gltf) => {
  boat = gltf.scene;
  boat.scale.set(1.2, 1.2, 1.2);

  // Find a safe land position with enough space, not near trees
  const angle = Math.random() * Math.PI * 2;
  const radius = 20 + Math.random() * 40; // somewhere inland but not center
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = getIslandHeight(x, z) + 0.5;

  boat.position.set(x, y, z);
  boat.rotation.y = Math.random() * Math.PI * 2;

  boat.traverse(o => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(boat);
});


// 2️⃣ Shore boat (slightly bobbing on water near edge)
let shoreBoat;
loader.load("models/Boat.glb", (gltf) => {
  shoreBoat = gltf.scene;
  shoreBoat.scale.set(1.2, 1.2, 1.2);

  const angle = Math.random() * Math.PI * 2;
  const radius = 88; // near shore (island radius ≈ 90)
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = 0.35; // just above sea level

  shoreBoat.position.set(x, y, z);
  shoreBoat.rotation.y = Math.random() * Math.PI * 2;

  shoreBoat.traverse(o => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  scene.add(shoreBoat);
});

// ======== DOLPHINS ========
loader.load("models/Dolphin.glb", (gltf) => {
  const base = gltf.scene;
  base.scale.set(0.25, 0.25, 0.25);
  base.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));

  const dolphinCount = 14; // total dolphins
  const nearShoreCount = 2; // 1–2 near the island shore

  for (let i = 0; i < dolphinCount; i++) {
    const dolphin = base.clone();

    // 🐬 Decide zone
    const isNear = i < nearShoreCount;

    // Radii setup:
    // - Near dolphins: slightly away from shore (95–105)
    // - Mid dolphins: mid-distance zone (105–140)
    const radius = isNear
      ? 95 + Math.random() * 10 // near shore but not too close
      : 105 + Math.random() * 35; // mid-water zone (not too far)

    // Evenly spaced angles around island with randomness
    const angle = (i / dolphinCount) * Math.PI * 2 + Math.random() * 0.3;
    const centerX = Math.cos(angle) * radius;
    const centerZ = Math.sin(angle) * radius;

    // Slightly bigger swim zone for mid dolphins
    const swimRange = isNear ? 3 + Math.random() * 3 : 6 + Math.random() * 6;

    dolphin.position.set(centerX, 1.5, centerZ);
    dolphin.rotation.y = Math.atan2(-centerZ, -centerX);
    scene.add(dolphin);

    dolphins.push({
      mesh: dolphin,
      baseX: centerX,
      baseZ: centerZ,
      swimRange,
      diveSpeed: 1.5 + Math.random() * 1.5,
      diveHeight: 3 + Math.random() * 2,
      diveDepth: 2 + Math.random() * 1.5,
      offset: Math.random() * Math.PI * 2,
      isNear,
    });
  }
});


// ======== UI ========
const message = document.createElement("div");
message.textContent = "💎 Find the Treasure Chest!";
Object.assign(message.style, {
  position: "absolute",
  top: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  color: "#fff",
  fontFamily: "Poppins, sans-serif",
  fontSize: "22px",
  textShadow: "2px 2px 6px rgba(0,0,0,0.5)",
});
document.body.appendChild(message);

// Reset button
const resetBtn = document.createElement("button");
resetBtn.textContent = "🔄 Reset Game";
Object.assign(resetBtn.style, {
  position: "absolute",
  top: "60px",
  left: "50%",
  transform: "translateX(-50%)",
  padding: "10px 18px",
  borderRadius: "10px",
  background: "#fff",
  border: "none",
  cursor: "pointer",
});
document.body.appendChild(resetBtn);

resetBtn.onclick = () => {
  gameWon = false;
  message.textContent = "💎 Find the Treasure Chest!";
  message.style.color = "#fff";
  if (girlModel) girlModel.position.set(0, getIslandHeight(0, 8) + 2.4, 8);
  spawnChestRandomly();
};

// ======== CAMERA MODE BUTTONS ========
let overheadMode = false;
let isNight = false;
let moon = null;

const uiContainer = document.createElement("div");
Object.assign(uiContainer.style, {
  position: "absolute",
  top: "20px",
  right: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
});
document.body.appendChild(uiContainer);

// Overhead toggle
const overheadBtn = document.createElement("button");
overheadBtn.textContent = "🌍 Overhead View";
Object.assign(overheadBtn.style, {
  padding: "10px 18px",
  borderRadius: "10px",
  background: "#fff",
  border: "none",
  cursor: "pointer",
  fontWeight: "600",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  transition: "0.3s",
});
uiContainer.appendChild(overheadBtn);

// Night/Day toggle (hidden initially)
const nightBtn = document.createElement("button");
nightBtn.textContent = "🌙 Night Mode";
Object.assign(nightBtn.style, {
  padding: "10px 18px",
  borderRadius: "10px",
  background: "#fff",
  border: "none",
  cursor: "pointer",
  fontWeight: "600",
  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
  transition: "0.3s",
  display: "none",
});
uiContainer.appendChild(nightBtn);

// ======== NIGHT MODE LOGIC ========
nightBtn.onclick = () => {
  isNight = !isNight;
  if (isNight) {
    // 🌙 Night
    scene.background = new THREE.Color(SKY_NIGHT);
    scene.fog.color = new THREE.Color(SKY_NIGHT);
    ambientLight.intensity = 0.4;
    sunLight.intensity = 0.3;
    sun.visible = false;

    const moonGeo = new THREE.SphereGeometry(4, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xe6f0ff,
      emissive: 0x99ccff,
      emissiveIntensity: 0.7,
    });
    moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-80, 60, 60);
    scene.add(moon);

    toggleCampfire(true);

    nightBtn.textContent = "☀️ Day Mode";
    nightBtn.style.background = "#222";
    nightBtn.style.color = "#fff";
  } else {
    // ☀️ Day
    scene.background = new THREE.Color(SKY_DAY);
    scene.fog.color = new THREE.Color(SKY_DAY);
    ambientLight.intensity = 0.7;
    sunLight.intensity = 1.3;
    sun.visible = true;
    if (moon) scene.remove(moon);
    moon = null;

    toggleCampfire(false);

    nightBtn.textContent = "🌙 Night Mode";
    nightBtn.style.background = "#fff";
    nightBtn.style.color = "#000";
  }
};

// ======== OVERHEAD MODE LOGIC ========
overheadBtn.onclick = () => {
  overheadMode = !overheadMode;
  if (overheadMode) {
    overheadBtn.textContent = "🎮 Player View";
    nightBtn.style.display = "block";

    controls.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = true;
    controls.enableRotate = true;
    controls.enableZoom = true;
    controls.minDistance = 20;
    controls.maxDistance = 200;
    controls.minPolarAngle = Math.PI / 6;
    controls.maxPolarAngle = Math.PI / 2;
    controls.target.set(0, 0, 0);
    camera.position.set(80, 80, 80);
    camera.lookAt(0, 0, 0);
  } else {
    overheadBtn.textContent = "🌍 Overhead View";
    nightBtn.style.display = "none";
    controls.dispose();
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 5;
    controls.maxDistance = 60;
    camera.position.set(0, 10, 15);
  }
};

// ======== ANIMATION LOOP ========
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  const t = clock.getElapsedTime();

  controls.update();

  if (girlController && !gameWon && !overheadMode) {
  girlController.update(delta);

    // ======== BOUNDARY CONSTRAINT: keep girl on island ========
  const maxRadius = 77; // safe shore boundary inside island
  const pos = girlModel.position;
  const distanceFromCenter = Math.sqrt(pos.x * pos.x + pos.z * pos.z);

  if (distanceFromCenter > maxRadius) {
    // Push her gently back inside the boundary
    const angle = Math.atan2(pos.z, pos.x);
    pos.x = Math.cos(angle) * maxRadius;
    pos.z = Math.sin(angle) * maxRadius;
    // Keep her slightly above terrain height
    pos.y = getIslandHeight(pos.x, pos.z) + 2.4;
  } else {
    // Normal terrain following
    pos.y = getIslandHeight(pos.x, pos.z) + 2.4;
  }

  function getIslandHeight(x, z) {
  const dist = Math.sqrt(x * x + z * z);
  const baseHeight = Math.max(0, 4 - dist * 0.08);
  const wave = Math.sin(x * 0.1) * 0.15 + Math.cos(z * 0.1) * 0.1;
  return baseHeight + wave;
}

  if (chestModel && girlModel) {
    const dist = girlModel.position.distanceTo(chestModel.position);
    if (dist < 5 && !gameWon) {
      gameWon = true;
      message.textContent = "🎉 You found the Treasure!";
      message.style.color = "#FFD700";
    }
  }
}

  const posSea = seaGeom.attributes.position;
  for (let i = 0; i < posSea.count; i++) {
    const x = posSea.getX(i),
      y = posSea.getY(i);
    posSea.setZ(
      i,
      Math.sin(x * 0.05 + t * 0.8) * 0.08 + Math.cos(y * 0.06 + t * 0.7) * 0.06
    );
  }
  posSea.needsUpdate = true;

  // Stationary island boat (no bobbing)
if (boat) {
  // stays still, no movement
  boat.rotation.z = 0;
}

// Slightly bobbing shore boat
if (shoreBoat) {
  shoreBoat.position.y = 0.35 + Math.sin(t * 1.2) * 0.15;
  shoreBoat.rotation.z = Math.sin(t * 0.8) * 0.05;
}

  // ======== DOLPHINS ANIMATION (dive zones) ========
dolphins.forEach((d) => {
  const mesh = d.mesh;
  const time = t * d.diveSpeed + d.offset;

  // Horizontal swim motion inside small local range
  const localX = d.baseX + Math.sin(time * 0.5) * d.swimRange;
  const localZ = d.baseZ + Math.cos(time * 0.5) * d.swimRange;

  // Vertical dive motion (up + down under water)
  const diveY =
    0.5 + Math.sin(time * 2) * d.diveHeight - Math.abs(Math.cos(time * 1.2)) * d.diveDepth;

  mesh.position.set(localX, diveY, localZ);
  mesh.rotation.y = Math.atan2(-localZ, -localX);
});

  // Flicker flame only when visible (nighttime)
if (campfireFlame && campfireFlame.visible) {
  const scale = 1 + Math.sin(t * 10) * 0.1;
  campfireFlame.scale.set(scale, scale, scale);
}
  renderer.render(scene, camera);
}
animate();

// ======== RESIZE ========
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});  