import './style.css';
import { Character, SaveState, Relationship, RelationshipStage, Scene, SceneNode, Choice, GameSpecies, GameGender } from "./types";
import { loadGame, saveGame, clearGame } from "./storage";
import { ARCHETYPES, UNIQUE_NPCS, generateNPC } from "./npc";
import { renderCharacter } from "./renderer";
import { computeCompatibility } from "./compatibility";
import { DIALOGUE_SCENES, getRelationshipStage, applyCompatibilityModifiers, getRelationshipPath } from "./dialogue";
import { generateOffspring, checkPairingEligibility } from "./genetics";

// Initial state
let state: SaveState = loadGame();

// Ensure safe defaults for lineage, resource management, and legacy depth
if (!state.currentSeason) state.currentSeason = 1;
if (state.actionPoints === undefined) state.actionPoints = 5;
if (!state.unlockedAchievements) state.unlockedAchievements = [];
if (state.player) {
  if (state.player.age === undefined) state.player.age = 3;
  if (state.player.generation === undefined) state.player.generation = 1;
}
state.npcs.forEach(n => {
  if (n.age === undefined) n.age = 3;
  if (n.generation === undefined) n.generation = 1;
});
state.offspring.forEach(c => {
  if (c.age === undefined) c.age = 0;
  if (c.generation === undefined) c.generation = 2;
});

// Active tracking UI states
let activeView: "creator" | "hub" | "npc-detail" | "dialogue" | "nursery" = state.player ? "hub" : "creator";
let selectedNpcId: string | null = null;
let activeScene: Scene | null = null;
let activeNodeId: string = "start";
let lastDialogueDeltas: Record<string, number> = {};

let nurserySubTab: "compact" | "tree" | "pairing" | "achievements" = "compact";
let detailedChildId: string | null = null;
let selectedParentAId: string | null = null;
let selectedParentBId: string | null = null;

function getAgeStageLabel(age: number): "Youth" | "Prime" | "Elder" {
  if (age <= 2) return "Youth";
  if (age <= 8) return "Prime";
  return "Elder";
}

function renderSeasonStatusBar(): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-2.5 rounded-xl text-xs font-black text-slate-300 shadow-inner w-full mb-4";

  const seasonText = document.createElement("span");
  seasonText.innerHTML = `🍂 Current Season: <strong class="text-amber-400">${state.currentSeason ?? 1}</strong>`;
  bar.appendChild(seasonText);

  const apText = document.createElement("span");
  apText.innerHTML = `⚡ Action Points: <strong class="text-orange-400">${state.actionPoints ?? 5} / 5</strong>`;
  bar.appendChild(apText);

  return bar;
}

function checkAndUnlockAchievements(child: Character) {
  if (!state.unlockedAchievements) state.unlockedAchievements = [];

  const list = [
    {
      id: "verdant_berserker",
      title: "The Verdant Berserker",
      desc: "An offspring of Orc or Half-Orc blood, high Boldness (75+), and classic green skin tone.",
      check: (c: Character) => (c.species === "Orc" || c.species === "Half-Orc") && c.personalityTraits.boldness >= 75 && (c.geneticTraits.skinScaleFurToneHue >= 90 && c.geneticTraits.skinScaleFurToneHue <= 130)
    },
    {
      id: "feywild_ambassador",
      title: "Feywild Ambassador",
      desc: "An offspring of Elf or Half-Elf blood, high Warmth (75+), and pointed elf ears.",
      check: (c: Character) => (c.species === "Elf" || c.species === "Half-Elf") && c.personalityTraits.warmth >= 75 && (c.geneticTraits.earShape === "pointed" || c.geneticTraits.earShape === "long")
    },
    {
      id: "hellfire_academic",
      title: "Hellfire Academic",
      desc: "A Tiefling offspring with high Wit (75+) and demonic horns.",
      check: (c: Character) => c.species === "Tiefling" && c.personalityTraits.wit >= 75 && c.geneticTraits.speciesFeatures === "horns"
    },
    {
      id: "golden_monarch",
      title: "Golden Monarch",
      desc: "An offspring possessing a Legendary Lineage Trait and styled with a golden crown accessory.",
      check: (c: Character) => (c.legendaryTraits && c.legendaryTraits.length > 0) && c.stylingTraits.accessory === "crown"
    },
    {
      id: "shadow_assassin",
      title: "Shadow Assassin",
      desc: "An offspring styled in rogue leather, high Chaos (75+), and dark hair.",
      check: (c: Character) => c.stylingTraits.clothing === "rogue-leather" && c.personalityTraits.chaos >= 75 && (c.geneticTraits.hairColorLight <= 20)
    },
    {
      id: "ancient_scholar",
      title: "Ancient Scholar",
      desc: "An offspring styled in a _mage cloak_, high Ambition (75+), and wearing glasses.",
      check: (c: Character) => c.stylingTraits.clothing === "mage-cloak" && c.personalityTraits.ambition >= 75 && c.stylingTraits.accessory === "glasses"
    }
  ];

  list.forEach(ach => {
    if (!state.unlockedAchievements!.includes(ach.id) && ach.check(child)) {
      state.unlockedAchievements!.push(ach.id);
      showToast(`🏆 ACHIEVEMENT UNLOCKED: "${ach.title}"!<br/><span class="text-xs font-normal text-slate-300">${ach.desc}</span>`);
    }
  });
}

// global display render modes for each character's portrait toggle ('portrait' | 'fullBody')
const renderModes: Record<string, "portrait" | "fullBody"> = {};

// Toast system for dialogue outcomes
function showToast(message: string, duration: number = 4000) {
  const existing = document.getElementById("toast-container");
  if (existing) existing.remove();

  const container = document.createElement("div");
  container.id = "toast-container";
  container.className = "fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none";

  const toast = document.createElement("div");
  toast.className = "bg-slate-900 border-l-4 border-amber-500 text-slate-100 p-4 rounded-lg shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-0 opacity-100 max-w-sm pointer-events-auto";
  toast.innerHTML = `
    <span class="text-xl">✨</span>
    <div>
      <p class="text-xs font-black uppercase text-amber-400">Interaction Outcome</p>
      <p class="text-xs text-slate-200 mt-0.5 leading-relaxed">${message}</p>
    </div>
  `;
  container.appendChild(toast);
  document.body.appendChild(container);

  setTimeout(() => {
    toast.className = "bg-slate-900 border-l-4 border-amber-500 text-slate-100 p-4 rounded-lg shadow-2xl flex items-center gap-3 transition-all duration-300 transform translate-y-2 opacity-0 max-w-sm pointer-events-none";
    setTimeout(() => container.remove(), 400);
  }, duration);
}

// Species Swatch Color Presets Definitions
const SPECIES_PRESETS: Record<GameSpecies, { skin: number[], hair: number[], eye: number[] }> = {
  Human: { skin: [22, 50, 65], hair: [30, 50, 25], eye: [210, 80, 50] },
  Elf: { skin: [40, 45, 82], hair: [195, 30, 85], eye: [145, 75, 50] },
  Dwarf: { skin: [22, 45, 64], hair: [15, 80, 40], eye: [105, 65, 50] },
  Halfling: { skin: [30, 45, 68], hair: [25, 55, 30], eye: [120, 60, 50] },
  Gnome: { skin: [28, 40, 72], hair: [160, 60, 60], eye: [190, 70, 50] },
  "Half-Elf": { skin: [32, 45, 75], hair: [100, 25, 70], eye: [160, 65, 50] },
  "Half-Orc": { skin: [95, 25, 55], hair: [0, 0, 15], eye: [30, 80, 50] },
  Orc: { skin: [110, 30, 40], hair: [0, 0, 10], eye: [20, 90, 50] },
  Tiefling: { skin: [345, 65, 50], hair: [275, 65, 20], eye: [48, 90, 60] },
  Dragonborn: { skin: [35, 65, 45], hair: [40, 60, 20], eye: [35, 80, 50] },
  Beastfolk: { skin: [35, 50, 50], hair: [35, 60, 25], eye: [50, 80, 50] }
};

interface BackgroundProfile {
  name: string;
  description: string;
  stats: {
    boldness: number;
    warmth: number;
    wit: number;
    ambition: number;
    chaos: number;
  };
}

const BACKGROUNDS_MAP: Record<string, BackgroundProfile> = {
  "Soldier": {
    name: "Soldier",
    description: "High Boldness & Ambition, Low Wit & Chaos. Trained for duty and honor.",
    stats: { boldness: 80, warmth: 50, wit: 20, ambition: 80, chaos: 20 }
  },
  "Sage": {
    name: "Sage",
    description: "High Wit & Ambition, Low Boldness & Chaos. A dedicated seeker of knowledge and truth.",
    stats: { boldness: 30, warmth: 50, wit: 80, ambition: 70, chaos: 20 }
  },
  "Charlatan": {
    name: "Charlatan",
    description: "High Wit & Chaos, Low Warmth & Ambition. A clever trickster who thrives on unpredictability.",
    stats: { boldness: 60, warmth: 20, wit: 80, ambition: 30, chaos: 80 }
  },
  "Hermit": {
    name: "Hermit",
    description: "High Warmth, Low Boldness & Chaos. A peaceful recluse who values quiet contemplation.",
    stats: { boldness: 20, warmth: 80, wit: 50, ambition: 30, chaos: 20 }
  },
  "Acolyte": {
    name: "Acolyte",
    description: "High Warmth & Ambition, Low Chaos. Devoted to a temple, seeking a higher calling.",
    stats: { boldness: 50, warmth: 80, wit: 50, ambition: 70, chaos: 10 }
  },
  "Noble": {
    name: "Noble",
    description: "High Boldness & Ambition, Low Warmth. Born to privilege, commanding and proud.",
    stats: { boldness: 80, warmth: 25, wit: 60, ambition: 85, chaos: 30 }
  },
  "Outlander": {
    name: "Outlander",
    description: "High Boldness & Chaos, Low Warmth. Raised in the wild, fierce and untethered.",
    stats: { boldness: 75, warmth: 30, wit: 50, ambition: 40, chaos: 80 }
  },
  "Urchin": {
    name: "Urchin",
    description: "High Wit & Chaos, Low Ambition. A street-smart survivor who lives moment to moment.",
    stats: { boldness: 50, warmth: 45, wit: 75, ambition: 20, chaos: 80 }
  },
  "Wanderer": {
    name: "Wanderer / Commoner",
    description: "Average stats across the board. A blank slate starting their journey.",
    stats: { boldness: 50, warmth: 50, wit: 50, ambition: 50, chaos: 50 }
  }
};

const PALETTE_SKIN = [
  { name: "Warm Beige", h: 30, s: 40, l: 65 },
  { name: "Peach", h: 20, s: 50, l: 75 },
  { name: "Bronze", h: 25, s: 45, l: 45 },
  { name: "Pale Ivory", h: 35, s: 25, l: 88 },
  { name: "Sage Green", h: 100, s: 25, l: 55 },
  { name: "Orc Green", h: 125, s: 30, l: 40 },
  { name: "Tiefling Red", h: 350, s: 60, l: 50 },
  { name: "Gold", h: 45, s: 70, l: 55 },
  { name: "Fur", h: 35, s: 35, l: 35 }
];

const PALETTE_HAIR = [
  { name: "Black", h: 0, s: 0, l: 15 },
  { name: "Gray", h: 0, s: 0, l: 60 },
  { name: "Brown", h: 25, s: 50, l: 30 },
  { name: "Autumn Red", h: 15, s: 75, l: 40 },
  { name: "Blonde", h: 45, s: 70, l: 70 },
  { name: "Forest Green", h: 140, s: 40, l: 30 },
  { name: "Ocean Blue", h: 200, s: 60, l: 40 },
  { name: "Mystic Purple", h: 275, s: 55, l: 35 }
];

