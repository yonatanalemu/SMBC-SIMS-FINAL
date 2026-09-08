import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { useAuth } from "../../context/AuthContext";
import { listLevels, listCourses, deptHeadListGrades, deptHeadGradeDecision } from "../../api/resources";

export default function DeptHeadGrades() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [courses, setCourses] = useState([]);
  const [levelId, setLevelId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [search, setSearch] = useState("");
  const [grades, setGrades] = useState([]);

  useEffect(() => { listLevels(user.departmentId).then(setLevels); }, [user.departmentId]);

  async function onLevel(id) {
    setLevelId(id); setCourseId(""); setGrades([]);
    setCourses(id ? await listCourses(id) : []);
  }

  async function load(cId = courseId) {
    setGrades(await deptHeadListGrades({ levelId: levelId || undefined, courseId: cId || undefined, search: search || undefined }));
  }

  async function onCourse(id) {
    setCourseId(id);
    load(id);
  }

  async function decide(id, decision) {
    await deptHeadGradeDecision(id, decision);
    load();
  }

  return (
    <DashboardLayout>
      <Card title="Navigate">
        <div className="flex gap-3">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={levelId} onChange={(e) => onLevel(e.target.value)}>
            <option value="">Select level</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={courseId} onChange={(e) => onCourse(e.target.value)} disabled={!levelId}>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 flex-1"
            placeholder="Search student" value={search}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        </div>
      </Card>

      <Card title="Grades">
        <Table
          columns={[
            { key: "student", label: "Student", render: (r) => r.student?.user?.username },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "teacher", label: "Teacher", render: (r) => r.submittedBy?.username },
            { key: "total", label: "Total / Grade", render: (r) => r.totalScore != null ? `${r.totalScore} (${r.letterGrade})` : (r.letterGrade || "—") },
            { key: "status", label: "Status", render: (r) => r.status },
            { key: "actions", label: "", render: (r) => r.status === "pending_dept_head" && (
              <div className="flex gap-2">
                <button onClick={() => decide(r.id, "approved")} className="text-teal-700 font-medium text-sm hover:underline">Approve</button>
                <button onClick={() => decide(r.id, "rejected")} className="text-red-600 text-sm hover:underline">Reject</button>
              </div>
            ) },
          ]}
          rows={grades}
          emptyLabel="Select a course to view grades"
        />
      </Card>
    </DashboardLayout>
  );
}
