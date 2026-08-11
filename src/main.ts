import './style.css';
import { Character, SaveState, Relationship, RelationshipStage, Scene, SceneNode, Choice, GameSpecies, GameGender } from "./types";
import { loadGame, saveGame, clearGame } from "./storage";
import { ARCHETYPES, UNIQUE_NPCS, generateNPC } from "./npc";
import { renderCharacter } from "./renderer";
import { computeCompatibility } from "./compatibility";
import { DIALOGUE_SCENES, getRelationshipStage, applyCompatibilityModifiers, getRelationshipPath } from "./dialogue";
import { generateOffspring, checkPairingEligibility, isRestrictedFamily, generateFantasyName } from "./genetics";

// Initial state
let state: SaveState = loadGame();

// Ensure safe defaults for lineage, resource management, and legacy depth
if (!state.currentSeason) state.currentSeason = 1;
if (state.actionPoints === undefined) state.actionPoints = 5;
if (!state.unlockedAchievements) state.unlockedAchievements = [];
if (!state.unlockedItems) state.unlockedItems = [];
if (!state.unlockedBackgrounds) state.unlockedBackgrounds = [];
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

function isPartnered(char: Character): boolean {
  if (char.partnerId) return true;
  if (char.id === "player") {
    return Object.values(state.relationships).some(r => r.stage === "Partner");
  } else {
    const rel = state.relationships[char.id];
    return rel ? rel.stage === "Partner" : false;
  }
}

function performSuccession(successor: Character) {
  if (!state.player) return;

  const formerPlayer = { ...state.player };
  formerPlayer.id = `npc-former-pc-${Date.now().toString(36)}`;
  formerPlayer.isFormerPC = true;
  formerPlayer.isPC = true;
  formerPlayer.origin = "generated";
  formerPlayer.age = Math.max(9, formerPlayer.age ?? 9); // Force Elder status on retirement

  const newPlayer = { ...successor };
  newPlayer.id = "player";
  newPlayer.isPC = true;
  if (newPlayer.parentIds) {
    newPlayer.parentIds = newPlayer.parentIds.map(pid => pid === "player" ? formerPlayer.id : pid) as [string, string];
  }

  // Remove successor from offspring list
  state.offspring = state.offspring.filter(c => c.id !== successor.id);

  // Update parentIds for all existing npcs and offspring to point to the retired parent's new ID
  state.npcs.forEach(npc => {
    if (npc.parentIds) {
      npc.parentIds = npc.parentIds.map(pid => pid === "player" ? formerPlayer.id : pid) as [string, string];
    }
  });
  state.offspring.forEach(o => {
    if (o.parentIds) {
      o.parentIds = o.parentIds.map(pid => pid === "player" ? formerPlayer.id : pid) as [string, string];
    }
  });

  // Add retired parent to the NPC pool
  state.npcs.push(formerPlayer);

  // Update current player
  state.player = newPlayer;

  // Track relationship mappings
  const oldRelationships = { ...state.relationships };
  state.relationships = {};

  // Setup high connection with the parent
  state.relationships[formerPlayer.id] = {
    characterAId: "player",
    characterBId: formerPlayer.id,
    stage: "Partner",
    path: "slowBurn",
    stats: { affection: 85, trust: 85, attraction: 10, rivalry: 10 },
    history: []
  };

  // Setup inherited relationships with other characters
  const allCast = [...state.npcs, ...state.offspring];
  allCast.forEach(npc => {
    if (npc.id === formerPlayer.id) return;

    const oldRel = oldRelationships[npc.id];
    let startAff = 15;
    let startTrust = 15;
    if (oldRel) {
      startAff = Math.round(oldRel.stats.affection * 0.3); // Inherit 30% of previous affection as reputation
      startTrust = Math.round(oldRel.stats.trust * 0.3); // Inherit 30% of previous trust
    }

    state.relationships[npc.id] = {
      characterAId: "player",
      characterBId: npc.id,
      stage: getRelationshipStage(startAff, startTrust),
      path: "none",
      stats: { affection: Math.max(10, startAff), trust: Math.max(10, startTrust), attraction: 10, rivalry: 10 },
      history: []
    };
  });

  saveGame(state);
  showToast(`👑 succession complete! You are now playing as the new heir: ${newPlayer.name} (Gen ${newPlayer.generation}). Your parent, ${formerPlayer.name}, has retired to the tavern.`);
  activeView = "hub";
  renderApp();
}

// Active tracking UI states
let activeView: "creator" | "hub" | "npc-detail" | "dialogue" | "nursery" | "expeditions" = state.player ? "hub" : "creator";
let selectedNpcId: string | null = null;
let activeScene: Scene | null = null;
let activeNodeId: string = "start";
let lastDialogueDeltas: Record<string, number> = {};

let nurserySubTab: "compact" | "tree" | "pairing" | "achievements" = "compact";
let detailedChildId: string | null = null;
let selectedParentAId: string | null = null;
let selectedParentBId: string | null = null;

// Expeditions State & Config
interface ExpeditionTemplate {
  id: string;
  name: string;
  desc: string;
  primaryStat: "boldness" | "warmth" | "wit" | "ambition" | "chaos";
  rewardItem: string; // Item code (e.g. 'crown', 'knight-armor')
  rewardType: "accessory" | "clothing";
  rewardLabel: string;
  fluffSuccess: string;
  fluffFailure: string;
}

const EXPEDITIONS_LIST: ExpeditionTemplate[] = [
  {
    id: "caves",
    name: "⛰️ The Glimmering Caves",
    desc: "A dark labyrinth of crystal protrusions and slumbering rock elementals. Demands unwavering courage to traverse.",
    primaryStat: "boldness",
    rewardItem: "knight-armor",
    rewardType: "clothing",
    rewardLabel: "Knight Armor",
    fluffSuccess: "With absolute bravery, they charge through the crumbling cavern, waking no elementals and securing a buried set of pristine Knight Armor!",
    fluffFailure: "Nerves got the better of them. They hesitated in the shadows, retreating empty-handed as the cave walls shook."
  },
  {
    id: "market",
    name: "🎭 The Goblin Market",
    desc: "A wild street bazaar of tricksters, illusionists, and devious merchants. Requires rapid-fire intellect to avoid being swindled.",
    primaryStat: "wit",
    rewardItem: "rogue-leather",
    rewardType: "clothing",
    rewardLabel: "Rogue Leather",
    fluffSuccess: "Through quick bartering and clever banter, they outsmart the goblin brokers, trading worthless stone for a stylish suit of Rogue Leather!",
    fluffFailure: "The fast-talking merchants completely swindled them, leaving them baffled, dazed, and empty-handed."
  },
  {
    id: "mountain",
    name: "🌋 Firetop Mountain",
    desc: "An unpredictable volcanic wasteland prone to sulfur geysers and wild lava tides. Only high chaos and pure luck can guide you through.",
    primaryStat: "chaos",
    rewardItem: "glasses",
    rewardType: "accessory",
    rewardLabel: "Glasses",
    fluffSuccess: "Embracing the chaos, they surf down a moving lava-flow with wild laughter, landing safely on a ledge and finding a pair of magical Glasses!",
    fluffFailure: "They tried to plan a safe route, but the shifting ash and volatile geysers forced them into a hot, sweaty retreat."
  },
  {
    id: "grove",
    name: "🌸 The Feywild Grove",
    desc: "An ethereal woodland realm of glowing night-buds and trickster dryads. Only deep warmth and kindness can soothe the forest guardians.",
    primaryStat: "warmth",
    rewardItem: "crown",
    rewardType: "accessory",
    rewardLabel: "Golden Crown",
    fluffSuccess: "Their soft-hearted singing and gentle energy melt the dryads' suspicions, who crown them with a beautiful Golden Crown of the woodland court!",
    fluffFailure: "A subtle chill in their hearts offended the dryads. The trees became aggressive, driving them back with whipping branches."
  }
];

