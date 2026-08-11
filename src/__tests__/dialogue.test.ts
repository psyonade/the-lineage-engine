import { describe, it, expect } from "vitest";
import { ARCHETYPES, generateNPC } from "../npc";
import { getRelationshipStage, applyCompatibilityModifiers, getRelationshipPath } from "../dialogue";

describe("NPC Generation and Dialogue Engine", () => {
  it("procedurally generates diverse NPCs from archetype templates", () => {
    const bardTemplate = ARCHETYPES.find(a => a.name === "Roguish Bard")!;
    const npc = generateNPC(bardTemplate);

    expect(npc.species).toBe("Elf");
    expect(npc.personalityTraits.wit).toBeGreaterThanOrEqual(75);
    expect(npc.personalityTraits.wit).toBeLessThanOrEqual(100);
    expect(npc.background).toContain("Roguish Bard");
  });

  it("calculates relationship stages correctly based on stats", () => {
    expect(getRelationshipStage(10, 10)).toBe("Stranger");
    expect(getRelationshipStage(30, 30)).toBe("Acquaintance");
    expect(getRelationshipStage(60, 60)).toBe("Interested");
    expect(getRelationshipStage(90, 90)).toBe("Partner");
  });

  it("calculates emergent relationship paths correctly", () => {
    // Rivals to lovers: high rivalry and high attraction
    expect(getRelationshipPath({ affection: 10, trust: 10, attraction: 50, rivalry: 50 })).toBe("rivalsToLovers");

    // Friends first: High trust, but attraction/rivalry lower
    expect(getRelationshipPath({ affection: 10, trust: 60, attraction: 20, rivalry: 10 })).toBe("friendsFirst");
  });

  it("applies compatibility multipliers to stat deltas", () => {
    const rawDeltas = { affection: 10, trust: -10 };
    // high compatibility (100) -> 1.5x positive, 0.5x penalty
    const modifiedHigh = applyCompatibilityModifiers(rawDeltas, 100);
    expect(modifiedHigh.affection).toBe(15);
    expect(modifiedHigh.trust).toBe(-5);

    // low compatibility (0) -> 0.5x positive, 1.5x penalty
    const modifiedLow = applyCompatibilityModifiers(rawDeltas, 0);
    expect(modifiedLow.affection).toBe(5);
    expect(modifiedLow.trust).toBe(-15);
  });
});
