import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { listDepartments, listRegistrarStudents, getRegistrarStudent } from "../../api/resources";

export default function AdminStudents() {
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  async function loadStudents() {
    setStudents(await listRegistrarStudents({ departmentId: filterDept || undefined, search: search || undefined }));
  }

  useEffect(() => { listDepartments().then(setDepartments); }, []);
  useEffect(() => { loadStudents(); }, [filterDept]);

  async function handleSearch(e) {
    e.preventDefault();
    loadStudents();
  }

  async function openStudent(id) {
    setSelected(await getRegistrarStudent(id));
  }

  return (
    <DashboardLayout>
      <Card
        title="Students"
        action={
          <div className="flex flex-wrap gap-2">
            <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
              value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="">All departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <form onSubmit={handleSearch} className="flex gap-1">
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
                placeholder="Search name/username" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="text-sm bg-teal-600 text-white rounded-lg px-3" type="submit">Go</button>
            </form>
          </div>
        }
      >
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => r.user?.username },
            { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
            { key: "department", label: "Department", render: (r) => r.department?.name },
            { key: "level", label: "Level", render: (r) => r.level?.name },
            { key: "status", label: "Record Status", render: (r) => r.recordStatus },
            { key: "view", label: "", render: (r) => (
              <button onClick={() => openStudent(r.id)} className="text-teal-600 text-sm hover:underline">
                View
              </button>
            ) },
          ]}
          rows={students}
          emptyLabel="No students found"
        />
      </Card>

      {selected && (
        <Card title={`${selected.user.fullName || selected.user.username} — Full Profile`} action={
          <button onClick={() => setSelected(null)} className="text-sm text-slate-500 dark:text-slate-400">Close</button>
        }>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm dark:text-slate-200">
            <p>Username: <span className="font-mono">{selected.user.username}</span></p>
            <p>Sex: {selected.sex || "—"}</p>
            <p>Age: {selected.age || "—"}</p>
            <p>Department: {selected.department.name}</p>
            <p>Level: {selected.level.name}</p>
            <p>Track: {selected.track}</p>
            <p>Nationality: {selected.nationality || "—"}</p>
            <p>Guardian: {selected.guardianName || "—"}</p>
            <p>Residence: {selected.residence || "—"}</p>
            <p>ESLCE GPA: {selected.esclceGpa || "—"}</p>
            <p>National ID: {selected.nationalId || "—"}</p>
            <p>Admission Year: {selected.admissionYear || "—"}</p>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}
