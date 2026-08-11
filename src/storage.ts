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
      if (charA && charB && isRestrictedFamily(charA, charB)) {
        rel.stats.attraction = 0;
      }
    });
  }
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
