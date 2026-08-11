import { Character } from "./types";

/**
 * Procedural SVG Avatar Renderer
 * Uses dynamic layered vector generation based on character features, species, and HSL colors.
 * This does not load external image files. It builds beautifully stacked SVG shapes.
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

  // Colors
  const skinHSL = `hsl(${g.skinScaleFurToneHue}, ${g.skinScaleFurToneSat}%, ${g.skinScaleFurToneLight}%)`;
  const hairHSL = `hsl(${g.hairColorHue}, ${g.hairColorSat}%, ${g.hairColorLight}%)`;
  const eyeHSL = `hsl(${g.eyeColorHue}, ${g.eyeColorSat}%, ${g.eyeColorLight}%)`;

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

  // 1. Species specific body & feature adjustments
  const isOrc = char.species === "Orc" || char.species === "Half-Orc";
  const isElf = char.species === "Elf" || char.species === "Half-Elf";
  const isDwarf = char.species === "Dwarf";
  const isTiefling = char.species === "Tiefling";
  const isDragonborn = char.species === "Dragonborn";
  const isBeastfolk = char.species === "Beastfolk";
  const isHalfling = char.species === "Halfling";
  const isGnome = char.species === "Gnome";

  // Height multiplier applied strictly via translate/scale on the entire body group
  // We'll define coordinate transformations relative to a 200x450 canvas.
  // Center of scaling will be near the bottom (Y=430) so taller characters stretch up.
  const scaleX = 1.0;
  const scaleY = heightScale;
  const translateY = 430 * (1 - heightScale);

  // 2. Wings and tails (drawn at the back)
  if (g.speciesFeatures === "wings" || isTiefling) {
    speciesFeaturesBack += `
      <!-- Wings -->
      <path d="M 50 200 Q 0 100, -20 150 Q 0 250, 50 240" fill="#312e81" stroke="#1e1b4b" stroke-width="2" />
      <path d="M 150 200 Q 200 100, 220 150 Q 200 250, 150 240" fill="#312e81" stroke="#1e1b4b" stroke-width="2" />
    `;
  }
  if (g.speciesFeatures === "tail" || isTiefling || isDragonborn || isBeastfolk) {
    speciesFeaturesBack += `
      <!-- Tail -->
      <path d="M 120 360 Q 180 370, 170 300 Q 160 270, 190 250" fill="none" stroke="${isTiefling ? "#be123c" : skinHSL}" stroke-width="12" stroke-linecap="round" />
      <path d="M 120 360 Q 180 370, 170 300 Q 160 270, 190 250" fill="none" stroke="#1e293b" stroke-width="12" stroke-dasharray="2,10" stroke-linecap="round" />
    `;
  }

  // 3. Body silhouettes with legs
  let shoulderWidth = 60;
  let hipWidth = 50;
  let chestY = 240;
  let waistY = 290;
  let hipY = 340;
  let ankleY = 430;

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

  // Build full body torso and legs
  baseBody = `
    <!-- Neck -->
    <rect x="90" y="130" width="20" height="40" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    <!-- Torso -->
    <path d="M ${100 - shoulderWidth} ${chestY}
             Q ${100 - shoulderWidth / 2} ${waistY}, ${100 - hipWidth} ${hipY}
             L ${100 + hipWidth} ${hipY}
             Q ${100 + shoulderWidth / 2} ${waistY}, ${100 + shoulderWidth} ${chestY} Z"
          fill="${skinHSL}" stroke="#1e293b" stroke-width="2.5" />
    <!-- Left Leg -->
    <rect x="${100 - hipWidth + 5}" y="${hipY}" width="${hipWidth - 10}" height="${ankleY - hipY}" rx="6" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    <!-- Right Leg -->
    <rect x="105" y="${hipY}" width="${hipWidth - 10}" height="${ankleY - hipY}" rx="6" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    <!-- Arms -->
    <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - shoulderWidth - 15} ${waistY + 30} L ${100 - shoulderWidth} ${waistY + 50}" fill="none" stroke="${skinHSL}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - shoulderWidth - 15} ${waistY + 30} L ${100 - shoulderWidth} ${waistY + 50}" fill="none" stroke="#1e293b" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2,12" />
    <path d="M ${100 + shoulderWidth} ${chestY} L ${100 + shoulderWidth + 15} ${waistY + 30} L ${100 + shoulderWidth} ${waistY + 50}" fill="none" stroke="${skinHSL}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M ${100 + shoulderWidth} ${chestY} L ${100 + shoulderWidth + 15} ${waistY + 30} L ${100 + shoulderWidth} ${waistY + 50}" fill="none" stroke="#1e293b" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="2,12" />
  `;

  // 4. Clothing layers
  switch (s.clothing) {
    case "knight-armor":
      clothingLayer = `
        <!-- Silver armor plate -->
        <path d="M ${100 - shoulderWidth - 2} ${chestY - 5} L ${100 - hipWidth} ${hipY} L ${100 + hipWidth} ${hipY} L ${100 + shoulderWidth + 2} ${chestY - 5} Z" fill="#94a3b8" stroke="#475569" stroke-width="2" />
        <path d="M ${100 - shoulderWidth + 5} ${chestY} L ${100 + shoulderWidth - 5} ${chestY}" stroke="#e2e8f0" stroke-width="4" />
        <rect x="70" y="${hipY}" width="25" height="40" fill="#475569" rx="2" />
        <rect x="105" y="${hipY}" width="25" height="40" fill="#475569" rx="2" />
        <!-- Gold trim -->
        <path d="M 100 ${chestY} L 100 ${hipY}" stroke="#eab308" stroke-width="3" />
      `;
      break;
    case "mage-cloak":
      clothingLayer = `
        <!-- Royal purple robes -->
        <path d="M 80 145 L ${100 - shoulderWidth - 6} ${chestY} L ${100 - hipWidth - 12} ${ankleY} L ${100 + hipWidth + 12} ${ankleY} L ${100 + shoulderWidth + 6} ${chestY} L 120 145 Z" fill="#4c1d95" stroke="#2e1065" stroke-width="2" />
        <path d="M 90 145 L 100 240 L 110 145" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
      `;
      break;
    case "bard-tunic":
      clothingLayer = `
        <!-- Colorful teal/rose tunic -->
        <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - hipWidth} ${hipY + 20} L ${100 + hipWidth} ${hipY + 20} L ${100 + shoulderWidth} ${chestY} Z" fill="#0d9488" stroke="#115e59" stroke-width="2" />
        <!-- Rose sash -->
        <path d="M ${100 - hipWidth} ${waistY + 5} L ${100 + hipWidth} ${waistY + 15}" stroke="#be123c" stroke-width="12" />
        <!-- Puffy sleeves -->
        <circle cx="${100 - shoulderWidth}" cy="${chestY + 15}" r="15" fill="#f43f5e" />
        <circle cx="${100 + shoulderWidth}" cy="${chestY + 15}" r="15" fill="#f43f5e" />
      `;
      break;
    case "rogue-leather":
      clothingLayer = `
        <!-- Dark leather vest -->
        <path d="M ${100 - shoulderWidth + 4} ${chestY} L ${100 - hipWidth + 4} ${hipY} L ${100 + hipWidth - 4} ${hipY} L ${100 + shoulderWidth - 4} ${chestY} Z" fill="#451a03" stroke="#1c1917" stroke-width="2.5" />
        <!-- Bandolier strap -->
        <line x1="${100 - shoulderWidth + 10}" y1="${chestY}" x2="${100 + hipWidth - 10}" y2="${hipY}" stroke="#78350f" stroke-width="6" />
      `;
      break;
    case "baker-apron":
      clothingLayer = `
        <!-- White baker apron and brown shirt -->
        <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - hipWidth} ${hipY + 10} L ${100 + hipWidth} ${hipY + 10} L ${100 + shoulderWidth} ${chestY} Z" fill="#78350f" />
        <!-- Apron overlay -->
        <path d="M 80 220 L 120 220 L 115 360 L 85 360 Z" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" />
        <line x1="80" y1="220" x2="65" y2="240" stroke="#f1f5f9" stroke-width="3" />
        <line x1="120" y1="220" x2="135" y2="240" stroke="#f1f5f9" stroke-width="3" />
      `;
      break;
    case "commoner-robe":
    default:
      clothingLayer = `
        <!-- Simple earthy green tunic -->
        <path d="M ${100 - shoulderWidth} ${chestY} L ${100 - hipWidth} ${hipY + 10} L ${100 + hipWidth} ${hipY + 10} L ${100 + shoulderWidth} ${chestY} Z" fill="#1e3a1e" stroke="#0f1d0f" stroke-width="2" />
        <!-- Belt -->
        <line x1="${100 - hipWidth}" y1="${waistY + 10}" x2="${100 + hipWidth}" y2="${waistY + 10}" stroke="#78350f" stroke-width="5" />
      `;
      break;
  }

  // 5. Face shape
  switch (g.faceShape) {
    case "sharp":
      facePath = `<polygon points="70,60 130,60 135,110 100,140 65,110" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />`;
      break;
    case "square":
      facePath = `<rect x="65" y="60" width="70" height="70" rx="5" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />`;
      break;
    case "round":
      facePath = `<circle cx="100" cy="95" r="38" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />`;
      break;
    case "oval":
    default:
      facePath = `<ellipse cx="100" cy="95" rx="34" ry="42" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />`;
      break;
  }

  // 6. Species ears & custom features
  if (isElf || g.earShape === "pointed" || g.earShape === "long") {
    // Pointed elf ears
    earPath = `
      <polygon points="66,85 40,70 66,95" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <polygon points="134,85 160,70 134,95" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    `;
  } else if (isOrc || g.earShape === "broad") {
    // Orc ears and tusks
    earPath = `
      <polygon points="65,90 35,82 65,102" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <polygon points="135,90 165,82 135,102" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    `;
    speciesFeaturesFront += `
      <!-- Orc Tusks -->
      <polygon points="84,118 87,106 91,118" fill="#f8fafc" stroke="#475569" stroke-width="1" />
      <polygon points="116,118 113,106 109,118" fill="#f8fafc" stroke="#475569" stroke-width="1" />
    `;
  } else if (isBeastfolk || g.earShape === "animal") {
    // Beast fluffy ears
    earPath = `
      <path d="M 60 65 Q 35 25, 75 50" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <path d="M 140 65 Q 165 25, 125 50" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <path d="M 61 62 Q 43 33, 70 51" fill="#fecdd3" />
      <path d="M 139 62 Q 157 33, 130 51" fill="#fecdd3" />
    `;
  } else if (g.earShape === "normal" || isHalfling || isGnome || isDwarf) {
    // Curved fantasy ears
    earPath = `
      <circle cx="64" cy="95" r="7" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <circle cx="136" cy="95" r="7" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    `;
  }

  // Tiefling specific Horns
  if (isTiefling || g.speciesFeatures === "horns") {
    speciesFeaturesFront += `
      <!-- Horns -->
      <path d="M 75 60 Q 50 10, 35 25 Q 50 35, 80 65" fill="#4c0519" stroke="#090514" stroke-width="1.5" />
      <path d="M 125 60 Q 150 10, 165 25 Q 150 35, 120 65" fill="#4c0519" stroke="#090514" stroke-width="1.5" />
    `;
  }

  // 7. Hair style & Texture rendering
  switch (s.hairStyle) {
    case "long":
      hairPath = `
        <path d="M 58 70 Q 42 160, 62 210 Q 100 80, 138 210 Q 158 160, 142 70 Q 100 30, 58 70" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 63 70 Q 100 40, 137 70 Q 100 52, 63 70" fill="${hairHSL}" />
      `;
      break;
    case "braids":
      hairPath = `
        <path d="M 63 80 Q 35 130, 45 220" fill="none" stroke="${hairHSL}" stroke-width="9" stroke-linecap="round" />
        <path d="M 63 80 Q 35 130, 45 220" fill="none" stroke="#1e293b" stroke-width="9" stroke-dasharray="3,3" stroke-linecap="round" />
        <path d="M 137 80 Q 165 130, 155 220" fill="none" stroke="${hairHSL}" stroke-width="9" stroke-linecap="round" />
        <path d="M 137 80 Q 165 130, 155 220" fill="none" stroke="#1e293b" stroke-width="9" stroke-dasharray="3,3" stroke-linecap="round" />
        <path d="M 68 70 Q 100 38, 132 70" fill="none" stroke="${hairHSL}" stroke-width="14" stroke-linecap="round" />
      `;
      break;
    case "curls":
      hairPath = `
        <circle cx="70" cy="60" r="15" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="85" cy="48" r="16" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="100" cy="42" r="17" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="115" cy="48" r="16" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="130" cy="60" r="15" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="58" cy="75" r="13" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="142" cy="75" r="13" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
      `;
      break;
    case "crest":
    case "mohawk":
      hairPath = `
        <path d="M 91 38 Q 100 8, 109 38 Q 109 80, 91 80 Z" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 93 28 Q 100 -2, 107 28" fill="none" stroke="${hairHSL}" stroke-width="4.5" />
      `;
      break;
    case "afro":
      hairPath = `
        <ellipse cx="100" cy="68" rx="49" ry="43" fill="${hairHSL}" stroke="#1e293b" stroke-width="2" />
        <circle cx="68" cy="68" r="18" fill="${hairHSL}" />
        <circle cx="132" cy="68" r="18" fill="${hairHSL}" />
      `;
      break;
    case "bald":
      hairPath = `<!-- Styled Bald -->`;
      break;
    case "short":
    default:
      hairPath = `
        <path d="M 64 70 Q 100 32, 136 70 Q 142 90, 136 84 Q 100 50, 64 84 Q 58 90, 64 70" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
      `;
      break;
  }

  // Apply Hair Texture overlays
  let textureOverlay = "";
  if (s.hairStyle !== "bald") {
    if (g.hairTexture === "curly" || g.hairTexture === "coily") {
      textureOverlay = `
        <path d="M 80 50 Q 85 45, 90 50 Q 95 45, 100 50" fill="none" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 105 50 Q 110 45, 115 50 Q 120 45, 125 50" fill="none" stroke="#1e293b" stroke-width="1.5" />
      `;
    } else if (g.hairTexture === "wavy") {
      textureOverlay = `
        <path d="M 75 50 Q 90 60, 100 50 T 125 50" fill="none" stroke="#e2e8f0" stroke-width="1" opacity="0.4" />
      `;
    } else if (g.hairTexture === "wild") {
      textureOverlay = `
        <line x1="80" y1="35" x2="70" y2="25" stroke="${hairHSL}" stroke-width="3" />
        <line x1="120" y1="35" x2="130" y2="25" stroke="${hairHSL}" stroke-width="3" />
      `;
    }
  }

  // 8. Facial markings
  if (g.markingsPattern === "tattoos") {
    markingsPath = `
      <path d="M 72 100 Q 80 110, 85 105" fill="none" stroke="#1d4ed8" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 128 100 Q 120 110, 115 105" fill="none" stroke="#1d4ed8" stroke-width="1.5" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "scars") {
    markingsPath = `
      <line x1="75" y1="78" x2="81" y2="92" stroke="#be123c" stroke-width="1.5" stroke-linecap="round" />
      <line x1="73" y1="84" x2="83" y2="86" stroke="#be123c" stroke-width="1" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "stripes") {
    markingsPath = `
      <path d="M 67 95 L 75 97" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      <path d="M 133 95 L 125 97" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
    `;
  } else if (g.markingsPattern === "freckles") {
    markingsPath = `
      <circle cx="76" cy="102" r="1.2" fill="#854d0e" />
      <circle cx="79" cy="104" r="0.9" fill="#854d0e" />
      <circle cx="124" cy="102" r="1.2" fill="#854d0e" />
      <circle cx="121" cy="104" r="0.9" fill="#854d0e" />
    `;
  }

  // 9. Dwarven or general beards
  if (isDwarf || g.speciesFeatures === "fangs") {
    beardPath = `
      <!-- Dwarf Beard -->
      <path d="M 68 102 Q 100 170, 132 102 Q 135 150, 100 175 Q 65 150, 68 102" fill="${hairHSL}" stroke="#1e293b" stroke-width="2" />
      <!-- Mustache -->
      <path d="M 85 112 Q 100 125, 115 112 Q 100 115, 85 112" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
    `;
  }

  // 10. Accessories
  if (s.accessory === "earrings") {
    accessoryPath = `
      <circle cx="60" cy="100" r="3.5" fill="#f59e0b" stroke="#b45309" stroke-width="0.5" />
      <circle cx="140" cy="100" r="3.5" fill="#f59e0b" stroke="#b45309" stroke-width="0.5" />
    `;
  } else if (s.accessory === "glasses") {
    accessoryPath = `
      <!-- glasses -->
      <circle cx="85" cy="88" r="10" fill="none" stroke="#0f172a" stroke-width="2.5" />
      <circle cx="115" cy="88" r="10" fill="none" stroke="#0f172a" stroke-width="2.5" />
      <line x1="95" y1="88" x2="105" y2="88" stroke="#0f172a" stroke-width="2.5" />
    `;
  } else if (s.accessory === "crown") {
    accessoryPath = `
      <polygon points="75,45 80,22 90,36 100,16 110,36 120,22 125,45" fill="#fbbf24" stroke="#d97706" stroke-width="1.5" />
      <circle cx="100" cy="18" r="2.5" fill="#dc2626" />
    `;
  } else if (s.accessory === "circlet") {
    accessoryPath = `
      <path d="M 72 65 Q 100 55, 128 65" fill="none" stroke="#fbbf24" stroke-width="4.5" />
      <circle cx="100" cy="56" r="3" fill="#10b981" />
    `;
  } else if (s.accessory === "eyepatch") {
    accessoryPath = `
      <polygon points="76,82 94,82 90,94 80,94" fill="#0f172a" stroke="#020617" stroke-width="1.5" />
      <line x1="62" y1="74" x2="138" y2="94" stroke="#0f172a" stroke-width="2.5" />
    `;
  } else if (s.accessory === "collar") {
    accessoryPath = `
      <rect x="86" y="138" width="28" height="6" fill="#0f172a" rx="1" />
      <circle cx="100" cy="141" r="2.5" fill="#e2e8f0" />
    `;
  }

  // 11. Eyes & Face Details
  const leftEyeX = 85;
  const rightEyeX = 115;
  const eyeY = 88;
  const eyeSize = 6.5;
  const eyes = `
    <ellipse cx="${leftEyeX}" cy="${eyeY}" rx="${eyeSize}" ry="${eyeSize - 2}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />
    <ellipse cx="${rightEyeX}" cy="${eyeY}" rx="${eyeSize}" ry="${eyeSize - 2}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />
    <!-- Pupil/Iris -->
    <circle cx="${leftEyeX}" cy="${eyeY}" r="${eyeSize - 3.5}" fill="${eyeHSL}" />
    <circle cx="${rightEyeX}" cy="${eyeY}" r="${eyeSize - 3.5}" fill="${eyeHSL}" />
    <circle cx="${leftEyeX - 1.8}" cy="${eyeY - 1.8}" r="1.2" fill="#ffffff" />
    <circle cx="${rightEyeX - 1.8}" cy="${eyeY - 1.8}" r="1.2" fill="#ffffff" />
  `;

  const mouthAndNose = `
    <!-- Nose -->
    <path d="M 98 94 L 100 106 L 103 106" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" />
    <!-- Smile -->
    <path d="M 92 114 Q 100 121, 108 114" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" />
  `;

  // Determine viewBox and dimensions based on render mode option
  const isFull = mode === "fullBody";
  const viewBoxStr = isFull ? "0 0 200 450" : "0 5 200 200";

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBoxStr}" width="${size}" height="${isFull ? (size * 2.25) : size}" class="rounded-xl overflow-hidden shadow-lg bg-slate-800 border border-slate-700 transition-all duration-300">
      <!-- Background Circles -->
      <circle cx="100" cy="120" r="105" fill="#1e293b" opacity="0.3" />
      <circle cx="100" cy="120" r="85" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="4,4" />

      <!-- Apply visual scaling group for Species heights (only translates in Y and scales vertically) -->
      <g transform="translate(0, ${translateY}) scale(${scaleX}, ${scaleY})">

        <!-- Back features (wings/tail) -->
        ${speciesFeaturesBack}

        <!-- Back Hair (for long hairstyles to slide behind the body) -->
        ${s.hairStyle === "long" ? hairPath : ""}

        <!-- Base Body / Silhouette / Legs -->
        ${baseBody}

        <!-- Clothing overlay -->
        ${clothingLayer}

        <!-- Ears (behind face) -->
        ${earPath}

        <!-- Face Shape Base -->
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
