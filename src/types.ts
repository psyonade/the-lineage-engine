export type OriginType = "player" | "generated" | "offspring";

export type GameSpecies =
  | "Human"
  | "Elf"
  | "Dwarf"
  | "Halfling"
  | "Gnome"
  | "Half-Elf"
  | "Half-Orc"
  | "Orc"
  | "Tiefling"
  | "Dragonborn"
  | "Beastfolk";

export type GameGender = "Male" | "Female" | "Non-binary";

export interface GeneticTraits {
  skinScaleFurToneHue: number;     // HSL hue 0-360
  skinScaleFurToneSat: number;     // HSL saturation 0-100
  skinScaleFurToneLight: number;   // HSL lightness 0-100
  hairColorHue: number;            // HSL hue 0-360
  hairColorSat: number;            // HSL saturation 0-100
  hairColorLight: number;          // HSL lightness 0-100
  eyeColorHue: number;             // HSL hue 0-360
  eyeColorSat: number;             // HSL saturation 0-100
  eyeColorLight: number;           // HSL lightness 0-100
  faceShape: string;               // oval, round, sharp, square
  build: "slender" | "average" | "muscular" | "stocky";
  height: number;                  // numerical height (e.g., 100 to 220 cm)
  earShape: string;                // normal, pointed, long, animal, broad
  hairTexture: string;             // straight, wavy, curly, coily, wild
  markingsPattern: string;         // none, tattoos, scars, stripes, freckles
  speciesFeatures: string;         // none, horns, tail, wings, fangs, fluffy-tail
}

export interface StylingTraits {
  hairStyle: string;               // short, long, braids, curls, crest, afro, mohawk, bald
  accessory: string;               // none, earrings, glasses, crown, circlet, eyepatch, collar
  clothing: string;                // commoner-robe, knight-armor, mage-cloak, bard-tunic, rogue-leather, baker-apron
}

export interface Character {
  id: string;
  name: string;
  species: GameSpecies;
  gender: GameGender;
  geneticTraits: GeneticTraits;
  stylingTraits: StylingTraits;
  personalityTraits: {
    boldness: number;  // 0-100
    warmth: number;    // 0-100
    wit: number;       // 0-100
    ambition: number;  // 0-100
    chaos: number;     // 0-100
  };
  background: string;
  origin: OriginType;
  isUnique?: boolean;               // Hand-authored unique NPCs
  questStage?: number;              // Current stage of quest (e.g. 0 to 3)
  parentIds?: [string, string];     // Present if origin === "offspring"
  parentNames?: [string, string];   // Visual reference
  age?: number;                     // Season/turn clock age: 0-2 (Youth), 3-8 (Prime), 9+ (Elder)
  legendaryTraits?: string[];       // Separate category of inheritable traits
  carriedTraits?: string[];         // Recessively carried genetic/legendary traits
  generation?: number;              // Generation level (Player = 1, Offspring = Parent + 1)
}

export type RelationshipStage = "Stranger" | "Acquaintance" | "Interested" | "Partner";
export type RelationshipPath = "friendsFirst" | "rivalsToLovers" | "whirlwind" | "slowBurn" | "none";

export interface RelationshipStats {
  affection: number;   // 0-100
  trust: number;       // 0-100
  attraction: number;  // 0-100
  rivalry: number;     // 0-100
}

export interface Relationship {
  characterAId: string; // usually player
  characterBId: string; // NPC
  stage: RelationshipStage;
  path: RelationshipPath;
  stats: RelationshipStats;
  history: InteractionLog[];
}

export interface InteractionLog {
  timestamp: number;
  sceneId: string;
  choiceMade: string;
  statDeltas: Partial<RelationshipStats>;
}

// Dialogue Tree Structures
export interface Choice {
  text: string;
  nextNodeId: string; // ID of the next SceneNode
  statDeltas?: Partial<RelationshipStats>; // How this choice changes relationships
  requirements?: {
    trait?: keyof Character["personalityTraits"];
    minVal?: number;
    relationshipStat?: keyof RelationshipStats;
    minRelVal?: number;
  };
}

export interface SceneNode {
  id: string;
  text: string;
  speaker: "NPC" | "Player" | "Narrator";
  choices: Choice[];
}

export interface Scene {
  id: string;
  title: string;
  nodes: Record<string, SceneNode>; // Key is node ID (start node is usually "start")
  triggerConditions?: {
    minStage?: RelationshipStage;
    maxStage?: RelationshipStage;
    requiredNPC?: string; // archetype, name, or id
  };
}

// SVG layers representation
export interface LayerDef {
  layerType: "silhouette" | "skin" | "faceShape" | "eyes" | "hair" | "markings" | "accessory" | "clothing";
  shapeId: string;
  colorTrait?: string;
  compatibleSpecies: string[];
}

export interface SaveState {
  player: Character | null;
  npcs: Character[];
  relationships: Record<string, Relationship>; // Key is NPC ID
  offspring: Character[];
  currentSeason?: number;
  actionPoints?: number;
  unlockedAchievements?: string[];
}
