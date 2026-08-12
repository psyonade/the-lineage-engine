import { SaveState, Character, Relationship, RelationshipStage } from "./types";
import { isRestrictedFamily } from "./genetics";

const SAVE_KEY = "lineage_engine_save_state";

export function loadGame(): SaveState {
  const saved = localStorage.getItem(SAVE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error("Error parsing save state", e);
    }
  }
  return {
    player: null,
    npcs: [],
    relationships: {},
    offspring: []
  };
}

export function saveGame(state: SaveState): void {
  if (state.player) {
    const allCharacters = [state.player].concat(state.npcs || []).concat(state.offspring || []).filter(Boolean);
    Object.values(state.relationships || {}).forEach((rel: Relationship) => {
      const charA = allCharacters.find(c => c.id === rel.characterAId);
      const charB = allCharacters.find(c => c.id === rel.characterBId);

      // Strict clamping between 0 and 100 for all relationship stats
      rel.stats.affection = Math.max(0, Math.min(100, rel.stats.affection));
      rel.stats.trust = Math.max(0, Math.min(100, rel.stats.trust));
      rel.stats.attraction = Math.max(0, Math.min(100, rel.stats.attraction));
      rel.stats.rivalry = Math.max(0, Math.min(100, rel.stats.rivalry));

      if (charA && charB && isRestrictedFamily(charA, charB)) {
        rel.stats.attraction = 0;
      }
    });

    // Strictly clamp personality stats for all characters to prevent any mutation overflows
    allCharacters.forEach(c => {
      if (c && c.personalityTraits) {
        c.personalityTraits.boldness = Math.max(0, Math.min(100, c.personalityTraits.boldness));
        c.personalityTraits.warmth = Math.max(0, Math.min(100, c.personalityTraits.warmth));
        c.personalityTraits.wit = Math.max(0, Math.min(100, c.personalityTraits.wit));
        c.personalityTraits.ambition = Math.max(0, Math.min(100, c.personalityTraits.ambition));
        c.personalityTraits.chaos = Math.max(0, Math.min(100, c.personalityTraits.chaos));
      }
    });
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
