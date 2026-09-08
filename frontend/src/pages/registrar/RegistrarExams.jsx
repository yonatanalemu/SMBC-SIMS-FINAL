import { useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import AcademicSelector from "../../components/AcademicSelector";
import { listApprovedExamsForRegistrar, markExamPrinted } from "../../api/resources";

export default function RegistrarExams() {
  const [selection, setSelection] = useState({});
  const [exams, setExams] = useState([]);

  async function load(sel) {
    setExams(await listApprovedExamsForRegistrar({
      courseId: sel.courseId || undefined,
      levelId: !sel.courseId ? sel.levelId || undefined : undefined,
      departmentId: !sel.courseId && !sel.levelId ? sel.departmentId || undefined : undefined,
    }));
  }

  function onSelect(sel) {
    setSelection(sel);
    load(sel);
  }

  async function handlePrinted(id) {
    await markExamPrinted(id);
    load(selection);
  }

  return (
    <DashboardLayout>
      <Card title="Navigate">
        <AcademicSelector mode="course" onSelect={onSelect} />
      </Card>

      <Card title="Approved Exams — Ready to Print">
        <Table
          columns={[
            { key: "title", label: "Title", render: (r) => r.title || "—" },
            { key: "dept", label: "Department", render: (r) => r.course?.level?.department?.name },
            { key: "level", label: "Level", render: (r) => r.course?.level?.name },
            { key: "course", label: "Course", render: (r) => r.course?.name },
            { key: "teacher", label: "Teacher", render: (r) => r.submittedBy?.username },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open PDF</a> },
            { key: "printed", label: "Printed", render: (r) => r.printedAt
              ? new Date(r.printedAt).toLocaleDateString()
              : <button onClick={() => handlePrinted(r.id)} className="text-teal-700 font-medium text-sm hover:underline">Mark Printed</button>
            },
          ]}
          rows={exams}
          emptyLabel="Select a department (and drill down) above to view approved exams"
        />
      </Card>
    </DashboardLayout>
  );
}
