import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import StatusPill from "../../components/StatusPill";
import AcademicSelector from "../../components/AcademicSelector";
import {
  adminListGrades, adminEditGrade, adminApproveGrade,
  adminListExams, adminExamDecision,
  adminListAttendance, adminExportAttendanceUrl, downloadFile,
  listTeachers,
} from "../../api/resources";
import { DEGREE_LETTER_GRADES } from "../../utils/degreeGradeScale";

export default function AdminGradesAttendance() {
  const { tab } = useParams(); // "grades" | "exams" | "attendance"
  if (!tab) return <Navigate to="/admin/grades-attendance/grades" replace />;

  const [selection, setSelection] = useState({});
  const [grades, setGrades] = useState([]);
  const [exams, setExams] = useState([]);
  const [edits, setEdits] = useState({});

  // Attendance tab: level selection drives the Department/Level shown in the
  // export, teacher selection scopes the actual data — both required.
  const [attendanceSelection, setAttendanceSelection] = useState({});
  const [teachers, setTeachers] = useState([]);
  const [teacherId, setTeacherId] = useState("");
  const [attendance, setAttendance] = useState([]);

  async function loadForSelection(sel) {
    setSelection(sel);
    if (tab === "grades" && sel.courseId) setGrades(await adminListGrades({ courseId: sel.courseId }));
    if (tab === "exams" && sel.courseId) setExams(await adminListExams({ courseId: sel.courseId }));
  }

  async function onAttendanceLevelSelect(sel) {
    setAttendanceSelection(sel);
    setTeacherId("");
    setAttendance([]);
    setTeachers(sel.departmentId ? await listTeachers(sel.departmentId) : []);
  }

  async function onAttendanceTeacherSelect(id) {
    setTeacherId(id);
    if (attendanceSelection.levelId && id) {
      setAttendance(await adminListAttendance({ levelId: attendanceSelection.levelId, teacherId: id }));
    } else {
      setAttendance([]);
    }
  }

  async function saveEdit(gradeId) {
    const e = edits[gradeId];
    if (!e) return;
    await adminEditGrade(gradeId, e);
    setEdits({ ...edits, [gradeId]: undefined });
    loadForSelection(selection);
  }

  async function approveGrade(gradeId) {
    await adminApproveGrade(gradeId);
    loadForSelection(selection);
  }

  async function approveExam(id) {
    await adminExamDecision(id, { decision: "approved" });
    loadForSelection(selection);
  }

  async function rejectExam(id) {
    const note = prompt("Rejection note for the teacher:");
    if (!note?.trim()) return;
    await adminExamDecision(id, { decision: "rejected", rejectionNote: note });
    loadForSelection(selection);
  }

  return (
    <DashboardLayout>
      {tab !== "attendance" && (
        <Card title="Navigate">
          <AcademicSelector mode="course" onSelect={loadForSelection} />
        </Card>
      )}

      {tab === "grades" && (selection.courseId ? (
        <Card title="Grades for this course">
          <Table
            columns={
              selection.track === "degree"
                ? [
                    { key: "student", label: "Student", render: (r) => <span className="id-chip">{r.student?.user?.username}</span> },
                    { key: "teacher", label: "Submitted By", render: (r) => r.submittedBy?.username },
                    { key: "deptHead", label: "Dept Head", render: (r) => r.deptHeadDecisionBy?.username || "—" },
                    { key: "grade", label: "Letter Grade", render: (r) => (
                      <select className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-2 py-1"
                        defaultValue={r.letterGrade || ""}
                        onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], letterGrade: e.target.value } })}>
                        <option value="">—</option>
                        {DEGREE_LETTER_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    ) },
                    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
                    { key: "actions", label: "", render: (r) => (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(r.id)} className="text-teal-600 text-sm hover:underline">Save</button>
                        {r.status === "pending_admin" && (
                          <button onClick={() => approveGrade(r.id)} className="text-teal-700 font-medium text-sm hover:underline">Approve</button>
                        )}
                      </div>
                    ) },
                  ]
                : [
                    { key: "student", label: "Student", render: (r) => <span className="id-chip">{r.student?.user?.username}</span> },
                    { key: "teacher", label: "Submitted By", render: (r) => r.submittedBy?.username },
                    { key: "deptHead", label: "Dept Head", render: (r) => r.deptHeadDecisionBy?.username || "—" },
                    { key: "theory", label: "Theory", render: (r) => (
                      <input type="number" className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1"
                        defaultValue={r.theoryScore}
                        onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], theoryScore: Number(e.target.value) } })} />
                    ) },
                    { key: "practice", label: "Practice", render: (r) => (
                      <input type="number" className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1"
                        defaultValue={r.practiceScore}
                        onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], practiceScore: Number(e.target.value) } })} />
                    ) },
                    { key: "coop", label: "Cooperative", render: (r) => (
                      <input type="number" className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1"
                        defaultValue={r.cooperativeScore}
                        onChange={(e) => setEdits({ ...edits, [r.id]: { ...edits[r.id], cooperativeScore: Number(e.target.value) } })} />
                    ) },
                    { key: "total", label: "Total / Grade", render: (r) => `${r.totalScore} (${r.letterGrade})` },
                    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
                    { key: "actions", label: "", render: (r) => (
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(r.id)} className="text-teal-600 text-sm hover:underline">Save</button>
                        {r.status === "pending_admin" && (
                          <button onClick={() => approveGrade(r.id)} className="text-teal-700 font-medium text-sm hover:underline">Approve</button>
                        )}
                      </div>
                    ) },
                  ]
            }
            rows={grades}
            emptyLabel="No grades submitted for this course yet"
          />
        </Card>
      ) : <p className="text-ink-muted dark:text-slate-400 text-sm">Select a course above to view its grades.</p>)}

      {tab === "exams" && (selection.courseId ? (
        <Card title="Exams for this course">
          <Table
            columns={[
              { key: "teacher", label: "Teacher", render: (r) => r.submittedBy?.username },
              { key: "deptHead", label: "Dept Head", render: (r) => r.deptHeadDecisionBy?.username || "—" },
              { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open PDF</a> },
              { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
              { key: "actions", label: "", render: (r) => r.status === "pending_admin" && (
                <div className="flex gap-2">
                  <button onClick={() => approveExam(r.id)} className="text-teal-700 font-medium text-sm hover:underline">Approve</button>
                  <button onClick={() => rejectExam(r.id)} className="text-red-600 text-sm hover:underline">Reject</button>
                </div>
              ) },
            ]}
            rows={exams}
            emptyLabel="No exams submitted for this course yet"
          />
        </Card>
      ) : <p className="text-ink-muted dark:text-slate-400 text-sm">Select a course above to view its exams.</p>)}

      {tab === "attendance" && (
        <>
          <Card title="Select Department / Level">
            <AcademicSelector mode="level" onSelect={onAttendanceLevelSelect} />
          </Card>

          {attendanceSelection.levelId && (
            <Card title="Select Teacher">
              <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:w-80"
                value={teacherId} onChange={(e) => onAttendanceTeacherSelect(e.target.value)}>
                <option value="">Select teacher</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.fullName || t.username}</option>)}
              </select>
              {teachers.length === 0 && (
                <p className="text-sm text-ink-muted dark:text-slate-400 mt-2">No teachers found in this department.</p>
              )}
            </Card>
          )}

          <Card title="Attendance" action={
            <button onClick={() => downloadFile(adminExportAttendanceUrl({ levelId: attendanceSelection.levelId, teacherId }), "attendance.csv")}
              disabled={!attendanceSelection.levelId || !teacherId}
              className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              Export CSV
            </button>
          }>
            <Table
              columns={[
                { key: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
                { key: "instructor", label: "Instructor", render: (r) => r.instructorName },
                { key: "present", label: "Present / Total", render: (r) => `${r.records.filter((x) => x.present).length} / ${r.records.length}` },
              ]}
              rows={attendance}
              emptyLabel="Select a level and a teacher above to view attendance"
            />
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}