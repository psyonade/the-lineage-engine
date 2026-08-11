import { Character } from "./types";
import { generateFantasyName } from "./genetics";

export interface ArchetypeTemplate {
  name: string;
  speciesDefault: Character["species"];
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
  } else if (species === "Orc") {
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
  } else {
    // Human
    skinH = Math.floor(Math.random() * 30) + 15;
    skinS = 45; skinL = Math.floor(Math.random() * 40) + 40;
    hairH = Math.floor(Math.random() * 40) + 10;
    hairS = 50; hairL = 25;
    eyeH = 210; // blue
  }

  const hairStyles = ["short", "long", "braids", "curls", "crest", "afro", "mohawk"];
  const faceShapes = ["round", "sharp", "oval", "square"];
  const builds: Array<Character["physicalTraits"]["build"]> = ["slender", "average", "muscular", "stocky"];
  const markingStyles = ["none", "tattoos", "scars", "stripes", "freckles"];
  const accessories = ["none", "earrings", "glasses", "crown", "circlet", "eyepatch"];

  // Randomize physical style tags
  const hairStyle = hairStyles[Math.floor(Math.random() * hairStyles.length)];
  const faceShape = faceShapes[Math.floor(Math.random() * faceShapes.length)];
  const build = builds[Math.floor(Math.random() * builds.length)];
  const markingStyle = markingStyles[Math.floor(Math.random() * markingStyles.length)];
  const accessory = accessories[Math.floor(Math.random() * accessories.length)];

  return {
    id: `npc-${Math.random().toString(36).substring(2, 9)}`,
    name,
    species,
    physicalTraits: {
      skinToneHue: skinH,
      skinToneSat: skinS,
      skinToneLight: skinL,
      hairColorHue: hairH,
      hairColorSat: hairS,
      hairColorLight: hairL,
      eyeColorHue: eyeH,
      eyeColorSat: 80,
      eyeColorLight: 50,
      hairStyle,
      faceShape,
      build,
      markingStyle,
      accessory
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
