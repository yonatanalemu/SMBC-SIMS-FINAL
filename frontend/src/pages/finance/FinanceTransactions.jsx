import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import { listTransactions, recordTransaction, transactionsExportUrl, downloadFile } from "../../api/resources";

export default function FinanceTransactions() {
  const [range, setRange] = useState("month");
  const [data, setData] = useState({ transactions: [], totalIncome: 0, count: 0 });
  const [form, setForm] = useState({ amount: "", date: "", note: "" });

  async function load() { setData(await listTransactions(range)); }
  useEffect(() => { load(); }, [range]);

  async function handleSubmit(e) {
    e.preventDefault();
    await recordTransaction({ ...form, amount: Number(form.amount) });
    setForm({ amount: "", date: "", note: "" });
    load();
  }

  return (
    <DashboardLayout>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Income ({range})</p>
          <p className="font-display text-2xl font-semibold dark:text-slate-100">{data.totalIncome}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Transactions</p>
          <p className="font-display text-2xl font-semibold dark:text-slate-100">{data.count}</p>
        </div>
      </div>

      <Card title="Log Transaction (EBIRR)">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="number" className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <input type="date" className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <input className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
            placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="col-span-3 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Log Transaction</button>
        </form>
      </Card>

      <Card title="Transactions" action={
        <div className="flex flex-wrap gap-2">
          <select className="border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1 text-sm" value={range} onChange={(e) => setRange(e.target.value)}>
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
          rows={data.transactions}
          emptyLabel="No transactions in this range"
        />
      </Card>
    </DashboardLayout>
  );
}