const PALETTE_EYES = [
  { name: "Blue", h: 210, s: 80, l: 50 },
  { name: "Green", h: 120, s: 70, l: 45 },
  { name: "Brown", h: 25, s: 60, l: 35 },
  { name: "Amber", h: 40, s: 85, l: 55 },
  { name: "Violet", h: 280, s: 65, l: 55 },
  { name: "Red", h: 0, s: 85, l: 50 }
];

// Creator form state
const creatorForm = {
  name: "Althea",
  species: "Human" as GameSpecies,
  gender: "Female" as GameGender,
  build: "average" as Character["geneticTraits"]["build"],
  height: 170,
  faceShape: "oval",
  earShape: "normal",
  hairTexture: "wavy",
  markingsPattern: "none",
  speciesFeatures: "none",
  hairStyle: "long",
  accessory: "none",
  clothing: "commoner-robe",
  skinToneHue: 22,
  skinToneSat: 50,
  skinToneLight: 65,
  hairColorHue: 30,
  hairColorSat: 50,
  hairColorLight: 25,
  eyeColorHue: 210,
  eyeColorSat: 80,
  eyeColorLight: 50,
  background: "Wanderer",
  personality: {
    boldness: 50,
    warmth: 50,
    wit: 50,
    ambition: 50,
    chaos: 50
  }
};

/**
 * Apply species swatch preset quickly
 */
function applySpeciesPresetColors(sp: GameSpecies) {
  const preset = SPECIES_PRESETS[sp];
  creatorForm.skinToneHue = preset.skin[0];
  creatorForm.skinToneSat = preset.skin[1];
  creatorForm.skinToneLight = preset.skin[2];

  creatorForm.hairColorHue = preset.hair[0];
  creatorForm.hairColorSat = preset.hair[1];
  creatorForm.hairColorLight = preset.hair[2];

  creatorForm.eyeColorHue = preset.eye[0];
  creatorForm.eyeColorSat = preset.eye[1];
  creatorForm.eyeColorLight = preset.eye[2];

  // Set default height guidelines
  if (sp === "Halfling" || sp === "Gnome") {
    creatorForm.height = 108;
    creatorForm.earShape = "normal";
  } else if (sp === "Elf" || sp === "Half-Elf") {
    creatorForm.height = 192;
    creatorForm.earShape = "pointed";
  } else if (sp === "Dwarf") {
    creatorForm.height = 142;
    creatorForm.earShape = "normal";
  } else if (sp === "Tiefling") {
    creatorForm.height = 195;
    creatorForm.speciesFeatures = "horns";
    creatorForm.earShape = "pointed";
  } else if (sp === "Dragonborn") {
    creatorForm.height = 205;
    creatorForm.speciesFeatures = "tail";
    creatorForm.earShape = "broad";
  } else if (sp === "Beastfolk") {
    creatorForm.height = 175;
    creatorForm.earShape = "animal";
    creatorForm.speciesFeatures = "fluffy-tail";
  } else if (sp === "Orc" || sp === "Half-Orc") {
    creatorForm.height = 188;
    creatorForm.earShape = "broad";
    creatorForm.speciesFeatures = "fangs";
  } else {
    creatorForm.height = 172;
    creatorForm.earShape = "normal";
    creatorForm.speciesFeatures = "none";
  }
}

/**
 * Main render router
 */
function renderApp() {
  const appEl = document.querySelector<HTMLDivElement>('#app')!;
  appEl.innerHTML = "";

  if (activeView === "creator") {
    appEl.appendChild(createCreatorView());
  } else if (activeView === "hub") {
    appEl.appendChild(createHubView());
  } else if (activeView === "npc-detail") {
    appEl.appendChild(createNpcDetailView());
  } else if (activeView === "dialogue") {
    appEl.appendChild(createDialogueView());
  } else if (activeView === "nursery") {
    appEl.appendChild(createNurseryView());
  }
}

/**
 * Helper to build interactive render toggle box for portraits
 */
function createToggleableAvatar(char: Character, defaultSize: number = 75, forceMode?: "portrait" | "fullBody"): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "relative group cursor-pointer inline-block";

  const renderMode = forceMode || renderModes[char.id] || "portrait";
  wrapper.innerHTML = renderCharacter(char, defaultSize, renderMode);

  // Toggle mode on click if not explicitly forced
  if (!forceMode) {
    const toggleBadge = document.createElement("div");
    toggleBadge.className = "absolute bottom-1 right-1 bg-slate-900/80 hover:bg-slate-950 text-[9px] font-bold text-slate-300 px-1.5 py-0.5 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none";
    toggleBadge.innerText = renderMode === "portrait" ? "🔍 Full" : "🔍 Port";
    wrapper.appendChild(toggleBadge);

    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      renderModes[char.id] = renderMode === "portrait" ? "fullBody" : "portrait";
      renderApp();
    });
  }

  return wrapper;
}

