import { describe, it, expect } from "vitest";
import { generateOffspring, blendHue, checkPairingEligibility } from "../genetics";
import { Character } from "../types";

const makeMockChar = (id: string, name: string, species: Character["species"], color: number, traits: Partial<Character["personalityTraits"]>): Character => {
  return {
    id,
    name,
    species,
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: color, skinScaleFurToneSat: 50, skinScaleFurToneLight: 50,
      hairColorHue: color, hairColorSat: 60, hairColorLight: 30,
      eyeColorHue: color, eyeColorSat: 80, eyeColorLight: 50,
      faceShape: "oval", build: "average", height: 170, earShape: "pointed",
      hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
    },
    stylingTraits: {
      hairStyle: "short", accessory: "none", clothing: "commoner-robe"
    },
    personalityTraits: {
      boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50,
      ...traits
    },
    background: "Parent",
    origin: "generated"
  };
};

describe("Genetics / Offspring Engine", () => {
  it("blends HSL hues correctly wrapping around 360", () => {
    expect(blendHue(10, 30)).toBe(20);
    expect(blendHue(350, 10)).toBe(0); // wrapping shortcut
  });

  it("produces offspring that inherits parent attributes", () => {
    const parentA = makeMockChar("pA", "Arthur", "Human", 40, { warmth: 80, boldness: 20 });
    const parentB = makeMockChar("pB", "Bess", "Elf", 80, { warmth: 40, boldness: 80 });

    const offspring = generateOffspring(parentA, parentB);

    expect(offspring.origin).toBe("offspring");
    expect(offspring.parentIds).toContain("pA");
    expect(offspring.parentIds).toContain("pB");
    expect(offspring.parentNames).toContain("Arthur");
    expect(offspring.parentNames).toContain("Bess");
    // Canonical Half-Elf check: Human + Elf -> Half-Elf
    expect(offspring.species).toBe("Half-Elf");

    // Blended or mutated personality
    expect(offspring.personalityTraits.warmth).toBeGreaterThanOrEqual(0);
    expect(offspring.personalityTraits.warmth).toBeLessThanOrEqual(100);
  });

  describe("Lineage Depth and Pairing Eligibility", () => {

    it("verifies pairing eligibility based on age stages", () => {
      const parentA = makeMockChar("pA", "Arthur", "Human", 40, {});
      const parentB = makeMockChar("pB", "Bess", "Elf", 80, {});

      // Default mock chars don't have age, so they default to 3 (Prime)
      expect(checkPairingEligibility(parentA, parentB).eligible).toBe(true);

      // Youth cannot breed
      parentA.age = 1; // Youth
      expect(checkPairingEligibility(parentA, parentB).eligible).toBe(false);
      expect(checkPairingEligibility(parentA, parentB).reason).toContain("breeding age");

      // Elder cannot breed
      parentA.age = 10; // Elder
      expect(checkPairingEligibility(parentA, parentB).eligible).toBe(false);
      expect(checkPairingEligibility(parentA, parentB).reason).toContain("breeding age");
    });

    it("prevents direct parent-child pairings", () => {
      const parentA = makeMockChar("pA", "Arthur", "Human", 40, {});
      const parentB = makeMockChar("pB", "Bess", "Elf", 80, {});

      const child = generateOffspring(parentA, parentB);
      child.age = 3; // make it prime

      // Attempt to breed child with parentA
      const result = checkPairingEligibility(child, parentA);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("parent-child");
    });

    it("prevents sibling pairings", () => {
      const parentA = makeMockChar("pA", "Arthur", "Human", 40, {});
      const parentB = makeMockChar("pB", "Bess", "Elf", 80, {});

      const sibling1 = generateOffspring(parentA, parentB);
      const sibling2 = generateOffspring(parentA, parentB);
      sibling1.age = 3;
      sibling2.age = 3;

      const result = checkPairingEligibility(sibling1, sibling2);
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain("sibling");
    });

    it("handles legendary and recessive trait inheritance across generations", () => {
      const parentA = makeMockChar("pA", "Arthur", "Human", 40, {});
      parentA.legendaryTraits = ["Moonlight Grace"];

      const parentB = makeMockChar("pB", "Bess", "Elf", 80, {});

      // Create children, some should express or carry the legendary trait
      const children = Array.from({ length: 25 }).map(() => generateOffspring(parentA, parentB));

      const someExpressOrCarry = children.some(child => {
        const carries = child.carriedTraits?.includes("Moonlight Grace");
        const expresses = child.legendaryTraits?.includes("Moonlight Grace");
        return carries || expresses;
      });
      expect(someExpressOrCarry).toBe(true);
    });
  });
});
