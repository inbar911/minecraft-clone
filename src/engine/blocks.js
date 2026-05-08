// Block registry. id 0 = air.
export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WOOD: 4, LEAVES: 5,
  PLANKS: 6, SAND: 7, WATER: 8, BEDROCK: 9, CRAFTING_TABLE: 10
};

// Per-block-type data. Faces order: [+x, -x, +y, -y, +z, -z]
// tex names refer to procedural texture keys.
export const BLOCKS = {
  [BLOCK.AIR]:    { id: 0, name: 'air',    solid: false, transparent: true,  breakTime: 0,   faces: null },
  [BLOCK.GRASS]:  { id: 1, name: 'grass',  solid: true,  transparent: false, breakTime: 0.5, faces: ['grass_side','grass_side','grass_top','dirt','grass_side','grass_side'] },
  [BLOCK.DIRT]:   { id: 2, name: 'dirt',   solid: true,  transparent: false, breakTime: 0.4, faces: ['dirt','dirt','dirt','dirt','dirt','dirt'] },
  [BLOCK.STONE]:  { id: 3, name: 'stone',  solid: true,  transparent: false, breakTime: 1.5, faces: ['stone','stone','stone','stone','stone','stone'] },
  [BLOCK.WOOD]:   { id: 4, name: 'wood',   solid: true,  transparent: false, breakTime: 1.0, faces: ['wood_side','wood_side','wood_top','wood_top','wood_side','wood_side'] },
  [BLOCK.LEAVES]: { id: 5, name: 'leaves', solid: true,  transparent: true,  breakTime: 0.2, faces: ['leaves','leaves','leaves','leaves','leaves','leaves'] },
  [BLOCK.PLANKS]: { id: 6, name: 'planks', solid: true,  transparent: false, breakTime: 0.8, faces: ['planks','planks','planks','planks','planks','planks'] },
  [BLOCK.SAND]:   { id: 7, name: 'sand',   solid: true,  transparent: false, breakTime: 0.4, faces: ['sand','sand','sand','sand','sand','sand'] },
  [BLOCK.WATER]:  { id: 8, name: 'water',  solid: false, transparent: true,  breakTime: 0,   faces: ['water','water','water','water','water','water'] },
  [BLOCK.BEDROCK]:{ id: 9, name: 'bedrock',solid: true,  transparent: false, breakTime: 9999,faces: ['bedrock','bedrock','bedrock','bedrock','bedrock','bedrock'] },
  [BLOCK.CRAFTING_TABLE]: { id: 10, name: 'crafting_table', solid: true, transparent: false, breakTime: 1.0, faces: ['ct_side','ct_side','ct_top','planks','ct_side','ct_side'] }
};

export function isSolid(id)       { return BLOCKS[id]?.solid ?? false; }
export function isTransparent(id) { return BLOCKS[id]?.transparent ?? true; }
export function blockData(id)     { return BLOCKS[id]; }
