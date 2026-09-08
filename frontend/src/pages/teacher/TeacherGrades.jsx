import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { teacherListCourses, teacherCourseStudents, teacherSubmitGrade, teacherListGrades } from "../../api/resources";
import { DEGREE_LETTER_GRADES } from "../../utils/degreeGradeScale";

const DRAFT_KEY = "smbc_grade_drafts";
const DEGREE_GRADE_LABELS = { I: "I — Incomplete", DO: "DO — Dropout" };

// Statuses that mean the Dept Head has already acted on this grade — once a
// grade reaches one of these, the teacher can no longer edit or resubmit it.
const LOCKED_STATUSES = ["pending_admin", "approved"];

function loadDrafts() {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { return {}; }
}
function saveDrafts(drafts) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

export default function TeacherGrades() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [students, setStudents] = useState([]);
  const [drafts, setDrafts] = useState(loadDrafts());
  const [mySubmissions, setMySubmissions] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { teacherListCourses().then(setCourses); }, []);
  useEffect(() => { teacherListGrades().then(setMySubmissions); }, []);

  const selectedCourse = courses.find((c) => c.id === courseId);
  // Degree courses take a single letter grade from the teacher — no theory/
  // practice/cooperative breakdown. TVET keeps the existing three scores.
  const isDegree = selectedCourse?.level?.department?.track === "degree";

  // Latest submitted grade per student for the selected course, so the
  // entry table can tell which rows are locked (Dept-Head-approved+).
  const gradeByStudent = {};
  for (const g of mySubmissions) {
    if (g.courseId === courseId) gradeByStudent[g.studentId] = g;
  }
  function isLocked(studentId) {
    const g = gradeByStudent[studentId];
    return !!g && LOCKED_STATUSES.includes(g.status);
  }

  async function onCourse(id) {
    setCourseId(id);
    setStudents(id ? await teacherCourseStudents(id) : []);
    // Refresh submissions too, so lock state reflects any Dept Head
    // decisions made since the page loaded.
    teacherListGrades().then(setMySubmissions);
  }

  function updateDraft(studentId, field, value) {
    if (isLocked(studentId)) return;
    const key = `${courseId}:${studentId}`;
    const next = { ...drafts, [key]: { ...drafts[key], [field]: value } };
    setDrafts(next);
    saveDrafts(next);
  }

  async function submit(studentId) {
    if (isLocked(studentId)) {
      setMsg("This grade is approved and locked — it can no longer be edited.");
      return;
    }
    const key = `${courseId}:${studentId}`;
    const d = drafts[key];

    if (isDegree) {
      if (!d?.letterGrade) return setMsg("Select a letter grade before submitting");
    } else if (!d?.theoryScore || !d?.practiceScore || !d?.cooperativeScore) {
      return setMsg("Fill in theory, practice, and cooperative scores before submitting");
    }

    setMsg("");
    try {
      await teacherSubmitGrade(
        isDegree
          ? { studentId, courseId, letterGrade: d.letterGrade }
          : {
              studentId, courseId,
              theoryScore: Number(d.theoryScore), practiceScore: Number(d.practiceScore), cooperativeScore: Number(d.cooperativeScore),
            }
      );
      const next = { ...drafts };
      delete next[key];
      setDrafts(next);
      saveDrafts(next);
      teacherListGrades().then(setMySubmissions);
      setMsg("Submitted — sent to Department Head for approval.");
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not submit grade");
    }
  }

  return (
    <DashboardLayout>
      <Card title="Select Course">
        <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
          value={courseId} onChange={(e) => onCourse(e.target.value)}>
          <option value="">Select a course</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.level?.name})</option>)}
        </select>
      </Card>

      {courseId && (
        <Card title="Enter Grades">
          {msg && <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">{msg}</p>}
          <Table
            columns={
              isDegree
                ? [
                    { key: "student", label: "Student", render: (r) => r.user?.username },
                    { key: "grade", label: "Letter Grade", render: (r) => (
                      isLocked(r.id) ? (
                        <span className="text-sm dark:text-slate-300">{gradeByStudent[r.id]?.letterGrade || "—"}</span>
                      ) : (
                        <select className="border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-2 py-1"
                          value={drafts[`${courseId}:${r.id}`]?.letterGrade || ""}
                          onChange={(e) => updateDraft(r.id, "letterGrade", e.target.value)}>
                          <option value="">—</option>
                          {DEGREE_LETTER_GRADES.map((g) => <option key={g} value={g}>{DEGREE_GRADE_LABELS[g] || g}</option>)}
                        </select>
                      )
                    ) },
                    { key: "actions", label: "", render: (r) => (
                      isLocked(r.id) ? (
                        <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Approved &amp; Locked</span>
                      ) : (
                        <button onClick={() => submit(r.id)} className="text-teal-600 text-sm hover:underline">Submit</button>
                      )
                    ) },
                  ]
                : [
                    { key: "student", label: "Student", render: (r) => r.user?.username },
                    { key: "theory", label: "Theory (30)", render: (r) => (
                      <input type="number" disabled={isLocked(r.id)}
                        className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={isLocked(r.id) ? (gradeByStudent[r.id]?.theoryScore ?? "") : (drafts[`${courseId}:${r.id}`]?.theoryScore || "")}
                        onChange={(e) => updateDraft(r.id, "theoryScore", e.target.value)} />
                    ) },
                    { key: "practice", label: "Practice (40)", render: (r) => (
                      <input type="number" disabled={isLocked(r.id)}
                        className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={isLocked(r.id) ? (gradeByStudent[r.id]?.practiceScore ?? "") : (drafts[`${courseId}:${r.id}`]?.practiceScore || "")}
                        onChange={(e) => updateDraft(r.id, "practiceScore", e.target.value)} />
                    ) },
                    { key: "coop", label: "Cooperative (30)", render: (r) => (
                      <input type="number" disabled={isLocked(r.id)}
                        className="w-16 border dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded px-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={isLocked(r.id) ? (gradeByStudent[r.id]?.cooperativeScore ?? "") : (drafts[`${courseId}:${r.id}`]?.cooperativeScore || "")}
                        onChange={(e) => updateDraft(r.id, "cooperativeScore", e.target.value)} />
                    ) },
                    { key: "actions", label: "", render: (r) => (
                      isLocked(r.id) ? (
                        <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Approved &amp; Locked</span>
                      ) : (
                        <button onClick={() => submit(r.id)} className="text-teal-600 text-sm hover:underline">Submit</button>
                      )
                    ) },
                  ]
            }
            rows={students}
            emptyLabel="No active students in this course's level"
          />
        </Card>
      )}

      <Card title="My Submissions">
        <Table
          columns={[
            { key: "student", label: "Student", render: (r) => r.student?.user?.username },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "total", label: "Total / Grade", render: (r) => r.totalScore != null ? `${r.totalScore} (${r.letterGrade})` : (r.letterGrade || "—") },
            { key: "status", label: "Status", render: (r) => (
              LOCKED_STATUSES.includes(r.status)
                ? <span className="status-pill bg-emerald-100 text-emerald-700 text-xs">Approved &amp; Locked</span>
                : r.status
            ) },
          ]}
          rows={mySubmissions}
          emptyLabel="No grades submitted yet"
        />
      </Card>
    </DashboardLayout>
  );
}