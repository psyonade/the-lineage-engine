import { Character } from "./types";

export interface CompatibilityResult {
  score: number; // 0 to 100
  breakdown: string[];
}

/**
 * Computes compatibility between two characters based on their personality traits.
 * Boldness, Warmth, Wit, Ambition, Chaos
 * Since it is high fantasy/escapist, compatibility isn't just "similarity".
 * For example:
 * - High warmth on both sides yields strong compatibility (warm-warm match).
 * - Opposites attract for Boldness (Bold + Shy/Low-Boldness is cute).
 * - High Wit on both sides leads to fun matches (witty banter).
 * - High Ambition on both sides might create rivalry but is also respected,
 *   while Ambition + Chaos can be highly volatile or highly entertaining!
 */
export function computeCompatibility(charA: Character, charB: Character): CompatibilityResult {
  const pA = charA.personalityTraits;
  const pB = charB.personalityTraits;

  const breakdown: string[] = [];
  let totalScore = 20; // Base score rebalanced to ~20%

  // 1. Warmth (0-100)
  const warmthAvg = (pA.warmth + pB.warmth) / 2;
  if (warmthAvg >= 75) {
    totalScore += 20;
    breakdown.push("Deep mutual warmth creates an incredibly cozy and affectionate bond.");
  } else if (warmthAvg <= 25) {
    totalScore -= 15;
    breakdown.push("A distinct chill: both characters struggle to open up, keeping things formal.");
  } else {
    const diff = Math.abs(pA.warmth - pB.warmth);
    if (diff >= 50) {
      totalScore += 8;
      breakdown.push("One character's vibrant warmth gently softens the other's icy demeanor.");
    } else {
      breakdown.push("A comfortable, steady emotional warmth sits between them.");
    }
  }

  // 2. Boldness vs. Boldness (Opposites attract, or dual-bold explosive dynamic)
  const boldDiff = Math.abs(pA.boldness - pB.boldness);
  if (boldDiff >= 60) {
    totalScore += 20;
    breakdown.push("Opposites attract! One's daring confidence perfectly balances the other's quiet reserve.");
  } else if (pA.boldness >= 75 && pB.boldness >= 75) {
    totalScore += 10;
    breakdown.push("Two bold souls. Their encounters are high-energy, exciting, and prone to friendly competition.");
  } else if (pA.boldness <= 25 && pB.boldness <= 25) {
    totalScore -= 12;
    breakdown.push("A gentle silence: both are highly reserved, making steps forward slow and polite.");
  } else {
    breakdown.push("A balanced sense of initiative; neither dominates the conversation.");
  }

  // 3. Wit vs. Wit (Witty banter)
  const witAvg = (pA.wit + pB.wit) / 2;
  if (witAvg >= 75) {
    totalScore += 20;
    breakdown.push("Sparkling wits! Their conversations flow with rapid-fire humor and clever banter.");
  } else if (pA.wit >= 70 && pB.wit <= 30) {
    totalScore += 10;
    breakdown.push("One character's sharp jokes often leave the more literal-minded one bemused or flustered.");
  } else if (Math.abs(pA.wit - pB.wit) >= 60) {
    totalScore -= 10;
    breakdown.push("A severe Wit mismatch: one's rapid-fire jokes completely fly over the other's head, causing minor friction.");
  } else if (pA.wit <= 25 && pB.wit <= 25) {
    breakdown.push("Straightforward and honest communication without complex double-meanings.");
  } else {
    breakdown.push("A lighthearted and pleasant sense of humor.");
  }

  // 4. Ambition (Shared drive or complementary interests)
  if (pA.ambition >= 75 && pB.ambition >= 75) {
    totalScore += 15;
    breakdown.push("A powerhouse pairing! Both respect each other's soaring aspirations, though rivalries may brew.");
  } else if (pA.ambition <= 25 && pB.ambition <= 25) {
    totalScore -= 12;
    breakdown.push("Low mutual drive: both characters lack long-term aspirations, leading to stagnant progression.");
  } else if (Math.abs(pA.ambition - pB.ambition) >= 60) {
    totalScore -= 8;
    breakdown.push("A clash of drives: one's relentless ambition leaves the other feeling exhausted or neglected.");
  } else {
    breakdown.push("Moderate, shared aspirations make for a peaceful and unstressed journey.");
  }

  // 5. Chaos (The unpredictable spark)
  const chaosAvg = (pA.chaos + pB.chaos) / 2;
  if (chaosAvg >= 80) {
    totalScore += 20;
    breakdown.push("Pure chaos! Together, they are a swirling storm of wild ideas and unpredictable adventure.");
  } else if (pA.chaos >= 75 && pB.chaos <= 25) {
    totalScore -= 10;
    breakdown.push("A clash of chaos: one's rigid adherence to rules frustrates the other's free, unpredictable spirit.");
  } else if (pA.chaos <= 25 && pB.chaos <= 25) {
    totalScore += 10;
    breakdown.push("Highly orderly. They share a love for structured schedules, neat plans, and predictable results.");
  } else {
    breakdown.push("A healthy balance of safety and sudden, fun whimsy.");
  }

  // 6. Species matching bonus/flavor
  if (charA.species === charB.species) {
    totalScore += 8;
    breakdown.push(`Shared heritage as ${charA.species}s provides instant cultural familiarity.`);
  } else {
    totalScore += 12; // High-fantasy romance loves inter-species curiosity and learning!
    breakdown.push(`An intriguing inter-species match (${charA.species} and ${charB.species}) sparking beautiful curiosity.`);
  }

  // Clamp score between 0 and 100
  const score = Math.max(0, Math.min(100, Math.round(totalScore)));

  return { score, breakdown };
}
