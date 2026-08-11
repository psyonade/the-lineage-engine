export type OriginType = "player" | "generated" | "offspring";

export interface Trait {
  id: string; // e.g. "boldness", "warmth", "wit", "ambition", "chaos"
  category: "physical" | "personality" | "background";
  label: string;
  value: number; // 0 to 100 for numerical traits, or static representations
}

export interface Character {
  id: string;
  name: string;
  species: "Human" | "Elf" | "Dwarf" | "Orc" | "Tiefling" | "Beastfolk";
  physicalTraits: {
    skinToneHue: number;       // HSL hue 0-360
    skinToneSat: number;       // HSL saturation 0-100
    skinToneLight: number;     // HSL lightness 0-100
    hairColorHue: number;      // HSL hue 0-360
    hairColorSat: number;      // HSL saturation 0-100
    hairColorLight: number;    // HSL lightness 0-100
    eyeColorHue: number;       // HSL hue 0-360
    eyeColorSat: number;       // HSL saturation 0-100
    eyeColorLight: number;     // HSL lightness 0-100
    hairStyle: string;         // e.g., "short", "long", "braids", "curls", "crest"
    faceShape: string;         // e.g., "round", "sharp", "oval", "square"
    build: "slender" | "average" | "muscular" | "stocky";
    markingStyle: string;      // "none" | "tattoos" | "scars" | "stripes" | "freckles"
    accessory: string;         // "none" | "earrings" | "glasses" | "crown" | "circlet" | "eyepatch"
  };
  personalityTraits: {
    boldness: number;  // 0-100
    warmth: number;    // 0-100
    wit: number;       // 0-100
    ambition: number;  // 0-100
    chaos: number;     // 0-100
  };
  background: string;
  origin: OriginType;
  parentIds?: [string, string]; // Present if origin === "offspring"
  parentNames?: [string, string]; // Visual reference
}

export type RelationshipStage = "Stranger" | "Acquaintance" | "Interested" | "Partner";

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
    requiredNPC?: string; // archetype or id
  };
}

// SVG layers representation
export interface LayerDef {
  layerType: "silhouette" | "skin" | "faceShape" | "eyes" | "hair" | "markings" | "accessory";
  shapeId: string;
  colorTrait?: string; // color property name in character.physicalTraits, e.g. "skinTone"
  compatibleSpecies: string[];
}

export interface SaveState {
  player: Character | null;
  npcs: Character[];
  relationships: Record<string, Relationship>; // Key is NPC ID
  offspring: Character[];
}