let selectedExpeditionId: string = "caves";
let expeditionMemberAId: string = "player";
let expeditionMemberBId: string = "";
let expeditionOutcomeText: string | null = null;

// Dynamic Random Hub Events State & Helper
let activeModalEvent: {
  title: string;
  text: string;
  imageEmoji: string;
  choices: { text: string; resolve: () => void }[];
} | null = null;

function triggerRandomHubEvent() {
  const roll = Math.random();
  if (roll >= 0.25) return; // 25% chance

  const npcsWithRel = state.npcs.concat(state.offspring).filter(n => {
    const rel = state.relationships[n.id];
    return rel !== undefined;
  });

  if (npcsWithRel.length === 0) return;

  const eventIdx = Math.floor(Math.random() * 4);

  if (eventIdx === 0) {
    // 1. Tavern Brawl
    const fighter = npcsWithRel[Math.floor(Math.random() * npcsWithRel.length)];
    const rel = state.relationships[fighter.id];

    activeModalEvent = {
      title: "🍻 Tavern Brawl Spark!",
      imageEmoji: "⚔️",
      text: `A massive bar fight explodes over spilled mead! ${fighter.name} is right in the center of the action, grinning as stools fly around them. What do you do?`,
      choices: [
        {
          text: "Step in boldly and fight back-to-back with them!",
          resolve: () => {
            rel.stats.affection = Math.min(100, rel.stats.affection + 15);
            rel.stats.rivalry = Math.min(100, rel.stats.rivalry + 15);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`You leaped into the fray! Affection and Rivalry with ${fighter.name} increased by +15%!`);
          }
        },
        {
          text: "Defuse the situation with quick-witted diplomacy.",
          resolve: () => {
            rel.stats.trust = Math.min(100, rel.stats.trust + 15);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`You clever diplomat! Trust with ${fighter.name} increased by +15%!`);
          }
        }
      ]
    };
  } else if (eventIdx === 1) {
    // 2. Jealousy Spark (exclude restricted family from romantic candidates)
    const romanticCandidates = npcsWithRel.filter(n => !isRestrictedFamily(state.player!, n));
    const highAff = romanticCandidates.filter(n => state.relationships[n.id].stats.affection >= 45);
    if (highAff.length < 2) {
      triggerFeastEvent(npcsWithRel);
      return;
    }

    const loverA = highAff[0];
    const loverB = highAff[1];
    const relA = state.relationships[loverA.id];

    activeModalEvent = {
      title: "🥀 A Jealous Spark",
      imageEmoji: "💔",
      text: `${loverA.name} catches you sharing a very sweet glance with ${loverB.name}. They cross their arms with a cute pout. 'Do they mean more to you than I do?'`,
      choices: [
        {
          text: `Reassure ${loverA.name} that they hold a completely unique place in your heart.`,
          resolve: () => {
            relA.stats.trust = Math.min(100, relA.stats.trust + 15);
            relA.stats.affection = Math.min(100, relA.stats.affection + 10);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`${loverA.name} blushes and looks away, satisfied. Affection and Trust increased!`);
          }
        },
        {
          text: "Teasingly challenge them, saying a little competition is healthy.",
          resolve: () => {
            relA.stats.rivalry = Math.min(100, relA.stats.rivalry + 15);
            relA.stats.attraction = Math.min(100, relA.stats.attraction + 15);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`A spark flares! Attraction and Rivalry with ${loverA.name} increased by +15%!`);
          }
        }
      ]
    };
  } else if (eventIdx === 2) {
    // 3. Magical Anomaly
    const victim = npcsWithRel[Math.floor(Math.random() * npcsWithRel.length)];
    activeModalEvent = {
      title: "🔮 Wild Magic Surge!",
      imageEmoji: "✨",
      text: `An explosive wave of unstable pink energy sweeps across the tavern! It collides directly with ${victim.name}, temporarily warping their hair color completely!`,
      choices: [
        {
          text: "Help them embrace it and compliment their fresh new look!",
          resolve: () => {
            victim.geneticTraits.hairColorHue = 320;
            victim.geneticTraits.hairColorSat = 85;
            victim.geneticTraits.hairColorLight = 60;
            const rel = state.relationships[victim.id];
            rel.stats.affection = Math.min(100, rel.stats.affection + 12);
            rel.stats.attraction = Math.min(100, rel.stats.attraction + 15);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`${victim.name}'s hair is now magical magenta! They grin at your compliment.`);
          }
        },
        {
          text: "Channel a dispel wave to reverse the anomaly.",
          resolve: () => {
            const rel = state.relationships[victim.id];
            rel.stats.trust = Math.min(100, rel.stats.trust + 15);
            saveGame(state);
            activeModalEvent = null;
            renderApp();
            showToast(`Dispel successful! ${victim.name}'s hair stayed safe. They thank you deeply for your quick magical reflexes!`);
          }
        }
      ]
    };
  } else {
    // 4. Surprise Feast
    triggerFeastEvent(npcsWithRel);
  }
}

function triggerFeastEvent(npcsWithRel: Character[]) {
  const chef = npcsWithRel[Math.floor(Math.random() * npcsWithRel.length)];
  const rel = state.relationships[chef.id];

  activeModalEvent = {
    title: "🍗 Grand Surprise Feast!",
    imageEmoji: "🥧",
    text: `${chef.name} arrives at the center table carrying massive, steaming platters of roasted meats and sweet pastries! 'Eat up, friends!' they call out.`,
    choices: [
      {
        text: "Help them carve the roasts and serve the hungry guests.",
        resolve: () => {
          rel.stats.trust = Math.min(100, rel.stats.trust + 15);
          rel.stats.affection = Math.min(100, rel.stats.affection + 10);
          saveGame(state);
          activeModalEvent = null;
          renderApp();
          showToast(`Excellent teamwork! Affection and Trust with ${chef.name} increased!`);
        }
      },
      {
        text: "Eat heartily while telling grand stories of your lineage's future.",
        resolve: () => {
          rel.stats.affection = Math.min(100, rel.stats.affection + 15);
          rel.stats.attraction = Math.min(100, rel.stats.attraction + 10);
          saveGame(state);
          activeModalEvent = null;
          renderApp();
          showToast(`Your tales captivated the room! Affection and Attraction with ${chef.name} increased!`);
        }
      }
    ]
  };
}

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
  },
  "Berserker": {
    name: "Berserker (Premium)",
    description: "High Boldness & Chaos, Low Wit. Unlocked by 'The Verdant Berserker' Achievement.",
    stats: { boldness: 90, warmth: 40, wit: 15, ambition: 60, chaos: 85 }
  },
  "Archmage": {
    name: "Archmage (Premium)",
    description: "High Wit & Ambition, Low Chaos. Unlocked by 'Ancient Scholar' Achievement.",
    stats: { boldness: 40, warmth: 45, wit: 90, ambition: 85, chaos: 15 }
  },
  "Assassin": {
    name: "Assassin (Premium)",
    description: "High Chaos & Boldness, Low Warmth. Unlocked by 'Shadow Assassin' Achievement.",
    stats: { boldness: 85, warmth: 15, wit: 70, ambition: 65, chaos: 80 }
  }
};

