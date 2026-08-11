import './style.css';
import { Character, SaveState, Relationship, RelationshipStage, Scene, SceneNode, Choice } from "./types";
import { loadGame, saveGame, clearGame } from "./storage";
import { ARCHETYPES, generateNPC } from "./npc";
import { renderCharacter } from "./renderer";
import { computeCompatibility } from "./compatibility";
import { DIALOGUE_SCENES, getRelationshipStage, applyCompatibilityModifiers } from "./dialogue";
import { generateOffspring } from "./genetics";

// Initial state
let state: SaveState = loadGame();

// Active tracking UI states
let activeView: "creator" | "hub" | "npc-detail" | "dialogue" | "nursery" = state.player ? "hub" : "creator";
let selectedNpcId: string | null = null;
let activeScene: Scene | null = null;
let activeNodeId: string = "start";
let lastDialogueDeltas: Record<string, number> = {};

// Creator form state
const creatorForm = {
  name: "Althea",
  species: "Human" as Character["species"],
  build: "average" as Character["physicalTraits"]["build"],
  faceShape: "oval",
  hairStyle: "long",
  markingStyle: "none",
  accessory: "none",
  skinToneHue: 25,
  skinToneSat: 50,
  skinToneLight: 60,
  hairColorHue: 35,
  hairColorSat: 60,
  hairColorLight: 30,
  eyeColorHue: 200,
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
 * Main render router
 */
function renderApp() {
  const appEl = document.querySelector<HTMLDivElement>('#app')!;
  appEl.innerHTML = "";

  // Dynamic content based on view state
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

  // Character builder options
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

  // Grid for Physical attributes
  const physicalGrid = document.createElement("div");
  physicalGrid.className = "grid grid-cols-2 gap-4";

  // Species Select
  const speciesLabel = document.createElement("label");
  speciesLabel.className = "block text-sm text-slate-400";
  speciesLabel.innerText = "Species";
  const speciesSelect = document.createElement("select");
  speciesSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["Human", "Elf", "Dwarf", "Orc", "Tiefling", "Beastfolk"].forEach(sp => {
    const opt = document.createElement("option");
    opt.value = sp;
    opt.innerText = sp;
    opt.selected = creatorForm.species === sp;
    speciesSelect.appendChild(opt);
  });
  speciesSelect.addEventListener("change", (e) => {
    creatorForm.species = (e.target as HTMLSelectElement).value as any;
    // Set matching colors defaults
    if (creatorForm.species === "Elf") {
      creatorForm.skinToneHue = 40; creatorForm.skinToneLight = 80;
      creatorForm.hairColorHue = 190; creatorForm.hairColorLight = 80;
    } else if (creatorForm.species === "Orc") {
      creatorForm.skinToneHue = 120; creatorForm.skinToneLight = 40;
      creatorForm.hairColorHue = 0; creatorForm.hairColorLight = 15;
    } else if (creatorForm.species === "Tiefling") {
      creatorForm.skinToneHue = 345; creatorForm.skinToneLight = 50;
      creatorForm.hairColorHue = 280; creatorForm.hairColorLight = 25;
    }
    updatePreview();
  });
  speciesLabel.appendChild(speciesSelect);
  physicalGrid.appendChild(speciesLabel);

  // Build Select
  const buildLabel = document.createElement("label");
  buildLabel.className = "block text-sm text-slate-400";
  buildLabel.innerText = "Build";
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

  // Hair style
  const hairStyleLabel = document.createElement("label");
  hairStyleLabel.className = "block text-sm text-slate-400";
  hairStyleLabel.innerText = "Hair Style";
  const hairStyleSelect = document.createElement("select");
  hairStyleSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["short", "long", "braids", "curls", "crest", "afro", "mohawk"].forEach(h => {
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

  // Face shape
  const faceShapeLabel = document.createElement("label");
  faceShapeLabel.className = "block text-sm text-slate-400";
  faceShapeLabel.innerText = "Face Shape";
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

  // Markings Style
  const markingsLabel = document.createElement("label");
  markingsLabel.className = "block text-sm text-slate-400";
  markingsLabel.innerText = "Markings Style";
  const markingsSelect = document.createElement("select");
  markingsSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["none", "tattoos", "scars", "stripes", "freckles"].forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.innerText = m.charAt(0).toUpperCase() + m.slice(1);
    opt.selected = creatorForm.markingStyle === m;
    markingsSelect.appendChild(opt);
  });
  markingsSelect.addEventListener("change", (e) => {
    creatorForm.markingStyle = (e.target as HTMLSelectElement).value;
    updatePreview();
  });
  markingsLabel.appendChild(markingsSelect);
  physicalGrid.appendChild(markingsLabel);

  // Accessories Select
  const accLabel = document.createElement("label");
  accLabel.className = "block text-sm text-slate-400";
  accLabel.innerText = "Accessory";
  const accSelect = document.createElement("select");
  accSelect.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white mt-1";
  ["none", "earrings", "glasses", "crown", "circlet", "eyepatch"].forEach(a => {
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

  form.appendChild(physicalGrid);

  // Sliders for colors (Skin, Hair, Eye)
  const colorSection = document.createElement("div");
  colorSection.className = "space-y-3 bg-slate-900 p-4 rounded-xl border border-slate-700";
  colorSection.innerHTML = `<h3 class="text-sm font-bold text-amber-400">Color Palettes</h3>`;

  // Helper slider maker
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
    // Generate Character object
    const player: Character = {
      id: "player",
      name: creatorForm.name || "Aventis",
      species: creatorForm.species,
      physicalTraits: {
        skinToneHue: creatorForm.skinToneHue,
        skinToneSat: creatorForm.skinToneSat,
        skinToneLight: creatorForm.skinToneLight,
        hairColorHue: creatorForm.hairColorHue,
        hairColorSat: creatorForm.hairColorSat,
        hairColorLight: creatorForm.hairColorLight,
        eyeColorHue: creatorForm.eyeColorHue,
        eyeColorSat: creatorForm.eyeColorSat,
        eyeColorLight: creatorForm.eyeColorLight,
        hairStyle: creatorForm.hairStyle,
        faceShape: creatorForm.faceShape,
        build: creatorForm.build,
        markingStyle: creatorForm.markingStyle,
        accessory: creatorForm.accessory
      },
      personalityTraits: { ...creatorForm.personality },
      background: "You, a legendary wanderer of this whimsical realm.",
      origin: "player"
    };

    // Populate default hand-written NPCs
    const npcs = ARCHETYPES.map(arch => generateNPC(arch));

    state.player = player;
    state.npcs = npcs;
    state.relationships = {};
    state.offspring = [];

    // Initialize blank relationships
    npcs.forEach(npc => {
      state.relationships[npc.id] = {
        characterAId: player.id,
        characterBId: npc.id,
        stage: "Stranger",
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

  // Right customization Live Preview
  const rightCol = document.createElement("div");
  rightCol.className = "flex flex-col items-center justify-center bg-slate-900/60 p-6 rounded-2xl border border-slate-700/50 shadow-inner";

  const previewBox = document.createElement("div");
  previewBox.id = "creator-preview";
  previewBox.className = "transition-all duration-300 transform hover:scale-105";

  const updatePreview = () => {
    const mockChar: Character = {
      id: "preview",
      name: creatorForm.name,
      species: creatorForm.species,
      physicalTraits: {
        skinToneHue: creatorForm.skinToneHue,
        skinToneSat: creatorForm.skinToneSat,
        skinToneLight: creatorForm.skinToneLight,
        hairColorHue: creatorForm.hairColorHue,
        hairColorSat: creatorForm.hairColorSat,
        hairColorLight: creatorForm.hairColorLight,
        eyeColorHue: creatorForm.eyeColorHue,
        eyeColorSat: creatorForm.eyeColorSat,
        eyeColorLight: creatorForm.eyeColorLight,
        hairStyle: creatorForm.hairStyle,
        faceShape: creatorForm.faceShape,
        build: creatorForm.build,
        markingStyle: creatorForm.markingStyle,
        accessory: creatorForm.accessory
      },
      personalityTraits: creatorForm.personality,
      background: "",
      origin: "player"
    };
    previewBox.innerHTML = renderCharacter(mockChar, 320);
  };

  rightCol.appendChild(previewBox);

  const previewLabel = document.createElement("p");
  previewLabel.className = "text-sm text-slate-400 font-medium tracking-wide uppercase mt-4";
  previewLabel.innerText = "Real-time Portrait";
  rightCol.appendChild(previewLabel);

  container.appendChild(leftCol);
  container.appendChild(rightCol);

  // Run initial preview rendering
  setTimeout(updatePreview, 50);

  return container;
}

/**
 * 2. MAIN ADVENTURE HUB VIEW
 */
function createHubView(): HTMLElement {
  const container = document.createElement("div");
  container.className = "max-w-7xl mx-auto p-6 space-y-8 animate-fadeIn";

  // Hub Header (Player Profile & Quick Controls)
  const header = document.createElement("div");
  header.className = "flex flex-col md:flex-row items-center justify-between bg-slate-800/80 p-6 rounded-2xl border border-slate-700/80 gap-6 shadow-2xl backdrop-blur-md";

  const playerDetails = document.createElement("div");
  playerDetails.className = "flex items-center gap-5";
  const playerAvatar = document.createElement("div");
  playerAvatar.innerHTML = renderCharacter(state.player!, 75);
  playerDetails.appendChild(playerAvatar);

  const playerText = document.createElement("div");
  playerText.innerHTML = `
    <h2 class="text-2xl font-black text-amber-400">${state.player!.name}</h2>
    <p class="text-sm text-slate-300">Level 1 ${state.player!.species} Explorer</p>
    <div class="flex gap-2 mt-2">
      <span class="text-xs bg-slate-700/70 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600">Boldness: ${state.player!.personalityTraits.boldness}%</span>
      <span class="text-xs bg-slate-700/70 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600">Warmth: ${state.player!.personalityTraits.warmth}%</span>
      <span class="text-xs bg-slate-700/70 text-slate-300 px-2.5 py-1 rounded-full border border-slate-600">Wit: ${state.player!.personalityTraits.wit}%</span>
    </div>
  `;
  playerDetails.appendChild(playerText);
  header.appendChild(playerDetails);

  // Reset Button & Meta Controls
  const metaControls = document.createElement("div");
  metaControls.className = "flex flex-col sm:flex-row gap-3";

  const viewNurseryBtn = document.createElement("button");
  viewNurseryBtn.className = "px-5 py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold rounded-xl shadow-lg transition-all text-sm";
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

  // Main columns
  const contentGrid = document.createElement("div");
  contentGrid.className = "grid grid-cols-1 lg:grid-cols-3 gap-8";

  // Column 1 & 2: NPC Roster
  const rosterCol = document.createElement("div");
  rosterCol.className = "lg:col-span-2 space-y-6";

  const rosterHeader = document.createElement("div");
  rosterHeader.className = "flex items-center justify-between";
  rosterHeader.innerHTML = `
    <div>
      <h3 class="text-2xl font-black text-slate-100">Cast of Characters</h3>
      <p class="text-xs text-slate-400 mt-1">Chat, compete, build relationships, and create family lineages.</p>
    </div>
  `;

  // Generate dynamic procedurally randomized NPC option
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
      stats: { affection: 10, trust: 10, attraction: 10, rivalry: 10 },
      history: []
    };
    saveGame(state);
    renderApp();
  });
  rosterHeader.appendChild(genBtn);
  rosterCol.appendChild(rosterHeader);

  // NPC cards
  const cardsGrid = document.createElement("div");
  cardsGrid.className = "grid grid-cols-1 sm:grid-cols-2 gap-6";

  state.npcs.forEach(npc => {
    const rel: Relationship = state.relationships[npc.id] || {
      characterAId: state.player!.id,
      characterBId: npc.id,
      stage: "Stranger",
      stats: { affection: 10, trust: 10, attraction: 10, rivalry: 10 },
      history: []
    };

    const card = document.createElement("div");
    card.className = "bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-slate-600 rounded-2xl p-5 flex gap-4 cursor-pointer transition-all duration-200 transform hover:-translate-y-1";
    card.addEventListener("click", () => {
      selectedNpcId = npc.id;
      activeView = "npc-detail";
      renderApp();
    });

    const npcAvatar = document.createElement("div");
    npcAvatar.innerHTML = renderCharacter(npc, 75);
    card.appendChild(npcAvatar);

    // Details text
    const details = document.createElement("div");
    details.className = "flex-1 min-w-0";

    const comp = computeCompatibility(state.player!, npc);

    details.innerHTML = `
      <div class="flex items-center justify-between">
        <h4 class="font-bold text-white text-base truncate">${npc.name}</h4>
        <span class="text-xs font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">${comp.score}% Fit</span>
      </div>
      <p class="text-xs text-slate-300 mt-1">${npc.species} • ${npc.physicalTraits.build}</p>

      <!-- Progress Bar for affection -->
      <div class="mt-3 space-y-1">
        <div class="flex justify-between text-[10px] text-slate-400 font-bold">
          <span>Relationship: ${rel.stage}</span>
          <span>Affection: ${rel.stats.affection}%</span>
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

  // Column 3: Stats Overview & Recent events
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
        <p class="text-[10px] text-slate-400 font-bold uppercase mt-1">Lineage Born</p>
      </div>
    </div>
  `;
  rightSidebar.appendChild(statBox);

  // Tips for getting offspring
  const guideBox = document.createElement("div");
  guideBox.className = "bg-slate-800/50 border border-slate-700/80 p-5 rounded-2xl space-y-3";
  guideBox.innerHTML = `
    <h4 class="font-extrabold text-base text-pink-400">🍼 Lineage Mechanics</h4>
    <p class="text-xs text-slate-300 leading-relaxed">
      Pair up with any character that reaches <strong class="text-slate-100">Interested (50+)</strong> or <strong class="text-slate-100">Partner (80+)</strong> status to generate beautiful children inheriting blended species, visual attributes, and personality traits!
    </p>
    <div class="p-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-xs text-pink-300 font-medium">
      Pro Tip: High compatibility scores significantly boost relationship progression!
    </div>
  `;
  rightSidebar.appendChild(guideBox);

  contentGrid.appendChild(rightSidebar);
  container.appendChild(contentGrid);

  return container;
}

/**
 * 3. NPC DETAIL / COMPATIBILITY / ENGAGEMENT SCREEN
 */
function createNpcDetailView(): HTMLElement {
  const npc = state.npcs.find(n => n.id === selectedNpcId)!;
  const rel: Relationship = state.relationships[npc.id];
  const comp = computeCompatibility(state.player!, npc);

  const container = document.createElement("div");
  container.className = "max-w-5xl mx-auto p-6 space-y-6 animate-fadeIn";

  // Back to Hub
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
  avatarBox.innerHTML = renderCharacter(npc, 160);
  const npcLabel = document.createElement("p");
  npcLabel.className = "text-xs font-bold text-slate-400 mt-2 uppercase tracking-wider";
  npcLabel.innerText = `${npc.species} • ${npc.physicalTraits.build}`;
  avatarBox.appendChild(npcLabel);
  npcHeader.appendChild(avatarBox);

  // Bio & Status
  const infoBox = document.createElement("div");
  infoBox.className = "md:col-span-2 space-y-4";
  infoBox.innerHTML = `
    <div>
      <h2 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400">${npc.name}</h2>
      <p class="text-sm italic text-slate-300 mt-1">"${npc.background}"</p>
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
        <span class="text-base font-black text-amber-400">${rel.stats.attraction}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Attraction</p>
      </div>
      <div class="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-center">
        <span class="text-base font-black text-orange-400">${rel.stats.rivalry}%</span>
        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Rivalry</p>
      </div>
    </div>

    <div class="flex items-center justify-between text-sm text-slate-300 bg-slate-900 p-3.5 rounded-xl border border-slate-800">
      <span class="font-semibold">Current Relationship: <strong class="text-white">${rel.stage}</strong></span>
      <span class="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400 border border-slate-700">Fit Index: ${comp.score}/100</span>
    </div>
  `;
  npcHeader.appendChild(infoBox);
  container.appendChild(npcHeader);

  // Action Columns
  const actionsGrid = document.createElement("div");
  actionsGrid.className = "grid grid-cols-1 lg:grid-cols-2 gap-8";

  // Actions
  const interactionPanel = document.createElement("div");
  interactionPanel.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 space-y-5 shadow-lg";
  interactionPanel.innerHTML = `
    <h3 class="text-xl font-bold text-slate-200">Engage ${npc.name}</h3>
    <p class="text-xs text-slate-400">Embark on dynamic story quests to deepen your connection, play jokes, or even confess romance.</p>
  `;

  // Start Meeting Button
  const playDialogueBtn = document.createElement("button");
  playDialogueBtn.className = "w-full py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all text-sm";
  playDialogueBtn.innerText = "🎬 Play Branching Story Scene";
  playDialogueBtn.addEventListener("click", () => {
    // Select correct scene based on current progress
    let targetScene = DIALOGUE_SCENES[0]; // first meeting default
    if (rel.stage === "Interested" || rel.stage === "Partner") {
      targetScene = DIALOGUE_SCENES[2]; // confession
    } else if (rel.stage === "Acquaintance") {
      targetScene = DIALOGUE_SCENES[1]; // shared quest
    }

    activeScene = targetScene;
    activeNodeId = "start";
    activeView = "dialogue";
    renderApp();
  });
  interactionPanel.appendChild(playDialogueBtn);

  // Lineage Generation action (Disabled if relationship isn't deep enough)
  const isLineageEligible = rel.stats.affection >= 50 || rel.stage === "Interested" || rel.stage === "Partner";
  const pairBtn = document.createElement("button");
  pairBtn.className = `w-full py-3 font-extrabold rounded-xl shadow-lg transition-all text-sm ${
    isLineageEligible
      ? "bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white cursor-pointer"
      : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-50"
  }`;
  pairBtn.innerHTML = `🍼 Produce Offspring (Requires 50+ Affection) ${isLineageEligible ? "✨" : "🔒"}`;
  pairBtn.addEventListener("click", () => {
    if (!isLineageEligible) return;

    // Generate offspring!
    const child = generateOffspring(state.player!, npc);
    state.offspring.push(child);
    saveGame(state);

    // Switch view to offspring presentation
    activeView = "nursery";
    renderApp();
  });
  interactionPanel.appendChild(pairBtn);

  actionsGrid.appendChild(interactionPanel);

  // Compatibility Analysis Breakdown
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
    <span class="text-xs uppercase font-extrabold tracking-widest text-amber-400">${scene.title}</span>
    <h2 class="text-2xl font-black text-slate-100">Interacting with ${npc.name}</h2>
  `;
  container.appendChild(header);

  // Narrative Layout Box
  const layoutBox = document.createElement("div");
  layoutBox.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-center shadow-2xl relative overflow-hidden";

  // Left column: Speaker portrait
  const speakerPortrait = document.createElement("div");
  speakerPortrait.className = "flex-shrink-0 flex flex-col items-center gap-2";
  if (node.speaker === "NPC") {
    speakerPortrait.innerHTML = renderCharacter(npc, 130);
    speakerPortrait.innerHTML += `<span class="text-xs font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">${npc.name}</span>`;
  } else if (node.speaker === "Player") {
    speakerPortrait.innerHTML = renderCharacter(state.player!, 130);
    speakerPortrait.innerHTML += `<span class="text-xs font-bold text-cyan-400 bg-cyan-400/10 px-3 py-1 rounded-full border border-cyan-400/20">You (${state.player!.name})</span>`;
  } else {
    // Narrator placeholder portrait
    speakerPortrait.innerHTML = `<div class="w-24 h-24 rounded-full bg-slate-700/50 border border-slate-600 flex items-center justify-center text-slate-300 text-3xl font-extrabold">⚜️</div>`;
    speakerPortrait.innerHTML += `<span class="text-xs font-bold text-slate-400">Narrator</span>`;
  }
  layoutBox.appendChild(speakerPortrait);

  // Right column: Dialogue Content & options
  const dialogueContent = document.createElement("div");
  dialogueContent.className = "flex-1 space-y-6 w-full";

  const messageBubble = document.createElement("div");
  messageBubble.className = "bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-slate-200 text-sm md:text-base leading-relaxed font-medium shadow-inner min-h-[80px]";
  messageBubble.innerText = node.text;
  dialogueContent.appendChild(messageBubble);

  // Choice button block
  const choicesBox = document.createElement("div");
  choicesBox.className = "space-y-3";

  if (node.choices.length > 0) {
    node.choices.forEach(choice => {
      const btn = document.createElement("button");
      btn.className = "w-full text-left p-4 bg-slate-700/50 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-600 hover:border-slate-500 font-semibold transition-all text-xs md:text-sm flex items-center justify-between gap-4 group";

      // Left option text
      const textSpan = document.createElement("span");
      textSpan.innerText = choice.text;
      btn.appendChild(textSpan);

      // Stat delta tag indication (for playful transparency)
      if (choice.statDeltas) {
        const deltaTags = document.createElement("div");
        deltaTags.className = "flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200";
        Object.entries(choice.statDeltas).forEach(([stat, val]) => {
          if (val) {
            const isPos = val > 0;
            const tag = document.createElement("span");
            tag.className = `text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
              isPos ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
            }`;
            tag.innerText = `${isPos ? "+" : ""}${val} ${stat.substring(0, 3)}`;
            deltaTags.appendChild(tag);
          }
        });
        btn.appendChild(deltaTags);
      }

      btn.addEventListener("click", () => {
        // Resolve choice stat adjustments with compatibility modifiers!
        if (choice.statDeltas) {
          const modified = applyCompatibilityModifiers(choice.statDeltas, comp.score);

          // Update stats
          Object.entries(modified).forEach(([key, val]) => {
            const k = key as keyof typeof rel.stats;
            if (val) {
              rel.stats[k] = Math.max(0, Math.min(100, rel.stats[k] + val));
            }
          });

          // Log active transaction changes to present on terminal screen
          lastDialogueDeltas = modified as any;
        }

        // Adjust Stage of Relationship if triggered
        const oldStage = rel.stage;
        rel.stage = getRelationshipStage(rel.stats.affection, rel.stats.trust);

        // Record log history
        rel.history.push({
          timestamp: Date.now(),
          sceneId: scene.id,
          choiceMade: choice.text,
          statDeltas: choice.statDeltas || {}
        });

        // Advance dialogue flow node
        activeNodeId = choice.nextNodeId;
        saveGame(state);
        renderApp();
      });

      choicesBox.appendChild(btn);
    });
  } else {
    // End of dialogue scene
    const finishBtn = document.createElement("button");
    finishBtn.className = "w-full py-3.5 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all text-sm text-center";
    finishBtn.innerText = "Complete Scene & Summarize";

    // Show change breakdown
    const summaryBox = document.createElement("div");
    summaryBox.className = "p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 text-xs";
    summaryBox.innerHTML = `<h4 class="font-bold text-amber-400">Connection Outcomes:</h4>`;

    if (Object.keys(lastDialogueDeltas).length > 0) {
      const summaryList = document.createElement("ul");
      summaryList.className = "space-y-1 text-slate-300";
      Object.entries(lastDialogueDeltas).forEach(([stat, val]) => {
        const item = document.createElement("li");
        item.innerHTML = `• ${stat.toUpperCase()}: <strong class="${val > 0 ? "text-emerald-400" : "text-rose-400"}">${val > 0 ? "+" : ""}${val}%</strong> (scaled by compatibility)`;
        summaryList.appendChild(item);
      });
      summaryBox.appendChild(summaryList);
    } else {
      summaryBox.innerHTML += `<p class="text-slate-400">A peaceful conversational stroll with no sudden shift in feelings.</p>`;
    }

    dialogueContent.appendChild(summaryBox);

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
 * 5. OFFSPRING NURSERY & LINEAGE VIEW
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
      <p class="text-xs text-slate-400 mt-1">Gaze upon your generational lineage and genetic masterworks.</p>
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
    // Grid of offspring cards
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 gap-8";

    state.offspring.forEach(child => {
      const card = document.createElement("div");
      card.className = "bg-slate-800 border border-slate-700 rounded-3xl p-6 flex flex-col sm:flex-row gap-6 items-center shadow-xl hover:border-slate-600 transition-all";

      const avatarBox = document.createElement("div");
      avatarBox.className = "flex-shrink-0 flex flex-col items-center";
      avatarBox.innerHTML = renderCharacter(child, 140);
      card.appendChild(avatarBox);

      // Children characteristics detail panel
      const textInfo = document.createElement("div");
      textInfo.className = "flex-1 space-y-3 w-full";
      textInfo.innerHTML = `
        <div>
          <h3 class="text-xl font-extrabold text-pink-400">${child.name}</h3>
          <span class="text-[10px] uppercase font-extrabold text-slate-400 bg-slate-900/60 border border-slate-800 px-2.5 py-0.5 rounded-full inline-block mt-1">${child.species} Lineage</span>
        </div>

        <p class="text-xs text-slate-300 italic">"${child.background}"</p>

        <div class="bg-slate-900/50 p-3 rounded-xl border border-slate-850 space-y-2">
          <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wide block">Inherited Traits Breakdown</span>
          <div class="grid grid-cols-2 gap-2 text-[10px] text-slate-300">
            <div><strong>Hair:</strong> ${child.physicalTraits.hairStyle}</div>
            <div><strong>Build:</strong> ${child.physicalTraits.build}</div>
            <div><strong>Markings:</strong> ${child.physicalTraits.markingStyle}</div>
            <div><strong>Accessory:</strong> ${child.physicalTraits.accessory}</div>
          </div>
        </div>

        <div class="space-y-1.5">
          <span class="text-[10px] font-bold text-pink-400 uppercase tracking-wide block">Personality Blend</span>
          <div class="grid grid-cols-5 gap-1.5 text-center text-[10px] font-semibold text-slate-300">
            <div class="bg-slate-900 p-1 rounded">Bold: ${child.personalityTraits.boldness}%</div>
            <div class="bg-slate-900 p-1 rounded">Warm: ${child.personalityTraits.warmth}%</div>
            <div class="bg-slate-900 p-1 rounded">Wit: ${child.personalityTraits.wit}%</div>
            <div class="bg-slate-900 p-1 rounded">Amb: ${child.personalityTraits.ambition}%</div>
            <div class="bg-slate-900 p-1 rounded">Chaos: ${child.personalityTraits.chaos}%</div>
          </div>
        </div>
      `;

      card.appendChild(textInfo);
      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  return container;
}

// Initial Kick-off render
renderApp();
