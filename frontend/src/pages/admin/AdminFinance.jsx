import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import StatusPill from "../../components/StatusPill";
import AcademicSelector from "../../components/AcademicSelector";
import {
  listDepartments, listFinanceStudents, getFinanceStudent, setInvoiceStatus, financeStudentsExportUrl,
  createInvoice, listTransactions, recordTransaction, transactionsExportUrl, downloadFile, viewFile,
} from "../../api/resources";
import AuthenticatedImage from "../../components/AuthenticatedImage";
export default function AdminFinance() {
  const { tab } = useParams(); // "students" | "invoices" | "transactions"
  if (!tab) return <Navigate to="/admin/finance/students" replace />;

  const [departments, setDepartments] = useState([]);
  const [students, setStudents] = useState([]);
  const [filterDept, setFilterDept] = useState("");

  const [invoiceForm, setInvoiceForm] = useState({ studentId: "", title: "", amount: "" });
  const [invoiceSelection, setInvoiceSelection] = useState({});
  const [invoiceMsg, setInvoiceMsg] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [pickedStudent, setPickedStudent] = useState(null); // { id, username, fullName }

  const [range, setRange] = useState("month");
  const [txData, setTxData] = useState({ transactions: [], totalIncome: 0, count: 0 });
  const [txForm, setTxForm] = useState({ amount: "", date: "", note: "" });
  const [selected, setSelected] = useState(null);

  useEffect(() => { listDepartments().then(setDepartments); }, []);
  function loadStudents() { listFinanceStudents({ departmentId: filterDept || undefined }).then(setStudents); }
  useEffect(() => { if (tab === "students") loadStudents(); }, [tab, filterDept]);
  useEffect(() => { if (tab === "transactions") listTransactions(range).then(setTxData); }, [tab, range]);

  async function openStudent(id) {
    setSelected(await getFinanceStudent(id));
  }

  async function toggleInvoice(invoiceId, status) {
    await setInvoiceStatus(invoiceId, status);
    if (selected) setSelected(await getFinanceStudent(selected.id));
    loadStudents();
  }

  async function handleInvoice(e) {
    e.preventDefault();
    setInvoiceMsg("");
    try {
      await createInvoice({
        studentId: invoiceForm.studentId || undefined,
        levelId: invoiceForm.studentId ? undefined : invoiceSelection.levelId || undefined,
        title: invoiceForm.title, amount: Number(invoiceForm.amount),
      });
      setInvoiceMsg("Invoice assigned.");
      setInvoiceForm({ studentId: "", title: "", amount: "" });
      setPickedStudent(null);
      setInvoiceSearch("");
      setInvoiceResults([]);
    } catch (err) {
      setInvoiceMsg(err?.response?.data?.error || "Could not assign invoice");
    }
  }

  async function handleInvoiceSearch(e) {
    e.preventDefault();
    if (!invoiceSearch.trim()) return setInvoiceResults([]);
    setInvoiceResults(await listFinanceStudents({ search: invoiceSearch }));
  }

  function pickStudent(s) {
    setPickedStudent({ id: s.id, username: s.user?.username, fullName: s.user?.fullName });
    setInvoiceForm({ ...invoiceForm, studentId: s.id });
    setInvoiceResults([]);
  }

  function clearPickedStudent() {
    setPickedStudent(null);
    setInvoiceForm({ ...invoiceForm, studentId: "" });
    setInvoiceSearch("");
  }

  async function handleTransaction(e) {
    e.preventDefault();
    await recordTransaction({ ...txForm, amount: Number(txForm.amount) });
    setTxForm({ amount: "", date: "", note: "" });
    listTransactions(range).then(setTxData);
  }

  const fieldClass = "border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2 text-sm";

  return (
    <DashboardLayout>
      {tab === "students" && (
        <Card title="Students — Tuition Status" action={
          <div className="flex flex-wrap gap-2">
            <select className={fieldClass} value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
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
              { key: "badge", label: "", render: (r) => r.recordStatus === "interim" && <span className="status-pill bg-blue-100 text-blue-700">N</span> },
              { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.user?.username}</span> },
              { key: "name", label: "Name", render: (r) => r.user?.fullName || "—" },
              { key: "dept", label: "Department", render: (r) => r.department?.name },
                           { key: "tuition", label: "Tuition", render: (r) => {
                const allPaid = r.invoices?.length > 0 && r.invoices.every((inv) => inv.status === "paid");
                return (
                  <span className={`status-pill ${allPaid ? "bg-teal-100 text-teal-700" : "bg-gold-100 text-gold-600"}`}>
                    {allPaid ? "Paid" : "Unpaid"}
                  </span>
                );
              } },
              { key: "invoices", label: "Invoices", render: (r) => r.invoices?.length || 0 },
              { key: "view", label: "", render: (r) => (
                <button onClick={() => openStudent(r.id)} className="text-teal-600 text-sm hover:underline">View</button>
              ) },
            ]}
            rows={students}
            emptyLabel="No students found"
          />
        </Card>
      )}

      {tab === "students" && selected && (
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

      {tab === "invoices" && (
        <Card title="Assign Invoice (single student or bulk by TVET/Degree level)">
          <form onSubmit={handleInvoice} className="space-y-3">
                        {pickedStudent ? (
              <div className="flex items-center justify-between border border-teal-200 bg-teal-50 dark:bg-slate-700 dark:border-slate-600 rounded-lg px-3 py-2">
                <span className="text-sm">
                  <span className="id-chip mr-2">{pickedStudent.username}</span>
                  {pickedStudent.fullName}
                </span>
                <button type="button" onClick={clearPickedStudent} className="text-xs text-red-600 hover:underline">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input className={`${fieldClass} flex-1`} placeholder="Search by username or name (leave blank for bulk-by-level)"
                  value={invoiceSearch} onChange={(e) => setInvoiceSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleInvoiceSearch(e)} />
                <button type="button" onClick={handleInvoiceSearch} className="bg-navy-950/5 dark:bg-slate-700 dark:text-slate-300 rounded-lg px-4 py-2 text-sm">
                  Search
                </button>
              </div>
            )}

            {invoiceResults.length > 0 && (
              <div className="border border-navy-950/10 dark:border-slate-600 rounded-lg divide-y divide-navy-950/10 dark:divide-slate-600 max-h-48 overflow-y-auto">
                {invoiceResults.map((s) => (
                  <button key={s.id} type="button" onClick={() => pickStudent(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-navy-950/5 dark:hover:bg-slate-700 flex justify-between">
                    <span><span className="id-chip mr-2">{s.user?.username}</span>{s.user?.fullName}</span>
                    <span className="text-ink-muted dark:text-slate-400">{s.department?.name}</span>
                  </button>
                ))}
              </div>
            )}

            {!invoiceForm.studentId && <AcademicSelector mode="level" compact onSelect={setInvoiceSelection} />}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={fieldClass} placeholder="Invoice title" value={invoiceForm.title}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, title: e.target.value })} required />
              <input type="number" className={fieldClass} placeholder="Amount" value={invoiceForm.amount}
                onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required />
            </div>
            <button className="bg-teal-600 text-white rounded-lg px-5 py-2 text-sm" type="submit">Assign</button>
          </form>
          {invoiceMsg && <p className="text-sm text-ink-muted dark:text-slate-300 mt-2">{invoiceMsg}</p>}
        </Card>
      )}

      {tab === "transactions" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
              <p className="text-xs text-ink-muted dark:text-slate-400">Total Income ({range})</p>
              <p className="font-display text-2xl font-semibold dark:text-slate-100">{txData.totalIncome}</p>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
              <p className="text-xs text-ink-muted dark:text-slate-400">Transactions</p>
              <p className="font-display text-2xl font-semibold dark:text-slate-100">{txData.count}</p>
            </div>
          </div>

          <Card title="Log Transaction (EBIRR)">
            <form onSubmit={handleTransaction} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="number" className={fieldClass} placeholder="Amount" value={txForm.amount} onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })} required />
              <input type="date" className={fieldClass} value={txForm.date} onChange={(e) => setTxForm({ ...txForm, date: e.target.value })} required />
              <input className={fieldClass} placeholder="Note (optional)" value={txForm.note} onChange={(e) => setTxForm({ ...txForm, note: e.target.value })} />
              <button className="col-span-3 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Log Transaction</button>
            </form>
          </Card>

          <Card title="Transactions" action={
            <div className="flex flex-wrap gap-2">
              <select className={fieldClass} value={range} onChange={(e) => setRange(e.target.value)}>
                <option value="today">Today</option><option value="week">This Week</option>
                <option value="month">This Month</option><option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
              <button onClick={() => downloadFile(transactionsExportUrl(range), `transactions-${range}.csv`)}
                className="text-sm bg-teal-600 text-white rounded-lg px-3 py-1.5">Export CSV</button>
            </div>
          }>
            <Table
              columns={[
                { key: "date", label: "Date", render: (r) => new Date(r.date).toLocaleDateString() },
                { key: "amount", label: "Amount" },
                { key: "method", label: "Method" },
                { key: "recordedBy", label: "Recorded By", render: (r) => r.recordedBy?.username },
                { key: "note", label: "Note" },
              ]}
              rows={txData.transactions}
              emptyLabel="No transactions in this range"
            />
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
