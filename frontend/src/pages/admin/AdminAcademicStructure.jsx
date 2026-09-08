import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import {
  listDepartments, createDepartment, listLevels, createLevel,
  listCourses, createCourse, listTeachers, assignCourseTeacher,
} from "../../api/resources";

export default function AdminAcademicStructure() {
  const [departments, setDepartments] = useState([]);
  const [deptForm, setDeptForm] = useState({ name: "", track: "tvet" });

  const [selectedDept, setSelectedDept] = useState("");
  const [levels, setLevels] = useState([]);
  const [levelForm, setLevelForm] = useState({ name: "" });

  const [selectedLevel, setSelectedLevel] = useState("");
  const [courses, setCourses] = useState([]);
  const [courseForm, setCourseForm] = useState({ name: "", code: "", courseNo: "", creditHours: "" });
  const [teachers, setTeachers] = useState([]);

  async function loadDepartments() { setDepartments(await listDepartments()); }
  useEffect(() => { loadDepartments(); }, []);

  const selectedDeptTrack = departments.find((d) => d.id === selectedDept)?.track;

  async function loadLevels(deptId) {
    setSelectedDept(deptId);
    setSelectedLevel("");
    setCourses([]);
    if (!deptId) { setLevels([]); return; }
    setLevels(await listLevels(deptId));
    setTeachers(await listTeachers(deptId));
  }

  async function loadCourses(levelId) {
    setSelectedLevel(levelId);
    if (!levelId) { setCourses([]); return; }
    setCourses(await listCourses(levelId));
  }

  async function handleAddDept(e) {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    await createDepartment(deptForm);
    setDeptForm({ name: "", track: "tvet" });
    loadDepartments();
  }

  async function handleAddLevel(e) {
    e.preventDefault();
    if (!levelForm.name.trim() || !selectedDept) return;
    await createLevel({ departmentId: selectedDept, name: levelForm.name, order: levels.length });
    setLevelForm({ name: "" });
    loadLevels(selectedDept);
  }

  async function handleAddCourse(e) {
    e.preventDefault();
    if (!courseForm.name.trim() || !selectedLevel) return;
    await createCourse({
      levelId: selectedLevel, name: courseForm.name, code: courseForm.code || undefined,
      courseNo: courseForm.courseNo || undefined,
      creditHours: courseForm.creditHours || undefined,
    });
    setCourseForm({ name: "", code: "", courseNo: "", creditHours: "" });
    loadCourses(selectedLevel);
  }

  async function handleAssignTeacher(courseId, teacherId) {
    await assignCourseTeacher(courseId, teacherId || null);
    loadCourses(selectedLevel);
  }

  return (
    <DashboardLayout>
      <Card title="Departments">
        <form onSubmit={handleAddDept} className="flex flex-wrap gap-2 mb-4">
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:flex-1 sm:min-w-[160px]"
            placeholder="Department name" value={deptForm.name}
            onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} />
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={deptForm.track} onChange={(e) => setDeptForm({ ...deptForm, track: e.target.value })}>
            <option value="tvet">TVET</option>
            <option value="degree">Degree</option>
          </select>
          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm w-full sm:w-auto" type="submit">Add</button>
        </form>
        <Table
          columns={[
            { key: "name", label: "Department" },
            { key: "track", label: "Track" },
            { key: "manage", label: "", render: (row) => (
              <button onClick={() => loadLevels(row.id)} className="text-teal-600 text-sm hover:underline">
                Manage levels →
              </button>
            ) },
          ]}
          rows={departments}
          emptyLabel="No departments yet"
        />
      </Card>

      {selectedDept && (
        <Card title="Levels">
          <form onSubmit={handleAddLevel} className="flex flex-wrap gap-2 mb-4">
            <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:flex-1 sm:min-w-[160px]"
              placeholder="e.g. Level 3, Year I Semester I" value={levelForm.name}
              onChange={(e) => setLevelForm({ name: e.target.value })} />
            <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm w-full sm:w-auto" type="submit">Add Level</button>
          </form>
          <Table
            columns={[
              { key: "name", label: "Level" },
              { key: "manage", label: "", render: (row) => (
                <button onClick={() => loadCourses(row.id)} className="text-teal-600 text-sm hover:underline">
                  Manage courses →
                </button>
              ) },
            ]}
            rows={levels}
            emptyLabel="No levels yet"
          />
        </Card>
      )}

      {selectedLevel && (
        <Card title="Courses">
          {selectedDeptTrack === "degree" ? (
            <form onSubmit={handleAddCourse} className="flex flex-wrap gap-2 mb-4">
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:w-28"
                placeholder="Course code" value={courseForm.code}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} />
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:w-24"
                placeholder="Course No." value={courseForm.courseNo}
                onChange={(e) => setCourseForm({ ...courseForm, courseNo: e.target.value })} />
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:flex-1 sm:min-w-[160px]"
                placeholder="Course title" value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} />
              <input type="number" className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:w-24"
                placeholder="Cr. Hrs" value={courseForm.creditHours}
                onChange={(e) => setCourseForm({ ...courseForm, creditHours: e.target.value })} />
              <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm w-full sm:w-auto" type="submit">Add Course</button>
            </form>
          ) : (
            <form onSubmit={handleAddCourse} className="flex flex-wrap gap-2 mb-4">
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:flex-1 sm:min-w-[160px]"
                placeholder="Course name" value={courseForm.name}
                onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })} />
              <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full sm:w-40"
                placeholder="Code (optional)" value={courseForm.code || ""}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value })} />
              <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm w-full sm:w-auto" type="submit">Add Course</button>
            </form>
          )}
          <Table
            columns={
              selectedDeptTrack === "degree"
                ? [
                    { key: "code", label: "Code", render: (row) => row.code ? <span className="id-chip">{row.code}</span> : "—" },
                    { key: "courseNo", label: "No.", render: (row) => row.courseNo || "—" },
                    { key: "name", label: "Course Title" },
                    { key: "creditHours", label: "Cr. Hrs", render: (row) => row.creditHours ?? "—" },
                    { key: "teacher", label: "Assigned Teacher", render: (row) => (
                      <select
                        className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
                        value={row.teacherId || ""}
                        onChange={(e) => handleAssignTeacher(row.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                      </select>
                    ) },
                  ]
                : [
                    { key: "code", label: "Code", render: (row) => row.code ? <span className="id-chip">{row.code}</span> : "—" },
                    { key: "name", label: "Course" },
                    { key: "teacher", label: "Assigned Teacher", render: (row) => (
                      <select
                        className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
                        value={row.teacherId || ""}
                        onChange={(e) => handleAssignTeacher(row.id, e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                      </select>
                    ) },
                  ]
            }
            rows={courses}
            emptyLabel="No courses yet"
          />
        </Card>
      )}
    </DashboardLayout>
  );
}
