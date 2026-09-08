import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import CredentialModal from "../../components/CredentialModal";
import { listDepartments, listEligibleDeptHeads, assignDeptHead, listDeptHeads, resetStaffPassword, deactivateDeptHead } from "../../api/resources";

export default function AdminDeptHeads() {
  const [departments, setDepartments] = useState([]);
  const [eligibleTeachers, setEligibleTeachers] = useState([]);
  const [deptHeads, setDeptHeads] = useState([]);
  const [form, setForm] = useState({ teacherId: "", departmentId: "" });
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");

  async function loadAll() {
    setDepartments(await listDepartments());
    setEligibleTeachers(await listEligibleDeptHeads());
    setDeptHeads(await listDeptHeads());
  }
  useEffect(() => { loadAll(); }, []);

  async function handleAssign(e) {
    e.preventDefault();
    setError("");
    try {
      const result = await assignDeptHead(form);
      setModal({
        title: "Department Head Account Created",
        username: result.username,
        tempPassword: result.tempPassword,
      });
      setForm({ teacherId: "", departmentId: "" });
      loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not assign Department Head");
    }
  }

  async function handleReset(userId) {
    const result = await resetStaffPassword(userId);
    setModal({ title: "Password Reset Successful", username: result.username, tempPassword: result.tempPassword });
  }

  async function handleDeactivate(id) {
    await deactivateDeptHead(id);
    loadAll();
  }

  return (
    <DashboardLayout>
      <Card title="Assign Department Head">
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Only existing teachers can be assigned. This creates a separate Department Head login
          (their Teacher account and courses stay untouched).
        </p>
        <form onSubmit={handleAssign} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} required>
            <option value="">Select teacher</option>
            {eligibleTeachers.map((t) => (
              <option key={t.id} value={t.id}>{t.username} — {t.fullName || "no name on file"}</option>
            ))}
          </select>
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
            <option value="">Department to head</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button className="col-span-2 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Assign</button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </Card>

      <Card title="Department Heads">
        <Table
          columns={[
            { key: "username", label: "Username" },
            { key: "fullName", label: "Name" },
            { key: "dept", label: "Department", render: (r) => r.staffProfile?.department?.name },
            { key: "actions", label: "", render: (r) => (
              <div className="flex gap-2">
                <button onClick={() => handleReset(r.id)} className="text-teal-600 text-sm hover:underline">
                  Reset Password
                </button>
                <button onClick={() => handleDeactivate(r.id)} className="text-red-600 text-sm hover:underline">
                  Deactivate
                </button>
              </div>
            ) },
          ]}
          rows={deptHeads}
          emptyLabel="No Department Heads assigned yet"
        />
      </Card>

      <CredentialModal open={!!modal} onClose={() => setModal(null)} {...modal} />
    </DashboardLayout>
  );
}