function createSwatchPicker(
  title: string,
  palette: Array<{ name: string; h: number; s: number; l: number }>,
  currentValues: { h: number; s: number; l: number },
  onSelect: (h: number, s: number, l: number) => void
): HTMLElement {
  const container = document.createElement("div");
  container.className = "space-y-2 mt-2";

  const header = document.createElement("div");
  header.className = "text-xs font-bold text-slate-300";
  header.innerText = title;
  container.appendChild(header);

  const row = document.createElement("div");
  row.className = "flex flex-wrap gap-2 py-1";

  palette.forEach(color => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-6 h-6 rounded-full border border-slate-700 hover:scale-110 hover:border-white transition-all cursor-pointer relative";
    btn.style.backgroundColor = `hsl(${color.h}, ${color.s}%, ${color.l}%)`;
    btn.title = color.name;

    // Add active indicator if current selection matches
    if (Math.abs(color.h - currentValues.h) < 3 && Math.abs(color.s - currentValues.s) < 3 && Math.abs(color.l - currentValues.l) < 3) {
      btn.classList.add("ring-2", "ring-amber-400", "border-white");
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      onSelect(color.h, color.s, color.l);
      Array.from(row.children).forEach(child => {
        child.classList.remove("ring-2", "ring-amber-400", "border-white");
      });
      btn.classList.add("ring-2", "ring-amber-400", "border-white");
    });
    row.appendChild(btn);
  });
  container.appendChild(row);

  // Advanced HSL Sliders - Collapsible
  const advanced = document.createElement("details");
  advanced.className = "text-[11px] text-slate-400 mt-1";
  const summary = document.createElement("summary");
  summary.className = "cursor-pointer font-bold hover:text-slate-300 focus:outline-none select-none";
  summary.innerText = "Advanced Color Tuning Sliders";
  advanced.appendChild(summary);

  const sliderBox = document.createElement("div");
  sliderBox.className = "space-y-2 mt-2 pl-2 border-l border-slate-700";

  const createSlider = (label: string, min: number, max: number, initial: number, onSliderChange: (v: number) => void) => {
    const sBox = document.createElement("div");
    sBox.className = "space-y-0.5";
    const sHeader = document.createElement("div");
    sHeader.className = "flex justify-between text-[10px] text-slate-400";
    sHeader.innerHTML = `<span>${label}</span><span class="font-bold text-slate-300">${initial}</span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = min.toString();
    input.max = max.toString();
    input.value = initial.toString();
    input.className = "w-full accent-amber-500 h-1 bg-slate-800 rounded appearance-none cursor-pointer";
    input.addEventListener("input", (e) => {
      const v = parseInt((e.target as HTMLInputElement).value);
      onSliderChange(v);
      sHeader.querySelector("span:last-child")!.textContent = v.toString();
    });
    sBox.appendChild(sHeader);
    sBox.appendChild(input);
    return sBox;
  };

  sliderBox.appendChild(createSlider("Hue", 0, 360, currentValues.h, (val) => {
    currentValues.h = val;
    onSelect(currentValues.h, currentValues.s, currentValues.l);
  }));
  sliderBox.appendChild(createSlider("Saturation", 0, 100, currentValues.s, (val) => {
    currentValues.s = val;
    onSelect(currentValues.h, currentValues.s, currentValues.l);
  }));
  sliderBox.appendChild(createSlider("Lightness", 0, 100, currentValues.l, (val) => {
    currentValues.l = val;
    onSelect(currentValues.h, currentValues.s, currentValues.l);
  }));

  advanced.appendChild(sliderBox);
  container.appendChild(advanced);

  return container;
}

/**
 * 1. CHARACTER CREATOR VIEW
 */
function createCreatorView(): HTMLElement {
  const container = document.createElement("div");
  container.className = "max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8";

  // Left customization form
  const leftCol = document.createElement("div");
  leftCol.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6";

  const title = document.createElement("div");
  title.innerHTML = `
    <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">The Lineage Engine</h1>
    <p class="text-slate-400 text-sm mt-1">Design your high-fantasy champion and prepare for beautiful relationships.</p>
  `;
  leftCol.appendChild(title);

  const form = document.createElement("div");
  form.className = "space-y-4";

  // Name
  const nameLabel = document.createElement("label");
  nameLabel.className = "block text-sm font-semibold text-slate-300";
  nameLabel.innerText = "Character Name";
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500 mt-1";
  nameInput.value = creatorForm.name;
  nameInput.addEventListener("input", (e) => {
    creatorForm.name = (e.target as HTMLInputElement).value;
    updatePreview();
  });
  nameLabel.appendChild(nameInput);
  form.appendChild(nameLabel);

  // Gender Identity Select
  const genderLabel = document.createElement("label");
  genderLabel.className = "block text-sm text-slate-400";
  genderLabel.innerText = "Gender Identity";
  const genderSelect = document.createElement("select");
  genderSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["Female", "Male", "Non-binary"].forEach(g => {
    const opt = document.createElement("option");
    opt.value = g;
    opt.innerText = g;
    opt.selected = creatorForm.gender === g;
    genderSelect.appendChild(opt);
  });
  genderSelect.addEventListener("change", (e) => {
    creatorForm.gender = (e.target as HTMLSelectElement).value as GameGender;
    updatePreview();
  });
  genderLabel.appendChild(genderSelect);
  form.appendChild(genderLabel);

  // Physical attribute columns
  const physicalGrid = document.createElement("div");
  physicalGrid.className = "grid grid-cols-2 gap-4";

  // Species Select
  const speciesLabel = document.createElement("label");
  speciesLabel.className = "block text-sm text-slate-400";
  speciesLabel.innerText = "Species";
  const speciesSelect = document.createElement("select");
  speciesSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Elf", "Half-Orc", "Orc", "Tiefling", "Dragonborn", "Beastfolk"].forEach(sp => {
    const opt = document.createElement("option");
    opt.value = sp;
    opt.innerText = sp;
    opt.selected = creatorForm.species === sp;
    speciesSelect.appendChild(opt);
  });
  speciesSelect.addEventListener("change", (e) => {
    creatorForm.species = (e.target as HTMLSelectElement).value as GameSpecies;
    applySpeciesPresetColors(creatorForm.species);
    updatePreview();
    renderApp(); // re-render to update the swatches section
  });
  speciesLabel.appendChild(speciesSelect);
  physicalGrid.appendChild(speciesLabel);

  // Height Slider
  const heightBox = document.createElement("div");
  heightBox.className = "space-y-1";
  const heightHeader = document.createElement("div");
  heightHeader.className = "flex justify-between text-xs text-slate-400";
  heightHeader.innerHTML = `<span>Height (Genetic)</span><span id="height-val" class="font-bold text-slate-200">${creatorForm.height} cm</span>`;
  const heightSlider = document.createElement("input");
  heightSlider.type = "range";
  heightSlider.min = "100";
  heightSlider.max = "220";
  heightSlider.value = creatorForm.height.toString();
  heightSlider.className = "w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer mt-1";
  heightSlider.addEventListener("input", (e) => {
    creatorForm.height = parseInt((e.target as HTMLInputElement).value);
    document.getElementById("height-val")!.innerText = `${creatorForm.height} cm`;
    updatePreview();
  });
  heightBox.appendChild(heightHeader);
  heightBox.appendChild(heightSlider);
  physicalGrid.appendChild(heightBox);

  // Build Select
  const buildLabel = document.createElement("label");
  buildLabel.className = "block text-sm text-slate-400";
  buildLabel.innerText = "Build (Genetic)";
  const buildSelect = document.createElement("select");
  buildSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["slender", "average", "muscular", "stocky"].forEach(b => {
    const opt = document.createElement("option");
    opt.value = b;
    opt.innerText = b.charAt(0).toUpperCase() + b.slice(1);
    opt.selected = creatorForm.build === b;
    buildSelect.appendChild(opt);
  });
  buildSelect.addEventListener("change", (e) => {
    creatorForm.build = (e.target as HTMLSelectElement).value as any;
    updatePreview();
  });
  buildLabel.appendChild(buildSelect);
  physicalGrid.appendChild(buildLabel);

  // Face shape
  const faceShapeLabel = document.createElement("label");
  faceShapeLabel.className = "block text-sm text-slate-400";
  faceShapeLabel.innerText = "Face Shape (Genetic)";
  const faceShapeSelect = document.createElement("select");
  faceShapeSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["oval", "round", "sharp", "square"].forEach(fs => {
    const opt = document.createElement("option");
    opt.value = fs;
    opt.innerText = fs.charAt(0).toUpperCase() + fs.slice(1);
    opt.selected = creatorForm.faceShape === fs;
    faceShapeSelect.appendChild(opt);
  });
  faceShapeSelect.addEventListener("change", (e) => {
    creatorForm.faceShape = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  faceShapeLabel.appendChild(faceShapeSelect);
  physicalGrid.appendChild(faceShapeLabel);

  // Ear shape
  const earShapeLabel = document.createElement("label");
  earShapeLabel.className = "block text-sm text-slate-400";
  earShapeLabel.innerText = "Ear Shape (Genetic)";
  const earShapeSelect = document.createElement("select");
  earShapeSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["normal", "pointed", "long", "animal", "broad"].forEach(es => {
    const opt = document.createElement("option");
    opt.value = es;
    opt.innerText = es.charAt(0).toUpperCase() + es.slice(1);
    opt.selected = creatorForm.earShape === es;
    earShapeSelect.appendChild(opt);
  });
  earShapeSelect.addEventListener("change", (e) => {
    creatorForm.earShape = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  earShapeLabel.appendChild(earShapeSelect);
  physicalGrid.appendChild(earShapeLabel);

  // Hair Texture
  const hairTextLabel = document.createElement("label");
  hairTextLabel.className = "block text-sm text-slate-400";
  hairTextLabel.innerText = "Hair Texture (Genetic)";
  const hairTextSelect = document.createElement("select");
  hairTextSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["straight", "wavy", "curly", "coily", "wild"].forEach(ht => {
    const opt = document.createElement("option");
    opt.value = ht;
    opt.innerText = ht.charAt(0).toUpperCase() + ht.slice(1);
    opt.selected = creatorForm.hairTexture === ht;
    hairTextSelect.appendChild(opt);
  });
  hairTextSelect.addEventListener("change", (e) => {
    creatorForm.hairTexture = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  hairTextLabel.appendChild(hairTextSelect);
  physicalGrid.appendChild(hairTextLabel);

  // Markings Pattern
  const markingsLabel = document.createElement("label");
  markingsLabel.className = "block text-sm text-slate-400";
  markingsLabel.innerText = "Markings (Genetic)";
  const markingsSelect = document.createElement("select");
  markingsSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["none", "tattoos", "scars", "stripes", "freckles"].forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m.charAt(0).toUpperCase() + m.slice(1);
    opt.selected = creatorForm.markingsPattern === m;
    markingsSelect.appendChild(opt);
  });
  markingsSelect.addEventListener("change", (e) => {
    creatorForm.markingsPattern = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  markingsLabel.appendChild(markingsSelect);
  physicalGrid.appendChild(markingsLabel);

  // Species Features
  const featuresLabel = document.createElement("label");
  featuresLabel.className = "block text-sm text-slate-400";
  featuresLabel.innerText = "Features (Genetic)";
  const featuresSelect = document.createElement("select");
  featuresSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["none", "horns", "tail", "wings", "fangs", "fluffy-tail"].forEach(f => {
    const opt = document.createElement("option");
    opt.value = f;
    opt.innerText = f.charAt(0).toUpperCase() + f.slice(1);
    opt.selected = creatorForm.speciesFeatures === f;
    featuresSelect.appendChild(opt);
  });
  featuresSelect.addEventListener("change", (e) => {
    creatorForm.speciesFeatures = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  featuresLabel.appendChild(featuresSelect);
  physicalGrid.appendChild(featuresLabel);

  // Hair style (Styling)
  const hairStyleLabel = document.createElement("label");
  hairStyleLabel.className = "block text-sm text-slate-400";
  hairStyleLabel.innerText = "Hairstyle (Styling)";
  const hairStyleSelect = document.createElement("select");
  hairStyleSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["short", "long", "braids", "curls", "crest", "afro", "mohawk", "bald"].forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.innerText = h.charAt(0).toUpperCase() + h.slice(1);
    opt.selected = creatorForm.hairStyle === h;
    hairStyleSelect.appendChild(opt);
  });
  hairStyleSelect.addEventListener("change", (e) => {
    creatorForm.hairStyle = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  hairStyleLabel.appendChild(hairStyleSelect);
  physicalGrid.appendChild(hairStyleLabel);

  // Accessories (Styling)
  const accLabel = document.createElement("label");
  accLabel.className = "block text-sm text-slate-400";
  accLabel.innerText = "Accessory (Styling)";
  const accSelect = document.createElement("select");
  accSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["none", "earrings", "glasses", "crown", "circlet", "eyepatch", "collar"].forEach(a => {
    const opt = document.createElement("option");
    opt.value = a;
    opt.innerText = a.charAt(0).toUpperCase() + a.slice(1);
    opt.selected = creatorForm.accessory === a;
    accSelect.appendChild(opt);
  });
  accSelect.addEventListener("change", (e) => {
    creatorForm.accessory = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  accLabel.appendChild(accSelect);
  physicalGrid.appendChild(accLabel);

  // Clothing (Styling)
  const clothesLabel = document.createElement("label");
  clothesLabel.className = "block text-sm text-slate-400 col-span-2";
  clothesLabel.innerText = "Clothing Outfit (Styling)";
  const clothesSelect = document.createElement("select");
  clothesSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["commoner-robe", "knight-armor", "mage-cloak", "bard-tunic", "rogue-leather", "baker-apron"].forEach(cl => {
    const opt = document.createElement("option");
    opt.value = cl;
    opt.innerText = cl.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    opt.selected = creatorForm.clothing === cl;
    clothesSelect.appendChild(opt);
  });
  clothesSelect.addEventListener("change", (e) => {
    creatorForm.clothing = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  clothesLabel.appendChild(clothesSelect);
  physicalGrid.appendChild(clothesLabel);

  form.appendChild(physicalGrid);

  // Species Swatches and Custom Picker UI
  const colorSection = document.createElement("div");
  colorSection.className = "space-y-4 bg-slate-900 p-4 rounded-xl border border-slate-700";
  colorSection.innerHTML = `
    <h3 class="text-sm font-bold text-amber-400 flex items-center justify-between">
      <span>Color Swatches &amp; Pickers</span>
      <span class="text-[10px] text-slate-400 font-normal">Presets loaded for: ${creatorForm.species}</span>
    </h3>
  `;

  // Mini-swatches row
  const swatchRow = document.createElement("div");
  swatchRow.className = "flex flex-wrap gap-2 py-1";
  const presetKeys = Object.keys(SPECIES_PRESETS) as GameSpecies[];
  presetKeys.forEach(pk => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 text-[10px] font-bold transition-all cursor-pointer";
    swatch.innerText = pk;
    swatch.addEventListener("click", () => {
      applySpeciesPresetColors(pk);
      updatePreview();
      renderApp(); // repaint creator to update values in slider fields
    });
    swatchRow.appendChild(swatch);
  });
  colorSection.appendChild(swatchRow);

  // Mount clickable circular swatches
  const skinSwatchPicker = createSwatchPicker("Skin Tone (Click to Select)", PALETTE_SKIN, {
    h: creatorForm.skinToneHue,
    s: creatorForm.skinToneSat,
    l: creatorForm.skinToneLight
  }, (h, s, l) => {
    creatorForm.skinToneHue = h;
    creatorForm.skinToneSat = s;
    creatorForm.skinToneLight = l;
    updatePreview();
  });
  colorSection.appendChild(skinSwatchPicker);

  const hairSwatchPicker = createSwatchPicker("Hair Color (Click to Select)", PALETTE_HAIR, {
    h: creatorForm.hairColorHue,
    s: creatorForm.hairColorSat,
    l: creatorForm.hairColorLight
  }, (h, s, l) => {
    creatorForm.hairColorHue = h;
    creatorForm.hairColorSat = s;
    creatorForm.hairColorLight = l;
    updatePreview();
  });
  colorSection.appendChild(hairSwatchPicker);

  const eyeSwatchPicker = createSwatchPicker("Eye Color (Click to Select)", PALETTE_EYES, {
    h: creatorForm.eyeColorHue,
    s: creatorForm.eyeColorSat,
    l: creatorForm.eyeColorLight
  }, (h, s, l) => {
    creatorForm.eyeColorHue = h;
    creatorForm.eyeColorSat = s;
    creatorForm.eyeColorLight = l;
    updatePreview();
  });
  colorSection.appendChild(eyeSwatchPicker);

  form.appendChild(colorSection);

  // Personality & Background Section
  const personalitySection = document.createElement("div");
  personalitySection.className = "space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-700";
  personalitySection.innerHTML = `<h3 class="text-sm font-bold text-amber-400">Background &amp; Persona Profile</h3>`;

  const bgLabel = document.createElement("label");
  bgLabel.className = "block text-xs font-semibold text-slate-300";
  bgLabel.innerText = "Select Background (DnD-Style)";
  const bgSelect = document.createElement("select");
  bgSelect.className = "w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white mt-1 text-xs focus:ring-2 focus:ring-amber-500";

  Object.keys(BACKGROUNDS_MAP).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.innerText = BACKGROUNDS_MAP[key].name;
    opt.selected = creatorForm.background === key;
    bgSelect.appendChild(opt);
  });
  bgLabel.appendChild(bgSelect);
  personalitySection.appendChild(bgLabel);

  // Description and read-only personality bars
  const bgDesc = document.createElement("p");
  bgDesc.className = "text-[11px] text-slate-400 italic leading-relaxed mt-1";
  personalitySection.appendChild(bgDesc);

  const statsContainer = document.createElement("div");
  statsContainer.className = "space-y-2 mt-2";
  personalitySection.appendChild(statsContainer);

  const updateBackgroundStats = () => {
    const bgKey = bgSelect.value;
    creatorForm.background = bgKey;
    const profile = BACKGROUNDS_MAP[bgKey];
    bgDesc.innerText = profile.description;
    creatorForm.personality = { ...profile.stats };

    statsContainer.innerHTML = "";
    Object.entries(profile.stats).forEach(([stat, val]) => {
      const row = document.createElement("div");
      row.className = "space-y-0.5";
      row.innerHTML = `
        <div class="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
          <span>${stat}</span>
          <span class="text-slate-200">${val}%</span>
        </div>
        <div class="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
          <div class="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full" style="width: ${val}%"></div>
        </div>
      `;
      statsContainer.appendChild(row);
    });

    updatePreview();
  };

  bgSelect.addEventListener("change", updateBackgroundStats);
  setTimeout(updateBackgroundStats, 10); // initial load

  form.appendChild(personalitySection);

  // Start button
  const startBtn = document.createElement("button");
  startBtn.className = "w-full py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 mt-6";
  startBtn.innerText = "Embark on Your Odyssey";
  startBtn.addEventListener("click", () => {
    const player: Character = {
      id: "player",
      name: creatorForm.name || "Aventis",
      species: creatorForm.species,
      gender: creatorForm.gender,
      geneticTraits: {
        skinScaleFurToneHue: creatorForm.skinToneHue,
        skinScaleFurToneSat: creatorForm.skinToneSat,
        skinScaleFurToneLight: creatorForm.skinToneLight,
        hairColorHue: creatorForm.hairColorHue,
        hairColorSat: creatorForm.hairColorSat,
        hairColorLight: creatorForm.hairColorLight,
        eyeColorHue: creatorForm.eyeColorHue,
        eyeColorSat: creatorForm.eyeColorSat,
        eyeColorLight: creatorForm.eyeColorLight,
        faceShape: creatorForm.faceShape,
        build: creatorForm.build,
        height: creatorForm.height,
        earShape: creatorForm.earShape,
        hairTexture: creatorForm.hairTexture,
        markingsPattern: creatorForm.markingsPattern,
        speciesFeatures: creatorForm.speciesFeatures
      },
      stylingTraits: {
        hairStyle: creatorForm.hairStyle,
        accessory: creatorForm.accessory,
        clothing: creatorForm.clothing
      },
      personalityTraits: { ...creatorForm.personality },
      background: BACKGROUNDS_MAP[creatorForm.background].description,
      origin: "player",
      age: 3, // starts at Prime
      generation: 1
    };

    // Coexist Unique NPCs + standard random generated archetype cast
    const npcs = [
      ...UNIQUE_NPCS,
      ...ARCHETYPES.map(arch => generateNPC(arch))
    ];

    state.player = player;
    state.npcs = npcs;
    state.relationships = {};
    state.offspring = [];

    // Initialize blank relationships with default stats
    npcs.forEach(npc => {
      state.relationships[npc.id] = {
        characterAId: player.id,
        characterBId: npc.id,
        stage: "Stranger",
        path: "none",
        stats: { affection: 10, trust: 10, attraction: 10, rivalry: 10 },
        history: []
      };
    });

    saveGame(state);
    activeView = "hub";
    renderApp();
  });

  leftCol.appendChild(form);
  leftCol.appendChild(startBtn);

  // Right Live Preview pane
  const rightCol = document.createElement("div");
  rightCol.className = "flex flex-col items-center justify-center bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 shadow-inner min-h-[400px]";

  const renderModeSelect = document.createElement("div");
  renderModeSelect.className = "flex gap-2 mb-4 bg-slate-800 p-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 font-bold";
  const pmBtn = document.createElement("button");
  pmBtn.className = "px-3 py-1 bg-amber-500 text-slate-900 rounded font-black";
  pmBtn.innerText = "Portrait (Default)";
  const fbmBtn = document.createElement("button");
  fbmBtn.className = "px-3 py-1 rounded hover:text-white";
  fbmBtn.innerText = "Full Body View";
  renderModeSelect.appendChild(pmBtn);
  renderModeSelect.appendChild(fbmBtn);
  rightCol.appendChild(renderModeSelect);

  let previewMode: "portrait" | "fullBody" = "portrait";

  pmBtn.addEventListener("click", () => {
    previewMode = "portrait";
    pmBtn.className = "px-3 py-1 bg-amber-500 text-slate-900 rounded font-black";
    fbmBtn.className = "px-3 py-1 rounded hover:text-white";
    updatePreview();
  });

  fbmBtn.addEventListener("click", () => {
    previewMode = "fullBody";
    fbmBtn.className = "px-3 py-1 bg-amber-500 text-slate-900 rounded font-black";
    pmBtn.className = "px-3 py-1 rounded hover:text-white";
    updatePreview();
  });

  const previewBox = document.createElement("div");
  previewBox.id = "creator-preview";
  previewBox.className = "transition-all duration-300 transform hover:scale-102 flex justify-center items-center";
  rightCol.appendChild(previewBox);

  const updatePreview = () => {
    const mockChar: Character = {
      id: "preview",
      name: creatorForm.name,
      species: creatorForm.species,
      gender: creatorForm.gender,
      geneticTraits: {
        skinScaleFurToneHue: creatorForm.skinToneHue,
        skinScaleFurToneSat: creatorForm.skinToneSat,
        skinScaleFurToneLight: creatorForm.skinToneLight,
        hairColorHue: creatorForm.hairColorHue,
        hairColorSat: creatorForm.hairColorSat,
        hairColorLight: creatorForm.hairColorLight,
        eyeColorHue: creatorForm.eyeColorHue,
        eyeColorSat: creatorForm.eyeColorSat,
        eyeColorLight: creatorForm.eyeColorLight,
        faceShape: creatorForm.faceShape,
        build: creatorForm.build,
        height: creatorForm.height,
        earShape: creatorForm.earShape,
        hairTexture: creatorForm.hairTexture,
        markingsPattern: creatorForm.markingsPattern,
        speciesFeatures: creatorForm.speciesFeatures
      },
      stylingTraits: {
        hairStyle: creatorForm.hairStyle,
        accessory: creatorForm.accessory,
        clothing: creatorForm.clothing
      },
      personalityTraits: creatorForm.personality,
      background: "",
      origin: "player"
    };
    previewBox.innerHTML = renderCharacter(mockChar, 240, previewMode);
  };

  const previewLabel = document.createElement("p");
  previewLabel.className = "text-xs text-slate-400 font-bold tracking-widest uppercase mt-4";
  previewLabel.innerText = "Custom Avatar Canvas Preview";
  rightCol.appendChild(previewLabel);

  container.appendChild(leftCol);
  container.appendChild(rightCol);

  setTimeout(updatePreview, 50);

  return container;
}

/**
 * 2. MAIN ADVENTURE HUB VIEW
 */
function createHubView(): HTMLElement {
  const container = document.createElement("div");
  container.className = "max-w-7xl mx-auto p-6 space-y-8 animate-fadeIn";

  // Render season and action points status bar
  container.appendChild(renderSeasonStatusBar());

  // Hub Header
  const header = document.createElement("div");
  header.className = "flex flex-col md:flex-row items-center justify-between bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 gap-6 shadow-2xl backdrop-blur-md";

  const playerDetails = document.createElement("div");
  playerDetails.className = "flex items-center gap-5";
  const playerAvatar = createToggleableAvatar(state.player!, 80);
  playerDetails.appendChild(playerAvatar);

  const playerAge = state.player!.age ?? 3;
  const playerStage = getAgeStageLabel(playerAge);
  const playerStageColor = playerStage === "Youth" ? "text-cyan-400" : playerStage === "Prime" ? "text-emerald-400" : "text-amber-500";

  const playerText = document.createElement("div");
  playerText.innerHTML = `
    <div class="flex items-center gap-2">
      <h2 class="text-2xl font-black text-amber-400">${state.player!.name}</h2>
      <span class="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">${state.player!.gender}</span>
    </div>
    <p class="text-xs text-slate-300 mt-1">${state.player!.species} • ${state.player!.geneticTraits.height} cm • Age: ${playerAge} (<span class="${playerStageColor} font-bold">${playerStage}</span>) • Gen ${state.player!.generation || 1}</p>
    <div class="flex flex-wrap gap-1.5 mt-2.5">
      <span class="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">Bold: ${state.player!.personalityTraits.boldness}%</span>
      <span class="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">Warm: ${state.player!.personalityTraits.warmth}%</span>
      <span class="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">Wit: ${state.player!.personalityTraits.wit}%</span>
      <span class="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">Ambition: ${state.player!.personalityTraits.ambition}%</span>
      <span class="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded-full">Chaos: ${state.player!.personalityTraits.chaos}%</span>
    </div>
  `;
  playerDetails.appendChild(playerText);
  header.appendChild(playerDetails);

  const metaControls = document.createElement("div");
  metaControls.className = "flex flex-wrap gap-3";

  // End Season Action Button
  const endSeasonBtn = document.createElement("button");
  endSeasonBtn.className = "px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-black transition-all shadow-md";
  endSeasonBtn.innerHTML = "⌛ End Season";
  endSeasonBtn.addEventListener("click", () => {
    state.currentSeason = (state.currentSeason ?? 1) + 1;
    state.actionPoints = 5;

    // Increment age for all characters
    if (state.player) state.player.age = (state.player.age ?? 3) + 1;
    state.npcs.forEach(n => n.age = (n.age ?? 3) + 1);
    state.offspring.forEach(c => c.age = (c.age ?? 0) + 1);

    saveGame(state);
    renderApp();
    showToast(`🍂 Time marches on... Advanced to Season ${state.currentSeason}! All characters aged, and 5 Action Points were restored.`);
  });
  metaControls.appendChild(endSeasonBtn);

  const viewNurseryBtn = document.createElement("button");
  viewNurseryBtn.className = "px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold rounded-xl shadow-lg transition-all text-xs";
  viewNurseryBtn.innerHTML = `🍼 Lineage &amp; Nursery (${state.offspring.length})`;
  viewNurseryBtn.addEventListener("click", () => {
    activeView = "nursery";
    nurserySubTab = "compact";
    detailedChildId = null;
    renderApp();
  });
  metaControls.appendChild(viewNurseryBtn);

  const resetBtn = document.createElement("button");
  resetBtn.className = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-600";
  resetBtn.innerText = "Reset Odyssey";
  resetBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your character and relationships? All progress will be lost!")) {
      clearGame();
      state = { player: null, npcs: [], relationships: {}, offspring: [], currentSeason: 1, actionPoints: 5, unlockedAchievements: [] };
      activeView = "creator";
      renderApp();
    }
  });
  metaControls.appendChild(resetBtn);

  header.appendChild(metaControls);
  container.appendChild(header);

  // Content Layout Columns
  const contentGrid = document.createElement("div");
  contentGrid.className = "grid grid-cols-1 lg:grid-cols-3 gap-8";

  // Cast Column (Left 2 cols)
  const rosterCol = document.createElement("div");
  rosterCol.className = "lg:col-span-2 space-y-6";

  const rosterHeader = document.createElement("div");
  rosterHeader.className = "flex items-center justify-between";
  rosterHeader.innerHTML = `
    <div>
      <h3 class="text-2xl font-black text-slate-100">Cast of Characters</h3>
      <p class="text-xs text-slate-400 mt-1">Interact with storied unique personas, procedural wanderers, and grown offspring.</p>
    </div>
  `;

  // Random wanderer generator button
  const genBtn = document.createElement("button");
  genBtn.className = "px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all";
  genBtn.innerText = "+ Wanderer Arrives";
  genBtn.addEventListener("click", () => {
    const randomArchetype = ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)];
    const wanderer = generateNPC(randomArchetype);
    state.npcs.push(wanderer);
    state.relationships[wanderer.id] = {
      characterAId: state.player!.id,
      characterBId: wanderer.id,
      stage: "Stranger",
      path: "none",
      stats: { affection: 10, trust: 10, attraction: 10, rivalry: 10 },
      history: []
    };
    saveGame(state);
    renderApp();
    showToast(`A new procedural adventurer, ${wanderer.name}, has entered the tavern hub!`);
  });
  rosterHeader.appendChild(genBtn);
  rosterCol.appendChild(rosterHeader);

  const cardsGrid = document.createElement("div");
  cardsGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-6";

  // Build unified active cast of all characters (including grown up offspring!)
  const allCast = [...state.npcs, ...state.offspring];

  // Initialize safe relationship defaults
  allCast.forEach(npc => {
    if (!state.relationships[npc.id]) {
      state.relationships[npc.id] = {
        characterAId: state.player!.id,
        characterBId: npc.id,
        stage: "Stranger",
        path: "none",
        stats: { affection: 15, trust: 15, attraction: 10, rivalry: 10 },
        history: []
      };
    }
  });

  allCast.forEach(npc => {
    const rel: Relationship = state.relationships[npc.id];

    // Calculate dynamic emergent path label
    const dynamicPath = getRelationshipPath(rel.stats);
    rel.path = dynamicPath; // update save instance state

    const card = document.createElement("div");
    card.className = `border rounded-2xl p-5 flex gap-4 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 bg-slate-800/60 hover:bg-slate-800 ${
      npc.isUnique
        ? "border-amber-500/30 hover:border-amber-500/50"
        : npc.origin === "offspring"
          ? "border-pink-500/20 hover:border-pink-500/40"
          : "border-slate-700/60 hover:border-slate-600"
    }`;
    card.addEventListener("click", () => {
      selectedNpcId = npc.id;
      activeView = "npc-detail";
      renderApp();
    });

    const npcAvatar = createToggleableAvatar(npc, 75);
    card.appendChild(npcAvatar);

    const details = document.createElement("div");
    details.className = "flex-1 min-w-0";

    const comp = computeCompatibility(state.player!, npc);

    let badgeHTML = "";
    if (npc.isUnique) {
      badgeHTML = `<span class="text-[9px] font-black text-rose-400 bg-rose-400/10 px-1.5 py-0.5 rounded border border-rose-400/20 mr-1.5 uppercase tracking-wider">★ Storied</span>`;
    } else if (npc.origin === "offspring") {
      badgeHTML = `<span class="text-[9px] font-black text-pink-400 bg-pink-400/10 px-1.5 py-0.5 rounded border border-pink-400/20 mr-1.5 uppercase tracking-wider">🍼 Offspring (Gen ${npc.generation || 2})</span>`;
    }

    let pathTagHTML = "";
    if (dynamicPath !== "none") {
      const pathColors: Record<string, string> = {
        friendsFirst: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
        rivalsToLovers: "text-red-400 bg-red-400/10 border-red-400/20",
        whirlwind: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
        slowBurn: "text-pink-400 bg-pink-400/10 border-pink-400/20"
      };
      const formattedNames: Record<string, string> = {
        friendsFirst: "Friends First",
        rivalsToLovers: "Rivals to Lovers",
        whirlwind: "Whirlwind Romance",
        slowBurn: "Slow Burn"
      };
      pathTagHTML = `<span class="text-[9px] font-black border px-1.5 py-0.5 rounded uppercase tracking-wider ml-1.5 ${pathColors[dynamicPath] || "text-slate-400 bg-slate-800"}">${formattedNames[dynamicPath]}</span>`;
    }

    const nAge = npc.age ?? 3;
    const nStage = getAgeStageLabel(nAge);
    const nStageColor = nStage === "Youth" ? "text-cyan-400" : nStage === "Prime" ? "text-emerald-400" : "text-amber-500";

    details.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-white text-base truncate flex items-center">${badgeHTML}${npc.name}</h4>
        <span class="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">${comp.score}% Fit</span>
      </div>
      <p class="text-[10px] text-slate-300 mt-1">${npc.species} • ${npc.gender} • Age: ${nAge} (<span class="${nStageColor} font-bold">${nStage}</span>)</p>
      <div class="mt-1 flex items-center">
        <span class="text-[10px] text-slate-400 italic">Stage: <strong>${rel.stage}</strong></span>
        ${pathTagHTML}
      </div>

      <!-- Affection Bar -->
      <div class="mt-3.5 space-y-1">
        <div class="flex justify-between text-[10px] text-slate-400 font-bold">
          <span>Emotional Affection</span>
          <span>${rel.stats.affection}%</span>
        </div>
        <div class="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
          <div class="bg-gradient-to-r from-amber-500 to-rose-500 h-full rounded-full" style="width: ${rel.stats.affection}%"></div>
        </div>
      </div>
    `;

    card.appendChild(details);
    cardsGrid.appendChild(card);
  });

  rosterCol.appendChild(cardsGrid);
  contentGrid.appendChild(rosterCol);

  // Sidebar controls
  const rightSidebar = document.createElement("div");
  rightSidebar.className = "space-y-6";

  const statBox = document.createElement("div");
  statBox.className = "bg-slate-800/50 border border-slate-700/80 p-5 rounded-2xl space-y-4";
  statBox.innerHTML = `
    <h4 class="font-extrabold text-lg text-slate-200">Odyssey Stats</h4>
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-center">
        <span class="text-2xl font-black text-rose-400">${state.npcs.length}</span>
        <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Wanderers Met</p>
      </div>
      <div class="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800 text-center">
        <span class="text-2xl font-black text-emerald-400">${state.offspring.length}</span>
        <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Children Born</p>
      </div>
    </div>
  `;
  rightSidebar.appendChild(statBox);

  // Guide panel
  const guideBox = document.createElement("div");
  guideBox.className = "bg-slate-800/50 border border-slate-700/80 p-5 rounded-2xl space-y-3";
  guideBox.innerHTML = `
    <h4 class="font-extrabold text-base text-pink-400">🍼 Lineage Mechanics</h4>
    <p class="text-xs text-slate-300 leading-relaxed">
      Pair up with any character that reaches <strong class="text-slate-100">Interested (50+)</strong> or <strong class="text-slate-100">Partner (80+)</strong> status to generate beautiful children inheriting blended species, visual attributes, and personality traits!
    </p>
    <div class="p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-xs text-pink-300 font-medium leading-relaxed">
      Tip: The active relationship path (e.g. Friends First or Rivals to Lovers) emerges naturally based on how you treat them!
    </div>
  `;
  rightSidebar.appendChild(guideBox);

  contentGrid.appendChild(rightSidebar);
  container.appendChild(contentGrid);

  return container;
}

