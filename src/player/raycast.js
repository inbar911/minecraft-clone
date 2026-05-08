import { isSolid } from '../engine/blocks.js';
import { BLOCK } from '../engine/blocks.js';

// Voxel DDA raycast (Amanatides-Woo).
// Returns { hit, block, normal, dist } or null.
export function raycastBlock(world, origin, dir, maxDist = 6) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : (dir.x < 0 ? -1 : 0);
  const stepY = dir.y > 0 ? 1 : (dir.y < 0 ? -1 : 0);
  const stepZ = dir.z > 0 ? 1 : (dir.z < 0 ? -1 : 0);

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  function frac(v) { return v - Math.floor(v); }
  let tMaxX = stepX > 0 ? (1 - frac(origin.x)) * tDeltaX : (stepX < 0 ? frac(origin.x) * tDeltaX : Infinity);
  let tMaxY = stepY > 0 ? (1 - frac(origin.y)) * tDeltaY : (stepY < 0 ? frac(origin.y) * tDeltaY : Infinity);
  let tMaxZ = stepZ > 0 ? (1 - frac(origin.z)) * tDeltaZ : (stepZ < 0 ? frac(origin.z) * tDeltaZ : Infinity);

  let normal = { x: 0, y: 0, z: 0 };
  let t = 0;
  for (let i = 0; i < 256; i++) {
    const id = world.getBlockGlobal(x, y, z);
    if (isSolid(id) && id !== BLOCK.WATER) {
      return { block: { x, y, z }, id, normal, dist: t };
    }
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX; normal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY; normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ; normal = { x: 0, y: 0, z: -stepZ };
    }
    if (t > maxDist) return null;
  }
  return null;
}
