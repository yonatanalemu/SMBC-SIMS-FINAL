import { forwardRef } from "react";
import smbcLogo from "../assets/smbc-logo.png";

function occupationalStandardLevel(student) {
  return student.programType === "level2_terminal" ? "Level 2" : "Level 4";
}

function groupByLevel(grades) {
  const byLevel = new Map();
  for (const g of grades) {
    const level = g.course.level;
    if (!byLevel.has(level.id)) byLevel.set(level.id, { level, grades: [] });
    byLevel.get(level.id).grades.push(g);
  }
  return [...byLevel.values()].sort((a, b) => (a.level.order ?? 0) - (b.level.order ?? 0));
}

function levelHours(grades) {
  return grades.reduce((sum, g) => sum + (g.theoryScore || 0) + (g.practiceScore || 0) + (g.cooperativeScore || 0), 0);
}

const TranscriptDocument = forwardRef(({ student, levelId = "all" }, ref) => {
  const allSections = groupByLevel(student.grades);
  const cumulativeHours = levelHours(student.grades);
  const visibleSections = levelId === "all" ? allSections : allSections.filter((s) => s.level.id === levelId);

  return (
    <div ref={ref} className="bg-white text-black p-8" style={{ fontFamily: "Public Sans, sans-serif" }}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-xs">☎ 0254-112038</p>
          <p className="text-xs">E-Mail: contact@smbc.edu.et</p>
        </div>
        <img src={smbcLogo} alt="SMBC" className="h-14 w-auto" style={{ filter: "invert(1)" }} />
        <div className="w-16 h-20 border border-black flex items-center justify-center text-[8px] text-center">
          PHOTO 4X3
        </div>
      </div>

      <p className="text-xs text-right mb-2">Dire Dawa - Ethiopia</p>

      <h2 className="text-center font-bold text-lg mb-1">TVET TRAINING PROGRAMME</h2>

      <div className="text-sm mb-4 space-y-0.5">
        <p>❖ NAME OF THE TRAINEE:- {student.user.fullName || student.user.username}</p>
        <p>❖ SEX:- {student.sex || "—"}</p>
        <p>❖ ID NO:- {student.user.username}</p>
        <p>❖ ADMISSION YEAR:- {student.admissionYear || "—"}</p>
        <p>❖ DATE OF BIRTH:- {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "—"}</p>
        <p>❖ DEPARTMENT:- {student.department.name}</p>
        <p>❖ Occupational standard:- {student.department.name} ({occupationalStandardLevel(student)})</p>
      </div>

      {visibleSections.map(({ level, grades }) => (
        <table key={level.id} className="print-table text-xs mb-3">
          <thead>
            <tr>
              <th colSpan={8} className="text-center font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
                {level.name}
              </th>
            </tr>
            <tr className="bg-gray-200" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <th>No</th>
              <th>Unit competency</th>
              <th>Code</th>
              <th>Theory</th>
              <th>Practical</th>
              <th>Cooperative</th>
              <th>Total</th>
              <th>Remark</th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g, i) => (
              <tr key={g.id || i}>
                <td className="text-center">{i + 1}</td>
                <td>{g.course.name}</td>
                <td>{g.course.code || "—"}</td>
                <td className="text-center">{g.theoryScore}</td>
                <td className="text-center">{g.practiceScore}</td>
                <td className="text-center">{g.cooperativeScore}</td>
                <td className="text-center">{g.totalScore}</td>
                <td className="text-center font-medium">{g.letterGrade}</td>
              </tr>
            ))}
            <tr className="font-medium">
              <td colSpan={6}>Level Total Hours</td>
              <td className="text-center" colSpan={2}>{levelHours(grades)}</td>
            </tr>
          </tbody>
        </table>
      ))}

      {visibleSections.length === 0 && (
        <p className="text-center text-gray-500 text-sm py-6">No approved grades yet</p>
      )}

      {allSections.length > 1 && (
        <div className="border border-black p-2 text-sm font-medium mb-4">
          Cumulative Total Hours (All Levels): {cumulativeHours}
        </div>
      )}

      <div className="signature-block grid grid-cols-2 gap-4 text-sm">
        <p>REGISTRAR ____________________</p>
        <p>DATE OF ISSUE ____________________</p>
      </div>
    </div>
  );
});

TranscriptDocument.displayName = "TranscriptDocument";
export default TranscriptDocument;