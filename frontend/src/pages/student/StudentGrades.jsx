import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import TranscriptDocument from "../../components/TranscriptDocument";
import DegreeTranscriptDocument from "../../components/DegreeTranscriptDocument";
import { studentTranscript } from "../../api/resources";

// Read-only — students can view their grades here but can no longer download
// a PDF themselves; only the Registrar can generate/download the official
// transcript (see RegistrarTranscripts.jsx).
export default function StudentGrades() {
  const [student, setStudent] = useState(null);
  const [levelFilter, setLevelFilter] = useState("all");

  useEffect(() => { studentTranscript().then(setStudent); }, []);

  if (!student) return <DashboardLayout><p className="dark:text-slate-300">Loading…</p></DashboardLayout>;

  const Document = student.track === "degree" ? DegreeTranscriptDocument : TranscriptDocument;

  // Levels the student has approved grades in, in curriculum order — same
  // source list RegistrarTranscripts.jsx uses, so a promoted student sees
  // their prior level's courses stay separate from their current one here too.
  const levelOptions = [...new Map(student.grades.map((g) => [g.course.level.id, g.course.level])).values()]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <DashboardLayout>
      <Card title="My Grades" action={
        levelOptions.length > 1 ? (
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1.5 text-sm"
            value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="all">All Levels</option>
            {levelOptions.map((l) => <option key={l.id} value={l.id}>{l.name} only</option>)}
          </select>
        ) : null
      }>
        <div className="border border-navy-950/10 dark:border-slate-700 rounded-xl overflow-x-auto">
          <div className="min-w-[720px]">
            <Document student={student} levelId={levelFilter} />
          </div>
        </div>
      </Card>
    </DashboardLayout>
  );
}