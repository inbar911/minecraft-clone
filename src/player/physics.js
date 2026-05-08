import { isSolid } from '../engine/blocks.js';

// AABB collision against voxel grid.
// Player AABB centered on (x, y_feet + height/2, z), w x h x d.
export const PLAYER = {
  width: 0.6,
  height: 1.8,
  eye: 1.62,
  walkSpeed: 4.3,
  sprintSpeed: 6.0,
  jumpVel: 8.6,
  gravity: -28
};

function blockSolid(world, x, y, z) {
  return isSolid(world.getBlockGlobal(x, y, z));
}

// pos = feet position (bottom-center of AABB). Returns adjusted position + flags.
export function moveAndCollide(world, pos, vel, dt) {
  const w = PLAYER.width, h = PLAYER.height;
  const half = w / 2;

  let onGround = false;

  function collideAxis(axis) {
    const dv = vel[axis] * dt;
    pos[axis] += dv;

    const minX = pos.x - half, maxX = pos.x + half;
    const minY = pos.y,        maxY = pos.y + h;
    const minZ = pos.z - half, maxZ = pos.z + half;

    const ix0 = Math.floor(minX), ix1 = Math.floor(maxX);
    const iy0 = Math.floor(minY), iy1 = Math.floor(maxY);
    const iz0 = Math.floor(minZ), iz1 = Math.floor(maxZ);

    for (let y = iy0; y <= iy1; y++) {
      for (let z = iz0; z <= iz1; z++) {
        for (let x = ix0; x <= ix1; x++) {
          if (!blockSolid(world, x, y, z)) continue;

          if (axis === 'y') {
            if (dv > 0) { pos.y = y - h - 0.0001; vel.y = 0; }
            else if (dv < 0) { pos.y = y + 1 + 0.0001; vel.y = 0; onGround = true; }
          } else if (axis === 'x') {
            if (dv > 0) { pos.x = x - half - 0.0001; vel.x = 0; }
            else if (dv < 0) { pos.x = x + 1 + half + 0.0001; vel.x = 0; }
          } else if (axis === 'z') {
            if (dv > 0) { pos.z = z - half - 0.0001; vel.z = 0; }
            else if (dv < 0) { pos.z = z + 1 + half + 0.0001; vel.z = 0; }
          }
        }
      }
    }
  }

  collideAxis('y');
  collideAxis('x');
  collideAxis('z');

  return { onGround };
}
