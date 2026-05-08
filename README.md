# Voxel Sandbox — A Minecraft-style game in the browser

A from-scratch voxel sandbox built with Three.js and Vite. Features procedural infinite terrain, biomes, trees, mobs, inventory, 3x3 crafting, day/night cycle, and persistent save.

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview
```

The build output is in `dist/`.

## Controls

| Action            | Key |
|-------------------|-----|
| Move              | `W` `A` `S` `D` |
| Sprint            | `Shift` |
| Jump              | `Space` |
| Look              | Mouse (click canvas to lock cursor) |
| Break block       | Hold left mouse button |
| Place block       | Right mouse button |
| Hotbar slot 1–9   | `1`…`9` |
| Scroll hotbar     | Mouse wheel |
| Toggle inventory  | `E` |
| Save game         | `F` |
| Release pointer   | `Esc` |

Inventory: click a slot to pick the stack into the cursor, click another to place/swap. Place items into the 3x3 crafting grid; the result appears on the right — click it to take.

## Recipes

| Inputs (3x3) | Output |
|--------------|--------|
| 1 wood log | 4 planks |
| 4 planks (2x2) | 1 crafting table |

Add more recipes in `src/systems/crafting.js`.

## Core systems

- **Rendering** — `src/engine/chunk.js` builds per-chunk `THREE.BufferGeometry` with face-culling; `src/engine/textures.js` generates a procedural pixelated texture atlas (no asset files).
- **World / Chunks** — `src/engine/world.js` manages chunk lifecycle around the player (load/unload by view distance). `src/engine/noise.js` is a hand-rolled simplex/fBm implementation.
- **Biomes** — Plains, Forest, Mountains, Desert. Trees in forests/plains.
- **Player** — `src/player/controls.js` (input + pointer lock + interaction), `physics.js` (AABB voxel collision + gravity), `raycast.js` (Amanatides–Woo voxel DDA).
- **Inventory** — `src/systems/inventory.js`. 9 hotbar + 27 main slots, stack size 64.
- **Crafting** — `src/systems/crafting.js`. Shape-trimmed pattern matching in 3x3 grid.
- **Mobs** — `src/systems/mobs.js`. Sheep / Cow (passive wander), Zombie (chase + attack), AABB-collided, simple step-up.
- **Save** — `src/systems/save.js`. localStorage; persists seed, modifications, inventory, player state.
- **Day/night** — Sun rotates over a 4-minute cycle in `src/main.js` with sky color blend.

## Project structure

```
.
├── index.html
├── package.json
├── vite.config.js
└── src
    ├── main.js
    ├── style.css
    ├── engine
    │   ├── blocks.js     # block registry
    │   ├── chunk.js      # chunk class + mesher
    │   ├── noise.js      # simplex / fBm
    │   ├── textures.js   # procedural atlas
    │   └── world.js      # chunk manager + generation
    ├── player
    │   ├── controls.js
    │   ├── physics.js
    │   └── raycast.js
    ├── systems
    │   ├── crafting.js
    │   ├── inventory.js
    │   ├── mobs.js
    │   └── save.js
    └── ui
        ├── hud.js
        └── inventory-ui.js
```

## Performance notes

- View distance default is 4 chunks (radius). Increase in `src/engine/world.js` (`viewDistance`).
- Mesh build is throttled to N chunks per frame (`processMeshQueue`).
- Chunks are 16x16x64. Adjust `CHUNK_SIZE` / `CHUNK_HEIGHT` in `chunk.js`.
- A face-culling mesher is used (one quad per visible face). For larger view distances consider true greedy meshing with a per-tile-tiling shader.

## Extending

### Add a block

1. Add an id in `src/engine/blocks.js` (`BLOCK` enum) and an entry in `BLOCKS`.
2. Reference texture names that exist in `src/engine/textures.js` `TEX` map; if you need a new texture, add a draw function and include it in `drawers`.

### Add a recipe

Append to `RECIPES` in `src/systems/crafting.js`. Use `0` for empty cells. Patterns are auto-trimmed for position-independence.

### Add a mob

Add a builder + entry to `MOB_TYPES` in `src/systems/mobs.js`. Provide `hostile`, `hp`, `speed`, `sight`, `attack`.

## Multiplayer outline (not implemented)

A plausible architecture if you want to extend:

- Authoritative server (Node + `ws`) holding world state and chunk data.
- Client connects, sends input deltas (`{ keys, yaw, pitch, dt }`).
- Server runs physics, computes block edits and entity positions, broadcasts diffs (`block_set`, `chunk_load`, `entity_update`) to all clients.
- Use binary frames (e.g. CBOR / msgpack) and chunk diffs (RLE Uint8Array) to keep bandwidth low.
- For low-latency play, run the same physics on the client and reconcile when server state differs.

## Modding (extensible blocks/items) outline

- Move `BLOCKS` and `RECIPES` into runtime registries with `register(id, data)` APIs.
- Allow mods to ship a JSON manifest declaring blocks (faces + properties), recipes, and mob definitions.
- A mod loader at boot fetches each manifest and calls `register*` before world generation.
- For procedural textures, mods can supply `draw(ctx, x, y)` functions registered with `registerTexture(name, fn)`; atlas is rebuilt before first render.

## License

MIT.
