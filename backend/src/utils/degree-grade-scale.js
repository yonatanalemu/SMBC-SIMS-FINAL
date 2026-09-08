// Degree track's official letter-grade -> GPA-points table (distinct from
// TVET's theory/practice/cooperative score-scale in grade-scale.js — Degree
// courses only ever get a single letter grade directly from the teacher,
// no computed score breakdown).
//
// I (Incomplete) and DO (Dropout) are given explicit 0.00 point values on
// the official table, same as F — so they're treated identically to F in
// every calculation below (counted in both grade points and credit hours,
// not excluded), per the school's own table rather than a guessed
// "excluded from GPA" convention.
export const DEGREE_GRADE_POINTS = {
  "A+": 4.0, "A": 4.0, "A-": 3.75,
  "B+": 3.5, "B": 3.0, "B-": 2.75,
  "C+": 2.5, "C": 2.0, "C-": 1.75,
  "D": 1.0, "F": 0.0, "I": 0.0, "DO": 0.0,
};

export const DEGREE_LETTER_GRADES = Object.keys(DEGREE_GRADE_POINTS);

export function isValidDegreeLetterGrade(value) {
  return DEGREE_LETTER_GRADES.includes(value);
}

export function degreeGradePointValue(letterGrade) {
  return Object.prototype.hasOwnProperty.call(DEGREE_GRADE_POINTS, letterGrade)
    ? DEGREE_GRADE_POINTS[letterGrade]
    : null;
}

// Grade Point (per course) = Credit Hours x Letter Grade Value
export function computeDegreeGradePoints(letterGrade, creditHours) {
  const value = degreeGradePointValue(letterGrade);
  if (value == null || !creditHours) return null;
  return value * creditHours;
}
