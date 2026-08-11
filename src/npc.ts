import { Character, GameSpecies } from "./types";
import { generateFantasyName } from "./genetics";

export interface ArchetypeTemplate {
  name: string;
  speciesDefault: GameSpecies;
  personalityBase: {
    boldness: [number, number]; // [min, max] bands
    warmth: [number, number];
    wit: [number, number];
    ambition: [number, number];
    chaos: [number, number];
  };
  flavorText: string;
  dialogueHook: string;
}

export const ARCHETYPES: ArchetypeTemplate[] = [
  {
    name: "Roguish Bard",
    speciesDefault: "Elf",
    personalityBase: {
      boldness: [70, 95],
      warmth: [50, 80],
      wit: [75, 100],
      ambition: [40, 70],
      chaos: [65, 95]
    },
    flavorText: "A silver-tongued charmer with a lute and a wink. Loves mischief and grand entrances.",
    dialogueHook: "Ah, looking for some poetry, or perhaps a daring heist partner? I excel at both."
  },
  {
    name: "Stoic Knight",
    speciesDefault: "Dwarf",
    personalityBase: {
      boldness: [80, 95],
      warmth: [20, 50],
      wit: [20, 50],
      ambition: [60, 85],
      chaos: [5, 25]
    },
    flavorText: "Bound by steel and duty. Quietly protective and deeply devoted to honor.",
    dialogueHook: "I stand on guard. State your business, stranger, but know you are safe in my shadow."
  },
  {
    name: "Feral Druid",
    speciesDefault: "Beastfolk",
    personalityBase: {
      boldness: [50, 80],
      warmth: [60, 90],
      wit: [30, 60],
      ambition: [10, 40],
      chaos: [60, 90]
    },
    flavorText: "Smells of moss and rain. More comfortable with wolves than high society.",
    dialogueHook: "The trees whispered about your arrival. Are you here to listen, or just stamp on the roots?"
  },
  {
    name: "Ambitious Mage",
    speciesDefault: "Tiefling",
    personalityBase: {
      boldness: [60, 85],
      warmth: [15, 45],
      wit: [70, 95],
      ambition: [80, 100],
      chaos: [40, 70]
    },
    flavorText: "Chasing ancient forbidden secrets. Often mutters to themselves in extinct languages.",
    dialogueHook: "Don't touch that! It could turn you inside out... though, now that I think of it, that would be a fascinating experiment."
  },
  {
    name: "Cheerful Baker",
    speciesDefault: "Human",
    personalityBase: {
      boldness: [30, 60],
      warmth: [80, 100],
      wit: [40, 70],
      ambition: [20, 50],
      chaos: [10, 40]
    },
    flavorText: "Always covered in flour and smiles. Believes every problem can be solved with hot pastry.",
    dialogueHook: "Oh, you look absolutely famished! Sit down, let me fetch you a fresh cinnamon bun."
  },
  {
    name: "Grim Mercenary",
    speciesDefault: "Orc",
    personalityBase: {
      boldness: [75, 95],
      warmth: [10, 35],
      wit: [30, 60],
      ambition: [50, 80],
      chaos: [40, 70]
    },
    flavorText: "Scars tell their stories. Pragmatic, survival-focused, but has a surprisingly soft spot for stray animals.",
    dialogueHook: "No free favors in this world. But if you have gold—or a decent story—I might listen."
  }
];

function randomInBand(band: [number, number]): number {
  return Math.floor(Math.random() * (band[1] - band[0] + 1)) + band[0];
}

