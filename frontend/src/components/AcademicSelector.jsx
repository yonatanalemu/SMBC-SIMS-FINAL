import { useEffect, useState } from "react";
import { listDepartments, listLevels, listCourses } from "../api/resources";

// Sentinel value for the "Graduated Students" pseudo-level option — never
// collides with a real Level's id (those are cuids from the database).
const GRADUATED_OPTION = "__graduated__";

// mode: "level" (stop at level — e.g. attendance, invoices) | "course" (drill to course — grades/exams/teacher assignment)
//
// showGraduated (mode="level" only): appends a distinct "🎓 Graduated
// Students" option after the real levels for the selected department.
// Without this, browsing to e.g. Level 4 mixes currently-enrolled Level 4
// students together with already-graduated former Level 4 students (they
// keep whatever levelId they finished at — graduation doesn't move them to
// a special level), which makes it impossible to tell them apart in
// Transcript/Certificate generation. Picking the real "Level 4" option
// now means "active Level 4 students only"; picking "Graduated Students"
// means "everyone graduated from this department, any level" — the two
// are mutually exclusive choices, never blended.
export default function AcademicSelector({ mode = "course", onSelect, compact = false, showGraduated = false }) {
  const [departments, setDepartments] = useState([]);
  const [track, setTrack] = useState("tvet");
  const [departmentId, setDepartmentId] = useState("");
  const [levels, setLevels] = useState([]);
  const [levelId, setLevelId] = useState("");
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => { listDepartments().then(setDepartments); }, []);

  const filteredDepartments = departments.filter((d) => d.track === track);

  async function onDept(id) {
    setDepartmentId(id); setLevelId(""); setCourseId(""); setCourses([]);
    setLevels(id ? await listLevels(id) : []);
    if (mode === "level") emit({ track, departmentId: id, levelId: "", graduated: false });
  }

  async function onLevel(id) {
    if (id === GRADUATED_OPTION) {
      setLevelId(id);
      setCourseId("");
      emit({ track, departmentId, levelId: "", graduated: true });
      return;
    }
    setLevelId(id); setCourseId("");
    if (mode === "course") setCourses(id ? await listCourses(id) : []);
    emit({ track, departmentId, levelId: id, courseId: "", graduated: false });
  }

  function onCourse(id) {
    setCourseId(id);
    emit({ track, departmentId, levelId, courseId: id, graduated: false });
  }

  function emit(partial) {
    onSelect?.(partial);
  }

  // Live search across courses by name, resolving the full chain on pick.
  async function handleSearch(q) {
    setSearch(q);
    if (q.length < 2) return setSearchResults([]);
    const allDepts = await listDepartments();
    const matches = [];
    for (const dept of allDepts) {
      const lvls = await listLevels(dept.id);
      for (const lvl of lvls) {
        const crs = await listCourses(lvl.id);
        crs.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
          .forEach((c) => matches.push({ ...c, department: dept, level: lvl }));
      }
    }
    setSearchResults(matches.slice(0, 8));
  }

  function pickSearchResult(m) {
    setTrack(m.department.track);
    setDepartmentId(m.department.id);
    setLevelId(m.level.id);
    setCourseId(m.id);
    setSearch(""); setSearchResults([]);
    emit({ track: m.department.track, departmentId: m.department.id, levelId: m.level.id, courseId: m.id, graduated: false });
  }

  const fieldClass = "border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm";

  return (
    <div className={compact ? "" : "bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-4"}>
      {mode === "course" && (
        <div className="relative mb-3">
          <input
            className={`${fieldClass} w-full`}
            placeholder="Search for a course directly…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="absolute z-10 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg mt-1 w-full shadow-lg max-h-56 overflow-y-auto">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  onClick={() => pickSearchResult(m)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-teal-100/50 dark:hover:bg-slate-700 dark:text-slate-200"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-ink-muted dark:text-slate-400"> — {m.department.name} · {m.level.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select className={fieldClass} value={track} onChange={(e) => { setTrack(e.target.value); setDepartmentId(""); setLevelId(""); setCourseId(""); setLevels([]); setCourses([]); }}>
          <option value="tvet">TVET</option>
          <option value="degree">Degree</option>
        </select>

        <select className={fieldClass} value={departmentId} onChange={(e) => onDept(e.target.value)}>
          <option value="">Select department</option>
          {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <select className={fieldClass} value={levelId} onChange={(e) => onLevel(e.target.value)} disabled={!departmentId}>
          <option value="">{track === "tvet" ? "Select level" : "Select Year/Semester"}</option>
          {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          {showGraduated && mode === "level" && departmentId && (
            <option value={GRADUATED_OPTION}>🎓 Graduated Students</option>
          )}
        </select>

        {mode === "course" && (
          <select className={fieldClass} value={courseId} onChange={(e) => onCourse(e.target.value)} disabled={!levelId}>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}