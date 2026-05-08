import * as THREE from 'three';
import { PLAYER, moveAndCollide } from './physics.js';
import { raycastBlock } from './raycast.js';
import { BLOCK, blockData } from '../engine/blocks.js';

export class Player {
  constructor(world, camera, dom) {
    this.world = world;
    this.camera = camera;
    this.dom = dom;
    this.pos = new THREE.Vector3(0, 32, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.health = 10;
    this.maxHealth = 10;
    this.invulnTimer = 0;

    this.keys = new Set();
    this.mouseDown = { left: false, right: false };
    this.justClicked = { left: false, right: false };

    this.locked = false;
    this._setupInput();

    this.breakingTarget = null;
    this.breakingProgress = 0;
  }

  setSpawn() {
    const top = this.world.topOf(0, 0);
    this.pos.set(0.5, top + 1.1, 0.5);
    this.vel.set(0, 0, 0);
    this.health = this.maxHealth;
  }

  _setupInput() {
    document.addEventListener('keydown', (e) => {
      this.keys.add(e.code);
      if (e.code === 'Escape') this.locked = false;
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    this.dom.addEventListener('click', () => {
      if (!this.locked) this.dom.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      const lim = Math.PI / 2 - 0.01;
      if (this.pitch >  lim) this.pitch =  lim;
      if (this.pitch < -lim) this.pitch = -lim;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouseDown.left = true; this.justClicked.left = true; }
      if (e.button === 2) { this.mouseDown.right = true; this.justClicked.right = true; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown.left = false;
      if (e.button === 2) this.mouseDown.right = false;
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  forwardVec() {
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    return f;
  }
  rightVec() {
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return r;
  }
  lookVec() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  update(dt, gameApi) {
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // movement input
    const move = new THREE.Vector3();
    const f = this.forwardVec();
    const r = this.rightVec();
    if (this.keys.has('KeyW')) move.add(f);
    if (this.keys.has('KeyS')) move.sub(f);
    if (this.keys.has('KeyD')) move.add(r);
    if (this.keys.has('KeyA')) move.sub(r);
    if (move.lengthSq() > 0) move.normalize();

    const speed = this.keys.has('ShiftLeft') ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    this.vel.x = move.x * speed;
    this.vel.z = move.z * speed;
    this.vel.y += PLAYER.gravity * dt;

    if (this.keys.has('Space') && this.onGround) {
      this.vel.y = PLAYER.jumpVel;
      this.onGround = false;
    }

    const r2 = moveAndCollide(this.world, this.pos, this.vel, dt);
    this.onGround = r2.onGround;

    if (this.pos.y < -10) {
      this.takeDamage(this.maxHealth, gameApi);
    }

    // camera
    this.camera.position.set(this.pos.x, this.pos.y + PLAYER.eye, this.pos.z);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    // interaction
    this._handleInteraction(gameApi, dt);

    // clear edge clicks
    this.justClicked.left = false;
    this.justClicked.right = false;
  }

  takeDamage(amount, gameApi) {
    if (this.invulnTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.invulnTimer = 0.5;
    if (this.health <= 0 && gameApi?.onDeath) gameApi.onDeath();
  }

  _handleInteraction(gameApi, dt) {
    const eye = new THREE.Vector3(this.pos.x, this.pos.y + PLAYER.eye, this.pos.z);
    const dir = this.lookVec();
    const hit = raycastBlock(this.world, eye, dir, 6);
    gameApi.setHighlight(hit);

    if (!hit) {
      this.breakingTarget = null;
      this.breakingProgress = 0;
      return;
    }

    if (this.mouseDown.left) {
      const k = hit.block.x + ',' + hit.block.y + ',' + hit.block.z;
      if (!this.breakingTarget || this.breakingTarget !== k) {
        this.breakingTarget = k;
        this.breakingProgress = 0;
      }
      const bd = blockData(hit.id);
      this.breakingProgress += dt;
      if (this.breakingProgress >= bd.breakTime) {
        this.world.setBlockGlobal(hit.block.x, hit.block.y, hit.block.z, BLOCK.AIR);
        gameApi.onBlockBroken(hit.id, hit.block);
        this.breakingTarget = null;
        this.breakingProgress = 0;
      }
    } else {
      this.breakingTarget = null;
      this.breakingProgress = 0;
    }

    if (this.justClicked.right) {
      const px = hit.block.x + hit.normal.x;
      const py = hit.block.y + hit.normal.y;
      const pz = hit.block.z + hit.normal.z;
      // cannot place inside player bbox
      if (!this._intersectsPlayer(px, py, pz)) {
        const blockId = gameApi.getActiveBlock();
        if (blockId !== null) {
          this.world.setBlockGlobal(px, py, pz, blockId);
          gameApi.onBlockPlaced(blockId);
        }
      }
    }
  }

  _intersectsPlayer(bx, by, bz) {
    const half = PLAYER.width / 2;
    const minX = this.pos.x - half, maxX = this.pos.x + half;
    const minY = this.pos.y,        maxY = this.pos.y + PLAYER.height;
    const minZ = this.pos.z - half, maxZ = this.pos.z + half;
    return (bx + 1 > minX && bx < maxX &&
            by + 1 > minY && by < maxY &&
            bz + 1 > minZ && bz < maxZ);
  }
}