/**
 * 3. NPC DETAIL VIEW
 */
function createNpcDetailView(): HTMLElement {
  const npc = state.npcs.find(n => n.id === selectedNpcId) || state.offspring.find(n => n.id === selectedNpcId)!;
  const rel: Relationship = state.relationships[npc.id];
  const comp = computeCompatibility(state.player!, npc);

  const container = document.createElement("div");
  container.className = "max-w-5xl mx-auto p-6 space-y-6 animate-fadeIn";

  // Season and AP Status bar at top of NPC Detail View
  container.appendChild(renderSeasonStatusBar());

  const backBtn = document.createElement("button");
  backBtn.className = "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all";
  backBtn.innerText = "← Return to Town Hub";
  backBtn.addEventListener("click", () => {
    activeView = "hub";
    renderApp();
  });
  container.appendChild(backBtn);

  // Top NPC header card
  const npcHeader = document.createElement("div");
  npcHeader.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center";

  const nAge = npc.age ?? 3;
  const nStage = getAgeStageLabel(nAge);
  const nStageColor = nStage === "Youth" ? "text-cyan-400" : nStage === "Prime" ? "text-emerald-400" : "text-amber-500";

  const avatarBox = document.createElement("div");
  avatarBox.className = "flex flex-col items-center justify-center";
  avatarBox.appendChild(createToggleableAvatar(npc, 160));
  const npcLabel = document.createElement("p");
  npcLabel.className = "text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider text-center";
  npcLabel.innerHTML = `${npc.species} • ${npc.gender} • ${npc.geneticTraits.height} cm<br/>Age: ${nAge} (<span class="${nStageColor} font-bold">${nStage}</span>) • Gen ${npc.generation || 1}`;
  avatarBox.appendChild(npcLabel);
  npcHeader.appendChild(avatarBox);

  // Dynamic path label
  const activePath = getRelationshipPath(rel.stats);
  let pathText = "None yet (Trivial Encounters)";
  if (activePath !== "none") {
    const map = {
      friendsFirst: "Friends First Dynamic",
      rivalsToLovers: "Rivals to Lovers Spark",
      whirlwind: "Whirlwind Attraction Storm",
      slowBurn: "Slow Burn Emotional Devotion"
    };
    pathText = map[activePath];
  }

  // Bio & stats
  const infoBox = document.createElement("div");
  infoBox.className = "md:col-span-2 space-y-4";
  infoBox.innerHTML = `
    <div>
      <div class="flex items-center gap-2 flex-wrap">
        <h2 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">${npc.name}</h2>
        ${npc.isUnique ? `<span class="text-[10px] font-black text-rose-400 bg-rose-400/10 px-2 py-0.5 rounded border border-rose-400/20 uppercase tracking-widest">★ Storied Unique</span>` : ""}
      </div>
      <p class="text-xs italic text-slate-300 mt-1.5">"${npc.background}"</p>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
        <span class="text-base font-black text-rose-400">${rel.stats.affection}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Affection</p>
      </div>
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
        <span class="text-base font-black text-cyan-400">${rel.stats.trust}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Trust</p>
      </div>
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
        <span class="text-base font-black text-yellow-400">${rel.stats.attraction}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Attraction</p>
      </div>
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
        <span class="text-base font-black text-orange-400">${rel.stats.rivalry}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Rivalry</p>
      </div>
    </div>

    <div class="space-y-1.5 text-xs text-slate-300 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
      <div class="flex justify-between items-center">
        <span>Current Relationship Stage:</span>
        <strong class="text-white bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-700">${rel.stage}</strong>
      </div>
      <div class="flex justify-between items-center mt-1">
        <span>Dynamic Emergent Path:</span>
        <strong class="text-amber-400">${pathText}</strong>
      </div>
    </div>
  `;
  npcHeader.appendChild(infoBox);
  container.appendChild(npcHeader);

  const actionsGrid = document.createElement("div");
  actionsGrid.className = "grid grid-cols-1 lg:grid-cols-2 gap-8";

  // Actions column
  const interactionPanel = document.createElement("div");
  interactionPanel.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-5 shadow-lg";
  interactionPanel.innerHTML = `
    <h3 class="text-xl font-bold text-slate-200">Interact with ${npc.name}</h3>
    <p class="text-xs text-slate-400">Deepen your romantic connection or cooperative bond through bespoke narratives.</p>
  `;

  // Start Meeting Button
  const playDialogueBtn = document.createElement("button");
  playDialogueBtn.className = "w-full py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all text-xs";

  if (npc.isUnique) {
    playDialogueBtn.innerText = `🎬 Continue Storied Quest Line (Stage ${(npc.questStage || 0) + 1})`;
  } else {
    playDialogueBtn.innerText = "🎬 Play Branching Story Scene";
  }

  playDialogueBtn.addEventListener("click", () => {
    // Resource AP check
    const currentAP = state.actionPoints ?? 5;
    if (currentAP <= 0) {
      showToast("⚠️ Out of Action Points! End the season to restore energy.");
      return;
    }

    let targetScene = DIALOGUE_SCENES[0]; // default general

    if (npc.isUnique) {
      const qStage = npc.questStage || 0;
      const scenePrefix = npc.id.replace("npc-", "") + "_quest_";
      const targetId = `${scenePrefix}${qStage + 1}`;
      const found = DIALOGUE_SCENES.find(s => s.id === targetId);
      if (found) {
        targetScene = found;
      } else {
        // Fallback to repeat / default
        targetScene = DIALOGUE_SCENES[0];
      }
    } else {
      if (rel.stage === "Interested" || rel.stage === "Partner") {
        targetScene = DIALOGUE_SCENES[2]; // confession
      } else if (rel.stage === "Acquaintance") {
        targetScene = DIALOGUE_SCENES[1]; // shared quest
      }
    }

    // Deduct 1 AP for starting interaction
    state.actionPoints = currentAP - 1;
    saveGame(state);

    activeScene = targetScene;
    activeNodeId = "start";
    activeView = "dialogue";
    renderApp();
  });
  interactionPanel.appendChild(playDialogueBtn);

  // Lineage Generation action
  const isLineageEligible = rel.stats.affection >= 50 || rel.stage === "Interested" || rel.stage === "Partner";
  const pairBtn = document.createElement("button");
  pairBtn.className = `w-full py-3 font-extrabold rounded-xl shadow-lg transition-all text-xs ${
    isLineageEligible
      ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white cursor-pointer"
      : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
  }`;
  pairBtn.innerHTML = `🍼 Produce Blended Offspring (Requires 50+ Affection) ${isLineageEligible ? "✨" : "🔒"}`;
  pairBtn.addEventListener("click", () => {
    if (!isLineageEligible) return;

    // Check pairing eligibility / incest prevention
    const eligibility = checkPairingEligibility(state.player!, npc);
    if (!eligibility.eligible) {
      showToast(`⚠️ Cannot breed: ${eligibility.reason}`);
      return;
    }

    // Check AP cost (costs 3 AP)
    const currentAP = state.actionPoints ?? 5;
    if (currentAP < 3) {
      showToast("⚠️ Requires 3 Action Points to breed! End the season to restore energy.");
      return;
    }

    // Deduct 3 AP
    state.actionPoints = currentAP - 3;

    // Generate offspring!
    const child = generateOffspring(state.player!, npc);
    state.offspring.push(child);

    // Check and unlock achievements for child
    checkAndUnlockAchievements(child);

    saveGame(state);

    // Swap view to Nursery and show child detail immediately
    detailedChildId = child.id;
    activeView = "nursery";
    renderApp();
  });
  interactionPanel.appendChild(pairBtn);

  actionsGrid.appendChild(interactionPanel);

  // Compatibility Profile Panel
  const compPanel = document.createElement("div");
  compPanel.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-4 shadow-lg";

  const compTitle = document.createElement("div");
  compTitle.className = "flex items-center justify-between";
  compTitle.innerHTML = `
    <h3 class="text-xl font-bold text-slate-200">Compatibility Profile</h3>
    <span class="text-2xl font-black text-rose-400">${comp.score}%</span>
  `;
  compPanel.appendChild(compTitle);

  const compText = document.createElement("div");
  compText.className = "space-y-3";
  comp.breakdown.forEach(point => {
    const pEl = document.createElement("div");
    pEl.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-800 text-xs text-slate-300 leading-relaxed flex items-start gap-2.5";
    pEl.innerHTML = `<span class="text-amber-400">✨</span> <span>${point}</span>`;
    compText.appendChild(pEl);
  });
  compPanel.appendChild(compText);

  actionsGrid.appendChild(compPanel);
  container.appendChild(actionsGrid);

  return container;
}

