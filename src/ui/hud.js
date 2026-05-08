import { BLOCK, BLOCKS, blockData } from '../engine/blocks.js';
import { tileIcon } from '../engine/textures.js';
import { HOTBAR_SLOTS } from '../systems/inventory.js';

export class Hud {
  constructor(inventory) {
    this.inv = inventory;
    this.hotbarEl = document.getElementById('hotbar');
    this.hpEl = document.getElementById('hp');
    this.coordsEl = document.getElementById('coords');

    this._iconCache = new Map();
    this._build();

    document.addEventListener('keydown', (e) => {
      if (e.code.startsWith('Digit')) {
        const n = parseInt(e.code.slice(5), 10);
        if (n >= 1 && n <= 9) {
          this.inv.setActive(n - 1);
          this.refresh();
        }
      }
    });
    document.addEventListener('wheel', (e) => {
      const dir = Math.sign(e.deltaY);
      if (dir === 0) return;
      const a = (this.inv.activeSlot + dir + HOTBAR_SLOTS) % HOTBAR_SLOTS;
      this.inv.setActive(a);
      this.refresh();
    }, { passive: true });
  }

  iconFor(id) {
    if (this._iconCache.has(id)) return this._iconCache.get(id);
    const bd = blockData(id);
    if (!bd || !bd.faces) return null;
    // pick a representative face: use top face for grass-like, side for wood
    let name;
    if (id === BLOCK.GRASS) name = 'grass_top';
    else if (id === BLOCK.WOOD) name = 'wood_side';
    else if (id === BLOCK.CRAFTING_TABLE) name = 'ct_top';
    else name = bd.faces[0];
    const url = tileIcon(name, 32);
    this._iconCache.set(id, url);
    return url;
  }

  _build() {
    this.hotbarEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.dataset.idx = i;
      slot.innerHTML = `<div class="icon"></div><div class="count"></div>`;
      this.hotbarEl.appendChild(slot);
    }
    this.refresh();
  }

  refresh() {
    const slots = this.hotbarEl.querySelectorAll('.slot');
    for (let i = 0; i < HOTBAR_SLOTS; i++) {
      const el = slots[i];
      el.classList.toggle('active', i === this.inv.activeSlot);
      const item = this.inv.getSlot(i);
      const icon = el.querySelector('.icon');
      const count = el.querySelector('.count');
      if (item) {
        const url = this.iconFor(item.id);
        icon.style.background = url ? `center/contain no-repeat url(${url})` : '';
        count.textContent = item.count > 1 ? item.count : '';
      } else {
        icon.style.background = '';
        count.textContent = '';
      }
    }
  }

  setHealth(hp, maxHp) {
    this.hpEl.innerHTML = '';
    for (let i = 0; i < maxHp; i++) {
      const d = document.createElement('div');
      d.className = 'heart' + (i >= hp ? ' empty' : '');
      this.hpEl.appendChild(d);
    }
  }

  setCoords(x, y, z, fps) {
    this.coordsEl.textContent = `XYZ ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)} | FPS ${fps|0}`;
  }
}
