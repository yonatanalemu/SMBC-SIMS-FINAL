import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { teacherListCourses, teacherUpdateCourseStatus } from "../../api/resources";

// fetcher: the role-specific list function (deptHeadListCurricula, teacherListCurricula, studentListCurricula)
// showCourseStatus: teacher-only — adds an editable "My Courses" status
// table below the curriculum documents. Dept Head and Student routes don't
// pass this, so their Curriculum tab is exactly as it was before.
export default function CurriculumPage({ fetcher, showCourseStatus = false }) {
  const [curricula, setCurricula] = useState([]);
  const [courses, setCourses] = useState([]);

  useEffect(() => { fetcher().then(setCurricula); }, [fetcher]);
  useEffect(() => {
    if (showCourseStatus) teacherListCourses().then(setCourses);
  }, [showCourseStatus]);

  async function handleStatusChange(courseId, status) {
    const updated = await teacherUpdateCourseStatus(courseId, status);
    setCourses((prev) => prev.map((c) => (c.id === courseId ? { ...c, status: updated.status } : c)));
  }

  return (
    <DashboardLayout>
      <Card title="Curriculum">
        <Table
          columns={[
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "level", label: "Level", render: (r) => r.level?.name },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open PDF</a> },
          ]}
          rows={curricula}
          emptyLabel="No curriculum documents uploaded yet — coming soon."
        />
      </Card>

      {showCourseStatus && (
        <Card title="My Courses">
          <p className="text-xs text-ink-muted dark:text-slate-400 mb-3">
            Mark a course Completed once you're done teaching it for the term — this is visible to Admin
            and doesn't affect grading or grade locking.
          </p>
          <Table
            columns={[
              { key: "name", label: "Course" },
              { key: "level", label: "Level", render: (r) => r.level?.name },
              { key: "status", label: "Status", render: (r) => (
                <select
                  value={r.status}
                  onChange={(e) => handleStatusChange(r.id, e.target.value)}
                  className={`border dark:border-slate-600 rounded px-2 py-1 text-xs ${r.status === "completed" ? "text-emerald-700" : "text-amber-700"}`}
                >
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
              ) },
            ]}
            rows={courses}
            emptyLabel="No courses assigned yet"
          />
        </Card>
      )}
    </DashboardLayout>
  );
}