import { Character } from "./types";

/**
 * Procedural SVG Avatar Renderer
 * Uses dynamic layered vector generation based on character features, species, and HSL colors.
 * This does not load external image files. It builds beautifully stacked SVG shapes.
 */
export function renderCharacter(char: Character, size: number = 200): string {
  const p = char.physicalTraits;

  // Colors
  const skinHSL = `hsl(${p.skinToneHue}, ${p.skinToneSat}%, ${p.skinToneLight}%)`;
  const hairHSL = `hsl(${p.hairColorHue}, ${p.hairColorSat}%, ${p.hairColorLight}%)`;
  const eyeHSL = `hsl(${p.eyeColorHue}, ${p.eyeColorSat}%, ${p.eyeColorLight}%)`;

  // Setup styles based on Build / Species
  const isOrc = char.species === "Orc";
  const isElf = char.species === "Elf";
  const isDwarf = char.species === "Dwarf";
  const isTiefling = char.species === "Tiefling";
  const isBeastfolk = char.species === "Beastfolk";

  // Base setup
  let silhouettePath = "";
  let facePath = "";
  let earPath = "";
  let speciesFeatures = ""; // horns, beast ears, fangs, etc.

  // 1. Build silhouettes
  switch (p.build) {
    case "slender":
      silhouettePath = `<path d="M 40 180 Q 50 140, 100 135 Q 150 140, 160 180" fill="#334155" stroke="#1e293b" stroke-width="3" />`;
      break;
    case "muscular":
      silhouettePath = `<path d="M 20 180 Q 40 120, 100 120 Q 160 120, 180 180" fill="#475569" stroke="#1e293b" stroke-width="4" />`;
      break;
    case "stocky":
      silhouettePath = `<path d="M 15 180 Q 30 110, 100 110 Q 170 110, 185 180" fill="#3b4252" stroke="#1e293b" stroke-width="4" />`;
      break;
    case "average":
    default:
      silhouettePath = `<path d="M 30 180 Q 45 130, 100 130 Q 155 130, 170 180" fill="#3d4454" stroke="#1e293b" stroke-width="3" />`;
      break;
  }

  // 2. Face shape
  switch (p.faceShape) {
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

  // 3. Species ears / characteristics
  if (isElf) {
    // Elegant pointed ears
    earPath = `
      <polygon points="66,85 45,75 66,95" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <polygon points="134,85 155,75 134,95" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    `;
  } else if (isOrc) {
    // Tusks and broad sharp ears
    earPath = `
      <polygon points="65,90 40,85 65,100" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <polygon points="135,90 160,85 135,100" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
    `;
    speciesFeatures += `
      <!-- Tusks -->
      <polygon points="85,115 88,105 92,115" fill="#f8fafc" stroke="#475569" stroke-width="1" />
      <polygon points="115,115 112,105 108,115" fill="#f8fafc" stroke="#475569" stroke-width="1" />
    `;
  } else if (isTiefling) {
    // Magnificent horns!
    speciesFeatures += `
      <!-- Horns -->
      <path d="M 75 60 Q 55 20, 45 35 Q 55 45, 80 65" fill="#1e1b4b" stroke="#090514" stroke-width="1.5" />
      <path d="M 125 60 Q 145 20, 155 35 Q 145 45, 120 65" fill="#1e1b4b" stroke="#090514" stroke-width="1.5" />
    `;
  } else if (isBeastfolk) {
    // Cute fluffy animal ears
    earPath = `
      <path d="M 60 65 Q 40 30, 75 50" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <path d="M 140 65 Q 160 30, 125 50" fill="${skinHSL}" stroke="#1e293b" stroke-width="2" />
      <!-- Fluffy inner ear -->
      <path d="M 61 62 Q 47 38, 70 51" fill="#fecdd3" />
      <path d="M 139 62 Q 153 38, 130 51" fill="#fecdd3" />
    `;
  } else if (isDwarf) {
    // Bushy dwarf eyebrows and rosy cheeks
    speciesFeatures += `
      <ellipse cx="78" cy="98" rx="8" ry="4" fill="#f43f5e" fill-opacity="0.25" />
      <ellipse cx="122" cy="98" rx="8" ry="4" fill="#f43f5e" fill-opacity="0.25" />
    `;
  }

  // 4. Eyes
  const leftEyeX = 85;
  const rightEyeX = 115;
  const eyeY = 88;
  const eyeSize = 6;
  const eyes = `
    <ellipse cx="${leftEyeX}" cy="${eyeY}" rx="${eyeSize}" ry="${eyeSize - 2}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />
    <ellipse cx="${rightEyeX}" cy="${eyeY}" rx="${eyeSize}" ry="${eyeSize - 2}" fill="#ffffff" stroke="#1e293b" stroke-width="1.5" />
    <!-- Pupil/Iris -->
    <circle cx="${leftEyeX}" cy="${eyeY}" r="${eyeSize - 3}" fill="${eyeHSL}" />
    <circle cx="${rightEyeX}" cy="${eyeY}" r="${eyeSize - 3}" fill="${eyeHSL}" />
    <!-- Eye reflection sparkle -->
    <circle cx="${leftEyeX - 1.5}" cy="${eyeY - 1.5}" r="1" fill="#ffffff" />
    <circle cx="${rightEyeX - 1.5}" cy="${eyeY - 1.5}" r="1" fill="#ffffff" />
  `;

  // 5. Hair style rendering
  let hairPath = "";
  switch (p.hairStyle) {
    case "long":
      hairPath = `
        <path d="M 60 70 Q 50 150, 65 170 Q 100 80, 135 170 Q 150 150, 140 70 Q 100 35, 60 70" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 65 70 Q 100 45, 135 70 Q 100 55, 65 70" fill="${hairHSL}" />
      `;
      break;
    case "braids":
      hairPath = `
        <!-- Left braid -->
        <path d="M 65 80 Q 40 120, 50 165" fill="none" stroke="${hairHSL}" stroke-width="8" stroke-linecap="round" />
        <path d="M 65 80 Q 40 120, 50 165" fill="none" stroke="#1e293b" stroke-width="8" stroke-dasharray="3,3" stroke-linecap="round" />
        <!-- Right braid -->
        <path d="M 135 80 Q 160 120, 150 165" fill="none" stroke="${hairHSL}" stroke-width="8" stroke-linecap="round" />
        <path d="M 135 80 Q 160 120, 150 165" fill="none" stroke="#1e293b" stroke-width="8" stroke-dasharray="3,3" stroke-linecap="round" />
        <!-- Top cap -->
        <path d="M 68 70 Q 100 40, 132 70" fill="none" stroke="${hairHSL}" stroke-width="14" stroke-linecap="round" />
      `;
      break;
    case "curls":
      hairPath = `
        <circle cx="70" cy="60" r="14" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="85" cy="50" r="15" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="100" cy="45" r="16" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="115" cy="50" r="15" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="130" cy="60" r="14" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="60" cy="75" r="12" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
        <circle cx="140" cy="75" r="12" fill="${hairHSL}" stroke="#1e293b" stroke-width="1" />
      `;
      break;
    case "crest":
    case "mohawk":
      hairPath = `
        <path d="M 92 40 Q 100 15, 108 40 Q 108 80, 92 80 Z" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
        <path d="M 94 30 Q 100 5, 106 30" fill="none" stroke="${hairHSL}" stroke-width="4" />
      `;
      break;
    case "afro":
      hairPath = `
        <ellipse cx="100" cy="70" rx="46" ry="40" fill="${hairHSL}" stroke="#1e293b" stroke-width="2" />
        <circle cx="70" cy="70" r="16" fill="${hairHSL}" />
        <circle cx="130" cy="70" r="16" fill="${hairHSL}" />
      `;
      break;
    case "short":
    default:
      hairPath = `
        <path d="M 66 70 Q 100 35, 134 70 Q 140 90, 134 85 Q 100 55, 66 85 Q 60 90, 66 70" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
      `;
      break;
  }

  // 6. Facial markings
  let markingsPath = "";
  if (p.markingStyle === "tattoos") {
    markingsPath = `
      <path d="M 72 100 Q 80 110, 85 105" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" />
      <path d="M 128 100 Q 120 110, 115 105" fill="none" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round" />
    `;
  } else if (p.markingStyle === "scars") {
    markingsPath = `
      <line x1="75" y1="78" x2="81" y2="92" stroke="#e11d48" stroke-width="1.5" stroke-linecap="round" />
      <line x1="73" y1="84" x2="83" y2="86" stroke="#e11d48" stroke-width="1" stroke-linecap="round" />
    `;
  } else if (p.markingStyle === "stripes") {
    markingsPath = `
      <path d="M 67 95 L 75 97" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      <path d="M 67 101 L 73 103" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      <path d="M 133 95 L 125 97" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
      <path d="M 133 101 L 127 103" fill="none" stroke="#1e293b" stroke-width="2" stroke-linecap="round" />
    `;
  } else if (p.markingStyle === "freckles") {
    markingsPath = `
      <circle cx="76" cy="102" r="1" fill="#b45309" />
      <circle cx="79" cy="104" r="0.8" fill="#b45309" />
      <circle cx="82" cy="103" r="1" fill="#b45309" />
      <circle cx="124" cy="102" r="1" fill="#b45309" />
      <circle cx="121" cy="104" r="0.8" fill="#b45309" />
      <circle cx="118" cy="103" r="1" fill="#b45309" />
    `;
  }

  // 7. Dwarf beard
  let beardPath = "";
  if (isDwarf) {
    beardPath = `
      <!-- Huge dwarven beard -->
      <path d="M 68 102 Q 100 170, 132 102 Q 135 150, 100 175 Q 65 150, 68 102" fill="${hairHSL}" stroke="#1e293b" stroke-width="2" />
      <!-- Mustache -->
      <path d="M 85 112 Q 100 125, 115 112 Q 100 115, 85 112" fill="${hairHSL}" stroke="#1e293b" stroke-width="1.5" />
    `;
  }

  // 8. Accessories
  let accessoryPath = "";
  if (p.accessory === "earrings") {
    accessoryPath = `
      <!-- earrings -->
      <circle cx="62" cy="100" r="3" fill="#fbbf24" stroke="#d97706" stroke-width="0.5" />
      <circle cx="138" cy="100" r="3" fill="#fbbf24" stroke="#d97706" stroke-width="0.5" />
    `;
  } else if (p.accessory === "glasses") {
    accessoryPath = `
      <!-- glasses -->
      <circle cx="85" cy="88" r="10" fill="none" stroke="#000000" stroke-width="2" />
      <circle cx="115" cy="88" r="10" fill="none" stroke="#000000" stroke-width="2" />
      <line x1="95" y1="88" x2="105" y2="88" stroke="#000000" stroke-width="2" />
    `;
  } else if (p.accessory === "crown") {
    accessoryPath = `
      <!-- crown -->
      <polygon points="75,45 80,25 90,38 100,20 110,38 120,25 125,45" fill="#f59e0b" stroke="#b45309" stroke-width="1.5" />
      <circle cx="100" cy="22" r="2" fill="#ef4444" />
      <circle cx="80" cy="27" r="1.5" fill="#3b82f6" />
      <circle cx="120" cy="27" r="1.5" fill="#3b82f6" />
    `;
  } else if (p.accessory === "circlet") {
    accessoryPath = `
      <!-- circlet -->
      <path d="M 72 65 Q 100 55, 128 65 Q 100 58, 72 65" fill="none" stroke="#fbbf24" stroke-width="4" />
      <polygon points="100,50 97,58 103,58" fill="#fbbf24" />
      <circle cx="100" cy="57" r="2" fill="#22c55e" />
    `;
  } else if (p.accessory === "eyepatch") {
    accessoryPath = `
      <!-- eyepatch -->
      <polygon points="76,82 94,82 90,94 80,94" fill="#18181b" stroke="#09090b" stroke-width="1" />
      <line x1="65" y1="75" x2="135" y2="92" stroke="#18181b" stroke-width="2" />
    `;
  }

  // 9. Mouth & Nose details
  const mouthAndNose = `
    <!-- Nose -->
    <path d="M 98 94 L 100 106 L 103 106" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" />
    <!-- Smile -->
    <path d="M 92 114 Q 100 121, 108 114" fill="none" stroke="#1e293b" stroke-width="1.5" stroke-linecap="round" />
  `;

  // Return the SVG as a string wrapping it inside an responsive svg block
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" class="rounded-xl overflow-hidden shadow-lg bg-slate-800 border border-slate-700">
      <!-- Background Circle decoration -->
      <circle cx="100" cy="100" r="95" fill="#1e293b" opacity="0.3" />
      <circle cx="100" cy="100" r="75" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="4,4" />

      <!-- Back Hair (for long hair styles to sit behind the head/body) -->
      ${p.hairStyle === "long" ? hairPath : ""}

      <!-- Body / Silhouette -->
      ${silhouettePath}

      <!-- Ears (drawn behind face) -->
      ${earPath}

      <!-- Face Base Shape -->
      ${facePath}

      <!-- Species Specific details (horns, etc) -->
      ${speciesFeatures}

      <!-- Head Markings -->
      ${markingsPath}

      <!-- Eyes -->
      ${eyes}

      <!-- Front Hair (if not long/back hair) -->
      ${p.hairStyle !== "long" ? hairPath : ""}

      <!-- Dwarf Beard -->
      ${beardPath}

      <!-- Nose, Mouth -->
      ${mouthAndNose}

      <!-- Accessory layered on top -->
      ${accessoryPath}
    </svg>
  `;
}
