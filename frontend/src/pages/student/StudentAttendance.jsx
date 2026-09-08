import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { studentAttendance } from "../../api/resources";

const RANGES = { week: 7, month: 30, year: 365, all: Infinity };

export default function StudentAttendance() {
  const [records, setRecords] = useState([]);
  const [range, setRange] = useState("month");

  useEffect(() => { studentAttendance().then(setRecords); }, []);

  const cutoff = Date.now() - RANGES[range] * 86400000;
  const filtered = records.filter((r) => range === "all" || new Date(r.session.date).getTime() >= cutoff);
  const present = filtered.filter((r) => r.present).length;
  const absent = filtered.length - present;

  return (
    <DashboardLayout>
      <div className="flex gap-2 mb-4">
        {["week", "month", "year", "all"].map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 text-sm rounded ${range === r ? "bg-slate-900 text-white" : "bg-white dark:bg-slate-800 dark:text-slate-200 border dark:border-slate-700"}`}>
            {r === "week" ? "This Week" : r === "month" ? "This Month" : r === "year" ? "This Year" : "All Time"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Present Days</p>
          <p className="text-2xl font-semibold text-teal-600">{present}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Absent Days</p>
          <p className="text-2xl font-semibold text-red-600">{absent}</p>
        </div>
      </div>

      <Card title="Attendance Log">
        <Table
          columns={[
            { key: "date", label: "Date", render: (r) => new Date(r.session.date).toLocaleDateString() },
            { key: "instructor", label: "Instructor", render: (r) => r.session.instructorName },
            { key: "present", label: "Status", render: (r) => (
              <span className={r.present ? "text-teal-600" : "text-red-600"}>{r.present ? "Present" : "Absent"}</span>
            ) },
          ]}
          rows={filtered}
          emptyLabel="No attendance recorded yet"
        />
      </Card>
    </DashboardLayout>
  );
}
