import { describe, it, expect } from "vitest";
import { computeCompatibility } from "../compatibility";
import { Character } from "../types";

const makeMockChar = (name: string, species: Character["species"], personality: Partial<Character["personalityTraits"]>): Character => {
  return {
    id: name.toLowerCase(),
    name,
    species,
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: 20, skinScaleFurToneSat: 50, skinScaleFurToneLight: 50,
      hairColorHue: 40, hairColorSat: 60, hairColorLight: 30,
      eyeColorHue: 200, eyeColorSat: 80, eyeColorLight: 50,
      faceShape: "oval", build: "average", height: 170, earShape: "pointed",
      hairTexture: "wavy", markingsPattern: "none", speciesFeatures: "none"
    },
    stylingTraits: {
      hairStyle: "short", accessory: "none", clothing: "commoner-robe"
    },
    personalityTraits: {
      boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50,
      ...personality
    },
    background: "Mock background",
    origin: "player"
  };
};

describe("Compatibility Engine", () => {
  it("computes baseline compatibility correctly", () => {
    const charA = makeMockChar("Alice", "Human", {});
    const charB = makeMockChar("Bob", "Elf", {});
    const result = computeCompatibility(charA, charB);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.breakdown.length).toBeGreaterThan(0);
  });

  it("rewards deep mutual warmth", () => {
    const charA = makeMockChar("Warm1", "Human", { warmth: 90 });
    const charB = makeMockChar("Warm2", "Human", { warmth: 85 });
    const result = computeCompatibility(charA, charB);
    expect(result.breakdown.some(b => b.includes("mutual warmth"))).toBe(true);
    expect(result.score).toBeGreaterThan(60);
  });

  it("rewards bold opposites attracting", () => {
    const boldPlayer = makeMockChar("Boldy", "Human", { boldness: 90 });
    const shyNPC = makeMockChar("ShyGuy", "Elf", { boldness: 10 });
    const result = computeCompatibility(boldPlayer, shyNPC);
    expect(result.breakdown.some(b => b.includes("Opposites attract"))).toBe(true);
  });

  it("rewards high wit banter", () => {
    const witA = makeMockChar("WittyA", "Dwarf", { wit: 85 });
    const witB = makeMockChar("WittyB", "Orc", { wit: 80 });
    const result = computeCompatibility(witA, witB);
    expect(result.breakdown.some(b => b.includes("Sparkling wits"))).toBe(true);
  });
});