function isItemUnlocked(itemCode: string): boolean {
  const freeItems = ["none", "earrings", "eyepatch", "collar", "commoner-robe", "bard-tunic", "baker-apron"];
  if (freeItems.includes(itemCode)) return true;

  if (state.unlockedItems?.includes(itemCode)) return true;

  if (itemCode === "crown" || itemCode === "circlet") {
    return state.unlockedAchievements?.includes("golden_monarch") || false;
  }
  if (itemCode === "glasses" || itemCode === "mage-cloak") {
    return state.unlockedAchievements?.includes("ancient_scholar") || false;
  }
  if (itemCode === "knight-armor") {
    return state.unlockedAchievements?.includes("verdant_berserker") || false;
  }
  if (itemCode === "rogue-leather") {
    return state.unlockedAchievements?.includes("shadow_assassin") || false;
  }

  return false;
}

function isBackgroundUnlocked(bgKey: string): boolean {
  const freeBgs = ["Soldier", "Sage", "Charlatan", "Hermit", "Acolyte", "Noble", "Outlander", "Urchin", "Wanderer"];
  if (freeBgs.includes(bgKey)) return true;

  if (state.unlockedBackgrounds?.includes(bgKey)) return true;

  if (bgKey === "Berserker") {
    return state.unlockedAchievements?.includes("verdant_berserker") || false;
  }
  if (bgKey === "Archmage") {
    return state.unlockedAchievements?.includes("ancient_scholar") || false;
  }
  if (bgKey === "Assassin") {
    return state.unlockedAchievements?.includes("shadow_assassin") || false;
  }

  return false;
}

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
  } else if (activeView === "expeditions") {
    appEl.appendChild(createExpeditionsView());
  }

  // Render active modal event overlay if present
  if (activeModalEvent) {
    const modalOverlay = document.createElement("div");
    modalOverlay.className = "fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn";

    const modalBox = document.createElement("div");
    modalBox.className = "bg-slate-900 border border-slate-700/80 p-6 md:p-8 rounded-3xl max-w-lg w-full text-center space-y-6 shadow-2xl relative";

    modalBox.innerHTML = `
      <div class="w-16 h-16 mx-auto bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner">
        ${activeModalEvent.imageEmoji}
      </div>
      <div class="space-y-2">
        <h3 class="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-rose-400 uppercase tracking-wide">${activeModalEvent.title}</h3>
        <p class="text-xs md:text-sm text-slate-200 leading-relaxed font-semibold">${activeModalEvent.text}</p>
      </div>
    `;

    const choiceContainer = document.createElement("div");
    choiceContainer.className = "space-y-3 pt-2";

    activeModalEvent.choices.forEach(ch => {
      const btn = document.createElement("button");
      btn.className = "w-full text-left p-3.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-amber-500/40 rounded-xl text-xs font-black text-slate-200 hover:text-white transition-all";
      btn.innerText = ch.text;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        ch.resolve();
      });
      choiceContainer.appendChild(btn);
    });

    modalBox.appendChild(choiceContainer);
    modalOverlay.appendChild(modalBox);
    appEl.appendChild(modalOverlay);
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

  // Name & Randomize Avatar Button
  const nameLabel = document.createElement("label");
  nameLabel.className = "block text-sm font-semibold text-slate-300";
  nameLabel.innerText = "Character Name";

  const nameRow = document.createElement("div");
  nameRow.className = "flex gap-2 items-center mt-1";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.className = "flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500";
  nameInput.value = creatorForm.name;
  nameInput.addEventListener("input", (e) => {
    creatorForm.name = (e.target as HTMLInputElement).value;
    updatePreview();
  });

  const randBtn = document.createElement("button");
  randBtn.type = "button";
  randBtn.className = "px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-extrabold rounded-lg shadow transition-all text-xs whitespace-nowrap cursor-pointer";
  randBtn.innerText = "🎲 Randomize Avatar";

  randBtn.addEventListener("click", (ev) => {
    ev.preventDefault();

    // 1. Randomize species and gender
    const speciesList: GameSpecies[] = ["Human", "Elf", "Dwarf", "Halfling", "Gnome", "Half-Elf", "Half-Orc", "Orc", "Tiefling", "Dragonborn", "Beastfolk"];
    const randomSpecies = speciesList[Math.floor(Math.random() * speciesList.length)];
    creatorForm.species = randomSpecies;

    const genderList: GameGender[] = ["Female", "Male", "Non-binary"];
    creatorForm.gender = genderList[Math.floor(Math.random() * genderList.length)];

    // 2. Randomize genetic traits
    const builds: Array<Character["geneticTraits"]["build"]> = ["slender", "average", "muscular", "stocky"];
    creatorForm.build = builds[Math.floor(Math.random() * builds.length)];

    // Set height based on species
    if (randomSpecies === "Halfling" || randomSpecies === "Gnome") {
      creatorForm.height = Math.floor(Math.random() * 16) + 100; // 100 - 115
    } else if (randomSpecies === "Elf" || randomSpecies === "Dragonborn" || randomSpecies === "Tiefling") {
      creatorForm.height = Math.floor(Math.random() * 21) + 185; // 185 - 205
    } else if (randomSpecies === "Dwarf") {
      creatorForm.height = Math.floor(Math.random() * 16) + 135; // 135 - 150
    } else {
      creatorForm.height = Math.floor(Math.random() * 31) + 155; // 155 - 185
    }

    creatorForm.faceShape = ["oval", "round", "sharp", "square"][Math.floor(Math.random() * 4)];
    creatorForm.earShape = ["normal", "pointed", "long", "animal", "broad"][Math.floor(Math.random() * 5)];
    creatorForm.hairTexture = ["straight", "wavy", "curly", "coily", "wild"][Math.floor(Math.random() * 5)];
    creatorForm.markingsPattern = ["none", "tattoos", "scars", "stripes", "freckles"][Math.floor(Math.random() * 5)];

    // Species features defaults/customizations
    let speciesFeatures = "none";
    if (randomSpecies === "Tiefling") speciesFeatures = "horns";
    else if (randomSpecies === "Dragonborn") speciesFeatures = "tail";
    else if (randomSpecies === "Beastfolk") speciesFeatures = "fluffy-tail";
    else speciesFeatures = ["none", "horns", "tail", "wings", "fangs", "fluffy-tail"][Math.floor(Math.random() * 6)];
    creatorForm.speciesFeatures = speciesFeatures;

    // 3. Randomize Styling traits (only eligible / unlocked ones)
    creatorForm.hairStyle = ["short", "long", "braids", "curls", "crest", "afro", "mohawk", "bald"][Math.floor(Math.random() * 8)];

    const allAccessories = ["none", "earrings", "glasses", "crown", "circlet", "eyepatch", "collar"];
    const unlockedAccessories = allAccessories.filter(isItemUnlocked);
    creatorForm.accessory = unlockedAccessories[Math.floor(Math.random() * unlockedAccessories.length)];

    const allClothing = ["commoner-robe", "knight-armor", "mage-cloak", "bard-tunic", "rogue-leather", "baker-apron"];
    const unlockedClothing = allClothing.filter(isItemUnlocked);
    creatorForm.clothing = unlockedClothing[Math.floor(Math.random() * unlockedClothing.length)];

    // 4. Color logic with 5% wild mutation chance
    if (Math.random() < 0.05) {
      // Wild mutation
      creatorForm.skinToneHue = Math.floor(Math.random() * 360);
      creatorForm.skinToneSat = Math.floor(Math.random() * 41) + 40; // 40-80
      creatorForm.skinToneLight = Math.floor(Math.random() * 41) + 30; // 30-70

      creatorForm.hairColorHue = Math.floor(Math.random() * 360);
      creatorForm.hairColorSat = Math.floor(Math.random() * 41) + 40;
      creatorForm.hairColorLight = Math.floor(Math.random() * 41) + 20; // 20-60

      creatorForm.eyeColorHue = Math.floor(Math.random() * 360);
      creatorForm.eyeColorSat = Math.floor(Math.random() * 41) + 40;
      creatorForm.eyeColorLight = Math.floor(Math.random() * 31) + 40; // 40-70
    } else {
      // Preset with HSL wobble
      const preset = SPECIES_PRESETS[randomSpecies];
      const wobble = (val: number, range: number, min: number, max: number) => {
        return Math.max(min, Math.min(max, Math.round(val + (Math.random() * range - range / 2))));
      };
      creatorForm.skinToneHue = Math.round((preset.skin[0] + (Math.random() * 21 - 10) + 360) % 360);
      creatorForm.skinToneSat = wobble(preset.skin[1], 14, 10, 100);
      creatorForm.skinToneLight = wobble(preset.skin[2], 14, 10, 95);

      creatorForm.hairColorHue = Math.round((preset.hair[0] + (Math.random() * 21 - 10) + 360) % 360);
      creatorForm.hairColorSat = wobble(preset.hair[1], 14, 10, 100);
      creatorForm.hairColorLight = wobble(preset.hair[2], 14, 10, 95);

      creatorForm.eyeColorHue = Math.round((preset.eye[0] + (Math.random() * 21 - 10) + 360) % 360);
      creatorForm.eyeColorSat = wobble(preset.eye[1], 14, 10, 100);
      creatorForm.eyeColorLight = wobble(preset.eye[2], 14, 10, 95);
    }

    // 5. Randomize background (only unlocked ones)
    const allBgs = Object.keys(BACKGROUNDS_MAP);
    const unlockedBgs = allBgs.filter(isBackgroundUnlocked);
    const randBg = unlockedBgs[Math.floor(Math.random() * unlockedBgs.length)];
    creatorForm.background = randBg;
    creatorForm.personality = { ...BACKGROUNDS_MAP[randBg].stats };

    // 6. Name generation
    creatorForm.name = generateFantasyName(randomSpecies);

    // Re-render and update preview immediately
    renderApp();
    updatePreview();
  });

  nameRow.appendChild(nameInput);
  nameRow.appendChild(randBtn);
  nameLabel.appendChild(nameRow);
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
    const labelText = a.charAt(0).toUpperCase() + a.slice(1);
    const unlocked = isItemUnlocked(a);
    if (!unlocked) {
      opt.innerText = `${labelText} (🔒 Locked)`;
      opt.disabled = true;
    } else {
      opt.innerText = labelText;
    }
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
    const labelText = cl.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    const unlocked = isItemUnlocked(cl);
    if (!unlocked) {
      opt.innerText = `${labelText} (🔒 Locked)`;
      opt.disabled = true;
    } else {
      opt.innerText = labelText;
    }
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
    const isUnlocked = isBackgroundUnlocked(key);
    if (!isUnlocked) {
      opt.innerText = `${BACKGROUNDS_MAP[key].name} (🔒 Locked)`;
      opt.disabled = true;
    } else {
      opt.innerText = BACKGROUNDS_MAP[key].name;
    }
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
    // Deep copy UNIQUE_NPCS to prevent mutations from leaking across game resets!
    const npcs = [
      ...JSON.parse(JSON.stringify(UNIQUE_NPCS)),
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

  // Expeditions button
  const viewExpeditionsBtn = document.createElement("button");
  viewExpeditionsBtn.className = "px-5 py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-extrabold rounded-xl shadow-lg transition-all text-xs";
  viewExpeditionsBtn.innerHTML = `🗺️ Expeditions`;
  viewExpeditionsBtn.addEventListener("click", () => {
    activeView = "expeditions";
    expeditionOutcomeText = null;
    expeditionMemberAId = "player";
    const possibleB = state.npcs.concat(state.offspring).filter(x => x.id !== "player");
    expeditionMemberBId = possibleB.length > 0 ? possibleB[0].id : "";
    renderApp();
  });
  metaControls.appendChild(viewExpeditionsBtn);

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

    const summaryLines: string[] = [];

    // 1. Autonomous NPC Partnerships (10% chance)
    // Candidates are unpartnered cast NPCs in Prime stage (age 3-8)
    const eligibleForPartner = state.npcs.concat(state.offspring).filter(c => {
      const ageVal = c.age ?? 3;
      return ageVal >= 3 && ageVal <= 8 && !isPartnered(c);
    });

    if (eligibleForPartner.length >= 2 && Math.random() < 0.10) {
      // Find a random non-incestuous pair
      const shuffled = [...eligibleForPartner].sort(() => Math.random() - 0.5);
      let foundPair: [Character, Character] | null = null;
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          if (!isRestrictedFamily(shuffled[i], shuffled[j])) {
            foundPair = [shuffled[i], shuffled[j]];
            break;
          }
        }
        if (foundPair) break;
      }

      if (foundPair) {
        foundPair[0].partnerId = foundPair[1].id;
        foundPair[1].partnerId = foundPair[0].id;
        summaryLines.push(`💞 **${foundPair[0].name}** and **${foundPair[1].name}** have autonomously formed a romantic partnership!`);
      }
    }

    // Update pool of unpartnered NPCs for Casual Flings
    const eligibleForFling = state.npcs.concat(state.offspring).filter(c => {
      const ageVal = c.age ?? 3;
      return ageVal >= 3 && ageVal <= 8 && !isPartnered(c);
    });

    // 2. Autonomous NPC Offspring - Casual Flings (5% chance)
    if (eligibleForFling.length >= 2 && Math.random() < 0.05) {
      const shuffled = [...eligibleForFling].sort(() => Math.random() - 0.5);
      let foundPair: [Character, Character] | null = null;
      for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
          if (!isRestrictedFamily(shuffled[i], shuffled[j])) {
            foundPair = [shuffled[i], shuffled[j]];
            break;
          }
        }
        if (foundPair) break;
      }

      if (foundPair) {
        const child = generateOffspring(foundPair[0], foundPair[1]);
        state.offspring.push(child);
        checkAndUnlockAchievements(child);
        summaryLines.push(`🍼 A casual background fling between **${foundPair[0].name}** and **${foundPair[1].name}** has resulted in a new child: **${child.name}**!`);
      }
    }

    triggerRandomHubEvent();

    saveGame(state);
    renderApp();

    // Custom season summary structured toast
    let summaryHTML = `Advanced to Season **${state.currentSeason}**! All characters aged, and 5 Action Points were restored.<br/>`;
    if (summaryLines.length > 0) {
      summaryHTML += `<div class="mt-2 border-t border-slate-700/50 pt-2 space-y-1.5 text-[11px] font-medium text-slate-300">`;
      summaryLines.forEach(line => {
        summaryHTML += `<div>• ${line}</div>`;
      });
      summaryHTML += `</div>`;
    }

    showToast(summaryHTML, summaryLines.length > 0 ? 6000 : 4000);
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
    } else if (npc.isFormerPC) {
      badgeHTML = `<span class="text-[9px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 mr-1.5 uppercase tracking-wider">👑 Past Ruler</span>`;
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
      if ((rel.stage === "Interested" || rel.stage === "Partner") && !isRestrictedFamily(state.player!, npc)) {
        targetScene = DIALOGUE_SCENES[2]; // confession
      } else if (rel.stage === "Acquaintance" || isRestrictedFamily(state.player!, npc)) {
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

  // GIFT GIVING REGION (1 AP)
  const giftSection = document.createElement("div");
  giftSection.className = "pt-4 border-t border-slate-700/50 space-y-3";
  giftSection.innerHTML = `
    <h4 class="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
      <span>🎁 Give a Flavorful Gift (Costs 1 AP)</span>
    </h4>
    <p class="text-[10px] text-slate-400">Match gifts with species, backgrounds, or traits for a double relationship boost!</p>
  `;

  const giftsConfig = [
    {
      name: "Fresh Cinnamon Bun",
      emoji: "🥯",
      desc: "Glazed warm pastry.",
      isMatch: (c: Character) => c.species === "Human" || c.background.toLowerCase().includes("baker"),
      base: { affection: 12, trust: 8 },
      boosted: { affection: 22, trust: 15 },
      matchReason: "They adore the sweet comfort of fresh human baking!"
    },
    {
      name: "Feywild Orchid",
      emoji: "🌸",
      desc: "Glowing delicate bloom.",
      isMatch: (c: Character) => c.species === "Elf" || c.species === "Half-Elf" || c.personalityTraits.warmth >= 70,
      base: { affection: 10, trust: 10 },
      boosted: { affection: 20, trust: 20 },
      matchReason: "They feel a magical, comforting resonance with the Feywild bloom!"
    },
    {
      name: "Brimstone Elixir",
      emoji: "🧪",
      desc: "Fiery chaotic flask.",
      isMatch: (c: Character) => c.species === "Tiefling" || c.personalityTraits.chaos >= 70,
      base: { attraction: 8, rivalry: 8 },
      boosted: { attraction: 20, rivalry: 15 },
      matchReason: "The raw, volatile spark of the elixir gets their blood pumping!"
    },
    {
      name: "Iron Ore Chunk",
      emoji: "🪨",
      desc: "Raw, dense metallurgy.",
      isMatch: (c: Character) => c.species === "Dwarf" || c.geneticTraits.build === "muscular" || c.geneticTraits.build === "stocky",
      base: { rivalry: 8, affection: 6 },
      boosted: { rivalry: 18, affection: 14 },
      matchReason: "They deeply respect the heavy weight and density of fine dwarven smithing ore!"
    },
    {
      name: "Ancient Cuneiform Tablet",
      emoji: "📜",
      desc: "Dense archaic lore.",
      isMatch: (c: Character) => c.background.toLowerCase().includes("mage") || c.background.toLowerCase().includes("scholar") || c.background.toLowerCase().includes("sage") || c.personalityTraits.ambition >= 70,
      base: { trust: 12, affection: 4 },
      boosted: { trust: 22, affection: 10 },
      matchReason: "Their eyes light up as they trace the ancient forbidden symbols!"
    },
    {
      name: "Hearth-Spiced Biryani",
      emoji: "🍛",
      desc: "Earthy, aromatic rice dish.",
      isMatch: (c: Character) => c.species === "Human" || c.background.toLowerCase().includes("wanderer") || c.background.toLowerCase().includes("commoner"),
      base: { affection: 10, trust: 10 },
      boosted: { affection: 20, trust: 18 },
      matchReason: "The rich, savory spices remind them of cozy hearthfires and safety!"
    },
    {
      name: "Charred Beast Skewers",
      emoji: "🍢",
      desc: "Smoky wild game meat.",
      isMatch: (c: Character) => c.species === "Orc" || c.species === "Half-Orc" || c.species === "Beastfolk" || c.background.toLowerCase().includes("outlander"),
      base: { attraction: 10, rivalry: 6 },
      boosted: { attraction: 22, rivalry: 12 },
      matchReason: "They devour the wild skewers with beastly satisfaction and fire in their eyes!"
    }
  ];

  const giftButtonsContainer = document.createElement("div");
  giftButtonsContainer.className = "grid grid-cols-1 gap-2 pt-1";

  giftsConfig.forEach(gift => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "w-full text-left p-2.5 bg-slate-900/60 hover:bg-slate-900 border border-slate-750 hover:border-amber-500/50 rounded-xl text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between gap-3 group";

    const hasMatch = gift.isMatch(npc);

    btn.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-base group-hover:scale-110 transition-transform">${gift.emoji}</span>
        <div>
          <div class="font-bold text-slate-200 text-xs">${gift.name}</div>
          <div class="text-[9px] text-slate-400">${gift.desc}</div>
        </div>
      </div>
      <div class="flex items-center gap-1.5">
        ${hasMatch ? `<span class="text-[8px] font-black uppercase text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">🔥 Perfect Fit</span>` : ""}
      </div>
    `;

    btn.addEventListener("click", () => {
      const currentAP = state.actionPoints ?? 5;
      if (currentAP <= 0) {
        showToast("⚠️ Out of Action Points! End the season to restore energy.");
        return;
      }

      // Deduct 1 AP
      state.actionPoints = currentAP - 1;

      // Select delta & reason
      const rawDeltas = hasMatch ? gift.boosted : gift.base;
      const modified = applyCompatibilityModifiers(rawDeltas, comp.score);

      let outcomeLog = `You gifted ${npc.name} a **${gift.name}**! ${gift.emoji}<br/><br/>`;
      if (hasMatch) {
        outcomeLog += `<span class="text-amber-400 font-bold">⭐ PERFECT FIT: ${gift.matchReason}</span><br/><br/>`;
      } else {
        outcomeLog += `<span class="text-slate-300 italic">They appreciated the gesture!</span><br/><br/>`;
      }

      // Apply
      Object.entries(modified).forEach(([key, val]) => {
        const k = key as keyof typeof rel.stats;
        if (val) {
          rel.stats[k] = Math.max(0, Math.min(100, rel.stats[k] + val));
          const sign = val > 0 ? "+" : "";
          outcomeLog += `• ${key.toUpperCase()} modified by ${sign}${val}% (influenced by compatibility)<br/>`;
        }
      });

      const oldStage = rel.stage;
      rel.stage = getRelationshipStage(rel.stats.affection, rel.stats.trust);

      if (oldStage !== rel.stage) {
        outcomeLog += `<br/><strong>🌟 RELATIONSHIP STAGE UPGRADED TO: ${rel.stage}!</strong>`;
      }

      saveGame(state);
      renderApp();
      showToast(outcomeLog);
    });

    giftButtonsContainer.appendChild(btn);
  });

  giftSection.appendChild(giftButtonsContainer);
  interactionPanel.appendChild(giftSection);

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
    let visibleChoices = node.choices;
    if (isRestrictedFamily(state.player!, npc)) {
      visibleChoices = node.choices.filter(choice => {
        const isRomantic = (choice.statDeltas?.attraction && choice.statDeltas.attraction > 0) ||
                           choice.nextNodeId === "end_romantic" ||
                           choice.nextNodeId === "end_flirty" ||
                           choice.nextNodeId === "partnership_accepted";
        return !isRomantic;
      });
    }

    visibleChoices.forEach(choice => {
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

      const cAge = child.age ?? 0;
      const cStage = getAgeStageLabel(cAge);

      genBlock.innerHTML = `
        <h4 class="font-black text-amber-400 text-sm uppercase tracking-wide border-b border-slate-700/50 pb-2">Lineage &amp; Genetics</h4>
        <div class="grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div><strong>Generation:</strong> Gen ${child.generation || 2}</div>
          <div><strong>Age Stage:</strong> ${cStage} (${cAge} Seasons)</div>
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

      // Succession Button: available if child is in Prime age
      if (cAge >= 3 && cAge <= 8) {
        const passTorchBtn = document.createElement("button");
        passTorchBtn.className = "px-6 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-900 font-extrabold rounded-xl shadow-lg transition-all text-sm animate-pulse";
        passTorchBtn.innerText = "👑 Pass the Torch (Succeeed)";
        passTorchBtn.addEventListener("click", () => {
          if (confirm(`Are you sure you want to retire your current character and succeed as ${child.name}? This is permanent!`)) {
            performSuccession(child);
          }
        });
        buttonsRow.appendChild(passTorchBtn);
      }

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
    treeContainer.className = "bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-x-auto overflow-y-auto min-h-[500px]";

    // Connections SVG overlay (underneath row contents)
    const svgConnections = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgConnections.id = "tree-svg-connections";
    svgConnections.setAttribute("class", "absolute inset-0 pointer-events-none w-full h-full z-0");
    treeContainer.appendChild(svgConnections);

    // Build the robust family tree members set (includes past/present PCs, offspring, and both parents)
    const treeMembersSet = new Set<Character>();
    allChars.forEach(c => {
      if (c.id === "player" || c.isPC || c.isFormerPC) {
        treeMembersSet.add(c);
      }
    });

    allChars.forEach(c => {
      if (c.parentIds) {
        treeMembersSet.add(c);
        c.parentIds.forEach(pid => {
          const parentChar = allChars.find(x => x.id === pid);
          if (parentChar) {
            treeMembersSet.add(parentChar);
          }
        });
      }
    });

    const treeMembers = Array.from(treeMembersSet);
    const treeMemberIds = new Set(treeMembers.map(m => m.id));

    // Group characters by generation
    const genMap: Record<number, Character[]> = {};
    treeMembers.forEach(c => {
      const g = c.generation || 1;
      if (!genMap[g]) genMap[g] = [];
      genMap[g].push(c);
    });

    const generations = Object.keys(genMap).map(Number).sort((a, b) => a - b);

    if (generations.length === 0) {
      treeContainer.innerHTML = `<p class="text-center text-slate-500 py-12">No lineage members recorded.</p>`;
    } else {
      const rowsBox = document.createElement("div");
      rowsBox.className = "space-y-24 relative z-10 flex flex-col w-max min-w-full p-8";

      generations.forEach(gen => {
        const tier = document.createElement("div");
        tier.className = "flex flex-col items-center border-b border-slate-800/30 last:border-b-0 pb-8 last:pb-0";

        const rowLabel = document.createElement("div");
        rowLabel.className = "text-center text-[11px] font-black uppercase text-pink-400/80 tracking-widest mb-4 sticky left-8 w-max";
        rowLabel.innerText = `Generation ${gen}`;
        tier.appendChild(rowLabel);

        const row = document.createElement("div");
        row.className = "flex flex-nowrap items-center justify-center gap-16 md:gap-24 py-2";
        tier.appendChild(row);

        const charsInRow = genMap[gen];

        // Build partnership graph for characters in this generation row
        const adj: Record<string, Set<string>> = {};
        charsInRow.forEach(c => adj[c.id] = new Set());

        allChars.forEach(o => {
          if (o.parentIds && o.parentIds.length === 2) {
            const [p1, p2] = o.parentIds;
            if (adj[p1] && adj[p2]) {
              adj[p1].add(p2);
              adj[p2].add(p1);
            }
          }
        });

        // Connected components (Partner Clusters)
        const visited = new Set<string>();
        const clusters: Character[][] = [];

        // First, extract partner groups
        charsInRow.forEach(c => {
          if (visited.has(c.id) || adj[c.id].size === 0) return;

          const component: string[] = [];
          const dfs = (nodeId: string) => {
            visited.add(nodeId);
            component.push(nodeId);
            const neighbors = Array.from(adj[nodeId]).sort((a, b) => adj[a].size - adj[b].size);
            neighbors.forEach(nbr => {
              if (!visited.has(nbr)) {
                dfs(nbr);
              }
            });
          };

          // Try to start from an endpoint of the partnership graph (degree 1)
          let startId = c.id;
          const nodesInComp = [c.id];
          const tempVisited = new Set<string>([c.id]);
          const queue = [c.id];
          while (queue.length > 0) {
            const curr = queue.shift()!;
            adj[curr].forEach(nbr => {
              if (!tempVisited.has(nbr)) {
                tempVisited.add(nbr);
                nodesInComp.push(nbr);
                queue.push(nbr);
              }
            });
          }

          const deg1 = nodesInComp.find(nid => adj[nid].size === 1);
          if (deg1) {
            startId = deg1;
          }

          dfs(startId);

          const clusterChars = component.map(id => charsInRow.find(x => x.id === id)!);
          clusters.push(clusterChars);
        });

        // Next, group single characters
        const singleChars = charsInRow.filter(c => adj[c.id].size === 0);
        const siblingGroups: Record<string, Character[]> = {};

        singleChars.forEach(c => {
          const pKey = c.parentIds ? [...c.parentIds].sort().join("___") : "none";
          if (!siblingGroups[pKey]) {
            siblingGroups[pKey] = [];
          }
          siblingGroups[pKey].push(c);
        });

        Object.entries(siblingGroups).forEach(([pKey, sList]) => {
          if (pKey === "none") {
            sList.forEach(sc => {
              clusters.push([sc]);
            });
          } else {
            clusters.push(sList);
          }
        });

        // Create the layout for each cluster in the row
        clusters.forEach(cluster => {
          const clusterDiv = document.createElement("div");
          clusterDiv.className = "flex flex-nowrap gap-4 items-center justify-center";

          cluster.forEach(c => {
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

            // Card Hover Path Highlighting registration
            card.addEventListener("mouseenter", () => {
              if (typeof (window as any).drawTreeConnections === "function") {
                (window as any).drawTreeConnections(c.id);
              }
            });
            card.addEventListener("mouseleave", () => {
              if (typeof (window as any).drawTreeConnections === "function") {
                (window as any).drawTreeConnections(null);
              }
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
            clusterDiv.appendChild(card);
          });

          row.appendChild(clusterDiv);
        });

        rowsBox.appendChild(tier);
      });

      treeContainer.appendChild(rowsBox);

      // SVG dynamic connection drawing with centered horizontal partner routing
      setTimeout(() => {
        let currentHoveredId: string | null = null;

        const drawConnections = (hoveredId: string | null) => {
          currentHoveredId = hoveredId;
          const svg = document.getElementById("tree-svg-connections") as SVGSVGElement | null;
          if (!svg) return;
          svg.innerHTML = ""; // clear previous connections

          // Size SVG canvas to match full scrollable area
          svg.setAttribute("width", treeContainer.scrollWidth.toString());
          svg.setAttribute("height", treeContainer.scrollHeight.toString());

          const containerRect = treeContainer.getBoundingClientRect();
          const scrollLeft = treeContainer.scrollLeft;
          const scrollTop = treeContainer.scrollTop;

          const processedPairs = new Set<string>();

          allChars.forEach(child => {
            if (!child.parentIds) return;
            if (!treeMemberIds.has(child.id)) return;

            const childCard = treeContainer.querySelector(`[data-id="${child.id}"].tree-node-card`);
            if (!childCard) return;

            const childRect = childCard.getBoundingClientRect();
            const childX = childRect.left + childRect.width / 2 - containerRect.left + scrollLeft;
            const childY = childRect.top - containerRect.top + scrollTop;

            const parentIds = child.parentIds.filter(pid => treeMemberIds.has(pid));

            if (parentIds.length === 2) {
              const [pAId, pBId] = parentIds;
              const pACard = treeContainer.querySelector(`[data-id="${pAId}"].tree-node-card`);
              const pBCard = treeContainer.querySelector(`[data-id="${pBId}"].tree-node-card`);

              if (pACard && pBCard) {
                const pARect = pACard.getBoundingClientRect();
                const pBRect = pBCard.getBoundingClientRect();

                const pAX = pARect.left + pARect.width / 2 - containerRect.left + scrollLeft;
                const pAY_bottom = pARect.top + pARect.height - containerRect.top + scrollTop;

                const pBX = pBRect.left + pBRect.width / 2 - containerRect.left + scrollLeft;
                const pBY_bottom = pBRect.top + pBRect.height - containerRect.top + scrollTop;

                const bottomY = (pAY_bottom + pBY_bottom) / 2;
                const midX = (pAX + pBX) / 2;
                const midY = bottomY;

                const midWayY = (midY + childY) / 2;

                // Determine highlight states
                const isChildHovered = hoveredId === child.id;
                const isParentAHovered = hoveredId === pAId;
                const isParentBHovered = hoveredId === pBId;
                const isHighlighted = hoveredId !== null && (isChildHovered || isParentAHovered || isParentBHovered);

                const strokeColor = isHighlighted ? "#fbbf24" : "#f43f5e";
                const opacity = hoveredId === null ? 0.70 : (isHighlighted ? 1.0 : 0.15);
                const strokeWidth = isHighlighted ? 4.5 : 2.5;

                const pairKey = [pAId, pBId].sort().join("___");
                if (!processedPairs.has(pairKey)) {
                  processedPairs.add(pairKey);

                  // Draw horizontal line connecting partners
                  const hLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
                  hLine.setAttribute("x1", pAX.toString());
                  hLine.setAttribute("y1", bottomY.toString());
                  hLine.setAttribute("x2", pBX.toString());
                  hLine.setAttribute("y2", bottomY.toString());
                  hLine.setAttribute("stroke", strokeColor);
                  hLine.setAttribute("stroke-width", (isHighlighted ? 5.0 : 3.0).toString());
                  hLine.setAttribute("stroke-opacity", opacity.toString());
                  svg.appendChild(hLine);
                }

                // Route descendant line downwards from center point (midX, midY) of the horizontal line
                // Orthogonal "Elbow" routing: midX,midY -> midX,midWayY -> childX,midWayY -> childX,childY
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                const d = `M ${midX} ${midY} L ${midX} ${midWayY} L ${childX} ${midWayY} L ${childX} ${childY}`;
                path.setAttribute("d", d);
                path.setAttribute("stroke", strokeColor);
                path.setAttribute("stroke-width", strokeWidth.toString());
                path.setAttribute("stroke-opacity", opacity.toString());
                path.setAttribute("fill", "none");
                svg.appendChild(path);
                return;
              }
            }

            // Fallback if 1 parent or cards missing
            parentIds.forEach(parentId => {
              const parentCard = treeContainer.querySelector(`[data-id="${parentId}"].tree-node-card`);
              if (!parentCard) return;

              const parentRect = parentCard.getBoundingClientRect();
              const parentX = parentRect.left + parentRect.width / 2 - containerRect.left + scrollLeft;
              const parentY = parentRect.top + parentRect.height - containerRect.top + scrollTop;

              const midWayY = (parentY + childY) / 2;

              const isChildHovered = hoveredId === child.id;
              const isParentHovered = hoveredId === parentId;
              const isHighlighted = hoveredId !== null && (isChildHovered || isParentHovered);

              const strokeColor = isHighlighted ? "#fbbf24" : "#f43f5e";
              const opacity = hoveredId === null ? 0.60 : (isHighlighted ? 1.0 : 0.15);
              const strokeWidth = isHighlighted ? 4.5 : 2.5;

              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              const d = `M ${parentX} ${parentY} L ${parentX} ${midWayY} L ${childX} ${midWayY} L ${childX} ${childY}`;
              path.setAttribute("d", d);
              path.setAttribute("stroke", strokeColor);
              path.setAttribute("stroke-width", strokeWidth.toString());
              path.setAttribute("stroke-opacity", opacity.toString());
              path.setAttribute("fill", "none");
              svg.appendChild(path);
            });
          });
        };

        (window as any).drawTreeConnections = drawConnections;
        (window as any).redrawTreeConnections = () => drawConnections(currentHoveredId);

        // Initial draw
        drawConnections(null);
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

function createExpeditionsView(): HTMLElement {
  const container = document.createElement("div");
  container.className = "max-w-6xl mx-auto p-6 space-y-8 animate-fadeIn";

  container.appendChild(renderSeasonStatusBar());

  // Header
  const header = document.createElement("div");
  header.className = "flex items-center justify-between";
  header.innerHTML = `
    <div>
      <h2 class="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400">🗺️ The Legendary Expedition Board</h2>
      <p class="text-xs text-slate-400 mt-1">Deploy pairs on high-fantasy quests for 2 AP to recover rare cosmetics and boost their compatibility!</p>
    </div>
  `;
  const backBtn = document.createElement("button");
  backBtn.className = "px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold border border-slate-700 transition-all shadow-md";
  backBtn.innerText = "← Back to Hub";
  backBtn.addEventListener("click", () => {
    activeView = "hub";
    renderApp();
  });
  header.appendChild(backBtn);
  container.appendChild(header);

  // Content Layout
  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 lg:grid-cols-3 gap-8";

  // Left Column: Expedition Selector Cards
  const leftCol = document.createElement("div");
  leftCol.className = "lg:col-span-2 space-y-4";
  leftCol.innerHTML = `<h3 class="text-lg font-black text-slate-200 mb-2">Available Quests</h3>`;

  EXPEDITIONS_LIST.forEach(exp => {
    const isSelected = selectedExpeditionId === exp.id;
    const expCard = document.createElement("div");
    expCard.className = `p-5 rounded-2xl border transition-all cursor-pointer ${isSelected ? "bg-slate-800 border-teal-500 shadow-lg" : "bg-slate-800/40 border-slate-800 hover:border-slate-700"}`;
    expCard.innerHTML = `
      <h4 class="font-extrabold text-sm text-slate-100 flex items-center justify-between">
        <span>${exp.name}</span>
        <span class="text-[10px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800 uppercase tracking-widest text-slate-400 font-bold">Tested Stat: ${exp.primaryStat}</span>
      </h4>
      <p class="text-xs text-slate-300 leading-relaxed mt-2">${exp.desc}</p>
      <div class="mt-3 flex items-center justify-between text-[11px] font-bold text-teal-400 uppercase tracking-wider">
        <span>Reward: ${exp.rewardLabel} (${exp.rewardType})</span>
        ${state.unlockedItems?.includes(exp.rewardItem) ? `<span class="text-emerald-400 font-black">✓ Already Unlocked</span>` : `<span class="text-amber-500 font-black">🔒 Locked starting option</span>`}
      </div>
    `;

    expCard.addEventListener("click", () => {
      selectedExpeditionId = exp.id;
      expeditionOutcomeText = null;
      renderApp();
    });

    leftCol.appendChild(expCard);
  });
  grid.appendChild(leftCol);

  // Right Column: Deploy & Preparation Panel
  const rightCol = document.createElement("div");
  rightCol.className = "bg-slate-800 p-6 rounded-2xl border border-slate-700 shadow-xl space-y-6";

  const exp = EXPEDITIONS_LIST.find(e => e.id === selectedExpeditionId)!;
  rightCol.innerHTML = `
    <h3 class="text-lg font-black text-slate-200">Prepare Party</h3>
    <p class="text-xs text-slate-400">Select any two characters to send. Higher tested stat (${exp.primaryStat}) increases success rate!</p>
  `;

  // Candidate options: player + npcs + offspring
  const candidates = [state.player!].concat(state.npcs).concat(state.offspring);

  if (candidates.length < 2) {
    rightCol.innerHTML += `<p class="text-xs text-red-400">You need at least 2 characters in play to run an expedition!</p>`;
  } else {
    // Dropdowns
    if (!expeditionMemberAId || !candidates.some(c => c.id === expeditionMemberAId)) {
      expeditionMemberAId = candidates[0].id;
    }
    // Set Member B to different default
    const possibleB = candidates.filter(c => c.id !== expeditionMemberAId);
    if (!expeditionMemberBId || !candidates.some(c => c.id === expeditionMemberBId) || expeditionMemberBId === expeditionMemberAId) {
      expeditionMemberBId = possibleB.length > 0 ? possibleB[0].id : "";
    }

    const dropdownBox = document.createElement("div");
    dropdownBox.className = "space-y-4";

    const createSelectGroup = (label: string, value: string, onSelectChange: (id: string) => void) => {
      const group = document.createElement("div");
      group.className = "space-y-1.5";
      group.innerHTML = `<label class="block text-xs font-black uppercase text-slate-400 tracking-wider">${label}</label>`;

      const sel = document.createElement("select");
      sel.className = "w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs focus:ring-2 focus:ring-teal-500";

      candidates.forEach(cand => {
        const opt = document.createElement("option");
        opt.value = cand.id;
        opt.innerText = `${cand.name} (${cand.species} • ${exp.primaryStat}: ${cand.personalityTraits[exp.primaryStat]}%)`;
        opt.selected = cand.id === value;
        sel.appendChild(opt);
      });

      sel.addEventListener("change", (e) => {
        onSelectChange((e.target as HTMLSelectElement).value);
        expeditionOutcomeText = null;
        renderApp();
      });

      group.appendChild(sel);
      return group;
    };

    dropdownBox.appendChild(createSelectGroup("Adventurer 1", expeditionMemberAId, (id) => expeditionMemberAId = id));
    dropdownBox.appendChild(createSelectGroup("Adventurer 2", expeditionMemberBId, (id) => expeditionMemberBId = id));
    rightCol.appendChild(dropdownBox);

    // Render Side-by-Side Mini-Portraits of party
    const partyA = candidates.find(c => c.id === expeditionMemberAId)!;
    const partyB = candidates.find(c => c.id === expeditionMemberBId)!;

    const partyPortraits = document.createElement("div");
    partyPortraits.className = "flex justify-center gap-4 py-2 border-t border-b border-slate-700/50";
    partyPortraits.appendChild(createToggleableAvatar(partyA, 80));
    partyPortraits.appendChild(createToggleableAvatar(partyB, 80));
    rightCol.appendChild(partyPortraits);

    // Tested metrics description
    const statA = partyA.personalityTraits[exp.primaryStat];
    const statB = partyB.personalityTraits[exp.primaryStat];
    const bestStat = Math.max(statA, statB);

    const matchBlock = document.createElement("div");
    matchBlock.className = "p-3 bg-slate-900/60 rounded-xl border border-slate-850 text-xs text-slate-300 text-center";
    matchBlock.innerHTML = `
      <div>Heir Stat Blend Match: <strong class="text-teal-400">${bestStat}% ${exp.primaryStat}</strong></div>
      <div class="text-[10px] text-slate-400 mt-0.5">Calculated Success Chance: <strong class="text-slate-200">${Math.min(100, bestStat + 15)}%</strong></div>
    `;
    rightCol.appendChild(matchBlock);

    // Embark Button (Costs 2 AP)
    const currentAP = state.actionPoints ?? 5;
    const canEmbark = currentAP >= 2 && expeditionMemberAId !== expeditionMemberBId;

    const embarkBtn = document.createElement("button");
    embarkBtn.className = `w-full py-3 font-extrabold rounded-xl text-xs uppercase transition-all shadow-md ${canEmbark ? "bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-900 cursor-pointer" : "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"}`;
    embarkBtn.innerHTML = `🗺️ Embark Adventurers (Costs 2 AP) ${canEmbark ? "✨" : "🔒"}`;

    if (expeditionMemberAId === expeditionMemberBId) {
      embarkBtn.innerHTML = "🔒 Cannot deploy same character twice!";
    }

    embarkBtn.addEventListener("click", () => {
      if (!canEmbark) return;

      // Deduct 2 AP
      state.actionPoints = currentAP - 2;

      // Roll success
      const successChance = bestStat + 15;
      const roll = Math.random() * 100;
      const isSuccess = roll < successChance;

      let logText = `### expedition outcome: ${isSuccess ? "🎉 SUCCESS" : "⚠️ RETREAT"}\n\n`;

      if (isSuccess) {
        logText += `${exp.fluffSuccess}\n\n`;

        // Unlock globally
        if (!state.unlockedItems) state.unlockedItems = [];
        if (!state.unlockedItems.includes(exp.rewardItem)) {
          state.unlockedItems.push(exp.rewardItem);
          logText += `⭐ **GLOBAL UNLOCK**: The **${exp.rewardLabel}** starting option is now permanently unlocked in the Character Creator on future runs!\n\n`;
        }

        // Apply immediately
        if (exp.rewardType === "accessory") {
          partyA.stylingTraits.accessory = exp.rewardItem;
          partyB.stylingTraits.accessory = exp.rewardItem;
        } else {
          partyA.stylingTraits.clothing = exp.rewardItem;
          partyB.stylingTraits.clothing = exp.rewardItem;
        }
        logText += `✨ **IMMEDIATE GRATIFICATION**: The **${exp.rewardLabel}** has been immediately equipped on both ${partyA.name} and ${partyB.name}!\n\n`;

        // Boost relationships
        // If there's a relationship between them
        const relId = partyA.id === "player" ? partyB.id : partyB.id === "player" ? partyA.id : null;
        if (relId && state.relationships[relId]) {
          const rel = state.relationships[relId];
          rel.stats.affection = Math.min(100, rel.stats.affection + 15);
          rel.stats.trust = Math.min(100, rel.stats.trust + 15);
          logText += `❤️ **BOND STRENGTHENED**: Shared triumph has increased their Affection and Trust by **+15%**!\n\n`;
        }

        // Expedition Offspring: 20% chance
        if (!isPartnered(partyA) && !isPartnered(partyB) && checkPairingEligibility(partyA, partyB).eligible) {
          if (Math.random() < 0.20) {
            const child = generateOffspring(partyA, partyB);
            state.offspring.push(child);
            checkAndUnlockAchievements(child);
            logText += `🍼 **MIRACLE ON THE TRAIL**: Sharing the triumph of this journey has brought them closer... They have returned with a newly born offspring, **${child.name}** (Gen ${child.generation}), who has been placed in the Nursery!`;
          }
        }
      } else {
        logText += `${exp.fluffFailure}\n\n`;
        const relId = partyA.id === "player" ? partyB.id : partyB.id === "player" ? partyA.id : null;
        if (relId && state.relationships[relId]) {
          const rel = state.relationships[relId];
          rel.stats.trust = Math.min(100, rel.stats.trust + 5);
          logText += `🤝 **SHARED STRUGGLE**: Although they retreated, the teamwork increased their mutual Trust by **+5%**.`;
        }
      }

      expeditionOutcomeText = logText;
      saveGame(state);
      renderApp();
    });

    rightCol.appendChild(embarkBtn);

    // Render outcome text if available
    if (expeditionOutcomeText) {
      const logBox = document.createElement("div");
      logBox.className = "p-4 bg-slate-950 rounded-xl border border-teal-500/30 text-xs text-slate-200 space-y-2 text-left leading-relaxed mt-4";

      // Simple parse markdown headers
      const lines = expeditionOutcomeText.split("\n");
      lines.forEach(line => {
        if (!line.trim()) return;
        const p = document.createElement("p");
        if (line.startsWith("###")) {
          p.className = "font-black text-teal-400 text-sm border-b border-teal-500/20 pb-1.5 mb-1.5 uppercase";
          p.innerText = line.replace("###", "").trim();
        } else {
          p.innerHTML = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        }
        logBox.appendChild(p);
      });

      rightCol.appendChild(logBox);
    }
  }

  grid.appendChild(rightCol);
  container.appendChild(grid);

  return container;
}

// Debounced tree connections resize redraw listener
if (!(window as any).hasTreeResizeListener) {
  (window as any).hasTreeResizeListener = true;
  let resizeTimeout: any = null;
  window.addEventListener("resize", () => {
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (typeof (window as any).redrawTreeConnections === "function") {
        (window as any).redrawTreeConnections();
      }
    }, 100);
  });
}

renderApp();
