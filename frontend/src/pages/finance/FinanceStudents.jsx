import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import {
  listDepartments, listFinanceStudents, getFinanceStudent, setInvoiceStatus,
  financeStudentsExportUrl, downloadFile, viewFile,
} from "../../api/resources";
import AuthenticatedImage from "../../components/AuthenticatedImage";

export default function FinanceStudents() {
  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [selected, setSelected] = useState(null);

  useEffect(() => { listDepartments().then(setDepartments); }, []);
  async function load() { setStudents(await listFinanceStudents({ departmentId: filterDept || undefined })); }
  useEffect(() => { load(); }, [filterDept]);

  async function openStudent(id) {
    setSelected(await getFinanceStudent(id));
  }

  async function toggleInvoice(invoiceId, status) {
    await setInvoiceStatus(invoiceId, status);
    // Refresh the open student panel so the change is reflected immediately,
    // and the roster (tuitionStatus may also change if this was the Tuition
    // Fee invoice — see PATCH /finance/invoices/:id/status).
    if (selected) setSelected(await getFinanceStudent(selected.id));
    load();
  }

  return (
    <DashboardLayout>
      <Card title="Students" action={
        <div className="flex flex-wrap gap-2">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm"
            value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={() => downloadFile(financeStudentsExportUrl("paid", filterDept), "students-paid.csv")}
            className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5">Export Paid</button>
          <button onClick={() => downloadFile(financeStudentsExportUrl("unpaid", filterDept), "students-unpaid.csv")}
            className="text-sm bg-gold-600 text-white rounded-lg px-3 py-1.5">Export Unpaid</button>
        </div>
      }>
        <Table
          columns={[
            { key: "username", label: "Student ID", render: (r) => <span className="id-chip">{r.user?.username}</span> },
            { key: "name", label: "Name", render: (r) => r.user?.fullName || "—" },
            { key: "status", label: "Status", render: (r) => (
              <span className={`status-pill ${r.recordStatus === "interim" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                {r.recordStatus === "interim" ? "Interim (N)" : "Active"}
              </span>
            ) },
            { key: "dept", label: "Department", render: (r) => r.department?.name },
                        { key: "tuition", label: "Tuition", render: (r) => {
              const allPaid = r.invoices?.length > 0 && r.invoices.every((inv) => inv.status === "paid");
              return (
                <span className={`status-pill ${allPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {allPaid ? "Paid" : "Unpaid"}
                </span>
              );
            } },
            { key: "view", label: "", render: (r) => (
              <button onClick={() => openStudent(r.id)} className="text-teal-600 text-sm hover:underline">View</button>
            ) },
          ]}
          rows={students}
          emptyLabel="No students found"
        />
      </Card>

      {selected && (
        <Card title={`${selected.user.fullName || selected.user.username} — Payment Details`} action={
          <button onClick={() => setSelected(null)} className="text-sm text-slate-500 dark:text-slate-400">Close</button>
        }>
          <h4 className="text-sm font-medium mb-2 dark:text-slate-200">Uploaded Payment Proofs</h4>
          {selected.paymentProofs.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">None uploaded yet.</p>}
          <div className="space-y-3">
            {selected.paymentProofs.map((p) => (
              <div key={p.id} className="border dark:border-slate-700 rounded p-2">
                <p className="text-xs mb-2 dark:text-slate-300">{p.periodMonth} — {p.status}</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(p.screenshotUrls || []).map((url, i) => (
                    <button key={i} type="button" onClick={() => viewFile(url)}
                      className="block border dark:border-slate-700 rounded overflow-hidden text-left">
                      <AuthenticatedImage src={url} alt={`proof ${i + 1}`} className="w-full h-32 object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <h4 className="text-sm font-medium mt-4 mb-2 dark:text-slate-200">Invoices</h4>
          <Table
            columns={[
              { key: "title", label: "Title" },
              { key: "amount", label: "Amount" },
              { key: "status", label: "Status", render: (r) => (
                <select value={r.status} onChange={(e) => toggleInvoice(r.id, e.target.value)}
                  className={`border dark:border-slate-600 rounded px-2 py-1 text-xs ${r.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              ) },
            ]}
            rows={selected.invoices}
            emptyLabel="No invoices assigned"
          />
        </Card>
      )}
    </DashboardLayout>
  );
}