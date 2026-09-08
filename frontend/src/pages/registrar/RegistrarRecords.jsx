import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { listRecords, registrarRecordsExportUrl, downloadFile } from "../../api/resources";
import { formatBothCalendars } from "../../utils/ethiopianCalendar";

// Graduated students only — once a level is graduated from the Students tab,
// they land here permanently. Certificate generation still works for them
// (see the "Generate Certificate" link per row, which deep-links into
// RegistrarCertificates.jsx) since certificates are often requested long
// after a student actually finishes.
export default function RegistrarRecords() {
  const [records, setRecords] = useState([]);
  useEffect(() => { listRecords().then(setRecords); }, []);

  return (
    <DashboardLayout>
      <Card title="Records — Graduated Students" action={
        <button onClick={() => downloadFile(registrarRecordsExportUrl(), "graduated-students.csv")}
          className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5">
          Export CSV
        </button>
      }>
        <Table
          columns={[
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "fullName", label: "Name", render: (r) => (
              <div>
                <p>{r.user?.fullName}</p>
                {r.fullNameAmharic && <p className="text-xs text-ink-muted dark:text-slate-400">{r.fullNameAmharic}</p>}
              </div>
            ) },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
            { key: "track", label: "Track", render: (r) => r.track },
            { key: "level", label: "Final Level", render: (r) => r.level?.name },
            { key: "personal", label: "Registration Info", render: (r) => (
              <div className="text-xs space-y-0.5">
                <p>Sex: {r.sex || "—"} &nbsp; DOB: {r.dateOfBirth ? formatBothCalendars(r.dateOfBirth) : "—"}</p>
                <p>Place of birth: {r.placeOfBirth || "—"}</p>
                <p>Nationality: {r.nationality || "—"} &nbsp; National ID: {r.nationalId || "—"}</p>
                <p>Admission year: {r.admissionYear || "—"}</p>
                {r.track === "degree" && <p>Classification: {r.admissionClassification === "extension" ? "Extension" : "Regular"}</p>}
              </div>
            ) },
            { key: "actions", label: "", render: (r) => (
              <Link to={`/registrar/certificates?studentId=${r.id}`} className="text-teal-600 text-sm hover:underline">
                Generate Certificate
              </Link>
            ) },
          ]}
          rows={records}
          emptyLabel="No graduated students yet"
        />
      </Card>
    </DashboardLayout>
  );
}
