import { useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import AcademicSelector from "../../components/AcademicSelector";
import GradeSheetDocument from "../../components/GradeSheetDocument";
import { listApprovedGradesForRegistrar } from "../../api/resources";
import { exportElementToPdf } from "../../utils/pdf";

export default function RegistrarGrades() {
  const [selection, setSelection] = useState({});
  const [grades, setGrades] = useState([]);
  const sheetRef = useRef(null);

  async function onSelect(sel) {
    setSelection(sel);
    setGrades(await listApprovedGradesForRegistrar({
      courseId: sel.courseId || undefined,
      levelId: !sel.courseId ? sel.levelId || undefined : undefined,
      departmentId: !sel.courseId && !sel.levelId ? sel.departmentId || undefined : undefined,
    }));
  }

  // The printable sheet is scoped to one course — pull its meta straight
  // off the fetched grades rather than re-fetching, so the header can never
  // disagree with the rows underneath it.
  const isSingleCourse = !!selection.courseId;
  const first = grades[0];
  const courseName = first?.course?.name;
  const track = first?.course?.level?.department?.track;
  const levelName = first?.course?.level?.name;
  const departmentName = first?.course?.level?.department?.name;
  const instructorName = first?.course?.teacher?.fullName || first?.course?.teacher?.username;
  const canGenerateSheet = isSingleCourse && grades.length > 0;
  function handlePrint() {
    window.print();
  }

  async function handleDownloadPdf() {
    if (sheetRef.current) {
      await exportElementToPdf(sheetRef.current, `${courseName || "grade-sheet"}.pdf`);
    }
  }

  return (
    <DashboardLayout>
      <p className="text-sm text-ink-muted dark:text-slate-400 mb-4">
        Approved grades only — view and export access. Editing happens upstream with Admin.
        TVET: Department → Level → Course. Degree: Department → Year/Semester → Course.
        Drill all the way down to a specific course to generate the official printable grade sheet.
      </p>
      <Card title="Navigate">
        <AcademicSelector mode="course" onSelect={onSelect} />
      </Card>

      <Card title="Approved Grades">
        <Table
          columns={[
            { key: "student", label: "Student ID", render: (r) => <span className="id-chip">{r.student?.user?.username}</span> },
            { key: "name", label: "Name", render: (r) => r.student?.user?.fullName || "—" },
            { key: "dept", label: "Department", render: (r) => r.course?.level?.department?.name },
            { key: "level", label: "Level", render: (r) => r.course?.level?.name },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "theory", label: "Theory", render: (r) => r.theoryScore ?? "—" },
            { key: "practice", label: "Practice", render: (r) => r.practiceScore ?? "—" },
            { key: "cooperative", label: "Cooperative", render: (r) => r.cooperativeScore ?? "—" },
            { key: "total", label: "Total / Grade", render: (r) => r.totalScore != null ? `${r.totalScore} (${r.letterGrade})` : (r.letterGrade || "—") },
          ]}
          rows={grades}
          emptyLabel="Select a department (and drill down) above to view approved grades"
        />
      </Card>

      <Card title="Official Grade Sheet" action={
        canGenerateSheet ? (
          <div className="flex gap-2">
            <button onClick={handlePrint} className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5">
              Print
            </button>
            <button onClick={handleDownloadPdf} className="text-sm bg-navy-950 text-white rounded-lg px-3 py-1.5">
              Download PDF
            </button>
          </div>
        ) : null
      }>
        {!isSingleCourse && (
          <p className="text-sm text-gold-600">
            Select a specific course above (not just a department or level) to generate the official
            grade sheet — the printed format is one course per sheet.
          </p>
        )}
        {isSingleCourse && grades.length === 0 && (
          <p className="text-sm text-gold-600">No approved grades yet for this course — nothing to print.</p>
        )}
        {canGenerateSheet && (
          <div id="grade-sheet-print-area" className="border dark:border-slate-700 overflow-x-auto">
            <GradeSheetDocument
              ref={sheetRef}
              grades={grades}
              departmentName={departmentName}
              levelName={levelName}
              courseName={courseName}
              instructorName={instructorName}
              track={track}
            />
          </div>
        )}
      </Card>

      {/* Print isolation: hides the rest of the dashboard (sidebar, other
          cards, the on-screen grades table above) so only the official
          sheet comes out of the printer / "Save as PDF" dialog. Scoped
          entirely to @media print — has zero effect on normal screen use. */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #grade-sheet-print-area, #grade-sheet-print-area * { visibility: visible; }
          #grade-sheet-print-area {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            border: none !important;
          }
        }
      `}</style>
    </DashboardLayout>
  );
}