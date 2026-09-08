import { useEffect, useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import CredentialModal from "../../components/CredentialModal";
import StudentsReportDocument from "../../components/StudentsReportDocument";
import {
  listDepartments, listLevels, listRegistrarStudents, resetStudentPassword, updateStudentDetails,
  graduateStudentsInLevel, promoteStudentsInLevel, setStudentActiveStatus, deleteStudent, getStudentsReport,
} from "../../api/resources";
import { formatBothCalendars } from "../../utils/ethiopianCalendar";
import { exportElementToPdf } from "../../utils/pdf";

// HRM/Accounting's "Level 2 Terminal" is a one-year, dead-end path — those
// students finish and graduate after that single year, they never continue
// to Level 2 Diploma/3/4. It isn't the department's highest-`order` level
// (Level 4 is), so it needs its own explicit graduation point alongside the
// generic "final level" check below. Mirrors the backend's
// TVET_TERMINAL_LEVELS guard on POST /students/promote.
const TVET_TERMINAL_GRADUATION_LEVELS = new Set(["Accounting|Level 2 Terminal", "HRM|Level 2 Terminal"]);

// Current, already-active students only — new registrations happen on the
// Registration tab and only land here once approved. Graduated students move
// to the Records tab via the "Graduate Students" action below.
export default function RegistrarStudents() {
  const [departments, setDepartments] = useState([]);
  const [levels, setLevels] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ fullNameAmharic: "", courseStartDate: "", courseEndDate: "" });
  const [graduating, setGraduating] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [reportTrack, setReportTrack] = useState("");
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => { listDepartments().then(setDepartments); }, []);

  useEffect(() => {
    setFilterLevel("");
    if (filterDept) listLevels(filterDept).then(setLevels);
    else setLevels([]);
  }, [filterDept]);

  async function load() {
    setStudents(await listRegistrarStudents({
      recordStatus: "active", departmentId: filterDept || undefined, levelId: filterLevel || undefined,
      search: search || undefined,
    }));
  }
  useEffect(() => { load(); }, [filterDept, filterLevel]);

  // The Graduate Students action appears once the department's FINAL level
  // (highest `order`, not a hardcoded name like "Level 4" or "Year IV
  // Semester II" — those are admin-defined free text) is selected, so it
  // works the same way for TVET and Degree without name-matching — OR once
  // Level 2 Terminal is selected for Accounting/HRM specifically (see the
  // TVET_TERMINAL_GRADUATION_LEVELS note above).
  const selectedLevelObj = levels.find((l) => l.id === filterLevel);
  const isFinalLevel = selectedLevelObj && levels.length > 0 &&
    selectedLevelObj.order === Math.max(...levels.map((l) => l.order));
  const isTerminalGraduationLevel = selectedLevelObj &&
    TVET_TERMINAL_GRADUATION_LEVELS.has(`${selectedLevelObj.department.name}|${selectedLevelObj.name}`);
  const isGraduationLevel = isFinalLevel || isTerminalGraduationLevel;
  // Every other level gets Promote instead — the system has no automatic
  // level-to-level progression otherwise (a student's level is set once at
  // registration and never changes on its own). Terminal is deliberately
  // excluded here even though "Level 2 Diploma" technically has a higher
  // `order` — Terminal isn't a step toward Diploma, they're separate tracks.
  const nextLevelObj = selectedLevelObj && !isGraduationLevel
    ? levels.filter((l) => l.order > selectedLevelObj.order).sort((a, b) => a.order - b.order)[0]
    : null;

  async function handleGraduate() {
    if (!filterLevel) return;
    const activeCount = students.length;
    if (!window.confirm(
      `Move all ${activeCount} active student(s) in ${selectedLevelObj?.name} to Records as graduated? This can't be undone from here.`
    )) return;
    setGraduating(true);
    try {
      const result = await graduateStudentsInLevel(filterLevel);
      window.alert(`${result.graduatedCount} student(s) moved to Records.`);
      load();
    } finally {
      setGraduating(false);
    }
  }

  async function handlePromote() {
    if (!filterLevel || !nextLevelObj) return;
    const activeCount = students.length;
    if (!window.confirm(
      `Move all ${activeCount} active student(s) from ${selectedLevelObj?.name} to ${nextLevelObj.name}?`
    )) return;
    setPromoting(true);
    try {
      const result = await promoteStudentsInLevel(filterLevel);
      window.alert(`${result.promotedCount} student(s) moved from ${result.fromLevel} to ${result.toLevel}.`);
      load();
    } finally {
      setPromoting(false);
    }
  }

  async function handleGenerateReport() {
    if (!reportTrack) return;
    setReportLoading(true);
    try {
      setReport(await getStudentsReport(reportTrack));
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadReport() {
    if (reportRef.current) await exportElementToPdf(reportRef.current, `${reportTrack}-student-report.pdf`);
  }

  async function handleReset(id) {
    const result = await resetStudentPassword(id);
    setModal({ title: "Password Reset Successful", username: result.username, tempPassword: result.tempPassword });
  }

  // Distinct from recordStatus — this toggles login access (User.isActive),
  // enforced at the auth layer, not the interim/active/graduated pipeline.
  async function handleActiveToggle(id, nextValue) {
    await setStudentActiveStatus(id, nextValue === "active");
    load();
  }

  async function handleDelete(r) {
    if (!window.confirm(
      `Permanently delete ${r.user?.fullName || r.user?.username}? This removes their account, grades, invoices, and payment proofs. This can't be undone.`
    )) return;
    await deleteStudent(r.id);
    load();
  }

  function startEdit(r) {
    setEditing(r.id);
    setEditForm({
      fullNameAmharic: r.fullNameAmharic || "",
      courseStartDate: r.courseStartDate ? r.courseStartDate.slice(0, 10) : "",
      courseEndDate: r.courseEndDate ? r.courseEndDate.slice(0, 10) : "",
    });
  }

  async function saveEdit(id) {
    await updateStudentDetails(id, editForm);
    setEditing(null);
    load();
  }

  const fieldClass = "border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-xs";

  return (
    <DashboardLayout>
      <Card title="Students" action={
        <div className="flex flex-wrap gap-2">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
            value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
            value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} disabled={!filterDept}>
            <option value="">{filterDept ? "All levels" : "Select a department first"}</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex gap-1">
            <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
              placeholder="Search name/username" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="text-sm bg-teal-600 text-white rounded-lg px-3" type="submit">Go</button>
          </form>
          {isGraduationLevel && (
            <button onClick={handleGraduate} disabled={graduating || students.length === 0}
              className="text-sm bg-gold-600 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
              {graduating ? "Graduating…" : "GRADUATE STUDENTS"}
            </button>
          )}
          {nextLevelObj && (
            <button onClick={handlePromote} disabled={promoting || students.length === 0}
              className="text-sm bg-teal-700 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
              {promoting ? "Promoting…" : `PROMOTE TO ${nextLevelObj.name.toUpperCase()}`}
            </button>
          )}
          {!filterDept && (
            <>
              <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
                value={reportTrack} onChange={(e) => { setReportTrack(e.target.value); setReport(null); }}>
                <option value="">Report: choose a track</option>
                <option value="tvet">TVET</option>
                <option value="degree">Degree</option>
              </select>
              <button onClick={handleGenerateReport} disabled={!reportTrack || reportLoading}
                className="text-sm bg-navy-950 text-white rounded-lg px-3 py-1.5 disabled:opacity-50">
                {reportLoading ? "Generating…" : "Export Report"}
              </button>
            </>
          )}
        </div>
      }>
        {isTerminalGraduationLevel && (
          <p className="text-xs text-gold-600 mb-3">
            {selectedLevelObj.name} is a one-year program for {selectedLevelObj.department.name} — students here
            never continue to Level 2 Diploma or beyond. "Graduate Students" will move every active student here to
            Records with a status of Graduated. Their registration info is kept as-is, and certificates can still be
            generated for them afterward.
          </p>
        )}
        {isFinalLevel && (
          <p className="text-xs text-gold-600 mb-3">
            {selectedLevelObj.name} is {selectedLevelObj.department.name}'s final level — "Graduate Students" will
            move every active student here to Records with a status of Graduated. Their registration info is kept
            as-is, and certificates can still be generated for them afterward.
          </p>
        )}
        {nextLevelObj && (
          <p className="text-xs text-teal-700 dark:text-teal-400 mb-3">
            "Promote to {nextLevelObj.name}" moves every active student here up to the next level. The system doesn't
            advance students automatically — a level only ever changes when Promote or Graduate Students is used.
          </p>
        )}
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "fullName", label: "Name", render: (r) => (
              <div>
                <p>{r.user?.fullName}</p>
                {r.fullNameAmharic && <p className="text-xs text-ink-muted dark:text-slate-400">{r.fullNameAmharic}</p>}
              </div>
            ) },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "level", label: "Level", render: (r) => r.level?.name },
            { key: "dates", label: "Start / End (G.C. & E.C.)", render: (r) =>
              editing === r.id ? (
                <div className="flex flex-col gap-1">
                  <input type="text" className={fieldClass} placeholder="ስም በአማርኛ (Amharic name)"
                    value={editForm.fullNameAmharic} onChange={(e) => setEditForm({ ...editForm, fullNameAmharic: e.target.value })} />
                  <input type="date" className={fieldClass}
                    value={editForm.courseStartDate} onChange={(e) => setEditForm({ ...editForm, courseStartDate: e.target.value })} />
                  <input type="date" className={fieldClass}
                    value={editForm.courseEndDate} onChange={(e) => setEditForm({ ...editForm, courseEndDate: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => saveEdit(r.id)} className="text-teal-600 text-xs hover:underline">Save</button>
                    <button onClick={() => setEditing(null)} className="text-ink-muted dark:text-slate-400 text-xs hover:underline">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="text-xs">
                  <p>Start: {r.courseStartDate ? formatBothCalendars(r.courseStartDate) : "—"}</p>
                  <p>End: {r.courseEndDate ? formatBothCalendars(r.courseEndDate) : "—"}</p>
                  <button onClick={() => startEdit(r)} className="text-teal-600 hover:underline mt-1">Edit</button>
                </div>
              )
            },
            { key: "status", label: "Login Access", render: (r) => (
              <select
                value={r.user?.isActive === false ? "inactive" : "active"}
                onChange={(e) => handleActiveToggle(r.id, e.target.value)}
                className={`border dark:border-slate-600 rounded px-2 py-1 text-xs ${r.user?.isActive === false ? "text-red-700" : "text-emerald-700"}`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            ) },
            { key: "actions", label: "", render: (r) => (
              <div className="flex items-center gap-3">
                <button onClick={() => handleReset(r.id)} className="text-teal-600 text-sm hover:underline">Reset Password</button>
                <button onClick={() => handleDelete(r)} title="Delete student" aria-label="Delete student"
                  className="text-red-600 hover:text-red-800">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            ) },
          ]}
          rows={students}
          emptyLabel="No active students yet"
        />
      </Card>

      {report && (
        <Card title="Student Population Report" action={
          <button onClick={downloadReport} className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm">Download PDF</button>
        }>
          <div className="border border-navy-950/10 dark:border-slate-700 rounded-xl overflow-x-auto">
            <div className="min-w-[560px]">
              <StudentsReportDocument
                ref={reportRef}
                track={report.track}
                rows={report.rows}
                generatedAt={new Date().toLocaleDateString()}
              />
            </div>
          </div>
        </Card>
      )}

      <CredentialModal open={!!modal} onClose={() => setModal(null)} {...modal} />
    </DashboardLayout>
  );
}
