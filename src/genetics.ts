import { Character } from "./types";

/**
 * Generate a random id.
 */
function uuid(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Convert HSL to RGB (useful for visualization or just understanding)
 */
export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Blend two hues. Hue wraps around 360, so we blend along the shortest arc.
 */
export function blendHue(h1: number, h2: number): number {
  const diff = Math.abs(h1 - h2);
  if (diff > 180) {
    // Wrap around blending
    const avg = (h1 + h2 + 360) / 2;
    return avg % 360;
  }
  return (h1 + h2) / 2;
}

/**
 * Helper to clamp a number
 */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Generate a list of cool and playful fantasy-sounding names based on species
 */
export function generateFantasyName(species: Character["species"]): string {
  const humanFirst = ["Eldrin", "Kael", "Lyra", "Rowan", "Seraphina", "Dorian", "Aislin", "Gideon", "Saffron"];
  const humanLast = ["Stormweaver", "Oakheart", "Starling", "Silverwood", "Briarwood", "Crowley", "Hawthorne"];

  const elfFirst = ["Sylas", "Thalia", "Faelar", "Yvaine", "Galathel", "Lirael", "Aethelgard", "Nuala"];
  const elfLast = ["Moonwhisper", "Sunstrider", "Gildedleaf", "Stardust", "Windrunner", "Raindancer"];

  const dwarfFirst = ["Thorgar", "Bram", "Helga", "Ulfric", "Dagna", "Gimli", "Brokk", "Sari", "Grenda"];
  const dwarfLast = ["Ironbreaker", "Stonefist", "Goldvein", "Copperforge", "Deepdelve", "Mountainborn"];

  const orcFirst = ["Garrok", "Mog", "Karg", "Runa", "Grisha", "Zub", "Throm", "Grakka", "Shanka"];
  const orcLast = ["Skullcrusher", "Bloodtusk", "Ironhide", "Direclaw", "Doomhammer", "Wildfury"];

  const tieflingFirst = ["Malakar", "Lilith", "Zariel", "Sariel", "Xandor", "Mephisto", "Damakos", "Verity", "Hope"];
  const tieflingLast = ["Hellfire", "Shadowbrand", "Sorrowgaze", "Ashenheart", "Soulweaver", "Brimstone"];

  const beastfolkFirst = ["Rox", "Finn", "Cleo", "Buster", "Luna", "Pip", "Ziggy", "Willow", "Jasper"];
  const beastfolkLast = ["Swiftclaw", "Goldtail", "Softfur", "Nightstalk", "Featherwing", "Wildpaws"];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  switch (species) {
    case "Elf":
      return `${pick(elfFirst)} ${pick(elfLast)}`;
    case "Dwarf":
      return `${pick(dwarfFirst)} ${pick(dwarfLast)}`;
    case "Orc":
      return `${pick(orcFirst)} ${pick(orcLast)}`;
    case "Tiefling":
      return `${pick(tieflingFirst)} ${pick(tieflingLast)}`;
    case "Beastfolk":
      return `${pick(beastfolkFirst)} ${pick(beastfolkLast)}`;
    case "Human":
    default:
      return `${pick(humanFirst)} ${pick(humanLast)}`;
  }
}

/**
 * Pure function: generateOffspring(parentA, parentB) -> Character
 * Generates an offspring character inheriting physical and personality traits from both parents,
 * with options for color-blending, parts inheritance, and mutations.
 */
export function generateOffspring(parentA: Character, parentB: Character): Character {
  const mutationChance = 0.15; // 15% chance for a specific trait to mutate completely

  // Species: 50% chance of either parent's species
  const species = Math.random() < 0.5 ? parentA.species : parentB.species;

  // Let's build physical traits
  // For colors, we blend by default (with a bit of random deviation), or mutate entirely.
  const inheritColor = (colorA: { h: number; s: number; l: number }, colorB: { h: number; s: number; l: number }) => {
    if (Math.random() < mutationChance) {
      // Complete color mutation (randomized)
      return {
        h: Math.floor(Math.random() * 360),
        s: clamp(Math.floor(Math.random() * 40) + 40, 20, 100), // 40-80%
        l: clamp(Math.floor(Math.random() * 40) + 30, 20, 95)  // 30-70%
      };
    }
    // Blend hues and average sat/lightness with a minor +/- 5% wobble
    const wobble = () => Math.floor(Math.random() * 11) - 5; // -5 to +5
    return {
      h: Math.round((blendHue(colorA.h, colorB.h) + wobble() + 360) % 360),
      s: clamp(Math.round((colorA.s + colorB.s) / 2 + wobble()), 10, 100),
      l: clamp(Math.round((colorA.l + colorB.l) / 2 + wobble()), 10, 95)
    };
  };

  const skin = inheritColor(
    { h: parentA.physicalTraits.skinToneHue, s: parentA.physicalTraits.skinToneSat, l: parentA.physicalTraits.skinToneLight },
    { h: parentB.physicalTraits.skinToneHue, s: parentB.physicalTraits.skinToneSat, l: parentB.physicalTraits.skinToneLight }
  );

  const hair = inheritColor(
    { h: parentA.physicalTraits.hairColorHue, s: parentA.physicalTraits.hairColorSat, l: parentA.physicalTraits.hairColorLight },
    { h: parentB.physicalTraits.hairColorHue, s: parentB.physicalTraits.hairColorSat, l: parentB.physicalTraits.hairColorLight }
  );

  const eye = inheritColor(
    { h: parentA.physicalTraits.eyeColorHue, s: parentA.physicalTraits.eyeColorSat, l: parentA.physicalTraits.eyeColorLight },
    { h: parentB.physicalTraits.eyeColorHue, s: parentB.physicalTraits.eyeColorSat, l: parentB.physicalTraits.eyeColorLight }
  );

  // Style properties: 50% A, 50% B, or mutated
  const hairStyles = ["short", "long", "braids", "curls", "crest", "afro", "mohawk"];
  const faceShapes = ["round", "sharp", "oval", "square"];
  const builds: Array<Character["physicalTraits"]["build"]> = ["slender", "average", "muscular", "stocky"];
  const markingStyles = ["none", "tattoos", "scars", "stripes", "freckles"];
  const accessories = ["none", "earrings", "glasses", "crown", "circlet", "eyepatch"];

  const inheritDiscrete = <T>(valA: T, valB: T, pool: T[]): T => {
    if (Math.random() < mutationChance) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return Math.random() < 0.5 ? valA : valB;
  };

  const hairStyle = inheritDiscrete(parentA.physicalTraits.hairStyle, parentB.physicalTraits.hairStyle, hairStyles);
  const faceShape = inheritDiscrete(parentA.physicalTraits.faceShape, parentB.physicalTraits.faceShape, faceShapes);
  const build = inheritDiscrete(parentA.physicalTraits.build, parentB.physicalTraits.build, builds);
  const markingStyle = inheritDiscrete(parentA.physicalTraits.markingStyle, parentB.physicalTraits.markingStyle, markingStyles);
  const accessory = inheritDiscrete(parentA.physicalTraits.accessory, parentB.physicalTraits.accessory, accessories);

  // Personality Traits: Blend both parents' values with a mutation offset
  const inheritPersonality = (valA: number, valB: number): number => {
    if (Math.random() < mutationChance) {
      // completely randomized mutation
      return Math.floor(Math.random() * 101);
    }
    // blend plus minor mutation nudge of -15 to +15
    const nudge = Math.floor(Math.random() * 31) - 15;
    return clamp(Math.round((valA + valB) / 2 + nudge), 0, 100);
  };

  const boldness = inheritPersonality(parentA.personalityTraits.boldness, parentB.personalityTraits.boldness);
  const warmth = inheritPersonality(parentA.personalityTraits.warmth, parentB.personalityTraits.warmth);
  const wit = inheritPersonality(parentA.personalityTraits.wit, parentB.personalityTraits.wit);
  const ambition = inheritPersonality(parentA.personalityTraits.ambition, parentB.personalityTraits.ambition);
  const chaos = inheritPersonality(parentA.personalityTraits.chaos, parentB.personalityTraits.chaos);

  // Background/Flavor
  const name = generateFantasyName(species);
  const background = `Offspring of ${parentA.name} and ${parentB.name}. Inherited ${parentA.name}'s ${parentA.physicalTraits.hairStyle} locks and ${parentB.name}'s ${parentB.physicalTraits.build} build.`;

  return {
    id: uuid(),
    name,
    species,
    physicalTraits: {
      skinToneHue: skin.h,
      skinToneSat: skin.s,
      skinToneLight: skin.l,
      hairColorHue: hair.h,
      hairColorSat: hair.s,
      hairColorLight: hair.l,
      eyeColorHue: eye.h,
      eyeColorSat: eye.s,
      eyeColorLight: eye.l,
      hairStyle,
      faceShape,
      build,
      markingStyle,
      accessory
    },
    personalityTraits: {
      boldness,
      warmth,
      wit,
      ambition,
      chaos
    },
    background,
    origin: "offspring",
    parentIds: [parentA.id, parentB.id],
    parentNames: [parentA.name, parentB.name]
  };
}
