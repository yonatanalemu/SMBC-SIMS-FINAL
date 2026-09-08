import { forwardRef } from "react";
import { computeDegreeSemesterStats } from "../utils/degreeGradeScale";

// `student` shape: { user: {fullName, username}, grandfatherName, placeOfBirth,
//   dateOfBirth, admissionClassification, courseStartDate, courseEndDate,
//   department: {name}, grades: [{course:{code, courseNo, name, creditHours,
//   level:{id, name, order}}, letterGrade}] }
//
// `levelId`: optional. "all" (default) shows every semester section. A
// specific level id shows only that section — but the grouping/GPA math
// below always runs over the FULL grade history first, so switching the
// filter never changes any number (Semester/Cumulative GPA), only which
// section is visible.
//
// Grade Pts. / Semester G.P.A / Cumulative G.P.A and the Summary's Total
// Grade Point / Cumulative Average are computed via
// utils/degreeGradeScale.js's computeDegreeSemesterStats — see that file for
// the formulas (Grade Point = Credit Hours x Letter Grade Value; Semester
// GPA = semester's total grade points / semester's total credit hours;
// Cumulative GPA = running total of both, carried forward semester to
// semester). The letter-grade-to-points table there is the school's own.

function fmt2(n) {
  return n == null ? "—" : n.toFixed(2);
}

function formatDMY(input) {
  if (!input) return "—";
  const d = input instanceof Date ? input : new Date(input);
  const day = d.getDate();
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${day}, ${month}, ${d.getFullYear()}`;
}

function degreeTitle(departmentName) {
  if (!departmentName) return "—";
  if (departmentName.startsWith("BSc ")) return `Bachelor of Science in ${departmentName.slice(4).toUpperCase()}`;
  if (departmentName.startsWith("BA ")) return `Bachelor of Arts in ${departmentName.slice(3).toUpperCase()}`;
  return departmentName;
}

function groupBySemester(grades) {
  const byLevel = new Map();
  for (const g of grades) {
    const level = g.course.level;
    if (!byLevel.has(level.id)) byLevel.set(level.id, { level, grades: [] });
    byLevel.get(level.id).grades.push(g);
  }
  return [...byLevel.values()].sort((a, b) => a.level.order - b.level.order);
}

const DegreeTranscriptDocument = forwardRef(({ student, levelId = "all" }, ref) => {
  // Computed over the FULL grade history unconditionally — Cumulative GPA
  // must always reflect everything up to that point, never just whichever
  // semester happens to be visible right now.
  const semesters = computeDegreeSemesterStats(groupBySemester(student.grades));
  const visibleSemesters = levelId === "all" ? semesters : semesters.filter((s) => s.level.id === levelId);
  // Summary block below always reflects the true, all-time final semester —
  // filtering the sections shown never changes the official cumulative totals.
  const final = semesters[semesters.length - 1];

  return (
    <div ref={ref} className="bg-white text-black p-8" style={{ fontFamily: "Times New Roman, Times, serif" }}>
      <div className="text-center mb-4">
        <h2 className="font-bold text-lg">SITTI MEDICAL AND BUSINESS COLLEGE</h2>
        <p className="text-sm">OFFICE OF REGISTRAR STUDENT ACADEMIC RECORD</p>
        <p className="text-xs">TEL:-+ 0254-112038 *P.O.Box 409 Dire Dawa, Ethiopia Email: info@smbcet.org</p>
      </div>

      <div className="grid grid-cols-2 gap-x-6 text-sm mb-4">
        <div className="space-y-0.5">
          <p>❖ Name: {student.user.fullName || student.user.username}</p>
          <p>❖ Grand Father Name:- {student.grandfatherName || "—"}</p>
          <p>❖ Place of Birth :- {student.placeOfBirth || "—"}</p>
          <p>❖ ID. Number: {student.user.username}</p>
          <p>❖ Date of Birth : {student.dateOfBirth ? new Date(student.dateOfBirth).getFullYear() : "—"}</p>
        </div>
        <div className="space-y-0.5">
          <p>❖ Admission classification:- {student.admissionClassification === "extension" ? "Extension" : "Regular"}</p>
          <p>❖ Admission Date:- {formatDMY(student.courseStartDate)}</p>
          <p>❖ Department:- {student.department.name.toUpperCase()}</p>
          <p>❖ Degree:- {degreeTitle(student.department.name)}</p>
        </div>
      </div>

      {visibleSemesters.map(({ level, grades, semesterGPA, cumulativeGPA }) => (
        <table key={level.id} className="print-table text-xs mb-3">
          <thead>
            <tr>
              <th colSpan={6} className="text-center font-bold">{level.name}</th>
            </tr>
            <tr className="bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <th>course code</th>
              <th>course No.</th>
              <th>Course Title</th>
              <th>Cr. Hrs</th>
              <th>Grade</th>
              <th>Grade Pts.</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td className="text-center">{g.course.code || "—"}</td>
                <td className="text-center">{g.course.courseNo || "—"}</td>
                <td>{g.course.name}</td>
                <td className="text-center">{g.course.creditHours ?? "—"}</td>
                <td className="text-center">{g.letterGrade || "—"}</td>
                <td className="text-center">{fmt2(g.gradePoints)}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td colSpan={5} className="text-right">Semester&nbsp;&nbsp;G P A =</td>
              <td className="text-center">{fmt2(semesterGPA)}</td>
            </tr>
            <tr className="font-medium">
              <td colSpan={5} className="text-right">Cumulative G P A =</td>
              <td className="text-center">{fmt2(cumulativeGPA)}</td>
            </tr>
          </tbody>
        </table>
      ))}

      {visibleSemesters.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">
          {semesters.length === 0 ? "No approved grades yet" : "No approved grades yet for this semester"}
        </p>
      )}

      <div className="signature-block border border-black p-3 text-sm">
        <p className="font-bold mb-1">Summary</p>
        <p>Total hours: {final ? final.cumulativeCreditHours : "—"}</p>
        <p>Total Grade point:- {final ? fmt2(final.cumulativeGradePoints) : "—"}</p>
        <p>Cumulative Average:- {final ? fmt2(final.cumulativeGPA) : "—"}</p>
        <p>
          {degreeTitle(student.department.name).split(" in ")[0]} Degree Granted:-{" "}
          {student.courseEndDate ? formatDMY(student.courseEndDate) : "Pending"}
        </p>
        <p>I certify that this to be a true copy</p>
        <div className="grid grid-cols-2 gap-4 mt-6">
          <p>College Registrar Signature ____________________</p>
          <p>Date ____________________</p>
        </div>
      </div>

      <p className="text-[10px] text-center mt-4 leading-tight">
        Grading system: A=Excellent, B+=Very Good, C=Satisfactory, D=Unsatisfactory, F=Failing, I=Incomplete, Do=Dropout.
        <br />
        Points: A=4, A-=3.75, B+=3.5, B=3, B-=2.75, C+=2.5, C=2, C-=1.75, D=1, F=0.
        <br />
        THIS TRANSCRIPT IS OFFICIAL ONLY WHEN SIGNED AND SEALED AND BY THE REGISTRAR
      </p>
    </div>
  );
});

DegreeTranscriptDocument.displayName = "DegreeTranscriptDocument";
export default DegreeTranscriptDocument;