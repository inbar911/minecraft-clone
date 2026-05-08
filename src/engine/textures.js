// Procedural pixel textures packed into a single 16x16 atlas (4 tiles x 4 tiles).
import * as THREE from 'three';

const TILE = 16;
const COLS = 4;
const ROWS = 4;
const ATLAS_W = TILE * COLS;
const ATLAS_H = TILE * ROWS;

// Mapping name -> [col, row] in atlas
export const TEX = {
  grass_top:    [0, 0],
  grass_side:   [1, 0],
  dirt:         [2, 0],
  stone:        [3, 0],
  wood_side:    [0, 1],
  wood_top:     [1, 1],
  leaves:       [2, 1],
  planks:       [3, 1],
  sand:         [0, 2],
  water:        [1, 2],
  bedrock:      [2, 2],
  ct_side:      [3, 2],
  ct_top:       [0, 3]
};

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s * 1664525 + 1013904223) | 0; return ((s >>> 0) % 1000) / 1000; };
}

function fill(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function noisy(ctx, x, y, w, h, base, variance, seed) {
  const r = rng(seed);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const n = (r() - 0.5) * variance;
    const col = base.map(c => Math.max(0, Math.min(255, c + n))).map(Math.round);
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.fillRect(x + i, y + j, 1, 1);
  }
}

function drawGrassTop(ctx, x, y) { noisy(ctx, x, y, TILE, TILE, [80, 160, 60], 40, 1); }
function drawGrassSide(ctx, x, y) {
  noisy(ctx, x, y, TILE, TILE, [134, 96, 67], 30, 2);
  noisy(ctx, x, y, TILE, 4, [80, 160, 60], 50, 3);
  // jagged grass overhang
  const r = rng(4);
  for (let i = 0; i < TILE; i++) {
    const h = 3 + Math.floor(r() * 3);
    for (let j = 0; j < h; j++) {
      const c = [80 + (r() - 0.5) * 30, 160 + (r() - 0.5) * 30, 60 + (r() - 0.5) * 20];
      ctx.fillStyle = `rgb(${c[0]|0},${c[1]|0},${c[2]|0})`;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}
function drawDirt(ctx, x, y)    { noisy(ctx, x, y, TILE, TILE, [134, 96, 67], 30, 5); }
function drawStone(ctx, x, y)   { noisy(ctx, x, y, TILE, TILE, [128, 128, 128], 30, 6); }
function drawWoodSide(ctx, x, y){
  noisy(ctx, x, y, TILE, TILE, [104, 78, 50], 14, 7);
  // dark vertical grain
  for (let i = 0; i < TILE; i += 4) fill(ctx, x + i, y, 1, TILE, '#5a3f25');
}
function drawWoodTop(ctx, x, y) {
  noisy(ctx, x, y, TILE, TILE, [134, 100, 60], 18, 8);
  ctx.strokeStyle = '#5a3f25';
  ctx.beginPath(); ctx.arc(x + 8, y + 8, 5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2); ctx.stroke();
}
function drawLeaves(ctx, x, y) {
  noisy(ctx, x, y, TILE, TILE, [50, 110, 40], 50, 9);
  const r = rng(10);
  for (let k = 0; k < 8; k++) {
    fill(ctx, x + (r() * TILE)|0, y + (r() * TILE)|0, 1, 1, 'rgba(0,0,0,0.5)');
  }
}
function drawPlanks(ctx, x, y) {
  noisy(ctx, x, y, TILE, TILE, [180, 142, 90], 14, 11);
  for (let j = 0; j < TILE; j += 4) fill(ctx, x, y + j, TILE, 1, '#7a5a36');
  for (let j = 0; j < TILE; j += 4) {
    const split = (j / 4) % 2 === 0 ? TILE / 2 : 0;
    fill(ctx, x + split, y + j, 1, 4, '#7a5a36');
  }
}
function drawSand(ctx, x, y)    { noisy(ctx, x, y, TILE, TILE, [220, 200, 140], 20, 12); }
function drawWater(ctx, x, y)   { noisy(ctx, x, y, TILE, TILE, [60, 100, 220], 20, 13); }
function drawBedrock(ctx, x, y) { noisy(ctx, x, y, TILE, TILE, [50, 50, 50], 30, 14); }
function drawCtSide(ctx, x, y)  {
  drawPlanks(ctx, x, y);
  fill(ctx, x, y + 4, TILE, 1, '#3a2a1a');
  ctx.fillStyle = '#3a2a1a';
  for (let i = 2; i < TILE - 2; i += 2) fill(ctx, x + i, y + 6, 1, 4, '#3a2a1a');
}
function drawCtTop(ctx, x, y) {
  drawPlanks(ctx, x, y);
  ctx.fillStyle = '#3a2a1a';
  for (let i = 0; i < 9; i++) {
    const cx = x + 1 + (i % 3) * 5;
    const cy = y + 1 + ((i / 3) | 0) * 5;
    ctx.strokeStyle = '#3a2a1a';
    ctx.strokeRect(cx + 0.5, cy + 0.5, 4, 4);
  }
}

const drawers = {
  grass_top: drawGrassTop, grass_side: drawGrassSide, dirt: drawDirt, stone: drawStone,
  wood_side: drawWoodSide, wood_top: drawWoodTop, leaves: drawLeaves, planks: drawPlanks,
  sand: drawSand, water: drawWater, bedrock: drawBedrock, ct_side: drawCtSide, ct_top: drawCtTop
};

let _atlas = null;
let _texture = null;

export function buildAtlas() {
  if (_atlas) return { canvas: _atlas, texture: _texture, tile: TILE, cols: COLS, rows: ROWS };
  const c = document.createElement('canvas');
  c.width = ATLAS_W; c.height = ATLAS_H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  for (const [name, [col, row]] of Object.entries(TEX)) {
    const fn = drawers[name];
    if (fn) fn(ctx, col * TILE, row * TILE);
    else { fill(ctx, col * TILE, row * TILE, TILE, TILE, '#f0f'); }
  }
  _atlas = c;
  _texture = new THREE.CanvasTexture(c);
  _texture.magFilter = THREE.NearestFilter;
  _texture.minFilter = THREE.NearestFilter;
  _texture.wrapS = _texture.wrapT = THREE.ClampToEdgeWrapping;
  _texture.colorSpace = THREE.SRGBColorSpace;
  _texture.needsUpdate = true;
  return { canvas: c, texture: _texture, tile: TILE, cols: COLS, rows: ROWS };
}

export function getUVs(name) {
  const [col, row] = TEX[name] || [0, 0];
  // Inset by half-pixel to avoid bleeding.
  const eps = 0.001;
  const u0 = (col * TILE) / ATLAS_W + eps;
  const v0 = 1 - ((row + 1) * TILE) / ATLAS_H + eps;
  const u1 = ((col + 1) * TILE) / ATLAS_W - eps;
  const v1 = 1 - (row * TILE) / ATLAS_H - eps;
  return { u0, v0, u1, v1 };
}

// 32x32 icon canvas extracted from atlas tile (for UI).
export function tileIcon(name, size = 32) {
  const atlas = buildAtlas().canvas;
  const [col, row] = TEX[name] || [0, 0];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(atlas, col * TILE, row * TILE, TILE, TILE, 0, 0, size, size);
  return c.toDataURL();
}