/**
 * 4. DYNAMIC BRANCHING DIALOGUE VIEW
 */
function createDialogueView(): HTMLElement {
  const npc = state.npcs.find(n => n.id === selectedNpcId) || state.offspring.find(n => n.id === selectedNpcId)!;
  const rel = state.relationships[npc.id];
  const comp = computeCompatibility(state.player!, npc);

  const scene = activeScene!;
  const node: SceneNode = scene.nodes[activeNodeId];

  const container = document.createElement("div");
  container.className = "max-w-4xl mx-auto p-6 space-y-8 animate-fadeIn";

  // Dialogue header
  const header = document.createElement("div");
  header.className = "text-center space-y-1.5";
  header.innerHTML = `
    <span class="text-[10px] uppercase font-extrabold tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-500/20 inline-block">${scene.title}</span>
    <h2 class="text-2xl font-black text-slate-100 mt-2">Story Interaction with ${npc.name}</h2>
  `;
  container.appendChild(header);

  // Full-body Layout Box for deep conversation immersion
  const layoutBox = document.createElement("div");
  layoutBox.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-stretch shadow-2xl relative overflow-hidden";

  // Left side: Active Speaker avatar
  const speakerPortrait = document.createElement("div");
  speakerPortrait.className = "flex-shrink-0 flex flex-col items-center justify-start gap-3 w-44";

  if (node.speaker === "NPC") {
    speakerPortrait.appendChild(createToggleableAvatar(npc, 160, "fullBody"));
    speakerPortrait.innerHTML += `<span class="text-xs font-black text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">${npc.name}</span>`;
  } else if (node.speaker === "Player") {
    speakerPortrait.appendChild(createToggleableAvatar(state.player!, 160, "fullBody"));
    speakerPortrait.innerHTML += `<span class="text-xs font-black text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/20">${state.player!.name}</span>`;
  } else {
    // Narrator avatar box
    const outerCirc = document.createElement("div");
    outerCirc.className = "w-28 h-28 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center text-slate-300 text-3xl font-extrabold shadow-lg";
    outerCirc.innerText = "⚜️";
    speakerPortrait.appendChild(outerCirc);
    speakerPortrait.innerHTML += `<span class="text-xs font-black text-slate-400">Narrator</span>`;
  }
  layoutBox.appendChild(speakerPortrait);

  // Right side: Bubble text and choices block
  const dialogueContent = document.createElement("div");
  dialogueContent.className = "flex-1 space-y-6 w-full flex flex-col justify-between";

  const messageBubble = document.createElement("div");
  messageBubble.className = "bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-slate-200 text-sm md:text-base leading-relaxed font-semibold shadow-inner min-h-[100px]";
  messageBubble.innerText = node.text;
  dialogueContent.appendChild(messageBubble);

  const choicesBox = document.createElement("div");
  choicesBox.className = "space-y-3";

  if (node.choices.length > 0) {
    node.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "w-full text-left p-4 bg-slate-700/50 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-600 hover:border-slate-500 font-bold transition-all text-xs md:text-sm flex items-center justify-between gap-4 group";

      // Display clean descriptive choice text (no explicit stat labels inside text to protect player immersion!)
      const textSpan = document.createElement("span");
      textSpan.innerText = choice.text;
      btn.appendChild(textSpan);

      btn.addEventListener("click", () => {
        let toastMsg = "";

        if (choice.statDeltas) {
          const modified = applyCompatibilityModifiers(choice.statDeltas, comp.score);

          Object.entries(modified).forEach(([key, val]) => {
            const k = key as keyof typeof rel.stats;
            if (val) {
              rel.stats[k] = Math.max(0, Math.min(100, rel.stats[k] + val));
              const sign = val > 0 ? "+" : "";
              toastMsg += `• ${key.toUpperCase()} adjusted by ${sign}${val}% (influenced by compatibility)<br/>`;
            }
          });

          lastDialogueDeltas = modified as any;
        }

        const oldStage = rel.stage;
        rel.stage = getRelationshipStage(rel.stats.affection, rel.stats.trust);

        if (oldStage !== rel.stage) {
          toastMsg += `<strong>🌟 RELATIONSHIP STAGE UPGRADED TO: ${rel.stage}!</strong>`;
        }

        // Increment unique questline stages on completion of quest nodes
        if (npc.isUnique && choice.nextNodeId === "end") {
          npc.questStage = Math.min(3, (npc.questStage || 0) + 1);
          toastMsg += `<br/><strong>★ QUEST LINE COMPLETED: Stage ${npc.questStage}!</strong>`;
        }

        // Show choice outcome toast
        if (toastMsg) {
          showToast(toastMsg);
        }

        rel.history.push({
          timestamp: Date.now(),
          sceneId: scene.id,
          choiceMade: choice.text,
          statDeltas: choice.statDeltas || {}
        });

        activeNodeId = choice.nextNodeId;
        saveGame(state);
        renderApp();
      });

      choicesBox.appendChild(btn);
    });
  } else {
    // End node
    const finishBtn = document.createElement("button");
    finishBtn.className = "w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-900 font-black rounded-xl shadow-lg transition-all text-sm text-center";
    finishBtn.innerText = "Complete Dialogue Scene";

    finishBtn.addEventListener("click", () => {
      lastDialogueDeltas = {};
      activeView = "npc-detail";
      renderApp();
    });
    choicesBox.appendChild(finishBtn);
  }

  dialogueContent.appendChild(choicesBox);
  layoutBox.appendChild(dialogueContent);
  container.appendChild(layoutBox);

  return container;
}

