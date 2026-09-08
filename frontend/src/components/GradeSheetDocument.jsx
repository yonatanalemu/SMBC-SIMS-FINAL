import { forwardRef } from "react";
import { degreeGradePointValue } from "../utils/degreeGradeScale";

function degreeStatus(letterGrade) {
  if (letterGrade === "F") return "Fail";
  if (letterGrade === "I") return "Incomplete";
  if (letterGrade === "DO") return "Dropout";
  if (!letterGrade) return "—";
  return "Pass";
}

function fmtPoints(letterGrade) {
  const v = degreeGradePointValue(letterGrade);
  return v == null ? "—" : v.toFixed(2);
}

// Official Registrar printed grade sheet. Border/padding/page-break/@page
// rules live in the shared `.print-table` / `.signature-block` classes in
// index.css — only this document's own column widths and header shading
// are defined locally here.
const GradeSheetDocument = forwardRef(({ grades, departmentName, levelName, courseName, instructorName, track }, ref) => {
  const year = new Date().getFullYear();
  const isDegree = track === "degree";

  return (
    <div ref={ref} className="bg-white text-black p-8" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <style>{`
        .gradesheet-table {
          font-size: 11pt;
          font-family: 'Times New Roman', Times, serif;
        }
        .gradesheet-table th {
          font-weight: bold;
          text-align: center;
          background: #f0f0f0;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .gradesheet-col-no { width: 5%; }
        .gradesheet-col-name { width: 26%; }
        .gradesheet-col-id { width: 12%; }
        /* TVET columns */
        .gradesheet-col-theory { width: 9%; }
        .gradesheet-col-practice { width: 9%; }
        .gradesheet-col-coop { width: 9%; }
        .gradesheet-col-total { width: 9%; }
        .gradesheet-col-status { width: 10%; }
        .gradesheet-col-remark { width: 11%; }
        /* Degree columns */
        .gradesheet-col-credit { width: 10%; }
        .gradesheet-col-lettergrade { width: 12%; }
        .gradesheet-col-gradepoints { width: 12%; }
        .gradesheet-col-degree-status { width: 12%; }
        .gradesheet-col-degree-remark { width: 11%; }
      `}</style>

      <h1 className="text-center font-bold uppercase text-lg mb-3" style={{ letterSpacing: "0.02em" }}>
        Sitti Medical and Business College
      </h1>

      <div className="text-sm mb-4 space-y-0.5">
        <p><span className="font-bold">INSTRUCTOR NAME:</span> {instructorName || "—"}</p>
        <p>
          <span className="font-bold">DEPARTMENT:</span> {departmentName || "—"}
          {"   |   "}<span className="font-bold">LEVEL:</span> {levelName || "—"}
          {"   |   "}REGULAR
          {"   |   "}<span className="font-bold">YEAR:</span> {year}
        </p>
        <p><span className="font-bold">COURSE:</span> {courseName || "—"}</p>
      </div>

      <table className="gradesheet-table print-table">
        <colgroup>
          <col className="gradesheet-col-no" />
          <col className="gradesheet-col-name" />
          <col className="gradesheet-col-id" />
          {isDegree ? (
            <>
              <col className="gradesheet-col-credit" />
              <col className="gradesheet-col-lettergrade" />
              <col className="gradesheet-col-gradepoints" />
              <col className="gradesheet-col-degree-status" />
              <col className="gradesheet-col-degree-remark" />
            </>
          ) : (
            <>
              <col className="gradesheet-col-theory" />
              <col className="gradesheet-col-practice" />
              <col className="gradesheet-col-coop" />
              <col className="gradesheet-col-total" />
              <col className="gradesheet-col-status" />
              <col className="gradesheet-col-remark" />
            </>
          )}
        </colgroup>
        <thead>
          <tr>
            <th>NO</th>
            <th>NAME OF STUDENT</th>
            <th>ID NO</th>
            {isDegree ? (
              <>
                <th>Cr. Hrs</th>
                <th>Letter Grade</th>
                <th>Grade Points</th>
                <th>Status</th>
                <th>Remark</th>
              </>
            ) : (
              <>
                <th>Class theory<br />30%</th>
                <th>Class practice<br />40%</th>
                <th>Cooperative<br />30%</th>
                <th>Total<br />100%</th>
                <th>Status</th>
                <th>Remark</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {grades.map((g, i) => (
            <tr key={g.id}>
              <td style={{ textAlign: "center" }}>{i + 1}.</td>
              <td style={{ textAlign: "left" }}>{g.student?.user?.fullName || g.student?.user?.username}</td>
              <td style={{ textAlign: "center" }}>{g.student?.user?.username}</td>
              {isDegree ? (
                <>
                  <td style={{ textAlign: "center" }}>{g.course?.creditHours ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{g.letterGrade || "—"}</td>
                  <td style={{ textAlign: "center" }}>{fmtPoints(g.letterGrade)}</td>
                  <td style={{ textAlign: "center" }}>{degreeStatus(g.letterGrade)}</td>
                  <td style={{ textAlign: "center" }}>{g.letterGrade || "—"}</td>
                </>
              ) : (
                <>
                  <td style={{ textAlign: "center" }}>{g.theoryScore ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{g.practiceScore ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{g.cooperativeScore ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{g.totalScore ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{g.letterGrade === "F" ? "Fail" : "Pass"}</td>
                  <td style={{ textAlign: "center" }}>{g.letterGrade || "—"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="signature-block grid grid-cols-2 gap-4 text-sm">
        <p>Instructor Signature: ____________________</p>
        <p>Registrar Signature: ____________________</p>
      </div>
    </div>
  );
});

GradeSheetDocument.displayName = "GradeSheetDocument";
export default GradeSheetDocument;