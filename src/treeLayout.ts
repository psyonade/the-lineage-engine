import { Character } from "./types";

export interface LayoutCoords {
  x: number;
  y: number;
}

export interface TreeLayoutResult {
  coords: Record<string, LayoutCoords>;
  width: number;
  height: number;
  generations: number[];
}

/**
 * Deterministic layered graph layout for family pedigree charts.
 * Aligns children under their parents, keeps partners adjacent, and resolves overlapping.
 */
export function computeTreeLayout(
  members: Character[],
  allChars: Character[]
): TreeLayoutResult {
  const CARD_WIDTH = 220;
  const CARD_HEIGHT = 80;
  const Y_GAP = 200;
  const PARTNER_SPACING = 240; // center-to-center
  const GENERAL_SPACING = 270; // center-to-center
  const BLOCK_GAP = 50;

  const coords: Record<string, LayoutCoords> = {};

  if (members.length === 0) {
    return { coords, width: 0, height: 0, generations: [] };
  }

  // 1. Group members by generation level
  const genMap: Record<number, Character[]> = {};
  members.forEach(c => {
    const g = c.generation || 1;
    if (!genMap[g]) genMap[g] = [];
    genMap[g].push(c);
  });

  const generations = Object.keys(genMap).map(Number).sort((a, b) => a - b);

  // Initialize partnership mappings
  const partnersMap: Record<string, Set<string>> = {};
  members.forEach(m => partnersMap[m.id] = new Set());

  allChars.forEach(c => {
    if (c.parentIds && c.parentIds.length === 2) {
      const [pA, pB] = c.parentIds;
      if (partnersMap[pA] && partnersMap[pB]) {
        partnersMap[pA].add(pB);
        partnersMap[pB].add(pA);
      }
    }
  });

  members.forEach(m => {
    if (m.partnerId && partnersMap[m.id] && partnersMap[m.partnerId]) {
      partnersMap[m.id].add(m.partnerId);
      partnersMap[m.partnerId].add(m.id);
    }
  });

  // Keep track of layout blocks in each generation
  interface Block {
    members: Character[];
    idealX: number;
    currentX: number;
    width: number;
  }

  const getIdealXForChar = (c: Character): number => {
    if (c.parentIds && c.parentIds.length > 0) {
      const parentCoords = c.parentIds
        .map(pid => coords[pid])
        .filter(Boolean);
      if (parentCoords.length === 2) {
        return (parentCoords[0].x + parentCoords[1].x) / 2;
      } else if (parentCoords.length === 1) {
        return parentCoords[0].x;
      }
    }
    return 0; // Default
  };

  // Lay out generation-by-generation
  generations.forEach((gen, genIdx) => {
    const charsInRow = genMap[gen];
    const visited = new Set<string>();
    const blocks: Block[] = [];

    // Form blocks of partners
    charsInRow.forEach(c => {
      if (visited.has(c.id)) return;

      const blockMembers: Character[] = [];
      const dfs = (char: Character) => {
        visited.add(char.id);
        blockMembers.push(char);
        const partners = partnersMap[char.id] || new Set();
        partners.forEach(pid => {
          const partnerChar = charsInRow.find(x => x.id === pid);
          if (partnerChar && !visited.has(pid)) {
            dfs(partnerChar);
          }
        });
      };

      dfs(c);

      // Order block members to put partners next to each other
      // Simple sorted or linearized placement:
      blockMembers.sort((a, b) => {
        // prioritize primary PC first
        if (a.id === "player") return -1;
        if (b.id === "player") return 1;
        return a.name.localeCompare(b.name);
      });

      // Calculate width of this layout block
      const numMembers = blockMembers.length;
      const width = (numMembers - 1) * PARTNER_SPACING + CARD_WIDTH;

      blocks.push({
        members: blockMembers,
        idealX: 0,
        currentX: 0,
        width
      });
    });

    // Compute ideal X for blocks in this generation row
    blocks.forEach(block => {
      if (genIdx === 0) {
        // Gen 1 initialization
        block.idealX = 0; // Initialized sequentially below
      } else {
        // Average of member ideal positions
        const sum = block.members.reduce((acc, m) => acc + getIdealXForChar(m), 0);
        block.idealX = sum / block.members.length;
      }
    });

    if (genIdx === 0) {
      // Seq placement for Gen 1 to start beautiful spreading
      let curX = CARD_WIDTH / 2 + 50;
      blocks.forEach(block => {
        block.idealX = curX + block.width / 2;
        block.currentX = block.idealX;
        curX += block.width + BLOCK_GAP;
      });
    } else {
      // Sort blocks by idealX to maintain hierarchy
      blocks.sort((a, b) => a.idealX - b.idealX);

      // Apply initial positions
      blocks.forEach(block => {
        block.currentX = block.idealX;
      });

      // Resolve overlaps (Iterative Sweep)
      for (let iter = 0; declineOverlap(blocks); iter++) {
        if (iter > 100) break;
      }
    }

    // Apply calculated coordinates back to generation members
    blocks.forEach(block => {
      const startX = block.currentX - block.width / 2 + CARD_WIDTH / 2;
      block.members.forEach((m, idx) => {
        const mx = startX + idx * PARTNER_SPACING;
        const my = genIdx * Y_GAP + 50;
        coords[m.id] = { x: mx, y: my };
      });
    });
  });

  // Resolve overlaps helper function
  function declineOverlap(blocks: Block[]): boolean {
    let shifted = false;
    // Left-to-Right sweep
    for (let i = 0; i < blocks.length - 1; i++) {
      const bA = blocks[i];
      const bB = blocks[i + 1];
      const minDistance = bA.width / 2 + bB.width / 2 + BLOCK_GAP;
      if (bB.currentX < bA.currentX + minDistance) {
        bB.currentX = bA.currentX + minDistance;
        shifted = true;
      }
    }

    // Right-to-Left sweep
    for (let i = blocks.length - 1; i > 0; i--) {
      const bA = blocks[i - 1];
      const bB = blocks[i];
      const minDistance = bA.width / 2 + bB.width / 2 + BLOCK_GAP;
      if (bA.currentX > bB.currentX - minDistance) {
        bA.currentX = bB.currentX - minDistance;
        shifted = true;
      }
    }

    return shifted;
  }

  // Find boundaries of the layout canvas
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  Object.values(coords).forEach(c => {
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  });

  // Handle margins
  const offsetX = minX < 50 ? 50 - minX : 0;
  if (offsetX > 0) {
    Object.values(coords).forEach(c => {
      c.x += offsetX;
    });
    maxX += offsetX;
  }

  const canvasWidth = Math.max(maxX + CARD_WIDTH + 100, 1000);
  const canvasHeight = Math.max(maxY + CARD_HEIGHT + 100, 600);

  return {
    coords,
    width: canvasWidth,
    height: canvasHeight,
    generations
  };
}

