import { SaveState, Character, Relationship, RelationshipStage } from "./types";

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
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function clearGame(): void {
  localStorage.removeItem(SAVE_KEY);
}
