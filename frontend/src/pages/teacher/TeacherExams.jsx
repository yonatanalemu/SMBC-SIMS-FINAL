import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import FileUpload from "../../components/FileUpload";
import { teacherListCourses, teacherSubmitExam, teacherListExams, teacherDeleteExam } from "../../api/resources";

export default function TeacherExams() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [exams, setExams] = useState([]);
  const [msg, setMsg] = useState("");

  useEffect(() => { teacherListCourses().then(setCourses); }, []);
  async function load() { setExams(await teacherListExams()); }
  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setMsg("");
    if (!title.trim()) {
      return setMsg("A title is required — include the academic year and exam type, e.g. \"2018 E.C. — Midterm Exam\".");
    }
    if (!file || file.type !== "application/pdf") {
      return setMsg("Exams can only be uploaded as PDF — this keeps the file format consistent for Dept Head review and Registrar printing.");
    }
    try {
      const formData = new FormData();
      formData.append("courseId", courseId);
      formData.append("title", title.trim());
      formData.append("file", file);
      await teacherSubmitExam(formData);
      setFile(null); setCourseId(""); setTitle("");
      load();
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not upload exam");
    }
  }

  async function handleRemove(id) {
    await teacherDeleteExam(id);
    load();
  }

  return (
    <DashboardLayout>
      <Card title="Upload Exam (PDF only)">
        <form onSubmit={handleUpload} className="space-y-3">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
            <option value="">Select course</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 w-full"
            placeholder='Title — e.g. "2018 E.C. — Midterm Exam"'
            value={title} onChange={(e) => setTitle(e.target.value)} required />
          <FileUpload accept="application/pdf" label="Upload exam PDF" onFileSelect={setFile} />
          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Upload</button>
        </form>
        {msg && <p className="text-sm text-amber-600 mt-2">{msg}</p>}
      </Card>

      <Card title="My Exam Submissions">
        <Table
          columns={[
            { key: "title", label: "Title", render: (r) => r.title || "—" },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open</a> },
            { key: "status", label: "Status", render: (r) => r.status },
            { key: "note", label: "Dept Head Note", render: (r) => r.rejectionNote || "—" },
            { key: "actions", label: "", render: (r) => r.status === "rejected" && (
              <button onClick={() => handleRemove(r.id)} className="text-red-600 text-sm hover:underline">Remove & Re-upload</button>
            ) },
          ]}
          rows={exams}
          emptyLabel="No exams submitted yet"
        />
      </Card>
    </DashboardLayout>
  );
}