/**
 * Returns mock characters representing stress test scenarios: "harem", "deep", or "web"
 */
export function generateStressTestMock(type: "harem" | "deep" | "web"): Character[] {
  if (type === "harem") {
    // 1 Parent with 4 partners on same tier
    const sultan: Character = {
      id: "sultan",
      name: "Sultan Al-Amir",
      species: "Human",
      gender: "Male",
      geneticTraits: {
        skinScaleFurToneHue: 25, skinScaleFurToneSat: 50, skinScaleFurToneLight: 50,
        hairColorHue: 40, hairColorSat: 60, hairColorLight: 20,
        eyeColorHue: 210, eyeColorSat: 80, eyeColorLight: 50,
        faceShape: "oval", build: "average", height: 178, earShape: "normal",
        hairTexture: "curly", markingsPattern: "none", speciesFeatures: "none"
      },
      stylingTraits: { hairStyle: "long", accessory: "crown", clothing: "knight-armor" },
      personalityTraits: { boldness: 80, warmth: 60, wit: 70, ambition: 90, chaos: 40 },
      background: "The legendary sultan of the sands.",
      origin: "generated",
      age: 5,
      generation: 1
    };

    const partners = ["Layla", "Yasmin", "Farah", "Hana"].map((name, idx) => {
      const speciesList: Character["species"][] = ["Elf", "Tiefling", "Orc", "Dwarf"];
      const sp = speciesList[idx];
      return {
        id: `partner-${idx}`,
        name: `Sultana ${name}`,
        species: sp,
        gender: "Female" as const,
        geneticTraits: {
          skinScaleFurToneHue: 35 + idx * 80, skinScaleFurToneSat: 50, skinScaleFurToneLight: 60,
          hairColorHue: 10 + idx * 90, hairColorSat: 50, hairColorLight: 40,
          eyeColorHue: 150 + idx * 30, eyeColorSat: 80, eyeColorLight: 50,
          faceShape: "sharp", build: "slender" as const, height: 165 + idx * 5, earShape: "pointed",
          hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
        },
        stylingTraits: { hairStyle: "braids", accessory: "circlet", clothing: "mage-cloak" },
        personalityTraits: { boldness: 50, warmth: 70, wit: 80, ambition: 60, chaos: 30 },
        background: `Honored partner of the Sultan.`,
        origin: "generated" as const,
        age: 4,
        generation: 1
      };
    });

    const children = partners.map((p, idx) => {
      return {
        id: `child-${idx}`,
        name: `Amir child ${idx + 1}`,
        species: idx === 0 ? ("Half-Elf" as const) : idx === 2 ? ("Half-Orc" as const) : ("Human" as const),
        gender: idx % 2 === 0 ? ("Female" as const) : ("Male" as const),
        geneticTraits: {
          skinScaleFurToneHue: 30, skinScaleFurToneSat: 40, skinScaleFurToneLight: 55,
          hairColorHue: 30, hairColorSat: 50, hairColorLight: 30,
          eyeColorHue: 180, eyeColorSat: 70, eyeColorLight: 50,
          faceShape: "oval", build: "average" as const, height: 172, earShape: "normal",
          hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
        },
        stylingTraits: { hairStyle: "short", accessory: "none", clothing: "commoner-robe" },
        personalityTraits: { boldness: 65, warmth: 65, wit: 75, ambition: 75, chaos: 35 },
        background: `Beloved offspring of ${sultan.name} and ${p.name}.`,
        origin: "offspring" as const,
        parentIds: [sultan.id, p.id] as [string, string],
        parentNames: [sultan.name, p.name] as [string, string],
        age: 1,
        generation: 2
      };
    });

    return [sultan, ...partners, ...children];
  } else if (type === "deep") {
    // 5+ Vertical Generations
    const list: Character[] = [];
    const names = ["Aethelgard", "Faelar", "Thalia", "Sylas", "Yvaine", "Lirael"];

    names.forEach((name, idx) => {
      const m: Character = {
        id: `ancestor-${idx}`,
        name: idx === 0 ? `Ancestor ${name}` : idx === 5 ? `Newborn ${name}` : `Heir ${name}`,
        species: "Elf",
        gender: idx % 2 === 0 ? "Male" : "Female",
        geneticTraits: {
          skinScaleFurToneHue: 40, skinScaleFurToneSat: 30, skinScaleFurToneLight: 80,
          hairColorHue: 190, hairColorSat: 30, hairColorLight: 85,
          eyeColorHue: 140, eyeColorSat: 70, eyeColorLight: 50,
          faceShape: "sharp", build: "slender", height: 190, earShape: "pointed",
          hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
        },
        stylingTraits: { hairStyle: "long", accessory: "circlet", clothing: "rogue-leather" },
        personalityTraits: { boldness: 60, warmth: 60, wit: 60, ambition: 60, chaos: 60 },
        background: `Gen ${idx + 1} of the ancient Elven dynasty.`,
        origin: idx === 0 ? "generated" : "offspring",
        age: 8 - idx,
        generation: idx + 1
      };

      if (idx > 0) {
        m.parentIds = [`ancestor-${idx - 1}`, `spouse-${idx - 1}`];
        m.parentNames = [list[list.length - 2].name, `Spouse ${idx}`];
      }

      list.push(m);

      if (idx < 5) {
        // Add a spouse to each to keep lineage valid
        const spouse: Character = {
          id: `spouse-${idx}`,
          name: `Spouse ${idx + 1}`,
          species: "Elf",
          gender: idx % 2 === 0 ? "Female" : "Male",
          geneticTraits: {
            skinScaleFurToneHue: 40, skinScaleFurToneSat: 30, skinScaleFurToneLight: 80,
            hairColorHue: 190, hairColorSat: 30, hairColorLight: 85,
            eyeColorHue: 140, eyeColorSat: 70, eyeColorLight: 50,
            faceShape: "sharp", build: "slender", height: 190, earShape: "pointed",
            hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
          },
          stylingTraits: { hairStyle: "short", accessory: "none", clothing: "commoner-robe" },
          personalityTraits: { boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50 },
          background: "Worthy spouse of the dynasty.",
          origin: "generated",
          age: 8 - idx,
          generation: idx + 1,
          partnerId: `ancestor-${idx}`
        };
        m.partnerId = spouse.id;
        list.push(spouse);
      }
    });

    return list;
  } else {
    // "Web" - Multi-lineage branches merging back together
    // Family A: A1 + A2 -> Child AB
    // Family B: B1 + B2 -> Child BC
    // AB + BC -> Child ABC
    const list: Character[] = [];

    const createPair = (id1: string, name1: string, id2: string, name2: string) => {
      const c1: Character = {
        id: id1, name: name1, species: "Human", gender: "Male",
        geneticTraits: {
          skinScaleFurToneHue: 20, skinScaleFurToneSat: 40, skinScaleFurToneLight: 60,
          hairColorHue: 30, hairColorSat: 50, hairColorLight: 20,
          eyeColorHue: 210, eyeColorSat: 80, eyeColorLight: 50,
          faceShape: "oval", build: "average", height: 175, earShape: "normal",
          hairTexture: "straight", markingsPattern: "none", speciesFeatures: "none"
        },
        stylingTraits: { hairStyle: "short", accessory: "none", clothing: "commoner-robe" },
        personalityTraits: { boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50 },
        background: "Founder of lineage branch A.", origin: "generated", age: 7, generation: 1, partnerId: id2
      };
      const c2: Character = {
        id: id2, name: name2, species: "Human", gender: "Female",
        geneticTraits: {
          skinScaleFurToneHue: 25, skinScaleFurToneSat: 40, skinScaleFurToneLight: 65,
          hairColorHue: 35, hairColorSat: 50, hairColorLight: 25,
          eyeColorHue: 200, eyeColorSat: 70, eyeColorLight: 50,
          faceShape: "round", build: "average", height: 165, earShape: "normal",
          hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
        },
        stylingTraits: { hairStyle: "long", accessory: "none", clothing: "commoner-robe" },
        personalityTraits: { boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50 },
        background: "Founder of lineage branch B.", origin: "generated", age: 7, generation: 1, partnerId: id1
      };
      return [c1, c2];
    };

    const familyA = createPair("A1", "Lord Arthur", "A2", "Lady Alice");
    const familyB = createPair("B1", "Lord Byron", "B2", "Lady Beatrice");

    const childAB: Character = {
      id: "AB", name: "Sir Albert", species: "Human", gender: "Male",
      geneticTraits: {
        skinScaleFurToneHue: 22, skinScaleFurToneSat: 40, skinScaleFurToneLight: 62,
        hairColorHue: 32, hairColorSat: 50, hairColorLight: 22,
        eyeColorHue: 205, eyeColorSat: 75, eyeColorLight: 50,
        faceShape: "oval", build: "average", height: 170, earShape: "normal",
        hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
      },
      stylingTraits: { hairStyle: "short", accessory: "glasses", clothing: "knight-armor" },
      personalityTraits: { boldness: 60, warmth: 60, wit: 60, ambition: 60, chaos: 40 },
      background: "A strong branch connector.", origin: "offspring", parentIds: ["A1", "A2"], parentNames: ["Arthur", "Alice"], age: 4, generation: 2, partnerId: "BC"
    };

    const childBC: Character = {
      id: "BC", name: "Dame Bella", species: "Human", gender: "Female",
      geneticTraits: {
        skinScaleFurToneHue: 24, skinScaleFurToneSat: 40, skinScaleFurToneLight: 64,
        hairColorHue: 34, hairColorSat: 50, hairColorLight: 24,
        eyeColorHue: 202, eyeColorSat: 72, eyeColorLight: 50,
        faceShape: "round", build: "average", height: 167, earShape: "normal",
        hairTexture: "straight", markingsPattern: "none", speciesFeatures: "none"
      },
      stylingTraits: { hairStyle: "long", accessory: "earrings", clothing: "mage-cloak" },
      personalityTraits: { boldness: 60, warmth: 60, wit: 60, ambition: 60, chaos: 40 },
      background: "A brilliant branch connector.", origin: "offspring", parentIds: ["B1", "B2"], parentNames: ["Byron", "Beatrice"], age: 4, generation: 2, partnerId: "AB"
    };

    const childABC: Character = {
      id: "ABC", name: "Young Charles", species: "Human", gender: "Male",
      geneticTraits: {
        skinScaleFurToneHue: 23, skinScaleFurToneSat: 40, skinScaleFurToneLight: 63,
        hairColorHue: 33, hairColorSat: 50, hairColorLight: 23,
        eyeColorHue: 203, eyeColorSat: 73, eyeColorLight: 50,
        faceShape: "oval", build: "average", height: 168, earShape: "normal",
        hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
      },
      stylingTraits: { hairStyle: "crest", accessory: "none", clothing: "commoner-robe" },
      personalityTraits: { boldness: 70, warmth: 70, wit: 70, ambition: 70, chaos: 50 },
      background: "The ultimate merged bloodline descendant!", origin: "offspring", parentIds: ["AB", "BC"], parentNames: ["Albert", "Bella"], age: 1, generation: 3
    };

    return [...familyA, ...familyB, childAB, childBC, childABC];
  }
}
