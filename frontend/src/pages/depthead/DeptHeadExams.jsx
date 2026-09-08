import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { useAuth } from "../../context/AuthContext";
import { listLevels, deptHeadListExams, deptHeadExamDecision } from "../../api/resources";

export default function DeptHeadExams() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState("");
  const [exams, setExams] = useState([]);
  const [noteDrafts, setNoteDrafts] = useState({});

  useEffect(() => { listLevels(user.departmentId).then(setLevels); }, [user.departmentId]);

  async function load() { setExams(await deptHeadListExams({ levelId: levelId || undefined })); }
  useEffect(() => { load(); }, [levelId]);

  async function approve(id) {
    await deptHeadExamDecision(id, { decision: "approved" });
    load();
  }

  async function reject(id) {
    const note = noteDrafts[id];
    if (!note?.trim()) return alert("A rejection note is required so the teacher knows what to fix");
    await deptHeadExamDecision(id, { decision: "rejected", rejectionNote: note });
    load();
  }

  return (
    <DashboardLayout>
      <Card title="Exams" action={
        <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
          value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">All levels</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      }>
        <Table
          columns={[
            { key: "title", label: "Title", render: (r) => r.title || "—" },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "teacher", label: "Teacher", render: (r) => r.submittedBy?.username },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open PDF</a> },
            { key: "status", label: "Status", render: (r) => r.status },
            { key: "actions", label: "", render: (r) => r.status === "pending_dept_head" && (
              <div className="flex flex-col gap-1">
                <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-xs w-40"
                  placeholder="Rejection note (if rejecting)"
                  value={noteDrafts[r.id] || ""} onChange={(e) => setNoteDrafts({ ...noteDrafts, [r.id]: e.target.value })} />
                <div className="flex gap-2">
                  <button onClick={() => approve(r.id)} className="text-emerald-600 text-xs hover:underline">Approve</button>
                  <button onClick={() => reject(r.id)} className="text-red-600 text-xs hover:underline">Reject</button>
                </div>
              </div>
            ) },
          ]}
          rows={exams}
          emptyLabel="No exams submitted yet"
        />
      </Card>
    </DashboardLayout>
  );
}
