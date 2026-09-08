import { useRef, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import AcademicSelector from "../../components/AcademicSelector";
import TranscriptDocument from "../../components/TranscriptDocument";
import DegreeTranscriptDocument from "../../components/DegreeTranscriptDocument";
import { listRegistrarStudents, getTranscript } from "../../api/resources";
import { exportElementToPdf } from "../../utils/pdf";

export default function RegistrarTranscripts() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [browseResults, setBrowseResults] = useState([]);
  const [student, setStudent] = useState(null);
  const [levelFilter, setLevelFilter] = useState("all");
  const docRef = useRef(null);

  async function handleSearch(e) {
    e.preventDefault();
    // Includes graduated students too — a transcript is a permanent record
    // and may well be needed long after a student has finished.
    setResults(await listRegistrarStudents({ search: search || undefined, recordStatus: "active,graduated" }));
  }

  // Track/Department/Level browse — the quicker path when the registrar
  // knows which cohort they need rather than one specific name/username.
  // "graduated" comes from AcademicSelector's showGraduated option: a
  // distinct choice from a real level, so currently-enrolled Level 4
  // students and already-graduated former Level 4 students never get mixed
  // together in the same browse result.
  async function handleBrowse({ departmentId, levelId, graduated }) {
    if (graduated) {
      setBrowseResults(await listRegistrarStudents({ departmentId, recordStatus: "graduated" }));
      return;
    }
    setBrowseResults(levelId ? await listRegistrarStudents({ levelId, recordStatus: "active" }) : []);
  }

  async function openTranscript(id) {
    setLevelFilter("all"); // reset the section filter for the newly opened student
    setStudent(await getTranscript(id));
  }

  async function download() {
    if (docRef.current) {
      const suffix = levelFilter === "all" ? "" : `-${levelFilter}`;
      await exportElementToPdf(docRef.current, `${student.user.username}-transcript${suffix}.pdf`);
    }
  }

  const Document = student?.track === "degree" ? DegreeTranscriptDocument : TranscriptDocument;

  // Levels present in this student's grade history, in curriculum order —
  // the source list for the "which level's section" dropdown. Distinct from
  // the student's CURRENT level: this covers every level they've ever taken
  // approved courses in, so a graduated student's full history is browsable.
  const levelOptions = student
    ? [...new Map(student.grades.map((g) => [g.course.level.id, g.course.level])).values()]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  return (
    <DashboardLayout>
      <Card title="Browse by Track / Department / Level">
        <AcademicSelector mode="level" onSelect={handleBrowse} compact showGraduated />
        {browseResults.length > 0 && (
          <div className="mt-4">
            <Table
              columns={[
                { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
                { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
                { key: "dept", label: "Department", render: (r) => r.department?.name },
                { key: "status", label: "Level / Status", render: (r) => (
                  r.recordStatus === "graduated"
                    ? <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Graduated</span>
                    : r.level?.name
                ) },
                { key: "view", label: "", render: (r) => (
                  <button onClick={() => openTranscript(r.id)} className="text-teal-600 text-sm hover:underline">
                    Generate Transcript
                  </button>
                ) },
              ]}
              rows={browseResults}
              emptyLabel="No students found"
            />
          </div>
        )}
      </Card>

      <Card title="Find Student">
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 flex-1"
            placeholder="Search by name or username" value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Search</button>
        </form>
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "status", label: "Level / Status", render: (r) => (
              r.recordStatus === "graduated"
                ? <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Graduated</span>
                : r.level?.name
            ) },
            { key: "view", label: "", render: (r) => (
              <button onClick={() => openTranscript(r.id)} className="text-teal-600 text-sm hover:underline">
                Generate Transcript
              </button>
            ) },
          ]}
          rows={results}
          emptyLabel="Search to find a student"
        />
      </Card>

      {student && (
        <Card title="Transcript" action={
          <div className="flex flex-wrap items-center gap-2">
            {levelOptions.length > 1 && (
              <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1.5 text-sm"
                value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
                <option value="all">All Levels (full transcript)</option>
                {levelOptions.map((l) => <option key={l.id} value={l.id}>{l.name} only</option>)}
              </select>
            )}
            <button onClick={download} className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm">Download PDF</button>
          </div>
        }>
          <div className="border border-navy-950/10 dark:border-slate-700 rounded-xl overflow-x-auto">
            <div className="min-w-[720px]">
              <Document ref={docRef} student={student} levelId={levelFilter} />
            </div>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}