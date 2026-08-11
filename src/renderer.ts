import { Character } from "./types";

/**
 * Procedural SVG Avatar Renderer
 * Uses dynamic layered vector generation based on character features, species, and HSL colors.
 * Overhauled to a polished modern vector style with organic paths, vertical gradients,
 * cel-shading overlays, expressive almond eyes, and voluminous layered hair.
 *
 * Supports:
 * - mode: 'portrait' (crops head and shoulders using viewBox) | 'fullBody' (full view viewBox 0 0 200 450)
 * - height scaling per species (Halfling/Gnome ~80-85%, Elf/Dragonborn ~110-115%)
 * - clothing styling layers
 * - expanded PHB species features (e.g. horns, tails, wings)
 */
export function renderCharacter(
  char: Character,
  size: number = 200,
  mode: "portrait" | "fullBody" = "portrait"
): string {
  const g = char.geneticTraits;
  const s = char.stylingTraits;

  const safeId = char.id.replace(/[^a-zA-Z0-9]/g, "");

  // HSL colors and their darker/lighter shades for linear gradients
  const skinHSL = `hsl(${g.skinScaleFurToneHue}, ${g.skinScaleFurToneSat}%, ${g.skinScaleFurToneLight}%)`;
  const skinDarkHSL = `hsl(${g.skinScaleFurToneHue}, ${g.skinScaleFurToneSat}%, ${Math.max(5, g.skinScaleFurToneLight - 14)}%)`;

  const hairHSL = `hsl(${g.hairColorHue}, ${g.hairColorSat}%, ${g.hairColorLight}%)`;
  const hairDarkHSL = `hsl(${g.hairColorHue}, ${g.hairColorSat}%, ${Math.max(5, g.hairColorLight - 16)}%)`;
  const hairLightHSL = `hsl(${g.hairColorHue}, ${g.hairColorSat}%, ${Math.min(100, g.hairColorLight + 12)}%)`;

  const eyeHSL = `hsl(${g.eyeColorHue}, ${g.eyeColorSat}%, ${g.eyeColorLight}%)`;
  const eyeDarkHSL = `hsl(${g.eyeColorHue}, ${g.eyeColorSat}%, ${Math.max(5, g.eyeColorLight - 20)}%)`;

  // Scale calculations for species heights
  let heightScale = 1.0;
  if (char.species === "Halfling" || char.species === "Gnome") {
    heightScale = 0.82;
  } else if (char.species === "Elf" || char.species === "Dragonborn" || char.species === "Tiefling") {
    heightScale = 1.12;
  }

  // Base layout components
  let speciesFeaturesBack = "";
  let speciesFeaturesFront = "";
  let baseBody = "";
  let clothingLayer = "";
  let facePath = "";
  let earPath = "";
  let markingsPath = "";
  let accessoryPath = "";
  let hairPath = "";
  let beardPath = "";

  const isOrc = char.species === "Orc" || char.species === "Half-Orc";
  const isElf = char.species === "Elf" || char.species === "Half-Elf";
  const isDwarf = char.species === "Dwarf";
  const isTiefling = char.species === "Tiefling";
  const isDragonborn = char.species === "Dragonborn";
  const isBeastfolk = char.species === "Beastfolk";
  const isHalfling = char.species === "Halfling";
  const isGnome = char.species === "Gnome";

  // Coordinates for the full body layout
  let shoulderWidth = 60;
  let hipWidth = 50;
  const chestY = 170;
  const waistY = 220;
  const hipY = 270;
  const ankleY = 410;

  if (g.build === "slender") {
    shoulderWidth = 45;
    hipWidth = 42;
  } else if (g.build === "muscular") {
    shoulderWidth = 72;
    hipWidth = 50;
  } else if (g.build === "stocky") {
    shoulderWidth = 65;
    hipWidth = 62;
  }

  // 1. Wings and tails (drawn at the back)
  if (g.speciesFeatures === "wings" || isTiefling) {
    speciesFeaturesBack += `
      <!-- Wings -->
      <path d="M 50 200 C 10 110, -25 130, -15 180 C -5 230, 40 230, 50 240 Z" fill="#312e81" stroke="#090d16" stroke-width="3" />
      <path d="M 150 200 C 190 110, 225 130, 215 180 C 205 230, 160 230, 150 240 Z" fill="#312e81" stroke="#090d16" stroke-width="3" />
      <path d="M 50 200 C 20 130, -5 140, 0 180 C 5 210, 40 210, 50 230 Z" fill="#4338ca" />
      <path d="M 150 200 C 180 130, 205 140, 200 180 C 195 210, 160 210, 150 230 Z" fill="#4338ca" />
    `;
  }
  if (g.speciesFeatures === "tail" || isTiefling || isDragonborn || isBeastfolk) {
    speciesFeaturesBack += `
      <!-- Tail -->
      <path d="M 100 290 Q 170 300, 165 370 Q 160 410, 185 410" fill="none" stroke="${isTiefling ? "#be123c" : skinHSL}" stroke-width="12" stroke-linecap="round" />
      <path d="M 100 290 Q 170 300, 165 370 Q 160 410, 185 410" fill="none" stroke="#090d16" stroke-width="12" stroke-dasharray="2,12" stroke-linecap="round" />
    `;
  }

  // 2. Organic contoured body and limbs
  baseBody = `
    <!-- Torso (sloped shoulders, contoured sides) -->
    <path d="M 90 155 C 90 155, ${100 - shoulderWidth} 162, ${100 - shoulderWidth} 178 C ${100 - shoulderWidth} 210, ${100 - hipWidth} 245, ${100 - hipWidth} ${hipY}
             L ${100 + hipWidth} ${hipY}
             C ${100 + hipWidth} 245, ${100 + shoulderWidth} 210, ${100 + shoulderWidth} 178 C ${100 + shoulderWidth} 162, 110 155, 110 155 Z"
          fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3.5" />

    <!-- Left Leg (Contoured thigh and calf) -->
    <path d="M ${100 - hipWidth + 4} ${hipY} C ${100 - hipWidth + 4} 320, ${100 - hipWidth + 8} 370, ${100 - hipWidth + 6} ${ankleY} L ${100 - 3} ${ankleY} C ${100 - 3} 370, ${100 - 3} 320, ${100 - 3} ${hipY} Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3" />
    <!-- Right Leg (Contoured thigh and calf) -->
    <path d="M 103 ${hipY} C 103 320, 103 370, 103 ${ankleY} L ${100 + hipWidth - 6} ${ankleY} C ${100 + hipWidth - 8} 370, ${100 + hipWidth - 4} 320, ${100 + hipWidth - 4} ${hipY} Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3" />

    <!-- Left Arm Contour -->
    <path d="M ${100 - shoulderWidth} 178 C ${100 - shoulderWidth - 14} 215, ${100 - shoulderWidth - 18} 250, ${100 - shoulderWidth} 295 C ${100 - shoulderWidth + 12} 250, ${100 - shoulderWidth + 6} 215, ${100 - shoulderWidth} 178 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3" />
    <!-- Right Arm Contour -->
    <path d="M ${100 + shoulderWidth} 178 C ${100 + shoulderWidth + 14} 215, ${100 + shoulderWidth + 18} 250, ${100 + shoulderWidth} 295 C ${100 + shoulderWidth - 12} 250, ${100 + shoulderWidth - 6} 215, ${100 + shoulderWidth} 178 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3" />

    <!-- Cel-Shade Torso Overlay -->
    <path d="M 100 155 L 100 ${hipY} L ${100 + hipWidth} ${hipY} C ${100 + hipWidth} 245, ${100 + shoulderWidth} 210, ${100 + shoulderWidth} 178 C ${100 + shoulderWidth} 162, 110 155, 110 155 Z" fill="#000000" opacity="0.15" />
    <!-- Cel-Shade Right Leg Overlay -->
    <path d="M 103 ${hipY} C 103 320, 103 370, 103 ${ankleY} L ${100 + hipWidth - 6} ${ankleY} C ${100 + hipWidth - 8} 370, ${100 + hipWidth - 4} 320, ${100 + hipWidth - 4} ${hipY} Z" fill="#000000" opacity="0.15" />
  `;

  // 3. Clothing layers with gradients & contours
  switch (s.clothing) {
    case "knight-armor":
      clothingLayer = `
        <!-- Knight Armor (Organic/Curved Plate) -->
        <path d="M ${100 - shoulderWidth - 2} ${chestY - 5} C ${100 - shoulderWidth + 15} ${chestY + 40}, ${100 - hipWidth} ${hipY - 15}, ${100 - hipWidth} ${hipY}
                 L ${100 + hipWidth} ${hipY}
                 C ${100 + hipWidth} ${hipY - 15}, ${100 + shoulderWidth - 15} ${chestY + 40}, ${100 + shoulderWidth + 2} ${chestY - 5} Z"
              fill="url(#clothSilver-${safeId})" stroke="#334155" stroke-width="2.5" />
        <path d="M ${100 - shoulderWidth + 6} ${chestY + 2} C 100 ${chestY + 20}, 100 ${chestY + 20}, ${100 + shoulderWidth - 6} ${chestY + 2}" fill="none" stroke="url(#clothGold-${safeId})" stroke-width="4.5" />
        <!-- Cel shade armor -->
        <path d="M 100 ${chestY - 5} L 100 ${hipY} L ${100 + hipWidth} ${hipY} C ${100 + hipWidth} ${hipY - 15}, ${100 + shoulderWidth - 15} ${chestY + 40}, ${100 + shoulderWidth + 2} ${chestY - 5} Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "mage-cloak":
      clothingLayer = `
        <!-- Mage Cloak (Royal Purple flowing curves) -->
        <path d="M 82 145 C 50 160, ${100 - shoulderWidth - 8} 180, ${100 - hipWidth - 14} ${ankleY}
                 L ${100 + hipWidth + 14} ${ankleY}
                 C ${100 + shoulderWidth + 8} 180, 150 160, 118 145 Z"
              fill="url(#clothPurple-${safeId})" stroke="#1e1b4b" stroke-width="2.5" />
        <!-- Golden embroidery trim -->
        <path d="M 82 145 C 90 155, 95 160, 100 178 C 105 160, 110 155, 118 145" fill="none" stroke="url(#clothGold-${safeId})" stroke-width="2" />
        <!-- Right side shadow -->
        <path d="M 100 178 L 100 ${ankleY} L ${100 + hipWidth + 14} ${ankleY} C ${100 + shoulderWidth + 8} 180, 150 160, 118 145 Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "bard-tunic":
      clothingLayer = `
        <!-- Bard Tunic (Teal contoured tunic) -->
        <path d="M ${100 - shoulderWidth} ${chestY} C ${100 - shoulderWidth + 10} 220, ${100 - hipWidth} 250, ${100 - hipWidth} ${hipY + 20}
                 L ${100 + hipWidth} ${hipY + 20}
                 C ${100 + hipWidth} 250, ${100 + shoulderWidth - 10} 220, ${100 + shoulderWidth} ${chestY} Z"
              fill="url(#clothTeal-${safeId})" stroke="#042f2e" stroke-width="2.5" />
        <!-- Soft rose sash curve -->
        <path d="M ${100 - hipWidth} ${waistY + 5} Q 100 ${waistY + 18}, ${100 + hipWidth} ${waistY + 12}" fill="none" stroke="#be123c" stroke-width="12" stroke-linecap="round" />
        <!-- Right side shadow -->
        <path d="M 100 ${chestY} L 100 ${hipY + 20} L ${100 + hipWidth} ${hipY + 20} C ${100 + hipWidth} 250, ${100 + shoulderWidth - 10} 220, ${100 + shoulderWidth} ${chestY} Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "rogue-leather":
      clothingLayer = `
        <!-- Rogue Leather (Asymmetric leather vest) -->
        <path d="M ${100 - shoulderWidth + 4} ${chestY} L ${100 - hipWidth + 4} ${hipY} L ${100 + hipWidth - 4} ${hipY} L ${100 + shoulderWidth - 4} ${chestY} Z" fill="url(#clothBrown-${safeId})" stroke="#1c1917" stroke-width="3" />
        <!-- Curved dynamic bandolier -->
        <path d="M ${100 - shoulderWidth + 12} ${chestY} Q 100 ${waistY + 10}, ${100 + hipWidth - 12} ${hipY}" fill="none" stroke="#78350f" stroke-width="6.5" />
        <!-- Right shadow -->
        <path d="M 100 ${chestY} L 100 ${hipY} L ${100 + hipWidth - 4} ${hipY} L ${100 + shoulderWidth - 4} ${chestY} Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "baker-apron":
      clothingLayer = `
        <!-- Baker Tunic & Apron (White organic drape) -->
        <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - hipWidth} ${hipY + 10} L ${100 + hipWidth} ${hipY + 10} L ${100 + shoulderWidth} ${chestY} Z" fill="url(#clothBrown-${safeId})" />
        <path d="M 78 150 C 78 150, 68 150, 78 285 C 78 300, 122 300, 122 285 C 132 150, 122 150, 122 150 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="2.5" />
        <path d="M 100 150 L 100 295 L 122 285 C 132 150, 122 150, 122 150 Z" fill="#000000" opacity="0.12" />
      `;
      break;
    case "commoner-robe":
    default:
      clothingLayer = `
        <!-- Simple earthy green tunic -->
        <path d="M ${100 - shoulderWidth} ${chestY} C ${100 - shoulderWidth + 8} 210, ${100 - hipWidth} 240, ${100 - hipWidth} ${hipY + 10}
                 L ${100 + hipWidth} ${hipY + 10}
                 C ${100 + hipWidth} 240, ${100 + shoulderWidth - 8} 210, ${100 + shoulderWidth} ${chestY} Z"
              fill="url(#clothGreen-${safeId})" stroke="#0f1d0f" stroke-width="2.5" />
        <!-- Curved belt details -->
        <path d="M ${100 - hipWidth} ${waistY + 10} Q 100 ${waistY + 16}, ${100 + hipWidth} ${waistY + 10}" fill="none" stroke="#78350f" stroke-width="5.5" />
        <!-- Shadow -->
        <path d="M 100 ${chestY} L 100 ${hipY + 10} L ${100 + hipWidth} ${hipY + 10} C ${100 + hipWidth} 240, ${100 + shoulderWidth - 8} 210, ${100 + shoulderWidth} ${chestY} Z" fill="#000000" opacity="0.15" />
      `;
      break;
  }

  // 4. Face shapes mapped to fluid bezier curves
  switch (g.faceShape) {
    case "sharp":
      facePath = `
        <path d="M 66 60 C 66 60, 65 105, 100 138 C 135 105, 134 60, 134 60 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 100 60 L 100 138 C 135 105, 134 60, 134 60 Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "square":
      facePath = `
        <path d="M 66 60 C 66 100, 70 132, 100 132 C 130 132, 134 100, 134 60 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 100 60 C 100 100, 100 132, 100 132 C 130 132, 134 100, 134 60 Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "round":
      facePath = `
        <path d="M 65 75 C 65 115, 80 134, 100 134 C 120 134, 135 115, 135 75 C 135 60, 65 60, 65 75 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 100 60 C 100 115, 100 134, 100 134 C 120 134, 135 115, 135 75 C 135 60, 100 60, 100 60 Z" fill="#000000" opacity="0.15" />
      `;
      break;
    case "oval":
    default:
      facePath = `
        <path d="M 66 75 C 66 115, 80 137, 100 137 C 120 137, 134 115, 134 75 C 134 60, 66 60, 66 75 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 100 60 C 100 115, 100 137, 100 137 C 120 137, 134 115, 134 75 C 134 60, 100 60, 100 60 Z" fill="#000000" opacity="0.15" />
      `;
      break;
  }

  // 5. Species ears
  if (isElf || g.earShape === "pointed" || g.earShape === "long") {
    earPath = `
      <path d="M 66 85 C 50 80, 32 64, 42 58 C 48 55, 58 72, 66 90" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 134 85 C 150 80, 168 64, 158 58 C 152 55, 142 72, 134 90" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
    `;
  } else if (isOrc || g.earShape === "broad") {
    earPath = `
      <path d="M 65 90 C 45 85, 25 78, 33 70 C 38 65, 53 78, 65 96" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 135 90 C 155 85, 175 78, 167 70 C 162 65, 147 78, 135 96" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
    `;
    speciesFeaturesFront += `
      <!-- Orc Tusks -->
      <path d="M 83 118 C 83 118, 86 102, 90 118" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
      <path d="M 117 118 C 117 118, 114 102, 110 118" fill="#f8fafc" stroke="#475569" stroke-width="1.5" />
    `;
  } else if (isBeastfolk || g.earShape === "animal") {
    earPath = `
      <path d="M 60 65 C 40 40, 30 18, 52 14 C 68 11, 68 38, 75 50" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 140 65 C 160 40, 170 18, 148 14 C 132 11, 132 38, 125 50" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 58 60 C 45 42, 38 25, 50 22 C 60 20, 62 38, 68 46" fill="#fecdd3" />
      <path d="M 142 60 C 155 42, 162 25, 150 22 C 140 20, 138 38, 132 46" fill="#fecdd3" />
    `;
  } else {
    // Normal / Gnomes / Halflings / Dwarfs
    earPath = `
      <path d="M 66 90 C 58 90, 56 102, 66 104" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 134 90 C 142 90, 144 102, 134 104" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
    `;
  }

  // Horns
  if (isTiefling || g.speciesFeatures === "horns") {
    speciesFeaturesFront += `
      <!-- Horns -->
      <path d="M 75 60 C 60 30, 42 10, 32 20 C 42 35, 60 55, 80 65 Z" fill="#4c0519" stroke="#090d16" stroke-width="2" />
      <path d="M 125 60 C 140 30, 158 10, 168 20 C 158 35, 140 55, 120 65 Z" fill="#4c0519" stroke="#090d16" stroke-width="2" />
    `;
  }

  // 6. Voluminous layered hairstyles with 3D overlapping paths
  switch (s.hairStyle) {
    case "long":
      hairPath = `
        <!-- Back Hair Volume -->
        <path d="M 52 70 C 25 120, 25 210, 52 250 C 70 200, 130 200, 148 250 C 175 210, 175 120, 148 70 Z" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <!-- Mid Hair Cap Base -->
        <path d="M 58 70 C 42 160, 62 210, 100 80 C 138 210, 158 160, 142 70 C 100 30, 58 70" fill="url(#hairGrad-${safeId})" stroke="#090d16" stroke-width="2" />
        <!-- Front Strand Highlights -->
        <path d="M 64 68 C 75 85, 90 90, 95 105 C 90 90, 80 85, 64 68 Z" fill="url(#hairGradLight-${safeId})" />
        <path d="M 136 68 C 125 85, 110 90, 105 105 C 110 90, 120 85, 136 68 Z" fill="url(#hairGradLight-${safeId})" />
      `;
      break;
    case "braids":
      hairPath = `
        <!-- Braids base crown volume -->
        <path d="M 60 70 C 50 30, 150 30, 140 70 Z" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3" />
        <!-- Layered hanging braids (overlapping pillows) -->
        <path d="M 64 80 C 40 120, 30 170, 40 220" fill="none" stroke="url(#hairGrad-${safeId})" stroke-width="12" stroke-linecap="round" />
        <path d="M 64 80 C 40 120, 30 170, 40 220" fill="none" stroke="url(#hairGradDark-${safeId})" stroke-width="12" stroke-dasharray="4,6" stroke-linecap="round" />

        <path d="M 136 80 C 160 120, 170 170, 160 220" fill="none" stroke="url(#hairGrad-${safeId})" stroke-width="12" stroke-linecap="round" />
        <path d="M 136 80 C 160 120, 170 170, 160 220" fill="none" stroke="url(#hairGradDark-${safeId})" stroke-width="12" stroke-dasharray="4,6" stroke-linecap="round" />

        <!-- Crown braid layer -->
        <path d="M 68 70 Q 100 42, 132 70" fill="none" stroke="url(#hairGradLight-${safeId})" stroke-width="14" stroke-linecap="round" />
        <path d="M 68 70 Q 100 42, 132 70" fill="none" stroke="#090d16" stroke-width="14" stroke-dasharray="4,6" stroke-linecap="round" />
      `;
      break;
    case "curls":
      hairPath = `
        <!-- Overlapping voluminous curly paths of different tones -->
        <path d="M 52 75 C 32 45, 168 45, 148 75 C 168 105, 32 105, 52 75 Z" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <circle cx="70" cy="60" r="18" fill="url(#hairGrad-${safeId})" />
        <circle cx="130" cy="60" r="18" fill="url(#hairGrad-${safeId})" />
        <circle cx="85" cy="46" r="19" fill="url(#hairGradLight-${safeId})" />
        <circle cx="115" cy="46" r="19" fill="url(#hairGradLight-${safeId})" />
        <circle cx="100" cy="38" r="21" fill="url(#hairGradLight-${safeId})" />
        <circle cx="56" cy="76" r="14" fill="url(#hairGrad-${safeId})" />
        <circle cx="144" cy="76" r="14" fill="url(#hairGrad-${safeId})" />
      `;
      break;
    case "crest":
    case "mohawk":
      hairPath = `
        <!-- Voluminous Mohawk spiked crest -->
        <path d="M 90 38 C 75 -5, 125 -5, 110 38 Q 110 80, 90 80 Z" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 94 38 C 82 5, 118 5, 106 38" fill="none" stroke="url(#hairGradLight-${safeId})" stroke-width="8" stroke-linecap="round" />
      `;
      break;
    case "afro":
      hairPath = `
        <!-- Dynamic bubbly Afro layers -->
        <ellipse cx="100" cy="65" rx="52" ry="46" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <circle cx="68" cy="68" r="22" fill="url(#hairGrad-${safeId})" />
        <circle cx="132" cy="68" r="22" fill="url(#hairGrad-${safeId})" />
        <circle cx="85" cy="46" r="20" fill="url(#hairGradLight-${safeId})" />
        <circle cx="115" cy="46" r="20" fill="url(#hairGradLight-${safeId})" />
        <circle cx="100" cy="38" r="23" fill="url(#hairGradLight-${safeId})" />
      `;
      break;
    case "bald":
      hairPath = `<!-- Styled Bald -->`;
      break;
    case "short":
    default:
      hairPath = `
        <!-- Overlapping layers for short hair -->
        <path d="M 62 70 C 62 30, 138 30, 138 70 C 144 85, 134 90, 134 82 C 100 48, 66 82, 66 82 Z" fill="url(#hairGradDark-${safeId})" stroke="#090d16" stroke-width="3.5" />
        <path d="M 64 70 C 64 35, 136 35, 136 70 C 142 80, 132 84, 132 78 C 100 50, 68 78, 64 70 Z" fill="url(#hairGrad-${safeId})" stroke="#090d16" stroke-width="1.5" />
        <path d="M 72 65 C 80 75, 95 78, 100 85 C 95 76, 85 70, 72 65 Z" fill="url(#hairGradLight-${safeId})" />
      `;
      break;
  }

  // Hair textures
  let textureOverlay = "";
  if (s.hairStyle !== "bald") {
    if (g.hairTexture === "curly" || g.hairTexture === "coily") {
      textureOverlay = `
        <path d="M 80 50 Q 85 44, 90 50 Q 95 44, 100 50" fill="none" stroke="#090d16" stroke-width="1.5" />
        <path d="M 105 50 Q 110 44, 115 50 Q 120 44, 125 50" fill="none" stroke="#090d16" stroke-width="1.5" />
      `;
    } else if (g.hairTexture === "wavy") {
      textureOverlay = `
        <path d="M 75 52 Q 90 62, 100 52 T 125 52" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.4" />
      `;
    } else if (g.hairTexture === "wild") {
      textureOverlay = `
        <line x1="80" y1="35" x2="70" y2="22" stroke="${hairLightHSL}" stroke-width="3.5" stroke-linecap="round" />
        <line x1="120" y1="35" x2="130" y2="22" stroke="${hairLightHSL}" stroke-width="3.5" stroke-linecap="round" />
      `;
    }
  }

  // 7. Facial markings
  if (g.markingsPattern === "tattoos") {
    markingsPath = `
      <path d="M 72 100 Q 80 110, 85 105" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" />
      <path d="M 128 100 Q 120 110, 115 105" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "scars") {
    markingsPath = `
      <line x1="75" y1="78" x2="81" y2="92" stroke="#be123c" stroke-width="2" stroke-linecap="round" />
      <line x1="73" y1="84" x2="83" y2="86" stroke="#be123c" stroke-width="1" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "stripes") {
    markingsPath = `
      <path d="M 67 95 L 75 97" fill="none" stroke="#090d16" stroke-width="2.5" stroke-linecap="round" />
      <path d="M 133 95 L 125 97" fill="none" stroke="#090d16" stroke-width="2.5" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "freckles") {
    markingsPath = `
      <circle cx="76" cy="102" r="1.3" fill="#854d0e" />
      <circle cx="79" cy="104" r="1.0" fill="#854d0e" />
      <circle cx="124" cy="102" r="1.3" fill="#854d0e" />
      <circle cx="121" cy="104" r="1.0" fill="#854d0e" />
    `;
  }

  // 8. Dwarven beards & Tusks
  if (isDwarf || g.speciesFeatures === "fangs") {
    beardPath = `
      <!-- Dwarf Beard -->
      <path d="M 68 102 C 68 102, 100 185, 100 185 C 100 185, 132 102, 132 102 C 138 155, 100 185, 100 185 C 100 185, 62 155, 68 102 Z" fill="url(#hairGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
      <path d="M 85 112 Q 100 125, 115 112 Q 100 115, 85 112" fill="url(#hairGrad-${safeId})" stroke="#090d16" stroke-width="2" />
    `;
  }

  // 9. Accessories (polished beziers)
  if (s.accessory === "earrings") {
    accessoryPath = `
      <path d="M 60 100 Q 56 108, 60 112 Q 64 108, 60 100 Z" fill="url(#clothGold-${safeId})" stroke="#b45309" stroke-width="0.75" />
      <path d="M 140 100 Q 136 108, 140 112 Q 144 108, 140 100 Z" fill="url(#clothGold-${safeId})" stroke="#b45309" stroke-width="0.75" />
    `;
  } else if (s.accessory === "glasses") {
    accessoryPath = `
      <!-- glasses -->
      <path d="M 85 78 C 96 78, 96 98, 85 98 C 74 98, 74 78, 85 78 Z" fill="none" stroke="#0f172a" stroke-width="3" />
      <path d="M 115 78 C 126 78, 126 98, 115 98 C 104 98, 104 78, 115 78 Z" fill="none" stroke="#0f172a" stroke-width="3" />
      <path d="M 95 88 Q 100 85, 105 88" fill="none" stroke="#0f172a" stroke-width="3" />
    `;
  } else if (s.accessory === "crown") {
    accessoryPath = `
      <path d="M 72 45 L 78 20 Q 90 35, 100 12 Q 110 35, 122 20 L 128 45 Z" fill="url(#clothGold-${safeId})" stroke="#d97706" stroke-width="2" />
      <circle cx="100" cy="13" r="3.5" fill="#dc2626" />
    `;
  } else if (s.accessory === "circlet") {
    accessoryPath = `
      <path d="M 72 65 Q 100 53, 128 65" fill="none" stroke="url(#clothGold-${safeId})" stroke-width="5" />
      <circle cx="100" cy="54" r="3.5" fill="#10b981" />
    `;
  } else if (s.accessory === "eyepatch") {
    accessoryPath = `
      <path d="M 76 82 L 94 82 L 91 94 L 79 94 Z" fill="#0f172a" stroke="#020617" stroke-width="2" />
      <path d="M 62 74 Q 100 84, 138 94" fill="none" stroke="#0f172a" stroke-width="3" />
    `;
  } else if (s.accessory === "collar") {
    accessoryPath = `
      <path d="M 85 137 Q 100 144, 115 137" fill="none" stroke="#0f172a" stroke-width="7" stroke-linecap="round" />
      <circle cx="100" cy="142" r="3" fill="#fbbf24" />
    `;
  }

  // 10. Expressive Almond-Contoured Eyes
  const leftEyeX = 85;
  const rightEyeX = 115;
  const eyeY = 88;
  const eyeSize = 6.5;
  const eyes = `
    <!-- Left Eye white almond contour -->
    <path d="M ${leftEyeX - 10} ${eyeY} Q ${leftEyeX} ${eyeY - 6}, ${leftEyeX + 10} ${eyeY} Q ${leftEyeX} ${eyeY + 5}, ${leftEyeX - 10} ${eyeY} Z" fill="#ffffff" stroke="#1e293b" stroke-width="1.2" />
    <circle cx="${leftEyeX}" cy="${eyeY}" r="${eyeSize - 2.8}" fill="url(#eyeGrad-${safeId})" />
    <circle cx="${leftEyeX}" cy="${eyeY}" r="2" fill="#090d16" />
    <circle cx="${leftEyeX - 1.6}" cy="${eyeY - 1.6}" r="1.3" fill="#ffffff" />
    <!-- Stylized eyelash/upper lid line -->
    <path d="M ${leftEyeX - 11} ${eyeY - 1} Q ${leftEyeX} ${eyeY - 8}, ${leftEyeX + 11} ${eyeY - 1}" fill="none" stroke="#090d16" stroke-width="2.8" stroke-linecap="round" />

    <!-- Right Eye white almond contour -->
    <path d="M ${rightEyeX - 10} ${eyeY} Q ${rightEyeX} ${eyeY - 6}, ${rightEyeX + 10} ${eyeY} Q ${rightEyeX} ${eyeY + 5}, ${rightEyeX - 10} ${eyeY} Z" fill="#ffffff" stroke="#1e293b" stroke-width="1.2" />
    <circle cx="${rightEyeX}" cy="${eyeY}" r="${eyeSize - 2.8}" fill="url(#eyeGrad-${safeId})" />
    <circle cx="${rightEyeX}" cy="${eyeY}" r="2" fill="#090d16" />
    <circle cx="${rightEyeX - 1.6}" cy="${eyeY - 1.6}" r="1.3" fill="#ffffff" />
    <!-- Stylized eyelash/upper lid line -->
    <path d="M ${rightEyeX - 11} ${eyeY - 1} Q ${rightEyeX} ${eyeY - 8}, ${rightEyeX + 11} ${eyeY - 1}" fill="none" stroke="#090d16" stroke-width="2.8" stroke-linecap="round" />
  `;

  const mouthAndNose = `
    <!-- Nose (Fluid Contour) -->
    <path d="M 98 94 Q 100 106, 100 106 L 103 106" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    <!-- Smile -->
    <path d="M 91 114 Q 100 122, 109 114" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round" />
  `;

  // Determine viewBox and dimensions based on render mode option
  const isFull = mode === "fullBody";
  const viewBoxStr = isFull ? "0 0 200 450" : "0 5 200 200";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${size}" height="${isFull ? (size * 2.25) : size}" class="rounded-xl overflow-hidden shadow-lg bg-slate-800 border border-slate-700 transition-all duration-300">
      <defs>
        <!-- Gradients with subtle vertical shading for 3D cel look -->
        <linearGradient id="skinGrad-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${skinHSL}" />
          <stop offset="100%" stop-color="${skinDarkHSL}" />
        </linearGradient>
        <linearGradient id="hairGrad-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${hairHSL}" />
          <stop offset="100%" stop-color="${hairDarkHSL}" />
        </linearGradient>
        <linearGradient id="hairGradDark-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${hairDarkHSL}" />
          <stop offset="100%" stop-color="hsl(${g.hairColorHue}, ${g.hairColorSat}%, ${Math.max(2, g.hairColorLight - 24)}%)" />
        </linearGradient>
        <linearGradient id="hairGradLight-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${hairLightHSL}" />
          <stop offset="100%" stop-color="${hairHSL}" />
        </linearGradient>
        <linearGradient id="eyeGrad-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${eyeHSL}" />
          <stop offset="100%" stop-color="${eyeDarkHSL}" />
        </linearGradient>

        <!-- Clothing Silver Gradients -->
        <linearGradient id="clothSilver-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#cbd5e1" />
          <stop offset="100%" stop-color="#475569" />
        </linearGradient>
        <linearGradient id="clothGold-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fbbf24" />
          <stop offset="100%" stop-color="#b45309" />
        </linearGradient>
        <linearGradient id="clothPurple-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed" />
          <stop offset="100%" stop-color="#3b0764" />
        </linearGradient>
        <linearGradient id="clothTeal-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0d9488" />
          <stop offset="100%" stop-color="#115e59" />
        </linearGradient>
        <linearGradient id="clothBrown-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#78350f" />
          <stop offset="100%" stop-color="#1c1917" />
        </linearGradient>
        <linearGradient id="clothGreen-${safeId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#16a34a" />
          <stop offset="100%" stop-color="#14532d" />
        </linearGradient>
      </defs>

      <!-- Background Circles -->
      <circle cx="100" cy="120" r="105" fill="#1e293b" opacity="0.3" />
      <circle cx="100" cy="120" r="85" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="4,4" />

      <!-- Back Hair (rendered first if long to sit behind the body) -->
      ${s.hairStyle === "long" ? hairPath : ""}

      <!-- 1. Scaled Back features (wings/tail) -->
      <g transform="translate(0, 170) scale(1, ${heightScale}) translate(0, -170)">
        ${speciesFeaturesBack}
      </g>

      <!-- 2. Scaled Body, limbs, and clothing -->
      <g transform="translate(0, 170) scale(1, ${heightScale}) translate(0, -170)">
        <!-- Base Body / Silhouette / Legs -->
        ${baseBody}

        <!-- Clothing overlay -->
        ${clothingLayer}
      </g>

      <!-- 3. Unscaled Head, Neck, Face & Accessories (uniform unscaled starting at Y=170) -->
      <g>
        <!-- Neck (bezier curve) -->
        <path d="M 90 120 C 90 145, 88 152, 88 155 L 112 155 C 112 152, 110 145, 110 120 Z" fill="url(#skinGrad-${safeId})" stroke="#090d16" stroke-width="2.5" />
        <path d="M 100 120 L 100 155 L 112 155 C 112 152, 110 145, 110 120 Z" fill="#000000" opacity="0.15" />

        <!-- Ears (behind face) -->
        ${earPath}

        <!-- Face Shape Base with Cel Shadow Overlay -->
        ${facePath}

        <!-- Species Specific elements (horns) -->
        ${speciesFeaturesFront}

        <!-- Markings -->
        ${markingsPath}

        <!-- Eyes -->
        ${eyes}

        <!-- Front Hair style -->
        ${s.hairStyle !== "long" ? hairPath : ""}
        ${textureOverlay}

        <!-- Dwarf Beard / Mustache -->
        ${beardPath}

        <!-- Nose / Mouth details -->
        ${mouthAndNose}

        <!-- Accessories on top -->
        ${accessoryPath}
      </g>
    </svg>
  `;
}
