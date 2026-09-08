export default function KpiCard({ label, value, sub, accent = "teal" }) {
  const accentClass = {
    teal: "text-teal-600 bg-teal-100",
    gold: "text-gold-600 bg-gold-100",
    navy: "text-navy-900 bg-navy-950/10 dark:text-slate-200 dark:bg-white/10",
  }[accent];

  return (
    <div className="bg-white dark:bg-slate-800 border border-navy-950/10 dark:border-slate-700 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs uppercase tracking-wide text-ink-muted dark:text-slate-400">{label}</p>
        <span className={`w-2 h-2 rounded-full ${accentClass.split(" ")[1]}`} />
      </div>
      <p className="font-display text-3xl font-semibold text-navy-950 dark:text-slate-100">{value}</p>
      {sub && <p className="text-xs text-ink-muted dark:text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}
