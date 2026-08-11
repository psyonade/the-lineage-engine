import { describe, it, expect } from "vitest";
import { renderCharacter } from "../renderer";
import { Character } from "../types";

const makeMockChar = (species: Character["species"], build: Character["physicalTraits"]["build"], hairStyle: string, accessory: string): Character => {
  return {
    id: "test",
    name: "Test Rendering",
    species,
    physicalTraits: {
      skinToneHue: 200, skinToneSat: 80, skinToneLight: 60,
      hairColorHue: 40, hairColorSat: 90, hairColorLight: 40,
      eyeColorHue: 120, eyeColorSat: 80, eyeColorLight: 50,
      hairStyle, faceShape: "sharp", build,
      markingStyle: "tattoos", accessory
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
    expect(svgStr).toContain("viewBox=\"0 0 200 200\"");
    expect(svgStr).toContain("</svg>");
  });

  it("adds species specific characteristics", () => {
    const dwarf = makeMockChar("Dwarf", "stocky", "long", "none");
    const dwarfSvg = renderCharacter(dwarf);
    expect(dwarfSvg).toContain("beard"); // has beard

    const tiefling = makeMockChar("Tiefling", "slender", "crest", "none");
    const tieflingSvg = renderCharacter(tiefling);
    expect(tieflingSvg).toContain("Horns");
  });

  it("handles various accessories correctly", () => {
    const glassesChar = makeMockChar("Human", "average", "short", "glasses");
    const svg = renderCharacter(glassesChar);
    expect(svg).toContain("glasses");
  });
});
