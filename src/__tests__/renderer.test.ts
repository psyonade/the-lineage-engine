import { describe, it, expect } from "vitest";
import { renderCharacter } from "../renderer";
import { Character } from "../types";

const makeMockChar = (species: Character["species"], build: Character["geneticTraits"]["build"], hairStyle: string, accessory: string): Character => {
  return {
    id: "test",
    name: "Test Rendering",
    species,
    gender: "Female",
    geneticTraits: {
      skinScaleFurToneHue: 200, skinScaleFurToneSat: 80, skinScaleFurToneLight: 60,
      hairColorHue: 40, hairColorSat: 90, hairColorLight: 40,
      eyeColorHue: 120, eyeColorSat: 80, eyeColorLight: 50,
      faceShape: "sharp", build, height: 175, earShape: "pointed",
      hairTexture: "wavy", markingsPattern: "tattoos", speciesFeatures: "none"
    },
    stylingTraits: {
      hairStyle, accessory, clothing: "commoner-robe"
    },
    personalityTraits: { boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50 },
    background: "Render target",
    origin: "player"
  };
};

describe("SVG Appearance Renderer", () => {
  it("renders basic SVG structure and output", () => {
    const char = makeMockChar("Human", "average", "short", "none");
    const svgStr = renderCharacter(char);
    expect(svgStr).toContain("<svg");
    expect(svgStr).toContain("viewBox=\"0 5 200 200\"");
    expect(svgStr).toContain("</svg>");
  });

  it("renders fullBody view correctly", () => {
    const char = makeMockChar("Human", "average", "short", "none");
    const svgStr = renderCharacter(char, 200, "fullBody");
    expect(svgStr).toContain("viewBox=\"0 0 200 450\"");
  });

  it("adds species specific characteristics", () => {
    const dwarf = makeMockChar("Dwarf", "stocky", "long", "none");
    const dwarfSvg = renderCharacter(dwarf);
    expect(dwarfSvg).toContain("Dwarf Beard"); // has beard

    const tiefling = makeMockChar("Tiefling", "slender", "crest", "none");
    const tieflingSvg = renderCharacter(tiefling);
    expect(tieflingSvg).toContain("horns");
  });

  it("handles various accessories correctly", () => {
    const glassesChar = makeMockChar("Human", "average", "short", "glasses");
    const svg = renderCharacter(glassesChar);
    expect(svg).toContain("glasses");
  });
});
