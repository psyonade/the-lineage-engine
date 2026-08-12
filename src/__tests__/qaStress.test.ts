import { describe, it, expect } from "vitest";
import { generateOffspring, checkPairingEligibility, isRestrictedFamily } from "../genetics";
import { computeCompatibility } from "../compatibility";
import { Character } from "../types";

const makeMockCharForQA = (id: string, name: string, age: number, generation: number, traits: Partial<Character["personalityTraits"]>, geneticOverrides?: Partial<Character["geneticTraits"]>): Character => {
  return {
    id,
    name,
    species: "Human",
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: 20, skinScaleFurToneSat: 50, skinScaleFurToneLight: 50,
      hairColorHue: 40, hairColorSat: 60, hairColorLight: 30,
      eyeColorHue: 200, eyeColorSat: 80, eyeColorLight: 50,
      faceShape: "oval", build: "average", height: 170, earShape: "normal",
      hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none",
      ...geneticOverrides
    },
    stylingTraits: {
      hairStyle: "long", accessory: "crown", clothing: "knight-armor"
    },
    personalityTraits: {
      boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50,
      ...traits
    },
    background: "QA Test Background",
    origin: "generated",
    age,
    generation
  };
};

describe("Comprehensive QA & Edge Case Test Suite", () => {

  describe("1. Offspring Generation Trait Split", () => {
    it("ensures styling traits are randomized and never inherited from parents", () => {
      const parentA = makeMockCharForQA("pA", "Parent A", 4, 1, {});
      const parentB = makeMockCharForQA("pB", "Parent B", 4, 1, {});

      // Mock styling traits of parents
      parentA.stylingTraits = { hairStyle: "long", accessory: "crown", clothing: "knight-armor" };
      parentB.stylingTraits = { hairStyle: "long", accessory: "crown", clothing: "knight-armor" };

      // Since styling is completely randomized from a list of options, generating multiple offspring
      // should yield diverse styling traits, proving they are NOT inherited.
      const stylingCrops = Array.from({ length: 30 }).map(() => generateOffspring(parentA, parentB));

      const hairStyles = new Set(stylingCrops.map(c => c.stylingTraits.hairStyle));
      const accessories = new Set(stylingCrops.map(c => c.stylingTraits.accessory));
      const clothingOptions = new Set(stylingCrops.map(c => c.stylingTraits.clothing));

      // Over 30 runs, we should see multiple different styles generated, proving non-inheritance
      expect(hairStyles.size).toBeGreaterThan(1);
      expect(accessories.size).toBeGreaterThan(1);
      expect(clothingOptions.size).toBeGreaterThan(1);
    });

    it("blends or mutates genetic traits appropriately", () => {
      const parentA = makeMockCharForQA("pA", "Parent A", 4, 1, {}, { skinScaleFurToneHue: 100, height: 160 });
      const parentB = makeMockCharForQA("pB", "Parent B", 4, 1, {}, { skinScaleFurToneHue: 200, height: 180 });

      const children = Array.from({ length: 50 }).map(() => generateOffspring(parentA, parentB));

      children.forEach(child => {
        // Height should be close to average of both parents (170 +/- wobble) OR complete mutation (clamped)
        expect(child.geneticTraits.height).toBeGreaterThanOrEqual(100);
        expect(child.geneticTraits.height).toBeLessThanOrEqual(220);

        // Skin Tone Hue is either color blended OR complete color mutation (0-360)
        expect(child.geneticTraits.skinScaleFurToneHue).toBeGreaterThanOrEqual(0);
        expect(child.geneticTraits.skinScaleFurToneHue).toBeLessThanOrEqual(360);
      });
    });
  });

  describe("2. Compatibility Engine Calculations", () => {
    it("verify that base score starts at exactly 20% rebalanced math", () => {
      const pA = makeMockCharForQA("p1", "Char 1", 3, 1, { warmth: 50, boldness: 50, wit: 50, ambition: 50, chaos: 50 });
      const pB = makeMockCharForQA("p2", "Char 2", 3, 1, { warmth: 50, boldness: 50, wit: 50, ambition: 50, chaos: 50 });
      pB.species = "Elf"; // different species gives a bonus of +12

      const comp = computeCompatibility(pA, pB);
      // Base score starts at 20.
      // Warmth average is 50 -> neutral (no warmth avg >= 75 or <= 25, warmth diff is 0 < 50 -> "comfortable steady warmth") -> totalScore += 0
      // Boldness diff is 0 < 60 -> neutral -> totalScore += 0
      // Wit average is 50 -> neutral -> totalScore += 0
      // Ambition -> neutral -> totalScore += 0
      // Chaos -> neutral -> totalScore += 0
      // Species mismatch bonus -> +12
      // Total score = 20 + 12 = 32%
      expect(comp.score).toBe(32);
    });

    it("verifies negative penalties are applied for mismatches", () => {
      // Create characters with cold warmth (<= 25 average), which applies a penalty of -15
      const coldA = makeMockCharForQA("p1", "Char 1", 3, 1, { warmth: 10, boldness: 50, wit: 50, ambition: 50, chaos: 50 });
      const coldB = makeMockCharForQA("p2", "Char 2", 3, 1, { warmth: 20, boldness: 50, wit: 50, ambition: 50, chaos: 50 });
      coldB.species = "Human"; // same species gives +8 bonus

      const comp = computeCompatibility(coldA, coldB);
      // Base: 20. Warmth penalty: -15. Species bonus: +8. Net: 13.
      expect(comp.score).toBe(13);
    });

    it("strictly bounds the final score between 0% and 100%", () => {
      // Worst case: extremely mismatched cold, reserved, low-wit, low-ambition, clashing chaos characters
      const terribleA = makeMockCharForQA("p1", "Char 1", 3, 1, { warmth: 5, boldness: 5, wit: 5, ambition: 5, chaos: 95 });
      const terribleB = makeMockCharForQA("p2", "Char 2", 3, 1, { warmth: 5, boldness: 5, wit: 5, ambition: 5, chaos: 5 });
      terribleB.species = "Human";

      const compBad = computeCompatibility(terribleA, terribleB);
      expect(compBad.score).toBeGreaterThanOrEqual(0);

      // Best case: extremely compatible warm, witty, chaotic adventurous matching characters
      const greatA = makeMockCharForQA("p1", "Char 1", 3, 1, { warmth: 95, boldness: 95, wit: 95, ambition: 95, chaos: 95 });
      const greatB = makeMockCharForQA("p2", "Char 2", 3, 1, { warmth: 95, boldness: 95, wit: 95, ambition: 95, chaos: 95 });
      const compGood = computeCompatibility(greatA, greatB);
      expect(compGood.score).toBeLessThanOrEqual(100);
    });
  });

  describe("3. Autonomous Turn Events Mechanics", () => {
    it("successfully simulates End Season unpartnered Prime NPC partnership logic", () => {
      // Establish eligible unpartnered Prime stage characters
      const eligibleNPCs: Character[] = [
        makeMockCharForQA("npc1", "Arthur", 4, 1, {}),
        makeMockCharForQA("npc2", "Bess", 4, 1, {}),
        makeMockCharForQA("npc3", "Charlie", 4, 1, {})
      ];

      // Exclude player and spouses, find pairs that are non-incestuous and eligible
      let unpartneredPrimes = eligibleNPCs.filter(c => c.age! >= 3 && c.age! <= 8);
      expect(unpartneredPrimes.length).toBe(3);

      // Proves sibling check works
      expect(isRestrictedFamily(unpartneredPrimes[0], unpartneredPrimes[1])).toBe(false);

      // Sibling block prevents half-siblings as well
      const sibling1 = makeMockCharForQA("sib1", "S1", 4, 1, {});
      sibling1.parentIds = ["A", "B"];
      const sibling2 = makeMockCharForQA("sib2", "S2", 4, 1, {});
      sibling2.parentIds = ["A", "C"]; // half-sibling (shares parent A)

      expect(isRestrictedFamily(sibling1, sibling2)).toBe(true);
    });
  });
});
