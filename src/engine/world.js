import * as THREE from 'three';
import { BLOCK, blockData, isSolid } from './blocks.js';
import { Chunk, CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, buildChunkGeometry } from './chunk.js';
import { Noise, hash2i } from './noise.js';
import { buildAtlas } from './textures.js';

export const BIOME = { PLAINS: 0, FOREST: 1, MOUNTAINS: 2, DESERT: 3 };

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.seed = seed;
    this.heightNoise = new Noise(seed);
    this.biomeNoise = new Noise(seed + 1);
    this.detailNoise = new Noise(seed + 2);
    this.chunks = new Map();          // key "cx,cz" -> Chunk
    this.modifications = new Map();   // key "x,y,z" -> blockId, persisted
    this.viewDistance = 4;            // chunks (radius)

    const { texture } = buildAtlas();
    this.atlasTexture = texture;
    this.solidMaterial = new THREE.MeshLambertMaterial({
      map: texture, vertexColors: true, side: THREE.FrontSide
    });
    this.transMaterial = new THREE.MeshLambertMaterial({
      map: texture, vertexColors: true, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: false
    });

    this._meshQueue = [];
    this._meshTimer = 0;
  }

  key(cx, cz) { return cx + ',' + cz; }

  // -------- Generation --------
  biomeAt(x, z) {
    const n = this.biomeNoise.fbm2(x * 0.005, z * 0.005, 3);
    if (n > 0.45) return BIOME.MOUNTAINS;
    if (n > 0.0)  return BIOME.FOREST;
    if (n > -0.4) return BIOME.PLAINS;
    return BIOME.DESERT;
  }

  heightAt(x, z) {
    const biome = this.biomeAt(x, z);
    const base = this.heightNoise.fbm2(x * 0.012, z * 0.012, 4);
    const detail = this.detailNoise.fbm2(x * 0.05, z * 0.05, 2) * 0.3;
    let h;
    if (biome === BIOME.MOUNTAINS) {
      h = SEA_LEVEL + 6 + Math.floor((base * 0.5 + 0.5) * 28 + detail * 6);
    } else if (biome === BIOME.FOREST) {
      h = SEA_LEVEL + 3 + Math.floor((base * 0.5 + 0.5) * 8 + detail * 2);
    } else if (biome === BIOME.PLAINS) {
      h = SEA_LEVEL + 2 + Math.floor((base * 0.5 + 0.5) * 4 + detail * 1.5);
    } else {
      h = SEA_LEVEL + 1 + Math.floor((base * 0.5 + 0.5) * 4 + detail * 1.5);
    }
    return Math.max(1, Math.min(CHUNK_HEIGHT - 4, h));
  }

  surfaceBlock(biome) {
    if (biome === BIOME.DESERT) return BLOCK.SAND;
    return BLOCK.GRASS;
  }
  subSurfaceBlock(biome) {
    if (biome === BIOME.DESERT) return BLOCK.SAND;
    return BLOCK.DIRT;
  }

  generateChunk(cx, cz) {
    const ch = new Chunk(cx, cz);
    const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        const biome = this.biomeAt(wx, wz);
        const h = this.heightAt(wx, wz);
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          if (y === 0) ch.set(x, y, z, BLOCK.BEDROCK);
          else if (y < h - 3) ch.set(x, y, z, BLOCK.STONE);
          else if (y < h)     ch.set(x, y, z, this.subSurfaceBlock(biome));
          else if (y === h)   ch.set(x, y, z, this.surfaceBlock(biome));
          else if (y <= SEA_LEVEL) ch.set(x, y, z, BLOCK.WATER);
        }
      }
    }
    // Trees
    if (this.biomeAt(ox + 8, oz + 8) === BIOME.FOREST) {
      this.placeTrees(ch, ox, oz, 5);
    } else if (this.biomeAt(ox + 8, oz + 8) === BIOME.PLAINS) {
      this.placeTrees(ch, ox, oz, 1);
    }
    // Apply persisted modifications inside this chunk
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const wx = ox + x, wz = oz + z;
        for (let y = 0; y < CHUNK_HEIGHT; y++) {
          const k = wx + ',' + y + ',' + wz;
          if (this.modifications.has(k)) {
            ch.set(x, y, z, this.modifications.get(k));
          }
        }
      }
    }
    ch.modified = false;
    return ch;
  }

  placeTrees(chunk, ox, oz, count) {
    for (let i = 0; i < count; i++) {
      const r1 = hash2i(ox + i * 17, oz + i * 31, this.seed);
      const r2 = hash2i(ox + i * 23, oz + i * 41, this.seed + 7);
      const lx = 2 + Math.floor(r1 * (CHUNK_SIZE - 4));
      const lz = 2 + Math.floor(r2 * (CHUNK_SIZE - 4));
      const wx = ox + lx, wz = oz + lz;
      const biome = this.biomeAt(wx, wz);
      if (biome === BIOME.DESERT || biome === BIOME.MOUNTAINS) continue;
      const h = this.heightAt(wx, wz);
      if (h < SEA_LEVEL + 1) continue;
      const trunkH = 4 + Math.floor(hash2i(wx, wz, 99) * 3);
      // trunk
      for (let y = 0; y < trunkH; y++) chunk.set(lx, h + 1 + y, lz, BLOCK.WOOD);
      // canopy: 5x5 base, 3x3 top
      const topY = h + 1 + trunkH;
      for (let dy = -2; dy <= 1; dy++) {
        const r = (dy <= -1) ? 2 : 1;
        for (let dz = -r; dz <= r; dz++) {
          for (let dx = -r; dx <= r; dx++) {
            if (dx === 0 && dz === 0 && dy < 1) continue;
            const ax = lx + dx, ay = topY + dy, az = lz + dz;
            if (ax < 0 || ax >= CHUNK_SIZE || az < 0 || az >= CHUNK_SIZE || ay < 0 || ay >= CHUNK_HEIGHT) continue;
            if (chunk.get(ax, ay, az) === BLOCK.AIR) chunk.set(ax, ay, az, BLOCK.LEAVES);
          }
        }
      }
    }
  }

  // -------- Chunk lifecycle --------
  ensureChunk(cx, cz) {
    const k = this.key(cx, cz);
    if (this.chunks.has(k)) return this.chunks.get(k);
    const ch = this.generateChunk(cx, cz);
    this.chunks.set(k, ch);
    this._meshQueue.push(ch);
    return ch;
  }

  removeChunk(cx, cz) {
    const k = this.key(cx, cz);
    const ch = this.chunks.get(k);
    if (!ch) return;
    if (ch.solidMesh) { this.scene.remove(ch.solidMesh); ch.solidMesh.geometry.dispose(); }
    if (ch.transMesh) { this.scene.remove(ch.transMesh); ch.transMesh.geometry.dispose(); }
    this.chunks.delete(k);
  }

  rebuildMesh(chunk) {
    const { solid, trans } = buildChunkGeometry(chunk, this);
    const ox = chunk.cx * CHUNK_SIZE, oz = chunk.cz * CHUNK_SIZE;

    if (chunk.solidMesh) { this.scene.remove(chunk.solidMesh); chunk.solidMesh.geometry.dispose(); chunk.solidMesh = null; }
    if (chunk.transMesh) { this.scene.remove(chunk.transMesh); chunk.transMesh.geometry.dispose(); chunk.transMesh = null; }

    if (solid) {
      const m = new THREE.Mesh(solid, this.solidMaterial);
      m.position.set(ox, 0, oz);
      m.castShadow = false; m.receiveShadow = false;
      this.scene.add(m);
      chunk.solidMesh = m;
    }
    if (trans) {
      const m = new THREE.Mesh(trans, this.transMaterial);
      m.position.set(ox, 0, oz);
      this.scene.add(m);
      chunk.transMesh = m;
    }
    chunk.dirty = false;
  }

  // Update visible chunks around (px, pz) world coordinates
  updateAround(px, pz) {
    const ccx = Math.floor(px / CHUNK_SIZE);
    const ccz = Math.floor(pz / CHUNK_SIZE);
    const r = this.viewDistance;
    const need = new Set();
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const cx = ccx + dx, cz = ccz + dz;
        need.add(this.key(cx, cz));
        if (!this.chunks.has(this.key(cx, cz))) this.ensureChunk(cx, cz);
      }
    }
    for (const k of [...this.chunks.keys()]) {
      if (!need.has(k)) {
        const [cx, cz] = k.split(',').map(Number);
        this.removeChunk(cx, cz);
      }
    }
  }

  // Process mesh queue, capped per frame
  processMeshQueue(maxPerFrame = 2) {
    let n = 0;
    while (this._meshQueue.length && n < maxPerFrame) {
      const ch = this._meshQueue.shift();
      if (this.chunks.get(this.key(ch.cx, ch.cz)) !== ch) continue;
      if (ch.dirty) this.rebuildMesh(ch);
      n++;
    }
  }

  markDirty(cx, cz) {
    const c = this.chunks.get(this.key(cx, cz));
    if (c && !this._meshQueue.includes(c)) {
      c.dirty = true;
      this._meshQueue.push(c);
    }
  }

  // -------- Block read/write (world coords) --------
  getBlockGlobal(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return BLOCK.AIR;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    return ch.get(lx, y, lz);
  }

  setBlockGlobal(x, y, z, id) {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    const ch = this.chunks.get(this.key(cx, cz));
    if (!ch) return;
    const lx = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const lz = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    if (ch.get(lx, y, lz) === id) return;
    ch.set(lx, y, lz, id);
    this.modifications.set(x + ',' + y + ',' + z, id);
    this.markDirty(cx, cz);
    if (lx === 0)               this.markDirty(cx - 1, cz);
    if (lx === CHUNK_SIZE - 1)  this.markDirty(cx + 1, cz);
    if (lz === 0)               this.markDirty(cx, cz - 1);
    if (lz === CHUNK_SIZE - 1)  this.markDirty(cx, cz + 1);
  }

  // returns top non-air Y at column (x,z); used for spawn
  topOf(x, z) {
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (isSolid(this.getBlockGlobal(x, y, z))) return y;
    }
    return 0;
  }
}