export function generateNPC(archetype: ArchetypeTemplate): Character {
  const species = archetype.speciesDefault;
  const name = generateFantasyName(species);

  // Generate HSL color palettes matching species defaults
  let skinH = 25;
  let skinS = 40;
  let skinL = 60;
  let hairH = 30;
  let hairS = 50;
  let hairL = 30;
  let eyeH = 200;

  if (species === "Elf") {
    skinH = Math.floor(Math.random() * 20) + 20; // pale gold
    skinS = 30; skinL = 80;
    hairH = Math.floor(Math.random() * 40) + 180; // silver-blue/white
    hairS = 20; hairL = 85;
    eyeH = 140; // green
  } else if (species === "Orc" || species === "Half-Orc") {
    skinH = Math.floor(Math.random() * 40) + 90; // greenish/greyish
    skinS = 25; skinL = 45;
    hairH = 0; hairS = 0; hairL = 15; // dark
    eyeH = 20; // red/orange eyes
  } else if (species === "Tiefling") {
    skinH = Math.floor(Math.random() * 30) + 340; // reddish/violet
    skinS = 60; skinL = 50;
    hairH = 260; hairS = 50; hairL = 20; // deep purple
    eyeH = 45; // yellow/gold eyes
  } else if (species === "Dwarf") {
    skinH = 25; skinS = 50; skinL = 65;
    hairH = 20; hairS = 70; hairL = 35; // ginger/brown
    eyeH = 100; // hazel
  } else if (species === "Beastfolk") {
    skinH = 35; skinS = 50; skinL = 50; // fur/lion tones
    hairH = 35; hairS = 60; hairL = 25;
    eyeH = 50; // feline gold
  } else if (species === "Dragonborn") {
    skinH = Math.floor(Math.random() * 50) + 15; // brass/copper
    skinS = 60; skinL = 45;
    hairH = 40; hairS = 60; hairL = 20;
    eyeH = 35; // cat-like yellow
  } else if (species === "Halfling") {
    skinH = 30; skinS = 45; skinL = 68;
    hairH = 25; hairS = 55; hairL = 30;
    eyeH = 120; // green
  } else if (species === "Gnome") {
    skinH = 28; skinS = 40; skinL = 72;
    hairH = 160; hairS = 60; hairL = 60; // whimsical pink/teal
    eyeH = 190;
  } else {
    // Human
    skinH = Math.floor(Math.random() * 30) + 15;
    skinS = 45; skinL = Math.floor(Math.random() * 40) + 40;
    hairH = Math.floor(Math.random() * 40) + 10;
    hairS = 50; hairL = 25;
    eyeH = 210; // blue
  }

  const hairStyles = ["short", "long", "braids", "curls", "crest", "afro", "mohawk", "bald"];
  const faceShapes = ["round", "sharp", "oval", "square"];
  const builds: Array<Character["geneticTraits"]["build"]> = ["slender", "average", "muscular", "stocky"];
  const earShapes = ["normal", "pointed", "long", "animal", "broad"];
  const hairTextures = ["straight", "wavy", "curly", "coily", "wild"];
  const markingsPatterns = ["none", "tattoos", "scars", "stripes", "freckles"];
  const accessories = ["none", "earrings", "glasses", "crown", "circlet", "eyepatch", "collar"];
  const clothings = ["commoner-robe", "knight-armor", "mage-cloak", "bard-tunic", "rogue-leather", "baker-apron"];

  // Randomize physical style tags
  const hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
  const faceShape = faceShapes[Math.floor(Math.random() * faceShapes.length)];
  const build = builds[Math.floor(Math.random() * builds.length)];
  const earShape = earShapes[Math.floor(Math.random() * earShapes.length)];
  const hairTexture = hairTextures[Math.floor(Math.random() * hairTextures.length)];
  const markingsPattern = markingsPatterns[Math.floor(Math.random() * markingsPatterns.length)];
  const accessory = accessories[Math.floor(Math.random() * accessories.length)];
  const clothing = clothings[Math.floor(Math.random() * clothings.length)];

  // Set height defaults based on species standards
  let height = 170;
  if (species === "Halfling" || species === "Gnome") {
    height = Math.floor(Math.random() * 15) + 100; // 100 - 115
  } else if (species === "Elf" || species === "Dragonborn" || species === "Tiefling") {
    height = Math.floor(Math.random() * 20) + 185; // 185 - 205
  } else if (species === "Dwarf") {
    height = Math.floor(Math.random() * 15) + 135; // 135 - 150
  } else {
    height = Math.floor(Math.random() * 30) + 155; // 155 - 185
  }

  // Set species features
  let speciesFeatures = "none";
  if (species === "Tiefling") speciesFeatures = "horns";
  else if (species === "Dragonborn") speciesFeatures = "tail";
  else if (species === "Beastfolk") speciesFeatures = "fluffy-tail";

  return {
    id: `npc-${Math.random().toString(36).substring(2, 9)}`,
    name,
    species,
    gender: Math.random() < 0.4 ? "Male" : Math.random() < 0.8 ? "Female" : "Non-binary",
    geneticTraits: {
      skinScaleFurToneHue: skinH,
      skinScaleFurToneSat: skinS,
      skinScaleFurToneLight: skinL,
      hairColorHue: hairH,
      hairColorSat: hairS,
      hairColorLight: hairL,
      eyeColorHue: eyeH,
      eyeColorSat: 80,
      eyeColorLight: 50,
      faceShape,
      build,
      height,
      earShape,
      hairTexture,
      markingsPattern,
      speciesFeatures
    },
    stylingTraits: {
      hairStyle,
      accessory,
      clothing
    },
    personalityTraits: {
      boldness: randomInBand(archetype.personalityBase.boldness),
      warmth: randomInBand(archetype.personalityBase.warmth),
      wit: randomInBand(archetype.personalityBase.wit),
      ambition: randomInBand(archetype.personalityBase.ambition),
      chaos: randomInBand(archetype.personalityBase.chaos)
    },
    background: `${archetype.name}: ${archetype.flavorText}`,
    origin: "generated"
  };
}

