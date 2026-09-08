// Matches the school's own "Criteria Referenced Based For TVET" table exactly.
// Note: the table's actual cutoff for failing is <73 (not <74 as mentioned
// verbally elsewhere in the spec) — built against the table since it's the
// authoritative source. Flag if this should be <74 instead.
const SCALE = [
  { min: 95, letter: "A+" },
  { min: 92, letter: "A" },
  { min: 89, letter: "A-" },
  { min: 86, letter: "B+" },
  { min: 83, letter: "B" },
  { min: 80, letter: "B-" },
  { min: 77, letter: "C+" },
  { min: 73, letter: "C" },
  { min: -Infinity, letter: "F" },
];

export function computeLetterGrade(totalScore) {
  const match = SCALE.find((band) => totalScore >= band.min);
  return match.letter;
}

export function isPassing(totalScore) {
  return totalScore >= 73;
}

// theory: 30%, practice: 40%, cooperative: 30% — each score is entered as a
// raw value out of its own weight (e.g. theory out of 30), per the school's
// own grade-entry sheet format, and summed directly to a 0-100 total.
export function computeTotalScore({ theoryScore, practiceScore, cooperativeScore }) {
  return theoryScore + practiceScore + cooperativeScore;
}