/**
 * 5. OFFSPRING NURSERY / GENERATION VISUAL SIDE-BY-SIDE VIEW
 */
function createNurseryView(): HTMLElement {
  const container = document.createElement("div");
  container.className = "max-w-6xl mx-auto p-6 space-y-8 animate-fadeIn";

  // Build a complete list of all characters in play
  const allChars: Character[] = [];
  if (state.player) allChars.push(state.player);
  state.npcs.forEach(n => allChars.push(n));
  state.offspring.forEach(o => allChars.push(o));

  // RENDER FOCUSED OFFSPRING REVEALUX SCREEN IF SELECTED
  if (detailedChildId) {
    const child = state.offspring.find(c => c.id === detailedChildId);
    if (child) {
      const parentA = allChars.find(x => x.id === child.parentIds?.[0]) || state.player!;
      const parentB = allChars.find(x => x.id === child.parentIds?.[1]) || state.npcs[0];

      // Side-by-side comparison Screen
      const revealContainer = document.createElement("div");
      revealContainer.className = "space-y-6";

      const rHeader = document.createElement("div");
      rHeader.className = "text-center space-y-2 py-4";
      rHeader.innerHTML = `
        <span class="text-[10px] uppercase font-black tracking-widest text-pink-400 bg-pink-400/10 px-3 py-1 rounded-full border border-pink-400/20">Lineage Creation Reveal</span>
        <h2 class="text-3xl font-black text-slate-100 mt-2">A Child of High Destiny is Born!</h2>
        <p class="text-xs text-slate-400">Marvel at the visual and personality traits blended across generations.</p>
      `;
      revealContainer.appendChild(rHeader);

      const mathView = document.createElement("div");
      mathView.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 flex flex-col md:flex-row justify-around items-center gap-6 shadow-2xl relative overflow-hidden";

      const createRevealedCard = (char: Character, role: string, highlight = false) => {
        const wrap = document.createElement("div");
        wrap.className = `flex flex-col items-center gap-2 text-center p-4 rounded-2xl border ${highlight ? "bg-pink-500/5 border-pink-500/30" : "bg-slate-900/40 border-slate-800"}`;

        wrap.appendChild(createToggleableAvatar(char, 140, "fullBody"));

        const label = document.createElement("div");
        label.className = "space-y-0.5 mt-2";
        label.innerHTML = `
          <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">${role}</span>
          <h4 class="font-extrabold text-slate-200 text-sm">${char.name}</h4>
          <span class="text-[10px] text-slate-400">${char.species} • ${char.gender}</span>
        `;
        wrap.appendChild(label);
        return wrap;
      };

      mathView.appendChild(createRevealedCard(parentA, "Parent 1"));
      const pSign = document.createElement("span");
      pSign.className = "text-3xl font-black text-slate-500 hidden md:block";
      pSign.innerText = "＋";
      mathView.appendChild(pSign);

      mathView.appendChild(createRevealedCard(parentB, "Parent 2"));
      const eSign = document.createElement("span");
      eSign.className = "text-3xl font-black text-slate-500 hidden md:block";
      eSign.innerText = "＝";
      mathView.appendChild(eSign);

      mathView.appendChild(createRevealedCard(child, "Offspring", true));
      revealContainer.appendChild(mathView);

      // Trait details block
      const traitDetails = document.createElement("div");
      traitDetails.className = "grid grid-cols-1 md:grid-cols-2 gap-6";

      const genBlock = document.createElement("div");
      genBlock.className = "bg-slate-800 border border-slate-700 p-5 rounded-2xl space-y-3";

      let legendaryHTML = "None";
      if (child.legendaryTraits && child.legendaryTraits.length > 0) {
        legendaryHTML = child.legendaryTraits.map(t => `<span class="inline-block bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded font-black text-xs mr-1 animate-pulse">✨ ${t}</span>`).join("");
      }

      let recessiveHTML = "None";
      if (child.carriedTraits && child.carriedTraits.length > 0) {
        recessiveHTML = child.carriedTraits.map(t => `<span class="inline-block bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded font-bold text-xs mr-1">🧬 ${t}</span>`).join("");
      }

      genBlock.innerHTML = `
        <h4 class="font-black text-amber-400 text-sm uppercase tracking-wide border-b border-slate-700/50 pb-2">Lineage &amp; Genetics</h4>
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div><strong>Generation:</strong> Gen ${child.generation || 2}</div>
          <div><strong>Age Stage:</strong> Youth (0 / 9 Seasons)</div>
          <div><strong>Height:</strong> ${child.geneticTraits.height} cm</div>
          <div><strong>Build:</strong> ${child.geneticTraits.build}</div>
          <div><strong>Ear Shape:</strong> ${child.geneticTraits.earShape}</div>
          <div><strong>Hair Texture:</strong> ${child.geneticTraits.hairTexture}</div>
          <div><strong>Markings Pattern:</strong> ${child.geneticTraits.markingsPattern}</div>
          <div><strong>Species Features:</strong> ${child.geneticTraits.speciesFeatures}</div>
        </div>
        <div class="space-y-1 pt-2">
          <span class="block text-[10px] font-bold text-slate-400 uppercase">Legendary Lineage Traits:</span>
          <div>${legendaryHTML}</div>
        </div>
        <div class="space-y-1 pt-2">
          <span class="block text-[10px] font-bold text-slate-400 uppercase">Recessively Carried Traits (Skipped Generation):</span>
          <div>${recessiveHTML}</div>
        </div>
      `;
      traitDetails.appendChild(genBlock);

      const stylingBlock = document.createElement("div");
      stylingBlock.className = "bg-slate-800 border border-slate-700 p-5 rounded-2xl space-y-3";
      stylingBlock.innerHTML = `
        <h4 class="font-black text-pink-400 text-sm uppercase tracking-wide border-b border-slate-700/50 pb-2">Styling &amp; Persona Profile</h4>
        <p class="text-xs text-slate-300 italic">"${child.background}"</p>
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
          <div><strong>Hairstyle (Fresh!):</strong> ${child.stylingTraits.hairStyle}</div>
          <div><strong>Accessory (Fresh!):</strong> ${child.stylingTraits.accessory}</div>
          <div class="col-span-2"><strong>Clothing Outfit:</strong> ${child.stylingTraits.clothing.split("-").join(" ")}</div>
        </div>
        <div class="space-y-1.5 pt-2">
          <span class="text-[10px] font-bold text-slate-400 uppercase block">Personality Stats:</span>
          <div class="grid grid-cols-5 gap-1 text-center text-[10px] font-semibold text-slate-200">
            <div class="bg-slate-900 p-1.5 rounded">Bold<br/>${child.personalityTraits.boldness}%</div>
            <div class="bg-slate-900 p-1.5 rounded">Warm<br/>${child.personalityTraits.warmth}%</div>
            <div class="bg-slate-900 p-1.5 rounded">Wit<br/>${child.personalityTraits.wit}%</div>
            <div class="bg-slate-900 p-1.5 rounded">Amb<br/>${child.personalityTraits.ambition}%</div>
            <div class="bg-slate-900 p-1.5 rounded">Chs<br/>${child.personalityTraits.chaos}%</div>
          </div>
        </div>
      `;
      traitDetails.appendChild(stylingBlock);
      revealContainer.appendChild(traitDetails);

      // Return Buttons
      const buttonsRow = document.createElement("div");
      buttonsRow.className = "flex gap-4 justify-center py-4";

      const toNurseryBtn = document.createElement("button");
      toNurseryBtn.className = "px-6 py-3 bg-pink-500 hover:bg-pink-600 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm";
      toNurseryBtn.innerText = "🍼 View in Nursery";
      toNurseryBtn.addEventListener("click", () => {
        detailedChildId = null;
        nurserySubTab = "compact";
        renderApp();
      });
      buttonsRow.appendChild(toNurseryBtn);

      const toHubBtn = document.createElement("button");
      toHubBtn.className = "px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-extrabold rounded-xl shadow-lg border border-slate-700 transition-all text-sm";
      toHubBtn.innerText = "← Return to Town Hub";
      toHubBtn.addEventListener("click", () => {
        detailedChildId = null;
        activeView = "hub";
        renderApp();
      });
      buttonsRow.appendChild(toHubBtn);

      revealContainer.appendChild(buttonsRow);
      container.appendChild(revealContainer);
      return container;
    }
  }

  // RENDER NORMAL GALLERY TABS

  // Season and AP Status bar at top of Nursery
  container.appendChild(renderSeasonStatusBar());

  // Header controls
  const header = document.createElement("div");
  header.className = "flex items-center justify-between";
  header.innerHTML = `
    <div>
      <h2 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">🍼 The Offspring Nursery</h2>
      <p class="text-xs text-slate-400 mt-1">Manage family breeding, gaze upon the branching lineage tree, and unlock bloodline achievements.</p>
    </div>
  `;
  const backBtn = document.createElement("button");
  backBtn.className = "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all shadow-md";
  backBtn.innerText = "← Back to Adventure Hub";
  backBtn.addEventListener("click", () => {
    activeView = "hub";
    renderApp();
  });
  header.appendChild(backBtn);
  container.appendChild(header);

  // Tab buttons row
  const tabsContainer = document.createElement("div");
  tabsContainer.className = "flex border-b border-slate-700 gap-2 overflow-x-auto text-xs md:text-sm pt-2";

  const renderTabBtn = (tabId: typeof nurserySubTab, label: string) => {
    const btn = document.createElement("button");
    btn.className = `px-4 py-2 font-bold transition-all border-b-2 focus:outline-none whitespace-nowrap cursor-pointer ${nurserySubTab === tabId ? "border-pink-500 text-pink-400 bg-pink-500/5" : "border-transparent text-slate-400 hover:text-slate-200"}`;
    btn.innerText = label;
    btn.addEventListener("click", () => {
      nurserySubTab = tabId;
      renderApp();
    });
    tabsContainer.appendChild(btn);
  };

  renderTabBtn("compact", "🍼 Compact Nursery Grid");
  renderTabBtn("tree", "🌳 Branching Family Tree");
  renderTabBtn("pairing", "💞 Lineage Pairing Chamber");
  renderTabBtn("achievements", "🏆 Legacy & Achievements");
  container.appendChild(tabsContainer);

  if (nurserySubTab === "compact") {
    // 1. COMPACT NURSERY GRID TAB
    if (state.offspring.length === 0) {
      const emptyBox = document.createElement("div");
      emptyBox.className = "bg-slate-800/40 border border-slate-700/50 p-12 text-center rounded-3xl space-y-4";
      emptyBox.innerHTML = `
        <span class="text-5xl">🍼</span>
        <h3 class="text-xl font-bold text-slate-200">The nursery is quiet... for now.</h3>
        <p class="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
          Deepen relationships with wanderers in the town or use the Pairing Chamber to generate beautiful descendants!
        </p>
      `;
      container.appendChild(emptyBox);
    } else {
      const grid = document.createElement("div");
      grid.className = "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6";

      state.offspring.forEach((child) => {
        const card = document.createElement("div");
        card.className = "bg-slate-800 border border-slate-700 hover:border-pink-500/50 rounded-2xl p-4 flex gap-4 cursor-pointer transition-all hover:-translate-y-1 shadow-md";
        card.addEventListener("click", () => {
          detailedChildId = child.id;
          renderApp();
        });

        // Small circular avatar (size 50px)
        const avatarWrapper = document.createElement("div");
        avatarWrapper.innerHTML = renderCharacter(child, 55, "portrait");
        card.appendChild(avatarWrapper);

        const details = document.createElement("div");
        details.className = "flex-1 min-w-0 flex flex-col justify-center";

        const ageVal = child.age ?? 0;
        const stageLabel = getAgeStageLabel(ageVal);
        const stageColor = stageLabel === "Youth" ? "text-cyan-400" : stageLabel === "Prime" ? "text-emerald-400" : "text-amber-500";

        details.innerHTML = `
          <h4 class="font-extrabold text-slate-100 truncate">${child.name}</h4>
          <p class="text-[10px] text-slate-400 mt-0.5">${child.species} • ${child.gender}</p>
          <p class="text-[10px] mt-1 text-slate-400">Age: ${ageVal} (<span class="${stageColor} font-bold">${stageLabel}</span>) • Gen ${child.generation || 2}</p>
        `;
        card.appendChild(details);
        grid.appendChild(card);
      });

      container.appendChild(grid);
    }
  } else if (nurserySubTab === "tree") {
    // 2. BRANCHING FAMILY TREE TAB
    const treeContainer = document.createElement("div");
    treeContainer.className = "bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden min-h-[450px]";

    // Connections SVG overlay (underneath row contents)
    const svgConnections = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgConnections.id = "tree-svg-connections";
    svgConnections.setAttribute("class", "absolute inset-0 pointer-events-none w-full h-full z-0");
    treeContainer.appendChild(svgConnections);

    // Group characters by generation
    const genMap: Record<number, Character[]> = {};
    allChars.forEach(c => {
      const g = c.generation || 1;
      if (!genMap[g]) genMap[g] = [];
      genMap[g].push(c);
    });

    const generations = Object.keys(genMap).map(Number).sort((a, b) => a - b);

    if (generations.length === 0) {
      treeContainer.innerHTML = `<p class="text-center text-slate-500 py-12">No lineage members recorded.</p>`;
    } else {
      const rowsBox = document.createElement("div");
      rowsBox.className = "space-y-16 relative z-10 flex flex-col";

      generations.forEach(gen => {
        const row = document.createElement("div");
        row.className = "flex flex-wrap justify-center gap-6 py-2 border-b border-slate-800/30 last:border-b-0";

        const rowLabel = document.createElement("div");
        rowLabel.className = "w-full text-center text-[10px] font-black uppercase text-pink-400/60 tracking-widest mb-1";
        rowLabel.innerText = `Generation ${gen}`;
        row.appendChild(rowLabel);

        genMap[gen].forEach(c => {
          const card = document.createElement("div");
          card.setAttribute("data-id", c.id);
          card.className = "tree-node-card bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 flex items-center gap-3 transition-all cursor-pointer shadow-md select-none max-w-xs";
          if (c.id === "player") {
            card.classList.add("ring-2", "ring-amber-500", "border-amber-400");
          }

          card.addEventListener("click", () => {
            if (c.origin === "offspring") {
              detailedChildId = c.id;
            } else {
              selectedNpcId = c.id;
              activeView = "npc-detail";
            }
            renderApp();
          });

          // Small 45px portrait
          const av = document.createElement("div");
          av.className = "flex-shrink-0";
          av.innerHTML = renderCharacter(c, 45, "portrait");
          card.appendChild(av);

          const textEl = document.createElement("div");
          textEl.className = "text-left min-w-0";

          const ageVal = c.age ?? 3;
          const stageLabel = getAgeStageLabel(ageVal);
          const stageColor = stageLabel === "Youth" ? "text-cyan-400" : stageLabel === "Prime" ? "text-emerald-400" : "text-amber-500";

          textEl.innerHTML = `
            <div class="font-extrabold text-slate-100 text-xs truncate flex items-center gap-1">${c.id === "player" ? "👑 " : ""}${c.name}</div>
            <p class="text-[9px] text-slate-400 mt-0.5">${c.species} • <span class="${stageColor} font-bold">${stageLabel}</span></p>
          `;
          card.appendChild(textEl);
          row.appendChild(card);
        });

        rowsBox.appendChild(row);
      });

      treeContainer.appendChild(rowsBox);

      // SVG dynamic connection drawing
      setTimeout(() => {
        const svg = document.getElementById("tree-svg-connections") as SVGSVGElement | null;
        if (!svg) return;
        svg.innerHTML = ""; // clear previous connections

        const containerRect = treeContainer.getBoundingClientRect();

        allChars.forEach(child => {
          if (!child.parentIds) return;

          const childCard = treeContainer.querySelector(`[data-id="${child.id}"].tree-node-card`);
          if (!childCard) return;

          const childRect = childCard.getBoundingClientRect();
          const childX = childRect.left + childRect.width / 2 - containerRect.left;
          const childY = childRect.top - containerRect.top;

          child.parentIds.forEach(parentId => {
            const parentCard = treeContainer.querySelector(`[data-id="${parentId}"].tree-node-card`);
            if (!parentCard) return;

            const parentRect = parentCard.getBoundingClientRect();
            const parentX = parentRect.left + parentRect.width / 2 - containerRect.left;
            const parentY = parentRect.top + parentRect.height - containerRect.top;

            // Draw elegant curved bezier line connecting generations
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            const midY = (parentY + childY) / 2;
            const d = `M ${parentX} ${parentY} C ${parentX} ${midY}, ${childX} ${midY}, ${childX} ${childY}`;
            path.setAttribute("d", d);
            path.setAttribute("stroke", "#f43f5e");
            path.setAttribute("stroke-width", "2.5");
            path.setAttribute("stroke-opacity", "0.55");
            path.setAttribute("fill", "none");
            svg.appendChild(path);
          });
        });
      }, 100);
    }

    container.appendChild(treeContainer);
  } else if (nurserySubTab === "pairing") {
    // 3. LINEAGE PAIRING CHAMBER TAB
    const chamber = document.createElement("div");
    chamber.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 space-y-6 shadow-xl";

    const chamberHeader = document.createElement("div");
    chamberHeader.className = "text-center max-w-xl mx-auto space-y-2";
    chamberHeader.innerHTML = `
      <h3 class="text-xl font-extrabold text-slate-100">💞 The Grand Pairing Chamber</h3>
      <p class="text-xs text-slate-400">Select any two eligible Prime characters in your bloodline to breed next-generation children. Sibling and direct parent-child pairings are strictly forbidden!</p>
    `;
    chamber.appendChild(chamberHeader);

    // Candidates are all characters in Prime stage (age 3-8 seasons)
    const primeCandidates = allChars.filter(c => {
      const ageVal = c.age ?? 3;
      return ageVal >= 3 && ageVal <= 8;
    });

    if (primeCandidates.length < 2) {
      const lockBox = document.createElement("div");
      lockBox.className = "p-8 text-center bg-slate-900/40 border border-slate-800 rounded-2xl max-w-md mx-auto space-y-3";
      lockBox.innerHTML = `
        <span class="text-3xl block">🔒</span>
        <h4 class="font-extrabold text-slate-200">Pairing Chamber Locked</h4>
        <p class="text-xs text-slate-400 leading-relaxed">Requires at least 2 characters in their Prime (age 3-8 seasons) to breed. Advance the seasons from the Town Hub to grow newborn Youth into Prime adulthood!</p>
      `;
      chamber.appendChild(lockBox);
    } else {
      // Setup dropdown state
      if (!selectedParentAId || !primeCandidates.some(c => c.id === selectedParentAId)) {
        selectedParentAId = primeCandidates[0].id;
      }
      if (!selectedParentBId || !primeCandidates.some(c => c.id === selectedParentBId)) {
        selectedParentBId = primeCandidates[1].id;
      }

      const p1 = primeCandidates.find(c => c.id === selectedParentAId)!;
      const p2 = primeCandidates.find(c => c.id === selectedParentBId)!;

      const selectorsRow = document.createElement("div");
      selectorsRow.className = "grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-slate-900/40 p-5 rounded-2xl border border-slate-850";

      const createSelectorHalf = (label: string, selectedId: string, onChange: (id: string) => void) => {
        const box = document.createElement("div");
        box.className = "space-y-3 flex flex-col items-center";

        const lbl = document.createElement("label");
        lbl.className = "block text-xs font-black uppercase text-pink-400/80 tracking-wider";
        lbl.innerText = label;
        box.appendChild(lbl);

        const sel = document.createElement("select");
        sel.className = "w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-white text-xs focus:ring-2 focus:ring-amber-500";
        primeCandidates.forEach(cand => {
          const opt = document.createElement("option");
          opt.value = cand.id;
          opt.innerText = `${cand.name} (${cand.species} • Age ${cand.age ?? 3})`;
          opt.selected = cand.id === selectedId;
          sel.appendChild(opt);
        });

        sel.addEventListener("change", (e) => {
          onChange((e.target as HTMLSelectElement).value);
          renderApp();
        });
        box.appendChild(sel);

        // Visual avatar
        const selCand = primeCandidates.find(c => c.id === selectedId)!;
        box.appendChild(createToggleableAvatar(selCand, 100, "fullBody"));

        return box;
      };

      selectorsRow.appendChild(createSelectorHalf("Partner A (Prime age)", selectedParentAId, (id) => selectedParentAId = id));
      selectorsRow.appendChild(createSelectorHalf("Partner B (Prime age)", selectedParentBId, (id) => selectedParentBId = id));
      chamber.appendChild(selectorsRow);

      // Check pairing eligibility / incest rules
      const eligibility = checkPairingEligibility(p1, p2);
      const outcomePanel = document.createElement("div");
      outcomePanel.className = "p-4 rounded-xl border max-w-xl mx-auto text-center space-y-4";

      if (!eligibility.eligible) {
        outcomePanel.classList.add("bg-rose-500/10", "border-rose-500/30", "text-rose-400");
        outcomePanel.innerHTML = `
          <h4 class="font-extrabold text-sm uppercase">⚠️ Pairing Blocked</h4>
          <p class="text-xs">${eligibility.reason}</p>
          <button class="w-full py-3 bg-slate-750 text-slate-500 font-extrabold rounded-xl text-xs cursor-not-allowed uppercase" disabled>🔒 Breed Action Forbidden</button>
        `;
      } else {
        const comp = computeCompatibility(p1, p2);
        outcomePanel.classList.add("bg-pink-500/5", "border-pink-500/20", "text-slate-200");

        outcomePanel.innerHTML = `
          <h4 class="font-extrabold text-sm uppercase text-pink-400 tracking-wider">💓 Partners Match Compatibility: ${comp.score}%</h4>
          <p class="text-xs text-slate-400 italic">"${comp.breakdown[0]}"</p>
        `;

        const breedBtn = document.createElement("button");
        breedBtn.className = "w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold rounded-xl text-xs shadow-lg transition-all cursor-pointer uppercase";
        breedBtn.innerText = "✨ Breed Selected Partners (Costs 3 AP)";
        breedBtn.addEventListener("click", () => {
          const currentAP = state.actionPoints ?? 5;
          if (currentAP < 3) {
            showToast("⚠️ Requires 3 Action Points to breed! End the season to restore energy.");
            return;
          }

          // Deduct 3 AP
          state.actionPoints = currentAP - 3;

          // Generate child
          const child = generateOffspring(p1, p2);
          state.offspring.push(child);

          // Check and unlock achievements
          checkAndUnlockAchievements(child);

          saveGame(state);

          // Launch focused offspring reveal immediately
          detailedChildId = child.id;
          renderApp();
        });

        outcomePanel.appendChild(breedBtn);
      }

      chamber.appendChild(outcomePanel);
    }

    container.appendChild(chamber);
  } else if (nurserySubTab === "achievements") {
    // 4. LEGACY AND ACHIEVEMENTS TAB
    const page = document.createElement("div");
    page.className = "space-y-6";

    // Milestone/Legacy Stats Card
    const milestoneBox = document.createElement("div");
    milestoneBox.className = "bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-md";

    // Calculations
    const maxGen = Math.max(state.player?.generation || 1, ...state.npcs.map(n => n.generation || 1), ...state.offspring.map(o => o.generation || 1));
    const speciesSet = new Set(allChars.map(c => c.species));
    const legendarySet = new Set<string>();
    allChars.forEach(c => c.legendaryTraits?.forEach(t => legendarySet.add(t)));

    milestoneBox.innerHTML = `
      <h3 class="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400 border-b border-slate-700/50 pb-2.5">🏆 Bloodline Milestone Progress</h3>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
        <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-850 text-center">
          <span class="text-2xl font-black text-rose-400">${maxGen}</span>
          <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Generation Depth</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-850 text-center">
          <span class="text-2xl font-black text-cyan-400">${speciesSet.size} / 11</span>
          <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Species Diversity</p>
        </div>
        <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-850 text-center">
          <span class="text-2xl font-black text-amber-400">${legendarySet.size}</span>
          <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Legendary Traits Collected</p>
        </div>
      </div>
    `;
    page.appendChild(milestoneBox);

    // Achievements grid
    const achTitle = document.createElement("h3");
    achTitle.className = "text-xl font-extrabold text-slate-200 mt-6";
    achTitle.innerText = "🏆 Hall of Achievements";
    page.appendChild(achTitle);

    const achievementsGrid = document.createElement("div");
    achievementsGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-6";

    const list = [
      {
        id: "verdant_berserker",
        title: "The Verdant Berserker",
        desc: "Orc or Half-Orc blood, high Boldness (75+), and classic green skin tone."
      },
      {
        id: "feywild_ambassador",
        title: "Feywild Ambassador",
        desc: "Elf or Half-Elf blood, high Warmth (75+), and pointed elf ears."
      },
      {
        id: "hellfire_academic",
        title: "Hellfire Academic",
        desc: "A Tiefling offspring with high Wit (75+) and demonic horns."
      },
      {
        id: "golden_monarch",
        title: "Golden Monarch",
        desc: "An offspring with a Legendary Trait styled with a golden crown."
      },
      {
        id: "shadow_assassin",
        title: "Shadow Assassin",
        desc: "An offspring styled in rogue leather, high Chaos (75+), and dark hair."
      },
      {
        id: "ancient_scholar",
        title: "Ancient Scholar",
        desc: "An offspring styled in a mage cloak, high Ambition (75+), and wearing glasses."
      }
    ];

    list.forEach(ach => {
      const isUnlocked = state.unlockedAchievements?.includes(ach.id) ?? false;
      const card = document.createElement("div");
      card.className = `border rounded-2xl p-5 flex flex-col justify-between transition-all ${isUnlocked ? "bg-slate-800 border-amber-500/40 text-slate-100" : "bg-slate-800/40 border-slate-800 opacity-60 text-slate-400"}`;

      card.innerHTML = `
        <div class="space-y-1.5 text-left">
          <div class="flex items-center justify-between">
            <h4 class="font-extrabold text-sm ${isUnlocked ? "text-amber-400" : "text-slate-500"}">${ach.title}</h4>
            <span class="text-sm">${isUnlocked ? "✨" : "🔒"}</span>
          </div>
          <p class="text-[11px] leading-relaxed text-slate-300">${ach.desc}</p>
        </div>
        <div class="text-[10px] font-bold uppercase mt-3 tracking-wider ${isUnlocked ? "text-amber-400" : "text-slate-500"}">
          ${isUnlocked ? "Status: Unlocked" : "Status: Locked"}
        </div>
      `;
      achievementsGrid.appendChild(card);
    });

    page.appendChild(achievementsGrid);
    container.appendChild(page);
  }

  return container;
}

renderApp();
