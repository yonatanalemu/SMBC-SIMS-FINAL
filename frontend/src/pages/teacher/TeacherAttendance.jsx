import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import { useAuth } from "../../context/AuthContext";
import { listLevels, teacherLevelStudents, teacherSubmitAttendance, teacherListAttendance } from "../../api/resources";

export default function TeacherAttendance() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState("");
  const [instructorName, setInstructorName] = useState(user?.fullName || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState([]);
  const [presence, setPresence] = useState({});
  const [history, setHistory] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { listLevels(user.departmentId).then(setLevels); }, [user.departmentId]);
  useEffect(() => { teacherListAttendance().then(setHistory); }, []);

  async function onLevel(id) {
    setLevelId(id);
    setStudents(id ? await teacherLevelStudents(id) : []);
    setPresence({});
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    try {
      await teacherSubmitAttendance({
        departmentId: user.departmentId, levelId, instructorName, date,
        records: students.map((s) => ({ studentId: s.id, present: !!presence[s.id] })),
      });
      setMsg("Attendance submitted.");
      teacherListAttendance().then(setHistory);
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not submit attendance");
    }
  }

  return (
    <DashboardLayout>
      <Card title="Take Attendance">
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={levelId} onChange={(e) => onLevel(e.target.value)} required>
              <option value="">Select level</option>
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              placeholder="Instructor name" value={instructorName} onChange={(e) => setInstructorName(e.target.value)} required />
            <input type="date" className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          {students.length > 0 && (
            <div className="border border-navy-950/10 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800">
                  <tr><th className="px-3 py-2 text-left">Student</th><th className="px-3 py-2">Present</th><th className="px-3 py-2">Absent</th></tr>
                </thead>
                <tbody className="divide-y dark:divide-slate-700">
                  {students.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 dark:text-slate-200">
                        <span>{s.user.fullName || s.user.username}</span>
                        {s.user.fullName && <span className="id-chip ml-2 text-xs">{s.user.username}</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="radio" name={`att-${s.id}`} checked={presence[s.id] === true}
                          onChange={() => setPresence({ ...presence, [s.id]: true })} />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="radio" name={`att-${s.id}`} checked={presence[s.id] === false}
                          onChange={() => setPresence({ ...presence, [s.id]: false })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit" disabled={!students.length}>
            Submit Attendance
          </button>
          {msg && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{msg}</p>}
        </form>
      </Card>

      <Card title="My Attendance History">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {history.length} session(s) submitted. Select a level above to edit any day again — attendance stays editable.
        </p>
      </Card>
    </DashboardLayout>
  );
}