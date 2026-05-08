import * as THREE from 'three';
import { isSolid } from '../engine/blocks.js';
import { moveAndCollide, PLAYER } from '../player/physics.js';

// Lightweight ECS-ish mob system. Each mob is { components } and shares an update step.

let _id = 0;
function newId() { return ++_id; }

function makeBoxMaterial(color) {
  return new THREE.MeshLambertMaterial({ color, vertexColors: false });
}

function makeBlockyMob({ size, parts, color }) {
  const root = new THREE.Group();
  for (const p of parts) {
    const g = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
    const m = new THREE.Mesh(g, makeBoxMaterial(p.color || color));
    m.position.set(p.pos[0], p.pos[1], p.pos[2]);
    root.add(m);
  }
  return root;
}

function makeSheep() {
  return makeBlockyMob({
    color: 0xffffff,
    parts: [
      { size: [0.9, 0.7, 1.2], pos: [0, 0.7, 0], color: 0xefefef }, // body
      { size: [0.5, 0.5, 0.5], pos: [0, 1.1, 0.7], color: 0xeeddcc }, // head
      { size: [0.2, 0.5, 0.2], pos: [-0.3, 0.25, 0.4], color: 0xcccccc },
      { size: [0.2, 0.5, 0.2], pos: [ 0.3, 0.25, 0.4], color: 0xcccccc },
      { size: [0.2, 0.5, 0.2], pos: [-0.3, 0.25,-0.4], color: 0xcccccc },
      { size: [0.2, 0.5, 0.2], pos: [ 0.3, 0.25,-0.4], color: 0xcccccc }
    ]
  });
}
function makeCow() {
  return makeBlockyMob({
    color: 0x6b3a1a,
    parts: [
      { size: [1.0, 0.8, 1.4], pos: [0, 0.7, 0], color: 0x4d2d12 },
      { size: [0.6, 0.6, 0.6], pos: [0, 1.0, 0.85], color: 0x6b3a1a },
      { size: [0.25, 0.6, 0.25], pos: [-0.35, 0.3, 0.5] },
      { size: [0.25, 0.6, 0.25], pos: [ 0.35, 0.3, 0.5] },
      { size: [0.25, 0.6, 0.25], pos: [-0.35, 0.3,-0.5] },
      { size: [0.25, 0.6, 0.25], pos: [ 0.35, 0.3,-0.5] }
    ]
  });
}
function makeZombie() {
  return makeBlockyMob({
    color: 0x4f7a3a,
    parts: [
      { size: [0.6, 1.2, 0.4], pos: [0, 1.1, 0], color: 0x2f5a2a }, // body
      { size: [0.55, 0.55, 0.55], pos: [0, 1.95, 0], color: 0x6c8c4a }, // head
      { size: [0.25, 1.0, 0.25], pos: [-0.45, 1.0, 0], color: 0x2f5a2a },
      { size: [0.25, 1.0, 0.25], pos: [ 0.45, 1.0, 0], color: 0x2f5a2a },
      { size: [0.28, 1.0, 0.28], pos: [-0.18, 0.0, 0], color: 0x2c3a18 },
      { size: [0.28, 1.0, 0.28], pos: [ 0.18, 0.0, 0], color: 0x2c3a18 }
    ]
  });
}

const MOB_TYPES = {
  sheep: { make: makeSheep, hostile: false, hp: 8, speed: 1.2, sight: 12, attack: 0 },
  cow:   { make: makeCow,   hostile: false, hp: 10, speed: 1.0, sight: 12, attack: 0 },
  zombie:{ make: makeZombie, hostile: true, hp: 16, speed: 2.4, sight: 16, attack: 1 }
};

