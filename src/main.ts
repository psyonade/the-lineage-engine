import './style.css';
import { Character, SaveState, Relationship, RelationshipStage, Scene, SceneNode, Choice, GameSpecies, GameGender } from "./types";
import { loadGame, saveGame, clearGame } from "./storage";
import { ARCHETYPES, UNIQUE_NPCS, generateNPC } from "./npc";
import { renderCharacter } from "./renderer";
import { computeCompatibility } from "./compatibility";
import { DIALOGUE_SCENES, getRelationshipStage, applyCompatibilityModifiers, getRelationshipPath } from "./dialogue";
import { generateOffspring } from "./genetics";

// Initial state
let state: SaveState = loadGame();

// Active tracking UI states
let activeView: "creator" | "hub" | "npc-detail" | "dialogue" | "nursery" = state.player ? "hub" : "creator";
let selectedNpcId: string | null = null;
let activeScene: Scene | null = null;
let activeNodeId: string = "start";
let lastDialogueDeltas: Record<string, number> = {};

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
    swatch.className = "px-2 py-1 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded border border-slate-700 text-[10px] font-bold transition-all";
    swatch.innerText = pk;
    swatch.addEventListener("click", () => {
      applySpeciesPresetColors(pk);
      updatePreview();
      renderApp(); // repaint creator to update values in slider fields
    });
    swatchRow.appendChild(swatch);
  });
  colorSection.appendChild(swatchRow);

  // Advanced color tuning sliders
  const createColorSlider = (label: string, value: number, max: number, onChange: (v: number) => void) => {
    const box = document.createElement("div");
    box.className = "space-y-1";
    const head = document.createElement("div");
    head.className = "flex justify-between text-xs text-slate-400";
    head.innerHTML = `<span>${label}</span><span class="font-bold text-slate-200">${value}</span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = max.toString();
    input.value = value.toString();
    input.className = "w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer";
    input.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      onChange(val);
      head.querySelector("span:last-child")!.textContent = val.toString();
      updatePreview();
    });
    box.appendChild(head);
    box.appendChild(input);
    return box;
  };

  colorSection.appendChild(createColorSlider("Skin Tone Hue", creatorForm.skinToneHue, 360, (v) => creatorForm.skinToneHue = v));
  colorSection.appendChild(createColorSlider("Hair Color Hue", creatorForm.hairColorHue, 360, (v) => creatorForm.hairColorHue = v));
  colorSection.appendChild(createColorSlider("Eye Color Hue", creatorForm.eyeColorHue, 360, (v) => creatorForm.eyeColorHue = v));

  form.appendChild(colorSection);

  // Personality sliders
  const personalitySection = document.createElement("div");
  personalitySection.className = "space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-700";
  personalitySection.innerHTML = `<h3 class="text-sm font-bold text-amber-400">Personality Stats</h3>`;

  const createPersSlider = (label: string, key: keyof typeof creatorForm.personality) => {
    const box = document.createElement("div");
    box.className = "space-y-1";
    const head = document.createElement("div");
    head.className = "flex justify-between text-xs text-slate-400";
    head.innerHTML = `<span>${label}</span><span class="font-bold text-slate-200">${creatorForm.personality[key]}%</span>`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.value = creatorForm.personality[key].toString();
    input.className = "w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer";
    input.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      creatorForm.personality[key] = val;
      head.querySelector("span:last-child")!.textContent = `${val}%`;
    });
    box.appendChild(head);
    box.appendChild(input);
    return box;
  };

  personalitySection.appendChild(createPersSlider("Boldness (Confidence & Initiative)", "boldness"));
  personalitySection.appendChild(createPersSlider("Warmth (Empathy & Friendliness)", "warmth"));
  personalitySection.appendChild(createPersSlider("Wit (Cleverness & Humour)", "wit"));
  personalitySection.appendChild(createPersSlider("Ambition (Drive & Respect)", "ambition"));
  personalitySection.appendChild(createPersSlider("Chaos (Playfulness & Spontaneity)", "chaos"));

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
      background: `You, the storied ${creatorForm.gender} ${creatorForm.species} explorer of this high-fantasy realm.`,
      origin: "player"
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

  // Hub Header
  const header = document.createElement("div");
  header.className = "flex flex-col md:flex-row items-center justify-between bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 gap-6 shadow-2xl backdrop-blur-md";

  const playerDetails = document.createElement("div");
  playerDetails.className = "flex items-center gap-5";
  const playerAvatar = createToggleableAvatar(state.player!, 80);
  playerDetails.appendChild(playerAvatar);

  const playerText = document.createElement("div");
  playerText.innerHTML = `
    <div class="flex items-center gap-2">
      <h2 class="text-2xl font-black text-amber-400">${state.player!.name}</h2>
      <span class="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold uppercase">${state.player!.gender}</span>
    </div>
    <p class="text-xs text-slate-300 mt-1">${state.player!.species} • ${state.player!.geneticTraits.height} cm • ${state.player!.geneticTraits.build}</p>
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
  metaControls.className = "flex flex-col sm:flex-row gap-3";

  const viewNurseryBtn = document.createElement("button");
  viewNurseryBtn.className = "px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold rounded-xl shadow-lg transition-all text-xs";
  viewNurseryBtn.innerHTML = `🍼 Offspring Gallery (${state.offspring.length})`;
  viewNurseryBtn.addEventListener("click", () => {
    activeView = "nursery";
    renderApp();
  });
  metaControls.appendChild(viewNurseryBtn);

  const resetBtn = document.createElement("button");
  resetBtn.className = "px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-xs font-bold transition-all border border-slate-600";
  resetBtn.innerText = "Reset Odyssey";
  resetBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to reset your character and relationships? All progress will be lost!")) {
      clearGame();
      state = { player: null, npcs: [], relationships: {}, offspring: [] };
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
      <p class="text-xs text-slate-400 mt-1">Talk with unique story personas (★ Storied) or generate procedural wanderers.</p>
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

  state.npcs.forEach(npc => {
    const rel: Relationship = state.relationships[npc.id] || {
      characterAId: state.player!.id,
      characterBId: npc.id,
      stage: "Stranger",
      path: "none",
      stats: { affection: 10, trust: 10, attraction: 10, rivalry: 10 },
      history: []
    };

    // Calculate dynamic emergent path label
    const dynamicPath = getRelationshipPath(rel.stats);
    rel.path = dynamicPath; // update save instance state

    const card = document.createElement("div");
    card.className = `border rounded-2xl p-5 flex gap-4 cursor-pointer transition-all duration-200 transform hover:-translate-y-1 bg-slate-800/60 hover:bg-slate-800 ${
      npc.isUnique
        ? "border-amber-500/30 hover:border-amber-500/50"
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

    details.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-white text-base truncate flex items-center">${badgeHTML}${npc.name}</h4>
        <span class="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">${comp.score}% Fit</span>
      </div>
      <p class="text-[10px] text-slate-300 mt-1">${npc.species} • ${npc.gender} • ${npc.geneticTraits.height} cm • ${npc.geneticTraits.build}</p>
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
  const npc = state.npcs.find(n => n.id === selectedNpcId)!;
  const rel: Relationship = state.relationships[npc.id];
  const comp = computeCompatibility(state.player!, npc);

  const container = document.createElement("div");
  container.className = "max-w-5xl mx-auto p-6 space-y-6 animate-fadeIn";

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

  const avatarBox = document.createElement("div");
  avatarBox.className = "flex flex-col items-center justify-center";
  avatarBox.appendChild(createToggleableAvatar(npc, 160));
  const npcLabel = document.createElement("p");
  npcLabel.className = "text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider";
  npcLabel.innerText = `${npc.species} • ${npc.gender} • ${npc.geneticTraits.height} cm`;
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

    // Generate offspring!
    const child = generateOffspring(state.player!, npc);
    state.offspring.push(child);
    saveGame(state);

    // Swap view
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
  const npc = state.npcs.find(n => n.id === selectedNpcId)!;
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

  // Header controls
  const header = document.createElement("div");
  header.className = "flex items-center justify-between";
  header.innerHTML = `
    <div>
      <h2 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-rose-400">🍼 The Offspring Nursery</h2>
      <p class="text-xs text-slate-400 mt-1">Gaze upon your generational lineage and genetic masterpieces.</p>
    </div>
  `;
  const backBtn = document.createElement("button");
  backBtn.className = "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all";
  backBtn.innerText = "← Back to Adventure Hub";
  backBtn.addEventListener("click", () => {
    activeView = "hub";
    renderApp();
  });
  header.appendChild(backBtn);
  container.appendChild(header);

  if (state.offspring.length === 0) {
    const emptyBox = document.createElement("div");
    emptyBox.className = "bg-slate-800/40 border border-slate-700/50 p-12 text-center rounded-3xl space-y-4";
    emptyBox.innerHTML = `
      <span class="text-5xl">🍼</span>
      <h3 class="text-xl font-bold text-slate-200">The nursery is quiet... for now.</h3>
      <p class="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
        Deepen relationships with wanderers in the town. Once your friendship status with a character progresses, you can produce beautiful children together!
      </p>
    `;
    container.appendChild(emptyBox);
  } else {
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 gap-8";

    state.offspring.forEach((child, index) => {
      const parentA = state.player!;
      const parentB = state.npcs.find(n => n.id === child.parentIds?.[1]) || state.npcs[0];

      const card = document.createElement("div");
      card.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 flex flex-col gap-6 shadow-xl relative overflow-hidden";

      // Triple Side-by-Side full-body visual presentation payoff
      const visualRoster = document.createElement("div");
      visualRoster.className = "flex flex-col md:flex-row items-center justify-around gap-6 bg-slate-900/60 p-4 rounded-2xl border border-slate-850/50";

      // Parent A
      const boxA = document.createElement("div");
      boxA.className = "flex flex-col items-center gap-1.5 text-center";
      boxA.appendChild(createToggleableAvatar(parentA, 130, "fullBody"));
      boxA.innerHTML += `<span class="text-[10px] font-bold text-slate-400">Parent 1: ${parentA.name} (${parentA.species})</span>`;
      visualRoster.appendChild(boxA);

      // Plus
      const mathSign1 = document.createElement("div");
      mathSign1.className = "text-xl font-black text-slate-500 hidden md:block";
      mathSign1.innerText = "＋";
      visualRoster.appendChild(mathSign1);

      // Parent B
      const boxB = document.createElement("div");
      boxB.className = "flex flex-col items-center gap-1.5 text-center";
      boxB.appendChild(createToggleableAvatar(parentB, 130, "fullBody"));
      boxB.innerHTML += `<span class="text-[10px] font-bold text-slate-400">Parent 2: ${parentB.name} (${parentB.species})</span>`;
      visualRoster.appendChild(boxB);

      // Equals
      const mathSign2 = document.createElement("div");
      mathSign2.className = "text-xl font-black text-slate-500 hidden md:block";
      mathSign2.innerText = "＝";
      visualRoster.appendChild(mathSign2);

      // Generated Offspring child
      const boxChild = document.createElement("div");
      boxChild.className = "flex flex-col items-center gap-1.5 text-center p-3 bg-pink-500/5 rounded-xl border border-pink-500/20";
      boxChild.appendChild(createToggleableAvatar(child, 140, "fullBody"));
      boxChild.innerHTML += `<span class="text-[10px] font-extrabold text-pink-400">Offspring: ${child.name} (${child.species})</span>`;
      visualRoster.appendChild(boxChild);

      card.appendChild(visualRoster);

      // Description details
      const detailSection = document.createElement("div");
      detailSection.className = "space-y-4";
      detailSection.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-2 border-b border-slate-700/50 pb-3">
          <div>
            <h3 class="text-2xl font-black text-pink-400">${child.name}</h3>
            <p class="text-[10px] uppercase font-extrabold text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-0.5 rounded-full inline-block mt-1">${child.species} Lineage • ${child.gender}</p>
          </div>
          <span class="text-xs text-slate-400">Generational child index: #${index + 1}</span>
        </div>

        <p class="text-xs text-slate-300 italic">"${child.background}"</p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Inherited traits card -->
          <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-2">
            <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wide block">Inherited Genetic Traits</span>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div><strong>Height:</strong> ${child.geneticTraits.height} cm</div>
              <div><strong>Build:</strong> ${child.geneticTraits.build}</div>
              <div><strong>Ears:</strong> ${child.geneticTraits.earShape}</div>
              <div><strong>Texture:</strong> ${child.geneticTraits.hairTexture}</div>
              <div><strong>Markings:</strong> ${child.geneticTraits.markingsPattern}</div>
              <div><strong>Features:</strong> ${child.geneticTraits.speciesFeatures}</div>
            </div>
          </div>

          <!-- Styling traits (Randomized style fresh!) -->
          <div class="bg-slate-900/50 p-4 rounded-xl border border-slate-850 space-y-2">
            <span class="text-[10px] font-bold text-pink-400 uppercase tracking-wide block">Fresh Styling (Non-Inherited)</span>
            <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
              <div><strong>Hairstyle:</strong> ${child.stylingTraits.hairStyle}</div>
              <div><strong>Accessory:</strong> ${child.stylingTraits.accessory}</div>
              <div><strong>Outfit:</strong> ${child.stylingTraits.clothing.split("-").join(" ")}</div>
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-[10px] font-bold text-pink-400 uppercase tracking-wide block">Personality Blend &amp; Mutation</span>
          <div class="grid grid-cols-5 gap-1.5 text-center text-[10px] font-semibold text-slate-300">
            <div class="bg-slate-900 p-2 rounded">Bold: ${child.personalityTraits.boldness}%</div>
            <div class="bg-slate-900 p-2 rounded">Warm: ${child.personalityTraits.warmth}%</div>
            <div class="bg-slate-900 p-2 rounded">Wit: ${child.personalityTraits.wit}%</div>
            <div class="bg-slate-900 p-2 rounded">Ambition: ${child.personalityTraits.ambition}%</div>
            <div class="bg-slate-900 p-2 rounded">Chaos: ${child.personalityTraits.chaos}%</div>
          </div>
        </div>
      `;

      card.appendChild(detailSection);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  return container;
}

renderApp();
