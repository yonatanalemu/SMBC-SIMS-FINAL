import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import StatusPill from "../../components/StatusPill";
import CredentialModal from "../../components/CredentialModal";
import AcademicSelector from "../../components/AcademicSelector";
import { registerStudent, listRegistrarStudents, approveInterimStudent, getRegistrarStudent, deleteStudent } from "../../api/resources";
import { formatBothCalendars } from "../../utils/ethiopianCalendar";

export default function RegistrarRegistration() {
  const [selection, setSelection] = useState({ track: "tvet", departmentId: "", levelId: "" });
  const [programType, setProgramType] = useState("");
  const [admissionClassification, setAdmissionClassification] = useState("");
  const [personal, setPersonal] = useState({
    fullName: "", fullNameAmharic: "", sex: "", age: "", guardianName: "", grandfatherName: "", nationality: "",
    dateOfBirth: "", placeOfBirth: "", residence: "", esclceGpa: "", nationalId: "", admissionYear: "",
    courseStartDate: "", courseEndDate: "",
  });
  const [modal, setModal] = useState(null);
  const [error, setError] = useState("");

  const [queue, setQueue] = useState([]);
  const [expanded, setExpanded] = useState(null);

  async function loadQueue() {
    setQueue(await listRegistrarStudents({ recordStatus: "interim" }));
  }
  useEffect(() => { loadQueue(); }, []);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    if (!selection.departmentId || !selection.levelId) return setError("Select a department and level");
    try {
      const result = await registerStudent({
        ...personal, ...selection, programType: programType || undefined,
        admissionClassification: selection.track === "degree" ? (admissionClassification || undefined) : undefined,
        age: personal.age ? Number(personal.age) : undefined,
        admissionYear: personal.admissionYear ? Number(personal.admissionYear) : undefined,
      });
      setModal({ title: result.username.startsWith("N-") ? "Student Registered (Interim)" : "Student Registered & Activated", username: result.username, tempPassword: result.tempPassword });
      setPersonal({
        fullName: "", fullNameAmharic: "", sex: "", age: "", guardianName: "", grandfatherName: "", nationality: "",
        dateOfBirth: "", placeOfBirth: "", residence: "", esclceGpa: "", nationalId: "", admissionYear: "",
        courseStartDate: "", courseEndDate: "",
      });
      setProgramType("");
      setAdmissionClassification("");
      loadQueue();
    } catch (err) {
      setError(err?.response?.data?.error || "Could not register student");
    }
  }

  async function handleApprove(id) {
    try {
      await approveInterimStudent(id);
      loadQueue();
      setExpanded(null);
    } catch (err) {
      alert(err?.response?.data?.error || "Could not approve — Finance may not have verified payment yet");
    }
  }

  async function handleDelete(r) {
    if (!window.confirm(
      `Permanently delete ${r.user?.fullName || r.user?.username}'s registration? This removes their account and any invoices/payment proofs. This can't be undone.`
    )) return;
    await deleteStudent(r.id);
    if (expanded?.id === r.id) setExpanded(null);
    loadQueue();
  }

  async function toggleExpand(id) {
    if (expanded?.id === id) return setExpanded(null);
    setExpanded(await getRegistrarStudent(id));
  }

  const fieldClass = "border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm";

  return (
    <DashboardLayout>
      <Card title="Register New Student">
        <form onSubmit={handleRegister} className="space-y-3">
          <AcademicSelector mode="level" compact onSelect={setSelection} />
          {selection.track === "tvet" && (
            <select className={fieldClass} value={programType} onChange={(e) => setProgramType(e.target.value)}>
              <option value="">Program type (if Level 2)</option>
              <option value="level4_eligible">Level 4 Eligible (Diploma track)</option>
              <option value="level2_terminal">Level 2 Terminal</option>
            </select>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input className={fieldClass} placeholder="Full name (English)" value={personal.fullName}
              onChange={(e) => setPersonal({ ...personal, fullName: e.target.value })} required />
            <input className={fieldClass} placeholder="ስም በአማርኛ (Full name, Amharic)" value={personal.fullNameAmharic}
              onChange={(e) => setPersonal({ ...personal, fullNameAmharic: e.target.value })} />
            <select className={fieldClass} value={personal.sex} onChange={(e) => setPersonal({ ...personal, sex: e.target.value })}>
              <option value="">Sex</option><option value="M">M</option><option value="F">F</option>
            </select>
            <input type="number" className={fieldClass} placeholder="Age" value={personal.age}
              onChange={(e) => setPersonal({ ...personal, age: e.target.value })} />
            <input className={fieldClass} placeholder="Guardian name" value={personal.guardianName}
              onChange={(e) => setPersonal({ ...personal, guardianName: e.target.value })} />
            <input className={fieldClass} placeholder="Grandfather's name" value={personal.grandfatherName}
              onChange={(e) => setPersonal({ ...personal, grandfatherName: e.target.value })} />
            <input className={fieldClass} placeholder="Nationality" value={personal.nationality}
              onChange={(e) => setPersonal({ ...personal, nationality: e.target.value })} />
            <div>
              <label className="text-xs text-ink-muted dark:text-slate-400">Date of birth</label>
              <input type="date" className={`${fieldClass} w-full`} value={personal.dateOfBirth}
                onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })} />
            </div>
            <input className={fieldClass} placeholder="Place of birth" value={personal.placeOfBirth}
              onChange={(e) => setPersonal({ ...personal, placeOfBirth: e.target.value })} />
            <input className={fieldClass} placeholder="Residence" value={personal.residence}
              onChange={(e) => setPersonal({ ...personal, residence: e.target.value })} />
            <input className={fieldClass} placeholder="ESLCE GPA" value={personal.esclceGpa}
              onChange={(e) => setPersonal({ ...personal, esclceGpa: e.target.value })} />
            <input className={fieldClass} placeholder="National ID" value={personal.nationalId}
              onChange={(e) => setPersonal({ ...personal, nationalId: e.target.value })} />
            <input type="number" className={fieldClass} placeholder="Admission year" value={personal.admissionYear}
              onChange={(e) => setPersonal({ ...personal, admissionYear: e.target.value })} />
            <div>
              <label className="text-xs text-ink-muted dark:text-slate-400">Course start date</label>
              <input type="date" className={`${fieldClass} w-full`} value={personal.courseStartDate}
                onChange={(e) => setPersonal({ ...personal, courseStartDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-ink-muted dark:text-slate-400">Course end date</label>
              <input type="date" className={`${fieldClass} w-full`} value={personal.courseEndDate}
                onChange={(e) => setPersonal({ ...personal, courseEndDate: e.target.value })} />
            </div>
          </div>

          {selection.track === "degree" && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-muted dark:text-slate-400">Admission classification:</span>
              <div className="flex gap-2">
                {[["regular", "Regular"], ["extension", "Extension"]].map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setAdmissionClassification(value)}
                    className={`px-3 py-1 text-xs rounded-full ${admissionClassification === value ? "bg-teal-600 text-white" : "bg-navy-950/5 dark:bg-slate-700 dark:text-slate-300"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="bg-teal-600 text-white rounded-lg px-5 py-2 text-sm" type="submit">Register (interim)</button>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
      </Card>

      <Card title="Registration Queue">
        <p className="text-xs text-ink-muted dark:text-slate-400 mb-3">
          Every registration auto-assigns a Registration Fee and Tuition Fee invoice. Approving here
          requires Finance to have verified a payment proof first, then strips the "N-" prefix and
          moves the student to the Students tab.
        </p>
        <Table
          columns={[
            { key: "badge", label: "", render: () => <span className="status-pill bg-blue-100 text-blue-700">N</span> },
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "fullName", label: "Name", render: (r) => r.user?.fullName },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "level", label: "Level", render: (r) => r.level?.name },
            { key: "dates", label: "Start / End", render: (r) => (
              <div className="text-xs">
                <p>{r.courseStartDate ? formatBothCalendars(r.courseStartDate) : "Start: —"}</p>
                <p>{r.courseEndDate ? formatBothCalendars(r.courseEndDate) : "End: —"}</p>
              </div>
            ) },
            { key: "view", label: "", render: (r) => (
              <button onClick={() => toggleExpand(r.id)} className="text-teal-600 text-sm hover:underline">
                {expanded?.id === r.id ? "Hide" : "View Invoices"}
              </button>
            ) },
            { key: "approve", label: "", render: (r) => (
              <button onClick={() => handleApprove(r.id)} className="text-teal-700 font-medium text-sm hover:underline">Approve</button>
            ) },
            { key: "delete", label: "", render: (r) => (
              <button onClick={() => handleDelete(r)} title="Delete registration" aria-label="Delete registration"
                className="text-red-600 hover:text-red-800">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            ) },
          ]}
          rows={queue}
          emptyLabel="No students waiting on registration"
        />

        {expanded && (
          <div className="mt-4 border-t dark:border-slate-700 pt-4">
            <h4 className="text-sm font-medium mb-2 dark:text-slate-200">Invoices for {expanded.user.fullName}</h4>
            <Table
              columns={[
                { key: "title", label: "Title" },
                { key: "amount", label: "Amount" },
                { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
              ]}
              rows={expanded.invoices}
              emptyLabel="No invoices"
            />
          </div>
        )}
      </Card>

      <CredentialModal open={!!modal} onClose={() => setModal(null)} {...modal} />
    </DashboardLayout>
  );
}
