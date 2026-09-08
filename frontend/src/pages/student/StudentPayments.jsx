import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import FileUpload from "../../components/FileUpload";
import { studentInvoices, studentPaymentProofs, studentUploadPaymentProof, viewFile } from "../../api/resources";

// Only shows while there's an actual unpaid invoice — previously this fired
// purely off the calendar day regardless of payment status, so it kept
// showing even after Finance had marked everything paid.
function tuitionNotice(invoices) {
  const hasUnpaid = invoices.some((inv) => inv.status === "unpaid");
  if (!hasUnpaid) return null;

  const day = new Date().getDate();
  if (day >= 8 && day <= 10) {
    return { level: "warning", text: `There are ${10 - day} day(s) left on your tuition. Please pay the fee by navigating to Payments tab.` };
  }
  if (day > 10) {
    return { level: "danger", text: "Your tuition payment date has passed, please pay." };
  }
  return null;
}

export default function StudentPayments() {
  const [invoices, setInvoices] = useState([]);
  const [proofs, setProofs] = useState([]);
  const [periodMonth, setPeriodMonth] = useState(new Date().toISOString().slice(0, 7));
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState("");
  const notice = tuitionNotice(invoices);

  const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);
  const unpaidAmount = invoices.filter((inv) => inv.status === "unpaid").reduce((sum, inv) => sum + inv.amount, 0);

  async function load() {
    setInvoices(await studentInvoices());
    setProofs(await studentPaymentProofs());
  }
  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    setMsg("");
    if (files.length === 0) return setMsg("Select at least one screenshot to upload");
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("screenshots", f));
      formData.append("periodMonth", periodMonth);
      await studentUploadPaymentProof(formData);
      setFiles([]);
      load();
      setMsg("Uploaded — pending Finance verification.");
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not upload");
    }
  }

  return (
    <DashboardLayout>
      {notice && (
        <div className={`mb-6 p-3 rounded text-sm ${notice.level === "danger" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
          {notice.text}
        </div>
      )}

      <Card title="Merchant Info">
        <p className="text-sm dark:text-slate-300">College E-Birr Merchant Number: <span className="font-mono font-medium">53059</span></p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tuition payment window: 1st – 10th of each month.</p>
      </Card>

      <Card title="Upload Payment Proof">
        <form onSubmit={handleUpload} className="space-y-3">
          <input type="month" className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)} />
          <FileUpload accept="image/*" multiple label="Upload payment screenshot(s)" onFileSelect={setFiles}
            hint="You can select more than one image (e.g. multiple screenshots for one payment)." />
          <button className="bg-teal-600 text-white rounded-lg px-4 py-2 text-sm" type="submit">Upload</button>
        </form>
        {msg && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{msg}</p>}
      </Card>

      <Card title="My Payment Proofs">
        <Table
          columns={[
            { key: "period", label: "Period", render: (r) => r.periodMonth },
            { key: "status", label: "Status" },
            { key: "screenshot", label: "Screenshots", render: (r) => (
              <div className="flex gap-2 flex-wrap">
                {(r.screenshotUrls || []).map((url, i) => (
                  <button key={i} type="button" onClick={() => viewFile(url)} className="text-teal-600 hover:underline">
                    View {r.screenshotUrls.length > 1 ? i + 1 : ""}
                  </button>
                ))}
              </div>
            ) },
          ]}
          rows={proofs}
          emptyLabel="No payment proofs uploaded yet"
        />
      </Card>

      <Card title="Invoices">
        <Table
          columns={[
            { key: "title", label: "Title" },
            { key: "amount", label: "Amount" },
            { key: "status", label: "Status" },
          ]}
          rows={invoices}
          emptyLabel="No invoices assigned"
        />
        {invoices.length > 0 && (
          <div className="flex justify-end gap-6 mt-3 pt-3 border-t border-navy-950/10 dark:border-slate-700 text-sm">
            <p className="dark:text-slate-300">Total: <span className="font-semibold">{totalAmount}</span></p>
            <p className={unpaidAmount > 0 ? "text-red-600 font-semibold" : "text-emerald-700 dark:text-emerald-400"}>
              Unpaid: {unpaidAmount}
            </p>
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
