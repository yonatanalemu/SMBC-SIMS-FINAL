import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import { getAppSettings, updateAppSettings } from "../../api/resources";

export default function AdminInvoiceSettings() {
  const [form, setForm] = useState({ registrationFeeAmount: "", tuitionFeeAmount: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => { getAppSettings().then(setForm); }, []);

  async function handleSave(e) {
    e.preventDefault();
    setMsg("");
    try {
      const result = await updateAppSettings({
        registrationFeeAmount: Number(form.registrationFeeAmount),
        tuitionFeeAmount: Number(form.tuitionFeeAmount),
      });
      const tuitionNote = result?.tuitionUpdatedCount > 0
        ? ` Tuition Fee was also updated on ${result.tuitionUpdatedCount} existing unpaid invoice${result.tuitionUpdatedCount === 1 ? "" : "s"} school-wide.`
        : "";
      setMsg(`Saved — Registration Fee applies to new registrations going forward.${tuitionNote}`);
    } catch (err) {
      setMsg(err?.response?.data?.error || "Could not save");
    }
  }

  return (
    <DashboardLayout>
      <Card title="Default Invoice Amounts">
        <p className="text-xs text-ink-muted dark:text-slate-400 mb-4">
          Registration Fee applies only to new student registrations going forward. Tuition Fee
          applies immediately to every currently unpaid Tuition Fee invoice school wide, in
          addition to being used for new registrations.
        </p>
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
          <div>
            <label className="text-xs text-ink-muted dark:text-slate-400">Registration Fee</label>
            <input type="number" className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={form.registrationFeeAmount} onChange={(e) => setForm({ ...form, registrationFeeAmount: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-ink-muted dark:text-slate-400">Tuition Fee</label>
            <input type="number" className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={form.tuitionFeeAmount} onChange={(e) => setForm({ ...form, tuitionFeeAmount: e.target.value })} />
          </div>
          <button className="col-span-2 bg-teal-600 text-white rounded-lg py-2 text-sm" type="submit">Save</button>
        </form>
        {msg && <p className="text-sm text-ink-muted dark:text-slate-300 mt-3">{msg}</p>}
      </Card>
    </DashboardLayout>
  );
}
