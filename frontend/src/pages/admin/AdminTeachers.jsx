import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import CredentialModal from "../../components/CredentialModal";
import AcademicSelector from "../../components/AcademicSelector";
import { listDepartments, createTeacher, listTeachers, deactivateTeacher, resetStaffPassword, assignCourseTeacher } from "../../api/resources";

const fieldClass = "border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm";

export default function AdminTeachers() {
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ departmentId: "", fullName: "", email: "", phone: "" });
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");
  const [courseModalTeacher, setCourseModalTeacher] = useState(null);

  const [assignSelection, setAssignSelection] = useState({});
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignMsg, setAssignMsg] = useState("");

  async function loadAll() {
    setDepartments(await listDepartments());
    setTeachers(await listTeachers());
  }
  useEffect(() => { loadAll(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    try {
      const result = await createTeacher(form);
      setModal({ title: "Teacher Account Created", username: result.username, tempPassword: result.tempPassword });
      setForm({ departmentId: "", fullName: "", email: "", phone: "" });
      loadAll();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not create teacher");
    }
  }

  async function handleReset(userId) {
    const result = await resetStaffPassword(userId);
    setModal({ title: "Password Reset Successful", username: result.username, tempPassword: result.tempPassword });
  }

  async function handleDeactivate(id) {
    await deactivateTeacher(id);
    loadAll();
  }

  async function handleAssign(e) {
    e.preventDefault();
    setAssignMsg("");
    if (!assignSelection.courseId || !assignTeacherId) {
      return setAssignMsg("Select a course (all the way down) and a teacher");
    }
    await assignCourseTeacher(assignSelection.courseId, assignTeacherId);
    setAssignMsg("Assigned.");
    setAssignTeacherId("");
    loadAll();
  }

  // Teachers in the selected course's department, so the picker stays relevant —
  // falls back to every teacher if no department is selected yet.
  const eligibleTeachers = assignSelection.departmentId
    ? teachers.filter((t) => t.staffProfile?.department?.id === assignSelection.departmentId)
    : teachers;

  return (
    <DashboardLayout>
      <Card title="Add Teacher">
        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <select className={fieldClass}
            value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} required>
            <option value="">Select department</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input className={fieldClass}
            placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <input className={fieldClass}
            placeholder="Email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className={fieldClass}
            placeholder="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <button className="col-span-2 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Create Teacher</button>
        </form>
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </Card>

      <Card title="Assign Course to Teacher">
        <p className="text-xs text-ink-muted dark:text-slate-400 mb-3">
          TVET or Degree → Department → Level (or Year/Semester) → Course — or just search for the course by name.
        </p>
        <form onSubmit={handleAssign} className="space-y-3">
          <AcademicSelector mode="course" onSelect={setAssignSelection} />
          <div className="flex gap-2">
            <select className={`${fieldClass} flex-1`} value={assignTeacherId} onChange={(e) => setAssignTeacherId(e.target.value)}>
              <option value="">Select teacher</option>
              {eligibleTeachers.map((t) => <option key={t.id} value={t.id}>{t.username} — {t.fullName || "no name on file"}</option>)}
            </select>
            <button className="bg-teal-600 text-white rounded-lg px-5 py-2 text-sm" type="submit">Assign</button>
          </div>
          {assignMsg && <p className="text-sm text-ink-muted dark:text-slate-300">{assignMsg}</p>}
        </form>
      </Card>

      <Card title="Teachers">
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.username}</span> },
            { key: "fullName", label: "Name" },
            { key: "dept", label: "Department", render: (r) => r.staffProfile?.department?.name },
           { key: "courses", label: "Courses", render: (r) => {
              const count = r.taughtCourses?.length || 0;
              if (!count) return "—";
              const ongoing = r.taughtCourses.filter((c) => c.status !== "completed").length;
              return (
                <button onClick={() => setCourseModalTeacher(r)} className="text-teal-600 text-sm hover:underline text-left">
                  {count} course{count === 1 ? "" : "s"}
                  <span className="text-ink-muted dark:text-slate-400"> ({ongoing} ongoing)</span>
                </button>
              );
            } },
            { key: "actions", label: "", render: (r) => (
              <div className="flex gap-2">
                <button onClick={() => handleReset(r.id)} className="text-teal-600 text-sm hover:underline">Reset Password</button>
                <button onClick={() => handleDeactivate(r.id)} className="text-red-600 text-sm hover:underline">Deactivate</button>
              </div>
            ) },
          ]}
          rows={teachers}
          emptyLabel="No teachers yet"
        />
      </Card>

      <CredentialModal open={!!modal} onClose={() => setModal(null)} {...modal} />
      {courseModalTeacher && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setCourseModalTeacher(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
              {courseModalTeacher.fullName || courseModalTeacher.username}'s Courses
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Status is set by the teacher on their own Curriculum tab — read-only here.
            </p>
            <div className="space-y-2">
              {courseModalTeacher.taughtCourses.map((c) => (
                <div key={c.id} className="flex items-center justify-between border-b border-navy-950/10 dark:border-slate-700 pb-2 last:border-0">
                  <div>
                    <p className="text-sm text-slate-700 dark:text-slate-200">{c.name}</p>
                    <p className="text-xs text-ink-muted dark:text-slate-400">{c.level?.name}</p>
                  </div>
                  <span className={`status-pill text-xs ${c.status === "completed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {c.status === "completed" ? "Completed" : "Ongoing"}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setCourseModalTeacher(null)} className="w-full mt-4 bg-slate-900 dark:bg-slate-700 text-white rounded px-4 py-2 text-sm">
              Close
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
