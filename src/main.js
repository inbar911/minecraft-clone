import * as THREE from 'three';
import { World } from './engine/world.js';
import { Player } from './player/controls.js';
import { Inventory } from './systems/inventory.js';
import { MobSystem } from './systems/mobs.js';
import { Hud } from './ui/hud.js';
import { InventoryUi } from './ui/inventory-ui.js';
import { saveGame, loadGame } from './systems/save.js';
import { BLOCK, blockData } from './engine/blocks.js';

const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const death = document.getElementById('death');
const respawnBtn = document.getElementById('respawn');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setClearColor(0x88c0ff);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88c0ff);
scene.fog = new THREE.Fog(0x88c0ff, 30, 110);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
camera.position.set(0, 30, 0);

// --- Lighting ---
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff5d6, 1.0);
sun.position.set(60, 100, 40);
scene.add(sun);
const sunTarget = new THREE.Object3D();
scene.add(sunTarget);
sun.target = sunTarget;

// --- Save load ---
const saved = loadGame();

// --- Systems ---
const world = new World(scene, saved?.seed || 1337);
if (saved?.modifications) {
  for (const [k, id] of Object.entries(saved.modifications)) {
    world.modifications.set(k, id);
  }
}

const inventory = new Inventory();
if (saved?.inventory) inventory.load(saved.inventory);

const player = new Player(world, camera, canvas);
if (saved?.player) {
  player.pos.set(saved.player.pos.x, saved.player.pos.y, saved.player.pos.z);
  player.yaw = saved.player.yaw;
  player.pitch = saved.player.pitch;
  player.health = saved.player.health ?? player.maxHealth;
} else {
  // generate spawn area first
  world.updateAround(0, 0);
  while (world._meshQueue.length) world.processMeshQueue(8);
  player.setSpawn();
}

const hud = new Hud(inventory);
const invUi = new InventoryUi(inventory, hud);

const mobs = new MobSystem(world, scene);

// --- Selection highlight ---
const highlightGeom = new THREE.BoxGeometry(1.001, 1.001, 1.001);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.5 });
const highlight = new THREE.Mesh(highlightGeom, highlightMat);
highlight.visible = false;
scene.add(highlight);

// --- Game API exposed to subsystems ---
const gameApi = {
  setHighlight(hit) {
    if (!hit) { highlight.visible = false; return; }
    highlight.visible = true;
    highlight.position.set(hit.block.x + 0.5, hit.block.y + 0.5, hit.block.z + 0.5);
  },
  getActiveBlock() {
    return inventory.getActiveBlock();
  },
  onBlockBroken(id, pos) {
    if (id !== BLOCK.AIR) inventory.tryAdd(id, 1);
    hud.refresh();
  },
  onBlockPlaced(id) {
    inventory.consumeActive(1);
    hud.refresh();
  },
  onDeath() {
    death.classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock();
  }
};

respawnBtn.addEventListener('click', () => {
  death.classList.add('hidden');
  player.setSpawn();
  hud.setHealth(player.health, player.maxHealth);
  canvas.requestPointerLock();
});

// --- Day/night ---
let timeOfDay = 0.25; // 0..1, 0.25 = morning
const DAY_LEN = 240; // seconds for full day

function updateDayNight(dt) {
  timeOfDay += dt / DAY_LEN;
  if (timeOfDay >= 1) timeOfDay -= 1;
  const angle = timeOfDay * Math.PI * 2;
  const sx = Math.cos(angle);
  const sy = Math.sin(angle);
  sun.position.set(sx * 200, sy * 200 + 20, 80);
  // brightness from sun height
  const h = Math.max(-0.2, sy);
  const day = Math.max(0, h);
  sun.intensity = 0.2 + day * 0.9;
  ambient.intensity = 0.25 + day * 0.45;
  // sky color
  const dayCol = new THREE.Color(0x88c0ff);
  const nightCol = new THREE.Color(0x0a0e1f);
  const dawnCol = new THREE.Color(0xff9a5b);
  let sky;
  if (h < 0) {
    sky = nightCol;
  } else if (h < 0.15) {
    sky = nightCol.clone().lerp(dawnCol, h / 0.15);
  } else if (h < 0.35) {
    sky = dawnCol.clone().lerp(dayCol, (h - 0.15) / 0.20);
  } else {
    sky = dayCol;
  }
  scene.background = sky;
  scene.fog.color = sky;
  renderer.setClearColor(sky);
}

// --- Mob spawn pacing ---
let mobTimer = 0;
function spawnPulse(dt) {
  mobTimer -= dt;
  if (mobTimer <= 0 && mobs.count() < 12) {
    mobs.spawnAround(player, 4);
    mobTimer = 12;
  }
}

// --- Save ---
function persist() {
  const mods = {};
  for (const [k, v] of world.modifications) mods[k] = v;
  saveGame({
    seed: world.seed,
    modifications: mods,
    inventory: inventory.serialize(),
    player: {
      pos: { x: player.pos.x, y: player.pos.y, z: player.pos.z },
      yaw: player.yaw, pitch: player.pitch, health: player.health
    }
  });
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'KeyF') { persist(); flash('Saved'); }
});
window.addEventListener('beforeunload', persist);

let flashEl = null;
function flash(text) {
  if (!flashEl) {
    flashEl = document.createElement('div');
    flashEl.style.cssText = 'position:absolute;top:60px;left:50%;transform:translateX(-50%);padding:6px 12px;background:rgba(0,0,0,.6);color:#fff;font-family:monospace;font-size:12px;pointer-events:none;';
    document.querySelector('#app').appendChild(flashEl);
  }
  flashEl.textContent = text;
  flashEl.style.opacity = 1;
  clearTimeout(flashEl._t);
  flashEl._t = setTimeout(() => { flashEl.style.opacity = 0; }, 1200);
}

// --- Resize ---
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

// --- Show overlay if not yet locked ---
overlay.classList.remove('hidden');
overlay.addEventListener('click', () => {
  overlay.classList.add('hidden');
  canvas.requestPointerLock();
});

// --- Init: render hud + initial chunks ---
hud.setHealth(player.health, player.maxHealth);
hud.refresh();
world.updateAround(player.pos.x, player.pos.z);

// --- Game loop ---
let prev = performance.now();
let lastChunkUpdate = 0;
let fpsAcc = 0, fpsCount = 0, fpsT = 0;
let displayFps = 60;

function loop(now) {
  const rawDt = (now - prev) / 1000;
  prev = now;
  const dt = Math.min(0.05, rawDt);

  if (!invUi.isOpen()) {
    player.update(dt, gameApi);
    mobs.update(dt, player, gameApi);
  }

  lastChunkUpdate += dt;
  if (lastChunkUpdate > 0.25) {
    world.updateAround(player.pos.x, player.pos.z);
    lastChunkUpdate = 0;
  }
  world.processMeshQueue(2);

  spawnPulse(dt);
  updateDayNight(dt);

  hud.setHealth(player.health, player.maxHealth);
  fpsAcc += rawDt; fpsCount++; fpsT += rawDt;
  if (fpsT > 0.5) { displayFps = fpsCount / fpsAcc; fpsAcc = 0; fpsCount = 0; fpsT = 0; }
  hud.setCoords(player.pos.x, player.pos.y, player.pos.z, displayFps);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
