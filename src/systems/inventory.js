import { BLOCK, BLOCKS } from '../engine/blocks.js';

export const STACK_MAX = 64;
export const HOTBAR_SLOTS = 9;
export const INV_ROWS = 3;
export const INV_COLS = 9;
export const INV_TOTAL = HOTBAR_SLOTS + INV_ROWS * INV_COLS; // 9 hotbar + 27 main

export class Inventory {
  constructor() {
    // slot 0..8 = hotbar, 9..35 = main grid
    this.slots = Array(INV_TOTAL).fill(null); // null | { id, count }
    this.activeSlot = 0;

    // Default starter kit
    this.tryAdd(BLOCK.GRASS, 16);
    this.tryAdd(BLOCK.DIRT, 16);
    this.tryAdd(BLOCK.STONE, 16);
    this.tryAdd(BLOCK.WOOD, 16);
    this.tryAdd(BLOCK.LEAVES, 16);
    this.tryAdd(BLOCK.SAND, 8);
  }

  getActiveBlock() {
    const s = this.slots[this.activeSlot];
    return s ? s.id : null;
  }

  setActive(idx) {
    if (idx < 0 || idx >= HOTBAR_SLOTS) return;
    this.activeSlot = idx;
  }

  tryAdd(id, count) {
    if (id === BLOCK.AIR || count <= 0) return count;
    let remaining = count;
    // first stack onto existing
    for (let i = 0; i < INV_TOTAL && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < STACK_MAX) {
        const add = Math.min(remaining, STACK_MAX - s.count);
        s.count += add;
        remaining -= add;
      }
    }
    // then place into empty
    for (let i = 0; i < INV_TOTAL && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(remaining, STACK_MAX);
        this.slots[i] = { id, count: add };
        remaining -= add;
      }
    }
    return remaining; // overflow
  }

  consumeActive(n = 1) {
    const s = this.slots[this.activeSlot];
    if (!s) return false;
    s.count -= n;
    if (s.count <= 0) this.slots[this.activeSlot] = null;
    return true;
  }

  consume(id, count) {
    let remaining = count;
    for (let i = 0; i < INV_TOTAL && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(remaining, s.count);
        s.count -= take;
        remaining -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    return remaining === 0;
  }

  swap(a, b) {
    if (a === b) return;
    const t = this.slots[a]; this.slots[a] = this.slots[b]; this.slots[b] = t;
  }

  setSlot(i, item) { this.slots[i] = item; }
  getSlot(i)      { return this.slots[i]; }

  serialize() {
    return { active: this.activeSlot, slots: this.slots };
  }
  load(data) {
    if (!data) return;
    if (typeof data.active === 'number') this.activeSlot = data.active;
    if (Array.isArray(data.slots)) {
      for (let i = 0; i < INV_TOTAL; i++) this.slots[i] = data.slots[i] || null;
    }
  }
}
