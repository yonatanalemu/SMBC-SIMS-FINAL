import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { useAuth } from "../../context/AuthContext";
import { listLevels, deptHeadListAttendance } from "../../api/resources";

export default function DeptHeadAttendance() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState("");
  const [sessions, setSessions] = useState([]);

  useEffect(() => { listLevels(user.departmentId).then(setLevels); }, [user.departmentId]);
  useEffect(() => { deptHeadListAttendance(levelId || undefined).then(setSessions); }, [levelId]);

  return (
    <DashboardLayout>
      <Card title="Attendance" action={
        <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
          value={levelId} onChange={(e) => setLevelId(e.target.value)}>
          <option value="">All levels</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      }>
        <Table
          columns={[
            { key: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
            { key: "instructor", label: "Instructor" , render: (r) => r.instructorName },
            { key: "teacher", label: "Teacher", render: (r) => r.teacher?.username },
            { key: "present", label: "Present / Total", render: (r) => `${r.records.filter((x) => x.present).length} / ${r.records.length}` },
          ]}
          rows={sessions}
          emptyLabel="No attendance submitted yet"
        />
      </Card>
    </DashboardLayout>
  );
}
