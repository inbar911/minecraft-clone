import { BLOCK } from '../engine/blocks.js';

// Recipes use a 3x3 pattern grid: array of 3 rows, each with 3 ids (0=empty/air).
// 'shaped' recipes match position (with trimming around empty rows/cols).
export const RECIPES = [
  {
    name: 'planks_from_wood',
    shape: [
      [0, 0, 0],
      [0, BLOCK.WOOD, 0],
      [0, 0, 0]
    ],
    output: { id: BLOCK.PLANKS, count: 4 }
  },
  {
    name: 'crafting_table',
    shape: [
      [0, 0, 0],
      [BLOCK.PLANKS, BLOCK.PLANKS, 0],
      [BLOCK.PLANKS, BLOCK.PLANKS, 0]
    ],
    output: { id: BLOCK.CRAFTING_TABLE, count: 1 }
  }
];

// Returns trimmed pattern (smallest enclosing rectangle of non-zero ids).
function trim(grid) {
  let minR = 3, minC = 3, maxR = -1, maxC = -1;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    if (grid[r][c]) {
      if (r < minR) minR = r; if (c < minC) minC = c;
      if (r > maxR) maxR = r; if (c > maxC) maxC = c;
    }
  }
  if (maxR === -1) return null;
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(grid[minR + r][minC + c]);
    out.push(row);
  }
  return out;
}

function eq(a, b) {
  if (!a || !b) return a === b;
  if (a.length !== b.length || a[0].length !== b[0].length) return false;
  for (let r = 0; r < a.length; r++)
    for (let c = 0; c < a[0].length; c++)
      if (a[r][c] !== b[r][c]) return false;
  return true;
}

// grid: 3x3 array of (id|0)
export function findRecipe(grid) {
  const ig = trim(grid);
  for (const r of RECIPES) {
    const tr = trim(r.shape);
    if (eq(tr, ig)) return r;
  }
  return null;
}
