# The Lineage Engine

A high-fantasy relationship sim where you build a character, meet a cast of hand-crafted and procedurally generated NPCs, and shape entirely player-driven relationships — including pairings that can produce offspring with generated appearance and personality. Not realistic: a playful, escapist world of connection and lineage.

🔗 **Play it live:** [psyonade.github.io/the-lineage-engine](https://psyonade.github.io/the-lineage-engine/)

## What is this?

The Lineage Engine isn't trying to simulate real life — it's a curiosity-cabinet of relationships and lineages in a DnD-style fantasy world. Create a character, meet a rotating cast of NPCs (some hand-authored, some procedurally generated), build relationships at your own pace across multiple possible paths, and — if things go well — see what your pairings produce. Every offspring is generated from a real genetics system: their appearance and personality are built from a blend of both parents, with a chance for surprises along the way.

## Features

- **Deep character creation** — species, genetic traits (build, coloring, features), styling traits (hairstyle, accessories), personality, gender, and background
- **Hybrid NPC generation** — hand-authored archetypes combined with procedural variation for infinite replayability
- **Branching relationships** — multiple relationship paths (friends-first, rivals-to-lovers, whirlwind, slow-burn) driven by Affection, Trust, Attraction, and Rivalry, discovered dynamically through play rather than picked from a menu
- **Offspring genetics engine** — pair up characters to generate offspring with inherited appearance and personality traits, visible mutations, and hybrid species rules
- **Procedural appearance rendering** — every character is rendered live from trait data as layered SVG, no external art assets or image-generation APIs. Fully self-contained
- **Named questlines** — a handful of unique, hand-authored NPCs with their own short story arcs, alongside the general procedural cast
- **DnD 5e-inspired species roster** — Human, Elf, Dwarf, Halfling, Gnome, Half-Elf, Half-Orc, Orc, Tiefling, Dragonborn, Beastfolk

## Tech stack

- **Vite + TypeScript** (vanilla, no framework)
- **Vitest** for testing core logic (compatibility scoring, offspring generation)
- **Procedural SVG rendering** for all character appearances — no image assets, no AI generation APIs
- **GitHub Actions** → **GitHub Pages** for hosting
- **Supabase** (planned) for save-sync, once the core loop is validated

## Getting started

Requires [Node.js](https://nodejs.org/) installed.

```bash
# Clone the repo
git clone https://github.com/psyonade/the-lineage-engine.git
cd the-lineage-engine

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The dev server serves the app under the `/the-lineage-engine/` subpath (matching the configured `base`), so if `localhost:5173/` 404s, check `localhost:5173/the-lineage-engine/`.

### Production build

```bash
npm run build      # compiles to dist/
npm run preview    # serves the dist/ build locally, matching what GitHub Pages serves
```

### Running tests

```bash
npm run test
```

## Deployment

Pushes to `main` trigger a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the project and deploys `dist/` to GitHub Pages automatically.

## Project status

Actively in development. Core loop (character creation → NPC interaction → relationship progression → offspring generation) is playable. Ongoing work includes expanded relationship path variety, a full-body rendering upgrade, an expanded species roster, and a lightweight quest system for named NPCs.

## License

TBD
