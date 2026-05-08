import * as THREE from 'three';
import { BLOCK, BLOCKS, isSolid, isTransparent, blockData } from './blocks.js';
import { getUVs } from './textures.js';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 64;
export const SEA_LEVEL = 18;

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.size = CHUNK_SIZE;
    this.height = CHUNK_HEIGHT;
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    this.dirty = true;
    this.solidMesh = null;
    this.transMesh = null;
    this.modified = false;
  }

  idx(x, y, z) { return (y * CHUNK_SIZE + z) * CHUNK_SIZE + x; }
  get(x, y, z) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BLOCK.AIR;
    return this.data[this.idx(x, y, z)];
  }
  set(x, y, z, v) {
    if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
    this.data[this.idx(x, y, z)] = v;
    this.dirty = true;
    this.modified = true;
  }
}

// 6 faces: +x, -x, +y, -y, +z, -z
// For each face, define the 4 corner offsets (in cube-local space) and normal.
const FACES = [
  { // +x  (right)
    normal: [1, 0, 0], faceIdx: 0,
    corners: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 2, 1, 0, 3, 2]
  },
  { // -x  (left)
    normal: [-1, 0, 0], faceIdx: 1,
    corners: [[0, 0, 1], [0, 0, 0], [0, 1, 0], [0, 1, 1]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 2, 1, 0, 3, 2]
  },
  { // +y  (top)
    normal: [0, 1, 0], faceIdx: 2,
    corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 1, 2, 0, 2, 3]
  },
  { // -y  (bottom)
    normal: [0, -1, 0], faceIdx: 3,
    corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 1, 2, 0, 2, 3]
  },
  { // +z  (front)
    normal: [0, 0, 1], faceIdx: 4,
    corners: [[1, 0, 1], [0, 0, 1], [0, 1, 1], [1, 1, 1]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 2, 1, 0, 3, 2]
  },
  { // -z  (back)
    normal: [0, 0, -1], faceIdx: 5,
    corners: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]],
    uv: [[0, 0], [1, 0], [1, 1], [0, 1]],
    tri: [0, 2, 1, 0, 3, 2]
  }
];

function shouldRenderFace(self, neighbor) {
  if (self === BLOCK.AIR) return false;
  if (neighbor === BLOCK.AIR) return true;
  const sT = isTransparent(self), nT = isTransparent(neighbor);
  if (!nT) return false;
  if (self === neighbor) return false;
  return true;
}

const SHADE = [0.78, 0.78, 1.0, 0.55, 0.85, 0.85]; // per face

export function buildChunkGeometry(chunk, world) {
  const { cx, cz } = chunk;
  const ox = cx * CHUNK_SIZE, oz = cz * CHUNK_SIZE;

  const solid = { positions: [], normals: [], uvs: [], indices: [], colors: [] };
  const trans = { positions: [], normals: [], uvs: [], indices: [], colors: [] };

  function blockAt(x, y, z) {
    if (y < 0 || y >= CHUNK_HEIGHT) return BLOCK.AIR;
    if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE) return chunk.get(x, y, z);
    return world.getBlockGlobal(ox + x, y, oz + z);
  }

  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const id = chunk.get(x, y, z);
        if (id === BLOCK.AIR) continue;
        const bd = blockData(id);

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = x + face.normal[0];
          const ny = y + face.normal[1];
          const nz = z + face.normal[2];
          const nid = blockAt(nx, ny, nz);
          if (!shouldRenderFace(id, nid)) continue;

          const tex = bd.faces[face.faceIdx];
          const uvs = getUVs(tex);

          const target = bd.transparent ? trans : solid;
          const start = target.positions.length / 3;

          for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            target.positions.push(x + c[0], y + c[1], z + c[2]);
            target.normals.push(face.normal[0], face.normal[1], face.normal[2]);
            const u = face.uv[i][0], v = face.uv[i][1];
            target.uvs.push(
              uvs.u0 + (uvs.u1 - uvs.u0) * u,
              uvs.v0 + (uvs.v1 - uvs.v0) * v
            );
            const s = SHADE[f];
            target.colors.push(s, s, s);
          }
          for (const t of face.tri) target.indices.push(start + t);
        }
      }
    }
  }

  function makeGeom(buf) {
    if (buf.indices.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
    g.setAttribute('normal',   new THREE.Float32BufferAttribute(buf.normals, 3));
    g.setAttribute('uv',       new THREE.Float32BufferAttribute(buf.uvs, 2));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(buf.colors, 3));
    g.setIndex(buf.indices);
    g.computeBoundingSphere();
    return g;
  }

  return { solid: makeGeom(solid), trans: makeGeom(trans) };
}
