import { Scene, Relationship, RelationshipStage, Character, RelationshipStats, RelationshipPath } from "./types";

/**
 * Determine dynamic relationship path from current stats.
 * Centered around:
 * - friendsFirst (high Trust)
 * - rivalsToLovers (high Rivalry + high Attraction)
 * - whirlwind (high Attraction)
 * - slowBurn (high Trust + high Affection)
 */
export function getRelationshipPath(stats: RelationshipStats): RelationshipPath {
  const { affection, trust, attraction, rivalry } = stats;

  // Rivals to lovers: high rivalry and high attraction
  if (rivalry >= 45 && attraction >= 45) {
    return "rivalsToLovers";
  }

  // Slow Burn: High trust and affection together
  if (trust >= 45 && affection >= 45) {
    return "slowBurn";
  }

  // Friends first: High trust, but affection/attraction are lower
  if (trust >= 45 && trust > attraction && trust > rivalry) {
    return "friendsFirst";
  }

  // Whirlwind: High attraction
  if (attraction >= 45) {
    return "whirlwind";
  }

  return "none";
}

/**
 * Custom branch-based narratives.
 * Each Scene is loaded with multiple options, each updating metrics depending on compatibility.
 */
export const DIALOGUE_SCENES: Scene[] = [
  {
    id: "first_meeting",
    title: "A Chance Encounter",
    nodes: {
      start: {
        id: "start",
        text: "You find yourself at the Golden Griffin Inn when someone walks in, scanning the room before locking eyes with you.",
        speaker: "Narrator",
        choices: [
          {
            text: "Smile warmly and raise your glass in welcome.",
            nextNodeId: "warm_welcome",
            statDeltas: { affection: 15, trust: 10 }
          },
          {
            text: "Challenge them with a confident, witty remark.",
            nextNodeId: "witty_challenge",
            statDeltas: { attraction: 15, rivalry: 5 }
          },
          {
            text: "Quietly study them, keeping your guard up.",
            nextNodeId: "cautious_stare",
            statDeltas: { trust: 5 }
          }
        ]
      },
      warm_welcome: {
        id: "warm_welcome",
        text: "They smile back, obviously relieved by your hospitality. They approach and take a seat next to you.",
        speaker: "NPC",
        choices: [
          {
            text: "Order a drink for both of you and exchange stories.",
            nextNodeId: "end_friendly",
            statDeltas: { affection: 10, trust: 15 }
          },
          {
            text: "Directly ask what brought them to this city.",
            nextNodeId: "end_curious",
            statDeltas: { trust: 10 }
          }
        ]
      },
      witty_challenge: {
        id: "witty_challenge",
        text: "A spark flares in their eyes! They raise an eyebrow and fire back an even faster quip, leaning in close.",
        speaker: "NPC",
        choices: [
          {
            text: "Laugh heartily and appreciate the banter.",
            nextNodeId: "end_flirty",
            statDeltas: { affection: 10, attraction: 15 }
          },
          {
            text: "Politely nod and steer back to standard conversation.",
            nextNodeId: "end_curious",
            statDeltas: { trust: 10 }
          }
        ]
      },
      cautious_stare: {
        id: "cautious_stare",
        text: "Recognizing your caution, they proceed carefully, keeping a respectful distance as they nod.",
        speaker: "NPC",
        choices: [
          {
            text: "Apologize for your coldness and offer an introducing handshake.",
            nextNodeId: "end_friendly",
            statDeltas: { affection: 10, trust: 15 }
          },
          {
            text: "Nod back silently, keeping things formal.",
            nextNodeId: "end_formal",
            statDeltas: { trust: 5 }
          }
        ]
      },
      end_friendly: {
        id: "end_friendly",
        text: "You talk for hours, sharing hearty laughs. A comfortable comfort has bloomed between you.",
        speaker: "Narrator",
        choices: []
      },
      end_curious: {
        id: "end_curious",
        text: "After sharing details of your respective journeys, you part ways with mutual respect and a promise to meet again.",
        speaker: "Narrator",
        choices: []
      },
      end_flirty: {
        id: "end_flirty",
        text: "Sparks fly in the dim firelight. You leave with a fluttering heart and a very strong impression.",
        speaker: "Narrator",
        choices: []
      },
      end_formal: {
        id: "end_formal",
        text: "A brief, stiff conversation follows. You both depart, noting each other as practical acquaintances.",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "shared_quest",
    title: "The Ruined Temple Overlook",
    triggerConditions: {
      minStage: "Acquaintance"
    },
    nodes: {
      start: {
        id: "start",
        text: "While seeking high ground to survey the valley, you both end up on a precarious ledge overlooking ancient, overgrown ruins.",
        speaker: "Narrator",
        choices: [
          {
            text: "Take a risk and climb higher, calling them to follow.",
            nextNodeId: "climb_high",
            statDeltas: { attraction: 15, rivalry: 10 }
          },
          {
            text: "Ask for their advice on the safest path forward.",
            nextNodeId: "ask_advice",
            statDeltas: { trust: 20, affection: 10 }
          },
          {
            text: "Prank them by pretending to slip!",
            nextNodeId: "prank_slip",
            statDeltas: { affection: 5, trust: -5 }
          }
        ]
      },
      climb_high: {
        id: "climb_high",
        text: "They watch you scramble up with an impressed grin, quickly climbing up to meet you at the summit. The view is breathtaking.",
        speaker: "NPC",
        choices: [
          {
            text: "Silently watch the sunset together, shoulder to shoulder.",
            nextNodeId: "end_romantic",
            statDeltas: { attraction: 15, affection: 15 }
          },
          {
            text: "Boast that you got here first.",
            nextNodeId: "end_competitive",
            statDeltas: { rivalry: 15 }
          }
        ]
      },
      ask_advice: {
        id: "ask_advice",
        text: "They trace the stonework with a knowledgeable eye, guiding you safely down. They seem very pleased by your confidence in them.",
        speaker: "NPC",
        choices: [
          {
            text: "Thank them deeply and confess how much you value their wisdom.",
            nextNodeId: "end_romantic",
            statDeltas: { affection: 20, attraction: 10 }
          },
          {
            text: "Make a joke about them being your personal guide.",
            nextNodeId: "end_playful",
            statDeltas: { affection: 10, attraction: 10 }
          }
        ]
      },
      prank_slip: {
        id: "prank_slip",
        text: "They gasp and dive forward to grab you, looking terrified before realizing you're laughing. They hit your shoulder playfully, cheeks flushed.",
        speaker: "NPC",
        choices: [
          {
            text: "Apologize with a warm hug.",
            nextNodeId: "end_romantic",
            statDeltas: { affection: 25, attraction: 15 }
          },
          {
            text: "Double down on the joke.",
            nextNodeId: "end_playful",
            statDeltas: { affection: 5, rivalry: 10 }
          }
        ]
      },
      end_romantic: {
        id: "end_romantic",
        text: "The shared adventure brings you closer than ever. An unmistakable romantic tension hangs in the air.",
        speaker: "Narrator",
        choices: []
      },
      end_competitive: {
        id: "end_competitive",
        text: "They spark a friendly rivalry. You spent the rest of the day challenging each other's athletic prowess.",
        speaker: "Narrator",
        choices: []
      },
      end_playful: {
        id: "end_playful",
        text: "Witty remarks and shared chuckles carry you through. Your bond feels light, happy, and incredibly easy.",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "confession_scene",
    title: "A Quiet Night in the Garden",
    triggerConditions: {
      minStage: "Interested"
    },
    nodes: {
      start: {
        id: "start",
        text: "Under a canopy of bioluminescent night-blooms, they look at you, taking a deep breath as if summoning courage.",
        speaker: "NPC",
        choices: [
          {
            text: "Hold their hand and ask what's on their mind.",
            nextNodeId: "hold_hand",
            statDeltas: { affection: 20, attraction: 20 }
          },
          {
            text: "Teasingly ask if they're about to make a grand speech.",
            nextNodeId: "tease_confess",
            statDeltas: { attraction: 10, affection: 10 }
          }
        ]
      },
      hold_hand: {
        id: "hold_hand",
        text: "They squeeze your hand tight. 'I've met many travelers, but nobody makes me feel the way you do. Will you walk this path together with me?'",
        speaker: "NPC",
        choices: [
          {
            text: "'Yes, a thousand times yes.' (Propose Partnership)",
            nextNodeId: "partnership_accepted",
            statDeltas: { affection: 30, trust: 30 }
          },
          {
            text: "'I care for you, but let's take things slow.'",
            nextNodeId: "slow_down",
            statDeltas: { trust: 15, affection: 5 }
          }
        ]
      },
      tease_confess: {
        id: "tease_confess",
        text: "They chuckle softly, blushing. 'I suppose I am. You always find a way to cut through my nerves. I... I want you to be my partner.'",
        speaker: "NPC",
        choices: [
          {
            text: "'I would love nothing more!'",
            nextNodeId: "partnership_accepted",
            statDeltas: { affection: 30, trust: 30 }
          },
          {
            text: "'Let's keep things as they are for now.'",
            nextNodeId: "slow_down",
            statDeltas: { trust: 15 }
          }
        ]
      },
      partnership_accepted: {
        id: "partnership_accepted",
        text: "They embrace you tightly, whispers of joy warming your heart. You are now officially partners!",
        speaker: "Narrator",
        choices: []
      },
      slow_down: {
        id: "slow_down",
        text: "They offer a gentle, slightly wistful nod, respecting your boundary. Your friendship remains rock-solid.",
        speaker: "Narrator",
        choices: []
      }
    }
  },

  // 3-Stage Quests for Named Unique NPCs
  // NPC 1: Elara the Moonlit Ranger (npc-elara)
  {
    id: "elara_quest_1",
    title: "Elara: Echoes in the Canopy",
    triggerConditions: { requiredNPC: "npc-elara" },
    nodes: {
      start: {
        id: "start",
        text: "Elara stands near the edge of the woodland trail, holding a torn piece of canvas. 'A poacher's snare,' she whispers. 'They are near.'",
        speaker: "NPC",
        choices: [
          {
            text: "Offer to help her track the poachers right now.",
            nextNodeId: "track_poachers",
            statDeltas: { affection: 15, trust: 15 }
          },
          {
            text: "Wryly remark that she can surely handle it alone, but you'll tag along for the show.",
            nextNodeId: "joke_track",
            statDeltas: { attraction: 15, rivalry: 10 }
          }
        ]
      },
      track_poachers: {
        id: "track_poachers",
        text: "'Thank you. Your eyes will be invaluable under this dense twilight,' she nods, lead-scouting with fluid, feline grace.",
        speaker: "NPC",
        choices: [
          {
            text: "Follow quietly, keeping close to her side.",
            nextNodeId: "end",
            statDeltas: { trust: 15, affection: 10 }
          }
        ]
      },
      joke_track: {
        id: "joke_track",
        text: "She rolls her eyes but a smirk leaks. 'Oh, is that so? Try to keep up then, city slicker!'",
        speaker: "NPC",
        choices: [
          {
            text: "Sprint ahead playfully to show off.",
            nextNodeId: "end",
            statDeltas: { rivalry: 15, attraction: 10 }
          }
        ]
      },
      end: {
        id: "end",
        text: "You successfully disable several traps and secure the perimeter. Elara breathes a sigh of relief. 'We made a great team today.'",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "elara_quest_2",
    title: "Elara: Shadows in the Glen",
    triggerConditions: { requiredNPC: "npc-elara" },
    nodes: {
      start: {
        id: "start",
        text: "Elara's bow is drawn tight as shadows writhe in the misty glen. 'That's no beast,' she warns. 'A corrupted spirit!'",
        speaker: "NPC",
        choices: [
          {
            text: "Charge in with your weapon to draw its anger away from her.",
            nextNodeId: "brave_charge",
            statDeltas: { attraction: 20, affection: 10 }
          },
          {
            text: "Suggest a strategic trap to snare the spirit safely.",
            nextNodeId: "clever_trap",
            statDeltas: { trust: 20, affection: 10 }
          }
        ]
      },
      brave_charge: {
        id: "brave_charge",
        text: "'Foolish!' she cries, but quickly covers you, firing perfect, glowing arrows to shatter the spirit's focus.",
        speaker: "NPC",
        choices: [
          {
            text: "Wink at her as the mist clears.",
            nextNodeId: "end",
            statDeltas: { attraction: 15, affection: 10 }
          }
        ]
      },
      clever_trap: {
        id: "clever_trap",
        text: "She smiles appreciatively. 'A hunter's mind. Let's do it.' Together, you build a runic trap that safely binds the mist.",
        speaker: "NPC",
        choices: [
          {
            text: "Hand her the binding crystal with a soft smile.",
            nextNodeId: "end",
            statDeltas: { trust: 15, affection: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "The forest calms. Elara looks at you, her stoic facade softening. 'I'm glad you're here. The woods feel less lonely now.'",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "elara_quest_3",
    title: "Elara: Oath of the Wilds",
    triggerConditions: { requiredNPC: "npc-elara" },
    nodes: {
      start: {
        id: "start",
        text: "Elara stands under the ancient Moonwood Tree. 'The rangers want me to move north,' she says softly. 'But my heart is... anchored here.'",
        speaker: "NPC",
        choices: [
          {
            text: "Tell her you want her to stay here, with you.",
            nextNodeId: "ask_stay",
            statDeltas: { affection: 30, attraction: 30 }
          },
          {
            text: "Encourage her to follow her ranger duty, promising to travel with her.",
            nextNodeId: "promise_travel",
            statDeltas: { trust: 30, affection: 20 }
          }
        ]
      },
      ask_stay: {
        id: "ask_stay",
        text: "She steps close, her hand resting on your shoulder. 'Then I stay. No wild forest holds more beauty than what we've built.'",
        speaker: "NPC",
        choices: [
          {
            text: "Embrace her warmly under the glowing canopy.",
            nextNodeId: "end",
            statDeltas: { affection: 20 }
          }
        ]
      },
      promise_travel: {
        id: "promise_travel",
        text: "Her eyes shimmer. 'You'd leave your home for mine? Your loyalty is a rare, precious thing.'",
        speaker: "NPC",
        choices: [
          {
            text: "Nod firmly and squeeze her hand.",
            nextNodeId: "end",
            statDeltas: { trust: 25, attraction: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "Elara has found her true sanctuary. Your souls are bound to the timeless whispers of the forest.",
        speaker: "Narrator",
        choices: []
      }
    }
  },

  // NPC 2: Ignatius the Hellfire Scholar (npc-ignatius)
  {
    id: "ignatius_quest_1",
    title: "Ignatius: The Smoldering Tome",
    triggerConditions: { requiredNPC: "npc-ignatius" },
    nodes: {
      start: {
        id: "start",
        text: "Ignatius is frantically cooling down a smoking leather book. 'An explosive sigil! Fascinating, yet slightly singeing!'",
        speaker: "NPC",
        choices: [
          {
            text: "Splash a cup of water on the book quickly.",
            nextNodeId: "water_splash",
            statDeltas: { rivalry: 15, affection: -5 }
          },
          {
            text: "Help him channel a containment spell.",
            nextNodeId: "channel_magic",
            statDeltas: { trust: 20, affection: 10 }
          }
        ]
      },
      water_splash: {
        id: "water_splash",
        text: "He gasps in horror! 'Are you mad? The ink! It's ruined... Wait, actually, the soot washed away revealing hidden runes! Lucky buffoon!'",
        speaker: "NPC",
        choices: [
          {
            text: "Smugly take credit for your brilliant 'solution'.",
            nextNodeId: "end",
            statDeltas: { rivalry: 15, attraction: 10 }
          }
        ]
      },
      channel_magic: {
        id: "channel_magic",
        text: "Together, you weave a cool energy shield. The smoking ceases. He sighs. 'A masterclass in coordination. Magnifique!'",
        speaker: "NPC",
        choices: [
          {
            text: "Compliment his magical quick-wit.",
            nextNodeId: "end",
            statDeltas: { trust: 15, affection: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "The scholar notes your helpfulness (or sheer luck) in his margins. A small flame of interest is lit.",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "ignatius_quest_2",
    title: "Ignatius: Forbidden Archives",
    triggerConditions: { requiredNPC: "npc-ignatius" },
    nodes: {
      start: {
        id: "start",
        text: "Ignatius is creeping through the restricted archives. 'The head archivist is asleep. Stand guard while I fetch the Codex of Ash!'",
        speaker: "NPC",
        choices: [
          {
            text: "Keep watch diligently, mimicking owl sounds to warn him of footsteps.",
            nextNodeId: "keep_watch",
            statDeltas: { trust: 25, affection: 10 }
          },
          {
            text: "Sneak in with him to steal extra scrolls.",
            nextNodeId: "double_sneak",
            statDeltas: { attraction: 25, rivalry: 10 }
          }
        ]
      },
      keep_watch: {
        id: "keep_watch",
        text: "He emerges, clutching the glowing volume. 'Your alarm noises were... eccentric, but highly effective. Let's make our escape!'",
        speaker: "NPC",
        choices: [
          {
            text: "Scurry out hand-in-hand.",
            nextNodeId: "end",
            statDeltas: { affection: 15, attraction: 15 }
          }
        ]
      },
      double_sneak: {
        id: "double_sneak",
        text: "He looks thrilled. 'A partner in intellectual crime!' You both dodge moving shadows and stuff ancient forbidden lore into your bags.",
        speaker: "NPC",
        choices: [
          {
            text: "Nudge his shoulder playfully in the darkness.",
            nextNodeId: "end",
            statDeltas: { attraction: 20, rivalry: 10 }
          }
        ]
      },
      end: {
        id: "end",
        text: "Safe in the courtyard, Ignatius smiles brightly under his horns. You have become his favorite co-conspirator.",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "ignatius_quest_3",
    title: "Ignatius: Sparks in the Hearth",
    triggerConditions: { requiredNPC: "npc-ignatius" },
    nodes: {
      start: {
        id: "start",
        text: "Ignatius sits by a roaring fireplace, surrounded by floating ink drops. 'I've unlocked the ultimate secret,' he whispers. 'But it means nothing if I cannot share it with you.'",
        speaker: "NPC",
        choices: [
          {
            text: "Confess that you care more about him than any ancient scroll.",
            nextNodeId: "confess_love",
            statDeltas: { affection: 35, attraction: 35 }
          },
          {
            text: "Challenge him to a spell duel to celebrate.",
            nextNodeId: "spell_duel",
            statDeltas: { rivalry: 35, attraction: 25 }
          }
        ]
      },
      confess_love: {
        id: "confess_love",
        text: "The ink droplets splash down. He blushes intensely, smoke trailing from his ears. 'I... I spent my life looking for eternity in paper, when it was standing right before me.'",
        speaker: "NPC",
        choices: [
          {
            text: "Pull him into a deep kiss.",
            nextNodeId: "end",
            statDeltas: { affection: 25 }
          }
        ]
      },
      spell_duel: {
        id: "spell_duel",
        text: "He laughs, his eyes blazing gold! 'Ah, the ultimate testing! Let our sparks write the final chapter!'",
        speaker: "NPC",
        choices: [
          {
            text: "Engage in an explosive, breathtaking dance of embers.",
            nextNodeId: "end",
            statDeltas: { rivalry: 15, attraction: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "Ignatius has found a mystery worth studying for a lifetime: you.",
        speaker: "Narrator",
        choices: []
      }
    }
  },

  // NPC 3: Brenda the Iron-Willed Smith (npc-brenda)
  {
    id: "brenda_quest_1",
    title: "Brenda: Fire and Fury",
    triggerConditions: { requiredNPC: "npc-brenda" },
    nodes: {
      start: {
        id: "start",
        text: "Brenda is swinging a massive hammer, sweat glistening on her brow. 'This slag is stubborn!' she grunts. 'Lend me a hand with the bellows!'",
        speaker: "NPC",
        choices: [
          {
            text: "Pump the bellows with all your strength.",
            nextNodeId: "pump_bellows",
            statDeltas: { trust: 20, affection: 10 }
          },
          {
            text: "Teasingly say you don't want to break a sweat, but offer moral support.",
            nextNodeId: "joke_lazy",
            statDeltas: { rivalry: 15, attraction: 10 }
          }
        ]
      },
      pump_bellows: {
        id: "pump_bellows",
        text: "The flames roar bright white! Brenda grins, striking the metal with rhythmic, devastating force. 'Now that's what I call heat!'",
        speaker: "NPC",
        choices: [
          {
            text: "Wipe some soot off her cheek with a warm smile.",
            nextNodeId: "end",
            statDeltas: { affection: 15, attraction: 10 }
          }
        ]
      },
      joke_lazy: {
        id: "joke_lazy",
        text: "She chuckles deeply. 'Too delicate for honest work? Alright, stand back and watch how a real master shapes steel!'",
        speaker: "NPC",
        choices: [
          {
            text: "Admire her impressive, muscular swing.",
            nextNodeId: "end",
            statDeltas: { attraction: 15, trust: 10 }
          }
        ]
      },
      end: {
        id: "end",
        text: "The molten ore is beautifully refined. Brenda nods in solid approval. 'You've got grit.'",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "brenda_quest_2",
    title: "Brenda: The Dragonsteel Hunt",
    triggerConditions: { requiredNPC: "npc-brenda" },
    nodes: {
      start: {
        id: "start",
        text: "Brenda has tracked a legendary meteor fragment to a deep cavern. 'It's guarded by a crystalline beast,' she mutters, tightening her gauntlets.",
        speaker: "NPC",
        choices: [
          {
            text: "Fight side-by-side with her, matching her fierce battle cry.",
            nextNodeId: "furious_fight",
            statDeltas: { attraction: 25, rivalry: 20 }
          },
          {
            text: "Distract the beast so she can land a clean hammer strike.",
            nextNodeId: "smart_distract",
            statDeltas: { trust: 25, affection: 15 }
          }
        ]
      },
      furious_fight: {
        id: "furious_fight",
        text: "Together, you unleash absolute mayhem! The cavern echoes with your strikes as you shatter the guardian to pieces.",
        speaker: "NPC",
        choices: [
          {
            text: "High-five her enthusiastically.",
            nextNodeId: "end",
            statDeltas: { rivalry: 15, affection: 15 }
          }
        ]
      },
      smart_distract: {
        id: "smart_distract",
        text: "You draw its gaze, dodging perfectly. Brenda leaps from a high ledge, bringing her hammer down like a meteor. 'BULLSEYE!'",
        speaker: "NPC",
        choices: [
          {
            text: "Cheer and help her carry the heavy ore fragment.",
            nextNodeId: "end",
            statDeltas: { trust: 15, affection: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "Brenda slides the glowing dragonsteel into her pack. She looks at you with a heavy, respectful gaze. 'I wouldn't want anyone else at my back.'",
        speaker: "Narrator",
        choices: []
      }
    }
  },
  {
    id: "brenda_quest_3",
    title: "Brenda: Unbreakable Bond",
    triggerConditions: { requiredNPC: "npc-brenda" },
    nodes: {
      start: {
        id: "start",
        text: "Brenda presents you with a stunning, hand-forged ring of dragonsteel. 'I don't do fancy speeches,' she says, her cheeks flushing. 'But this metal will never break... and neither will my devotion to you.'",
        speaker: "NPC",
        choices: [
          {
            text: "Accept the ring and tell her you are hers forever.",
            nextNodeId: "accept_forever",
            statDeltas: { affection: 35, trust: 35 }
          },
          {
            text: "Boast that you'll forge an even better one for her tomorrow.",
            nextNodeId: "boast_back",
            statDeltas: { rivalry: 35, attraction: 20 }
          }
        ]
      },
      accept_forever: {
        id: "accept_forever",
        text: "She laughs, her eyes watering slightly, before picking you up in a powerful, joyful hug. 'You've got yourself a partner for life!'",
        speaker: "NPC",
        choices: [
          {
            text: "Hold onto her tight.",
            nextNodeId: "end",
            statDeltas: { affection: 25 }
          }
        ]
      },
      boast_back: {
        id: "boast_back",
        text: "She punches your shoulder with a massive grin. 'Is that a challenge? I look forward to seeing you try!'",
        speaker: "NPC",
        choices: [
          {
            text: "Slide the ring on, grinning back.",
            nextNodeId: "end",
            statDeltas: { attraction: 20, rivalry: 15 }
          }
        ]
      },
      end: {
        id: "end",
        text: "Forged in fire and tempered by love, your bond with Brenda is completely unbreakable.",
        speaker: "Narrator",
        choices: []
      }
    }
  }
];

/**
 * Determine relationship stage based on affection and trust metrics
 */
export function getRelationshipStage(affection: number, trust: number): RelationshipStage {
  const sum = (affection + trust) / 2;
  if (sum >= 80) return "Partner";
  if (sum >= 50) return "Interested";
  if (sum >= 20) return "Acquaintance";
  return "Stranger";
}

/**
 * Modify choice rewards based on compatibility score (0-100)
 * Higher compatibility amplifies positive deltas and reduces negative penalties, and vice versa.
 */
export function applyCompatibilityModifiers(
  deltas: Partial<Relationship["stats"]>,
  compatibilityScore: number
): Partial<Relationship["stats"]> {
  const multiplier = 0.5 + (compatibilityScore / 100);

  const modified: Partial<Relationship["stats"]> = {};
  for (const [key, value] of Object.entries(deltas)) {
    const k = key as keyof Relationship["stats"];
    if (value && value > 0) {
      modified[k] = Math.round(value * multiplier);
    } else if (value && value < 0) {
      const penaltyReduction = 1.5 - (compatibilityScore / 100); // 100 compatibility -> 0.5x penalty
      modified[k] = Math.round(value * Math.max(0.2, penaltyReduction));
    }
  }
  return modified;
}
