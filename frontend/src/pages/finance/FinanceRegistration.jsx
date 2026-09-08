import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { listRegistrationQueue, verifyPaymentProof, viewFile } from "../../api/resources";

export default function FinanceRegistration() {
  const [queue, setQueue] = useState([]);

  async function load() { setQueue(await listRegistrationQueue()); }
  useEffect(() => { load(); }, []);

  async function decide(proofId, status) {
    await verifyPaymentProof(proofId, status);
    load();
  }

  return (
    <DashboardLayout>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Students the Registrar has newly registered (N-badge), with their uploaded payment
        screenshots pending verification. Once verified, the Registrar can activate the account.
      </p>
      {queue.map((student) => (
        <Card key={student.id} title={`${student.user.username} — ${student.user.fullName || "no name on file"}`}>
          <p className="text-sm dark:text-slate-300 mb-3">
            {student.department.name} · {student.level.name}
          </p>
          <Table
            columns={[
              { key: "period", label: "Period", render: (p) => p.periodMonth },
              { key: "screenshot", label: "Screenshots", render: (p) => (
                <div className="flex gap-2 flex-wrap">
                  {(p.screenshotUrls || []).map((url, i) => (
                    <button key={i} type="button" onClick={() => viewFile(url)} className="text-teal-600 hover:underline">
                      View {p.screenshotUrls.length > 1 ? i + 1 : ""}
                    </button>
                  ))}
                </div>
              ) },
              { key: "status", label: "Status" },
              { key: "actions", label: "", render: (p) => p.status === "pending" && (
                <div className="flex gap-2">
                  <button onClick={() => decide(p.id, "verified")} className="text-teal-700 font-medium text-sm hover:underline">Verify</button>
                  <button onClick={() => decide(p.id, "rejected")} className="text-red-600 text-sm hover:underline">Reject</button>
                </div>
              ) },
            ]}
            rows={student.paymentProofs}
            emptyLabel="No payment screenshot uploaded yet"
          />
        </Card>
      ))}
      {queue.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">No students waiting on registration right now.</p>}
    </DashboardLayout>
  );
}
