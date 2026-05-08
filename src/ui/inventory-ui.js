import { tileIcon } from '../engine/textures.js';
import { blockData, BLOCK } from '../engine/blocks.js';
import { findRecipe } from '../systems/crafting.js';
import { INV_TOTAL, HOTBAR_SLOTS } from '../systems/inventory.js';

// Inventory & 3x3 crafting UI with drag & drop.
export class InventoryUi {
  constructor(inv, hud) {
    this.inv = inv;
    this.hud = hud;
    this.root = document.getElementById('inventory');
    this.invGrid = document.getElementById('inv-grid');
    this.craftGrid = document.getElementById('craft-grid');
    this.craftOut = document.getElementById('craft-out');
    this.craftSlots = [
      [null, null, null],
      [null, null, null],
      [null, null, null]
    ]; // {id,count}
    this.outputItem = null;
    this.dragItem = null;
    this.dragGhost = null;

    this._iconCache = new Map();
    this._build();
    this._bindGlobalDrag();

    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' || (e.code === 'Escape' && !this.root.classList.contains('hidden'))) {
        this.toggle();
      }
    });
  }

  iconFor(id) {
    if (!id) return null;
    if (this._iconCache.has(id)) return this._iconCache.get(id);
    const bd = blockData(id);
    if (!bd || !bd.faces) return null;
    let name;
    if (id === BLOCK.GRASS) name = 'grass_top';
    else if (id === BLOCK.CRAFTING_TABLE) name = 'ct_top';
    else if (id === BLOCK.WOOD) name = 'wood_side';
    else name = bd.faces[0];
    const url = tileIcon(name, 32);
    this._iconCache.set(id, url);
    return url;
  }

  toggle() {
    const wasHidden = this.root.classList.contains('hidden');
    this.root.classList.toggle('hidden');
    if (!wasHidden) {
      // closing -> dump crafting and held drag back into inventory
      this._returnCraftToInv();
      if (this.dragItem) { this.dragItem = null; this._updateGhost(); }
      if (!document.pointerLockElement) document.querySelector('#game').requestPointerLock();
    } else {
      // opening
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.refresh();
  }

  isOpen() { return !this.root.classList.contains('hidden'); }

  _build() {
    this.invGrid.innerHTML = '';
    this.invGrid.style.gridTemplateRows = `repeat(4, 40px)`;
    // Layout: hotbar row + 3 storage rows = 4 rows of 9
    // Order in array: 0..8 hotbar, 9..35 main. We'll show main first (top), hotbar at bottom.
    for (let i = 9; i < INV_TOTAL; i++) this._addSlot(this.invGrid, 'inv', i);
    // separator: hotbar
    for (let i = 0; i < HOTBAR_SLOTS; i++) this._addSlot(this.invGrid, 'inv', i);

    this.craftGrid.innerHTML = '';
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.dataset.kind = 'craft';
      el.dataset.r = r; el.dataset.c = c;
      el.innerHTML = `<div class="icon"></div><div class="count"></div>`;
      this._bindSlotClicks(el);
      this.craftGrid.appendChild(el);
    }

    this.craftOut.dataset.kind = 'output';
    this.craftOut.innerHTML = `<div class="icon"></div><div class="count"></div>`;
    this._bindSlotClicks(this.craftOut);
  }

  _addSlot(parent, kind, idx) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.kind = kind;
    el.dataset.idx = idx;
    el.innerHTML = `<div class="icon"></div><div class="count"></div>`;
    this._bindSlotClicks(el);
    parent.appendChild(el);
  }

  _itemFromSlot(el) {
    const kind = el.dataset.kind;
    if (kind === 'inv') return this.inv.getSlot(parseInt(el.dataset.idx, 10));
    if (kind === 'craft') return this.craftSlots[+el.dataset.r][+el.dataset.c];
    if (kind === 'output') return this.outputItem;
    return null;
  }
  _setSlot(el, item) {
    const kind = el.dataset.kind;
    if (kind === 'inv') this.inv.setSlot(parseInt(el.dataset.idx, 10), item);
    else if (kind === 'craft') this.craftSlots[+el.dataset.r][+el.dataset.c] = item;
    else if (kind === 'output') this.outputItem = item;
  }

  _bindSlotClicks(el) {
    el.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const kind = el.dataset.kind;
      const item = this._itemFromSlot(el);

      if (kind === 'output') {
        if (!this.outputItem) return;
        // craft -> consume one of each input, give output to drag
        this._consumeCraftInputs();
        if (!this.dragItem) {
          this.dragItem = { ...this.outputItem };
        } else if (this.dragItem.id === this.outputItem.id) {
          this.dragItem.count += this.outputItem.count;
        } else {
          // swap
          const tmp = this.dragItem; this.dragItem = { ...this.outputItem };
          // try return tmp to inventory
          const left = this.inv.tryAdd(tmp.id, tmp.count);
          if (left > 0) this.dragItem = { id: tmp.id, count: left };
        }
        this._evalCrafting();
        this.refresh();
        this._updateGhost();
        return;
      }

      if (this.dragItem) {
        // place
        if (!item) {
          this._setSlot(el, { ...this.dragItem });
          this.dragItem = null;
        } else if (item.id === this.dragItem.id) {
          item.count += this.dragItem.count;
          this.dragItem = null;
        } else {
          // swap
          const tmp = item;
          this._setSlot(el, { ...this.dragItem });
          this.dragItem = tmp;
        }
      } else {
        // pick up
        if (item) {
          this.dragItem = { ...item };
          this._setSlot(el, null);
        }
      }
      this._evalCrafting();
      this.refresh();
      this._updateGhost();
    });
  }

  _bindGlobalDrag() {
    document.addEventListener('mousemove', (e) => {
      if (!this.dragGhost) return;
      this.dragGhost.style.left = (e.clientX - 16) + 'px';
      this.dragGhost.style.top  = (e.clientY - 16) + 'px';
    });
  }

  _updateGhost() {
    if (this.dragItem) {
      if (!this.dragGhost) {
        this.dragGhost = document.createElement('div');
        this.dragGhost.className = 'drag-ghost';
        document.body.appendChild(this.dragGhost);
      }
      const url = this.iconFor(this.dragItem.id);
      this.dragGhost.style.background = url ? `center/contain no-repeat url(${url})` : '';
      this.dragGhost.title = this.dragItem.count;
    } else if (this.dragGhost) {
      this.dragGhost.remove();
      this.dragGhost = null;
    }
  }

  _consumeCraftInputs() {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const it = this.craftSlots[r][c];
      if (it) {
        it.count -= 1;
        if (it.count <= 0) this.craftSlots[r][c] = null;
      }
    }
  }

  _evalCrafting() {
    const grid = [
      [this.craftSlots[0][0]?.id || 0, this.craftSlots[0][1]?.id || 0, this.craftSlots[0][2]?.id || 0],
      [this.craftSlots[1][0]?.id || 0, this.craftSlots[1][1]?.id || 0, this.craftSlots[1][2]?.id || 0],
      [this.craftSlots[2][0]?.id || 0, this.craftSlots[2][1]?.id || 0, this.craftSlots[2][2]?.id || 0]
    ];
    const recipe = findRecipe(grid);
    this.outputItem = recipe ? { id: recipe.output.id, count: recipe.output.count } : null;
  }

  _returnCraftToInv() {
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const it = this.craftSlots[r][c];
      if (it) {
        const left = this.inv.tryAdd(it.id, it.count);
        this.craftSlots[r][c] = left > 0 ? { id: it.id, count: left } : null;
      }
    }
    if (this.dragItem) {
      const left = this.inv.tryAdd(this.dragItem.id, this.dragItem.count);
      this.dragItem = left > 0 ? { id: this.dragItem.id, count: left } : null;
      this._updateGhost();
    }
  }

  _renderSlot(el, item) {
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

  refresh() {
    // inv slots
    const invEls = this.invGrid.querySelectorAll('.slot');
    invEls.forEach((el) => {
      const idx = parseInt(el.dataset.idx, 10);
      this._renderSlot(el, this.inv.getSlot(idx));
    });
    // craft slots
    const craftEls = this.craftGrid.querySelectorAll('.slot');
    craftEls.forEach((el) => {
      const r = +el.dataset.r, c = +el.dataset.c;
      this._renderSlot(el, this.craftSlots[r][c]);
    });
    // output
    this._renderSlot(this.craftOut, this.outputItem);
    // hud
    if (this.hud) this.hud.refresh();
  }

  serializeCraft() {
    return this.craftSlots.map(row => row.map(it => it ? { ...it } : null));
  }
  loadCraft(data) {
    if (!Array.isArray(data)) return;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      this.craftSlots[r][c] = data[r]?.[c] || null;
    }
    this._evalCrafting();
  }
}
