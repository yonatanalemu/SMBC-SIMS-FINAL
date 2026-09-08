// Mirrors backend/src/utils/degree-grade-scale.js (separate frontend/backend
// codebases in this project, no shared package — see grade-scale.js /
// ethiopianCalendar.js for the same pattern elsewhere).
//
// I (Incomplete) and DO (Dropout) carry explicit 0.00 point values on the
// official table, same as F, so they're included in every sum below exactly
// like F — not excluded from GPA the way some schools treat incompletes.
export const DEGREE_GRADE_POINTS = {
  "A+": 4.0, "A": 4.0, "A-": 3.75,
  "B+": 3.5, "B": 3.0, "B-": 2.75,
  "C+": 2.5, "C": 2.0, "C-": 1.75,
  "D": 1.0, "F": 0.0, "I": 0.0, "DO": 0.0,
};

export const DEGREE_LETTER_GRADES = Object.keys(DEGREE_GRADE_POINTS);

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

// Takes semesters already grouped+sorted chronologically (see
// DegreeTranscriptDocument's groupBySemester) and annotates each with:
//   - per-course gradePoints
//   - semesterGPA = total grade points this semester / total credit hours this semester
//   - cumulativeGPA = total grade points through this semester / total credit hours through this semester
// Cumulative GPA is computed progressively (this semester's totals folded
// into a running total carried from all prior semesters), which is the
// standard definition — implemented as described rather than left as a
// guess, per the school's own note that this is the default until/unless
// they say otherwise.
export function computeDegreeSemesterStats(semesters) {
  let cumPoints = 0;
  let cumHours = 0;
  return semesters.map(({ level, grades }) => {
    let semPoints = 0;
    let semHours = 0;
    const rows = grades.map((g) => {
      const hours = g.course.creditHours || 0;
      const gradePoints = computeDegreeGradePoints(g.letterGrade, hours);
      if (gradePoints != null) {
        semPoints += gradePoints;
        semHours += hours;
      }
      return { ...g, gradePoints };
    });
    cumPoints += semPoints;
    cumHours += semHours;
    return {
      level,
      grades: rows,
      semesterCreditHours: semHours,
      semesterGradePoints: semPoints,
      semesterGPA: semHours > 0 ? semPoints / semHours : null,
      cumulativeCreditHours: cumHours,
      cumulativeGradePoints: cumPoints,
      cumulativeGPA: cumHours > 0 ? cumPoints / cumHours : null,
    };
  });
}
