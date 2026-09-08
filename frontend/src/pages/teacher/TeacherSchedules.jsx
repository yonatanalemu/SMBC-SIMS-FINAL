import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { listSchedules } from "../../api/resources";

export default function TeacherSchedules() {
  const [schedules, setSchedules] = useState([]);
  useEffect(() => { listSchedules().then(setSchedules); }, []);

  return (
    <DashboardLayout>
      <Card title="Schedules">
        <Table
          columns={[
            { key: "type", label: "Type" },
            { key: "title", label: "Title", render: (r) => r.title || "—" },
            { key: "file", label: "File", render: (r) => <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">Open</a> },
          ]}
          rows={schedules}
          emptyLabel="No schedules uploaded yet"
        />
      </Card>
    </DashboardLayout>
  );
}