/**
 * Define the 3 static named unique NPCs with full 3-stage storylines
 */
export const UNIQUE_NPCS: Character[] = [
  {
    id: "npc-elara",
    name: "Elara Moonshadow",
    species: "Elf",
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: 35,
      skinScaleFurToneSat: 25,
      skinScaleFurToneLight: 85,
      hairColorHue: 195,
      hairColorSat: 30,
      hairColorLight: 85,
      eyeColorHue: 145,
      eyeColorSat: 70,
      eyeColorLight: 55,
      faceShape: "sharp",
      build: "slender",
      height: 192,
      earShape: "pointed",
      hairTexture: "wavy",
      markingsPattern: "none",
      speciesFeatures: "none"
    },
    stylingTraits: {
      hairStyle: "braids",
      accessory: "circlet",
      clothing: "rogue-leather"
    },
    personalityTraits: {
      boldness: 75,
      warmth: 65,
      wit: 50,
      ambition: 60,
      chaos: 40
    },
    background: "★ Storied Ranger: Guardian of the twilight forest trail. Calm, focused, and deeply devoted to nature.",
    origin: "generated",
    isUnique: true,
    questStage: 0
  },
  {
    id: "npc-ignatius",
    name: "Ignatius Brimstone",
    species: "Tiefling",
    gender: "Male",
    geneticTraits: {
      skinScaleFurToneHue: 345,
      skinScaleFurToneSat: 70,
      skinScaleFurToneLight: 45,
      hairColorHue: 275,
      hairColorSat: 65,
      hairColorLight: 20,
      eyeColorHue: 48,
      eyeColorSat: 90,
      eyeColorLight: 60,
      faceShape: "oval",
      build: "slender",
      height: 198,
      earShape: "pointed",
      hairTexture: "straight",
      markingsPattern: "tattoos",
      speciesFeatures: "horns"
    },
    stylingTraits: {
      hairStyle: "crest",
      accessory: "glasses",
      clothing: "mage-cloak"
    },
    personalityTraits: {
      boldness: 65,
      warmth: 40,
      wit: 85,
      ambition: 90,
      chaos: 55
    },
    background: "★ Storied Mage: Relentless scholar tracking long-lost forbidden artifacts. Fascinated by ancient spells.",
    origin: "generated",
    isUnique: true,
    questStage: 0
  },
  {
    id: "npc-brenda",
    name: "Brenda Ironfist",
    species: "Dwarf",
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: 22,
      skinScaleFurToneSat: 45,
      skinScaleFurToneLight: 64,
      hairColorHue: 15,
      hairColorSat: 80,
      hairColorLight: 40,
      eyeColorHue: 105,
      eyeColorSat: 65,
      eyeColorLight: 50,
      faceShape: "square",
      build: "stocky",
      height: 142,
      earShape: "normal",
      hairTexture: "coily",
      markingsPattern: "scars",
      speciesFeatures: "none"
    },
    stylingTraits: {
      hairStyle: "curls",
      accessory: "earrings",
      clothing: "knight-armor"
    },
    personalityTraits: {
      boldness: 90,
      warmth: 55,
      wit: 60,
      ambition: 75,
      chaos: 30
    },
    background: "★ Storied Blacksmith: An iron-willed dwarven metal-forger with a fiery passion and unmatched work ethic.",
    origin: "generated",
    isUnique: true,
    questStage: 0
  }
];
