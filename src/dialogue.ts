import { Scene, Relationship, RelationshipStage, Character, RelationshipStats } from "./types";

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
  // scale factor centered around 50 (neutral)
  // e.g. score of 100 -> 1.5x, score of 0 -> 0.5x
  const multiplier = 0.5 + (compatibilityScore / 100);

  const modified: Partial<Relationship["stats"]> = {};
  for (const [key, value] of Object.entries(deltas)) {
    const k = key as keyof Relationship["stats"];
    if (value && value > 0) {
      modified[k] = Math.round(value * multiplier);
    } else if (value && value < 0) {
      // higher compatibility reduces the severity of mistakes!
      const penaltyReduction = 1.5 - (compatibilityScore / 100); // 100 compatibility -> 0.5x penalty
      modified[k] = Math.round(value * Math.max(0.2, penaltyReduction));
    }
  }
  return modified;
}
