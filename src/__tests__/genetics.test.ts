import { describe, it, expect } from "vitest";
import { generateOffspring, blendHue } from "../genetics";
import { Character } from "../types";

const makeMockChar = (id: string, name: string, species: Character["species"], color: number, traits: Partial<Character["personalityTraits"]>): Character => {
  return {
    id,
    name,
    species,
    physicalTraits: {
      skinToneHue: color, skinToneSat: 50, skinToneLight: 50,
      hairColorHue: color, hairColorSat: 60, hairColorLight: 30,
      eyeColorHue: color, eyeColorSat: 80, eyeColorLight: 50,
      hairStyle: "short", faceShape: "oval", build: "average",
      markingStyle: "none", accessory: "none"
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
    expect(["Human", "Elf"]).toContain(offspring.species);

    // Blended or mutated personality
    expect(offspring.personalityTraits.warmth).toBeGreaterThanOrEqual(0);
    expect(offspring.personalityTraits.warmth).toBeLessThanOrEqual(100);
  });
});
