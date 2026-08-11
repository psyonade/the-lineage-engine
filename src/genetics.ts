import { Character, GameSpecies, GeneticTraits, StylingTraits } from "./types";

/**
 * Generate a random id.
 */
export function uuid(): string {
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
export function generateFantasyName(species: GameSpecies): string {
  const humanFirst = ["Eldrin", "Kael", "Lyra", "Rowan", "Seraphina", "Dorian", "Aislin", "Gideon", "Saffron"];
  const humanLast = ["Stormweaver", "Oakheart", "Starling", "Silverwood", "Briarwood", "Crowley", "Hawthorne"];

  const elfFirst = ["Sylas", "Thalia", "Faelar", "Yvaine", "Galathel", "Lirael", "Aethelgard", "Nuala"];
  const elfLast = ["Moonwhisper", "Sunstrider", "Gildedleaf", "Stardust", "Windrunner", "Raindancer"];

  const dwarfFirst = ["Thorgar", "Bram", "Helga", "Ulfric", "Dagna", "Gimli", "Brokk", "Sari", "Grenda"];
  const dwarfLast = ["Ironbreaker", "Stonefist", "Goldvein", "Copperforge", "Deepdelve", "Mountainborn"];

  const halflingFirst = ["Bodo", "Cora", "Milo", "Pippin", "Rosie", "Toby", "Penny", "Finnan", "Lilly"];
  const halflingLast = ["Tealeaf", "Brushgather", "Underbough", "Hilltopple", "Goodbarrel", "Greenbottle"];

  const gnomeFirst = ["Gimble", "Zook", "Pip", "Tink", "Nissa", "Fizban", "Wrenn", "Oda", "Loopmottin"];
  const gnomeLast = ["Sparklegem", "Nackle", "Folkor", "Beren", "Doublelock", "Scheppen"];

  const orcFirst = ["Garrok", "Mog", "Karg", "Runa", "Grisha", "Zub", "Throm", "Grakka", "Shanka"];
  const orcLast = ["Skullcrusher", "Bloodtusk", "Ironhide", "Direclaw", "Doomhammer", "Wildfury"];

  const tieflingFirst = ["Malakar", "Lilith", "Zariel", "Sariel", "Xandor", "Mephisto", "Damakos", "Verity", "Hope"];
  const tieflingLast = ["Hellfire", "Shadowbrand", "Sorrowgaze", "Ashenheart", "Soulweaver", "Brimstone"];

  const dragonbornFirst = ["Balasar", "Donaar", "Ghesh", "Kriv", "Medrash", "Patrin", "Arjhan", "Nala", "Biri"];
  const dragonbornLast = ["Clearsighted", "Drachedandion", "Kepeshkmolik", "Myastan", "Turnuroth", "Ophidius"];

  const beastfolkFirst = ["Rox", "Finn", "Cleo", "Buster", "Luna", "Pip", "Ziggy", "Willow", "Jasper"];
  const beastfolkLast = ["Swiftclaw", "Goldtail", "Softfur", "Nightstalk", "Featherwing", "Wildpaws"];

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  switch (species) {
    case "Elf":
    case "Half-Elf":
      return `${pick(elfFirst)} ${pick(elfLast)}`;
    case "Dwarf":
      return `${pick(dwarfFirst)} ${pick(dwarfLast)}`;
    case "Halfling":
      return `${pick(halflingFirst)} ${pick(halflingLast)}`;
    case "Gnome":
      return `${pick(gnomeFirst)} ${pick(gnomeLast)}`;
    case "Orc":
    case "Half-Orc":
      return `${pick(orcFirst)} ${pick(orcLast)}`;
    case "Tiefling":
      return `${pick(tieflingFirst)} ${pick(tieflingLast)}`;
    case "Dragonborn":
      return `${pick(dragonbornFirst)} ${pick(dragonbornLast)}`;
    case "Beastfolk":
      return `${pick(beastfolkFirst)} ${pick(beastfolkLast)}`;
    case "Human":
    default:
      return `${pick(humanFirst)} ${pick(humanLast)}`;
  }
}

/**
 * Determine the hybrid species based on parent species.
 */
export function resolveHybridSpecies(speciesA: GameSpecies, speciesB: GameSpecies): GameSpecies {
  if (speciesA === speciesB) return speciesA;

  // Human + Elf -> Half-Elf
  if ((speciesA === "Human" && speciesB === "Elf") || (speciesA === "Elf" && speciesB === "Human")) {
    return "Half-Elf";
  }

  // Human + Orc -> Half-Orc
  if ((speciesA === "Human" && speciesB === "Orc") || (speciesA === "Orc" && speciesB === "Human")) {
    return "Half-Orc";
  }

  // Fallback: 50% chance of parent A or parent B
  return Math.random() < 0.5 ? speciesA : speciesB;
}

/**
 * Pure function: generateOffspring(parentA, parentB) -> Character
 * Generates an offspring character inheriting physical and personality traits from both parents,
 * with options for color-blending, parts inheritance, and mutations.
 * Strictly respects the genetic/styling split.
 */
export function generateOffspring(parentA: Character, parentB: Character): Character {
  const mutationChance = 0.15; // 15% chance for a specific trait to mutate completely

  // Resolve hybrid species
  const species = resolveHybridSpecies(parentA.species, parentB.species);

  // Gender assignment
  const genders: Character["gender"][] = ["Male", "Female", "Non-binary"];
  const gender = genders[Math.floor(Math.random() * genders.length)];

  // 1. INHERITING GENETIC TRAITS
  const inheritColor = (colorA: { h: number; s: number; l: number }, colorB: { h: number; s: number; l: number }) => {
    if (Math.random() < mutationChance) {
      // Complete color mutation (randomized)
      return {
        h: Math.floor(Math.random() * 360),
        s: clamp(Math.floor(Math.random() * 40) + 40, 20, 100), // 40-80%
        l: clamp(Math.floor(Math.random() * 40) + 30, 20, 95)  // 30-70%
      };
    }
    const wobble = () => Math.floor(Math.random() * 11) - 5; // -5 to +5
    return {
      h: Math.round((blendHue(colorA.h, colorB.h) + wobble() + 360) % 360),
      s: clamp(Math.round((colorA.s + colorB.s) / 2 + wobble()), 10, 100),
      l: clamp(Math.round((colorA.l + colorB.l) / 2 + wobble()), 10, 95)
    };
  };

  const skin = inheritColor(
    { h: parentA.geneticTraits.skinScaleFurToneHue, s: parentA.geneticTraits.skinScaleFurToneSat, l: parentA.geneticTraits.skinScaleFurToneLight },
    { h: parentB.geneticTraits.skinScaleFurToneHue, s: parentB.geneticTraits.skinScaleFurToneSat, l: parentB.geneticTraits.skinScaleFurToneLight }
  );

  const hair = inheritColor(
    { h: parentA.geneticTraits.hairColorHue, s: parentA.geneticTraits.hairColorSat, l: parentA.geneticTraits.hairColorLight },
    { h: parentB.geneticTraits.hairColorHue, s: parentB.geneticTraits.hairColorSat, l: parentB.geneticTraits.hairColorLight }
  );

  const eye = inheritColor(
    { h: parentA.geneticTraits.eyeColorHue, s: parentA.geneticTraits.eyeColorSat, l: parentA.geneticTraits.eyeColorLight },
    { h: parentB.geneticTraits.eyeColorHue, s: parentB.geneticTraits.eyeColorSat, l: parentB.geneticTraits.eyeColorLight }
  );

  const inheritDiscrete = <T>(valA: T, valB: T, pool: T[]): T => {
    if (Math.random() < mutationChance) {
      return pool[Math.floor(Math.random() * pool.length)];
    }
    return Math.random() < 0.5 ? valA : valB;
  };

  const faceShapes = ["round", "sharp", "oval", "square"];
  const builds: Array<Character["geneticTraits"]["build"]> = ["slender", "average", "muscular", "stocky"];
  const earShapes = ["normal", "pointed", "long", "animal", "broad"];
  const hairTextures = ["straight", "wavy", "curly", "coily", "wild"];
  const markingsPatterns = ["none", "tattoos", "scars", "stripes", "freckles"];
  const speciesFeaturesList = ["none", "horns", "tail", "wings", "fangs", "fluffy-tail"];

  const faceShape = inheritDiscrete(parentA.geneticTraits.faceShape, parentB.geneticTraits.faceShape, faceShapes);
  const build = inheritDiscrete(parentA.geneticTraits.build, parentB.geneticTraits.build, builds);
  const earShape = inheritDiscrete(parentA.geneticTraits.earShape, parentB.geneticTraits.earShape, earShapes);
  const hairTexture = inheritDiscrete(parentA.geneticTraits.hairTexture, parentB.geneticTraits.hairTexture, hairTextures);
  const markingsPattern = inheritDiscrete(parentA.geneticTraits.markingsPattern, parentB.geneticTraits.markingsPattern, markingsPatterns);

  // Specific species features logic
  let speciesFeatures = inheritDiscrete(parentA.geneticTraits.speciesFeatures, parentB.geneticTraits.speciesFeatures, speciesFeaturesList);
  if (species === "Tiefling" && speciesFeatures === "none") {
    speciesFeatures = "horns"; // Tieflings should default to horns
  } else if (species === "Dragonborn" && speciesFeatures === "none") {
    speciesFeatures = "tail"; // Dragonborn gets tail/scales
  }

  // Height inheritance: average of both parents with minor wobble, clamped between 100 and 220
  let parentHeightA = parentA.geneticTraits.height || 170;
  let parentHeightB = parentB.geneticTraits.height || 170;
  let height = Math.round((parentHeightA + parentHeightB) / 2 + (Math.floor(Math.random() * 11) - 5));
  if (Math.random() < mutationChance) {
    // Complete height mutation
    if (species === "Dwarf" || species === "Halfling" || species === "Gnome") {
      height = Math.floor(Math.random() * 40) + 100; // 100 to 140
    } else {
      height = Math.floor(Math.random() * 60) + 150; // 150 to 210
    }
  }
  height = clamp(height, 100, 220);

  const geneticTraits: GeneticTraits = {
    skinScaleFurToneHue: skin.h,
    skinScaleFurToneSat: skin.s,
    skinScaleFurToneLight: skin.l,
    hairColorHue: hair.h,
    hairColorSat: hair.s,
    hairColorLight: hair.l,
    eyeColorHue: eye.h,
    eyeColorSat: eye.s,
    eyeColorLight: eye.l,
    faceShape,
    build,
    height,
    earShape,
    hairTexture,
    markingsPattern,
    speciesFeatures
  };

  // 2. STYLING TRAITS (Randomized completely, never inherited!)
  const hairStyles = ["short", "long", "braids", "curls", "crest", "afro", "mohawk", "bald"];
  const accessories = ["none", "earrings", "glasses", "crown", "circlet", "eyepatch", "collar"];
  const clothings = ["commoner-robe", "knight-armor", "mage-cloak", "bard-tunic", "rogue-leather", "baker-apron"];

  const stylingTraits: StylingTraits = {
    hairStyle: hairStyles[Math.floor(Math.random() * hairStyles.length)],
    accessory: accessories[Math.floor(Math.random() * accessories.length)],
    clothing: clothings[Math.floor(Math.random() * clothings.length)]
  };

  // 3. PERSONALITY TRAITS: Blend both parents' values with a mutation offset
  const inheritPersonality = (valA: number, valB: number): number => {
    if (Math.random() < mutationChance) {
      return Math.floor(Math.random() * 101);
    }
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
  const background = `The offspring of ${parentA.name} and ${parentB.name}. Inherited a blended ${species} heritage, with parentage traits and completely unique fashion styling.`;

  return {
    id: uuid(),
    name,
    species,
    gender,
    geneticTraits,
    stylingTraits,
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
