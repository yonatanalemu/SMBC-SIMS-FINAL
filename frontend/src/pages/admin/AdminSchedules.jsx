import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import FileUpload from "../../components/FileUpload";
import { listDepartments, listSchedules, createSchedule, deleteSchedule } from "../../api/resources";

export default function AdminSchedules() {
  const [departments, setDepartments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [form, setForm] = useState({ departmentId: "", type: "teaching", title: "" });
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => { listDepartments().then(setDepartments); }, []);
  useEffect(() => { listSchedules().then(setSchedules); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setMsg("");
    if (!file) return setMsg("A PDF file is required");
    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      formData.append("file", file);
      await createSchedule(formData);
      setForm({ departmentId: "", type: "teaching", title: "" });
      setFile(null);
      listSchedules().then(setSchedules);
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not upload");
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this schedule? This can't be undone.")) return;
    await deleteSchedule(id);
    listSchedules().then(setSchedules);
  }

  return (
    <DashboardLayout>
      <Card title="Upload Schedule">
        <form onSubmit={handleUpload} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="teaching">Teaching Schedule</option>
            <option value="exam">Exam Schedule</option>
          </select>
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 col-span-2"
            placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div className="col-span-2">
            <FileUpload accept="application/pdf" label="Upload schedule PDF" onFileSelect={setFile} />
          </div>
          <button className="col-span-2 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Upload</button>
          {msg && <p className="col-span-2 text-red-600 text-sm">{msg}</p>}
        </form>
      </Card>

      <Card title="Schedules">
        <Table
          columns={[
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "type", label: "Type" },
            { key: "title", label: "Title", render: (r) => r.title || "—" },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open</a> },
            { key: "actions", label: "", render: (r) => (
              <button onClick={() => handleDelete(r.id)} className="text-red-600 text-sm hover:underline">Delete</button>
            ) },
          ]}
          rows={schedules}
          emptyLabel="No schedules uploaded yet"
        />
      </Card>
    </DashboardLayout>
  );
}