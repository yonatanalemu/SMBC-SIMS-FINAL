import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import { getAdminDashboard } from "../../api/resources";

function KpiCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="font-display text-2xl font-semibold dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { getAdminDashboard().then(setData); }, []);

  if (!data) return <DashboardLayout><p className="dark:text-slate-300">Loading…</p></DashboardLayout>;

  const avgAge = data.ages.length ? (data.ages.reduce((a, b) => a + b, 0) / data.ages.length).toFixed(1) : "—";

  return (
    <DashboardLayout>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Total Students" value={data.totalStudents} />
        <KpiCard label="Male / Female" value={`${data.genderBreakdown.male} / ${data.genderBreakdown.female}`} />
        <KpiCard label="Total Teachers" value={data.totalTeachers} />
        <KpiCard label="Total Dept Heads" value={data.totalDeptHeads} />
      </div>

      <Card title="Age Distribution">
        <p className="text-sm dark:text-slate-300">
          Average age: <span className="font-medium">{avgAge}</span> across {data.ages.length} students with age on file.
        </p>
      </Card>
    </DashboardLayout>
  );
}