export class MobSystem {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.mobs = [];
  }

  spawn(type, x, y, z) {
    const def = MOB_TYPES[type];
    if (!def) return null;
    const root = def.make();
    root.position.set(x, y, z);
    this.scene.add(root);
    const m = {
      id: newId(),
      type,
      def,
      hp: def.hp,
      pos: new THREE.Vector3(x, y, z),
      vel: new THREE.Vector3(),
      yaw: Math.random() * Math.PI * 2,
      onGround: false,
      group: root,
      wanderTimer: 0,
      attackCooldown: 0,
      bobT: Math.random() * 10
    };
    this.mobs.push(m);
    return m;
  }

  spawnAround(player, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 8 + Math.random() * 12;
      const wx = player.pos.x + Math.cos(angle) * r;
      const wz = player.pos.z + Math.sin(angle) * r;
      const ix = Math.floor(wx), iz = Math.floor(wz);
      const top = this.world.topOf(ix, iz);
      const sun = top + 1.0;
      const types = ['sheep', 'cow', 'zombie'];
      const t = types[Math.floor(Math.random() * types.length)];
      this.spawn(t, ix + 0.5, sun, iz + 0.5);
    }
  }

  damageMob(mob, dmg) {
    mob.hp -= dmg;
    if (mob.hp <= 0) this._kill(mob);
  }

  _kill(mob) {
    this.scene.remove(mob.group);
    mob.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose && o.material.dispose(); });
    const i = this.mobs.indexOf(mob);
    if (i >= 0) this.mobs.splice(i, 1);
  }

  update(dt, player, gameApi) {
    for (const m of [...this.mobs]) this._updateMob(m, dt, player, gameApi);
  }

  _updateMob(m, dt, player, gameApi) {
    // gravity
    m.vel.y += -28 * dt;

    if (m.def.hostile) {
      const dx = player.pos.x - m.pos.x;
      const dz = player.pos.z - m.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < m.def.sight) {
        const len = Math.max(0.0001, dist);
        m.vel.x = (dx / len) * m.def.speed;
        m.vel.z = (dz / len) * m.def.speed;
        m.yaw = Math.atan2(dx, dz);
        if (dist < 1.4) {
          if (m.attackCooldown <= 0) {
            player.takeDamage(m.def.attack, gameApi);
            m.attackCooldown = 1.0;
          }
        }
      } else {
        this._wander(m, dt);
      }
    } else {
      this._wander(m, dt);
    }
    if (m.attackCooldown > 0) m.attackCooldown -= dt;

    // jump if blocked horizontally (climb 1-block steps)
    const front = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
    const fx = Math.floor(m.pos.x + front.x * 0.6);
    const fz = Math.floor(m.pos.z + front.z * 0.6);
    const fy = Math.floor(m.pos.y);
    if (m.onGround && isSolid(this.world.getBlockGlobal(fx, fy, fz))) {
      m.vel.y = 7.5;
    }

    const r = moveAndCollide(this.world, m.pos, m.vel, dt);
    m.onGround = r.onGround;

    // rotate group to yaw, bob slightly
    m.bobT += dt * (m.vel.x !== 0 || m.vel.z !== 0 ? 6 : 1.5);
    m.group.position.copy(m.pos);
    m.group.rotation.y = m.yaw + Math.PI;
    const bob = Math.sin(m.bobT) * 0.06;
    m.group.position.y = m.pos.y + bob;

    // despawn if too far
    const dx = player.pos.x - m.pos.x, dz = player.pos.z - m.pos.z;
    if (dx * dx + dz * dz > 80 * 80) this._kill(m);
  }

  _wander(m, dt) {
    m.wanderTimer -= dt;
    if (m.wanderTimer <= 0) {
      m.yaw = Math.random() * Math.PI * 2;
      m.wanderTimer = 2 + Math.random() * 4;
      const moving = Math.random() > 0.4;
      if (moving) {
        m.vel.x = Math.sin(m.yaw) * m.def.speed * 0.6;
        m.vel.z = Math.cos(m.yaw) * m.def.speed * 0.6;
      } else {
        m.vel.x = 0; m.vel.z = 0;
      }
    }
  }

  count() { return this.mobs.length; }
}
