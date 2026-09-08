export default function Table({ columns, rows, emptyLabel = "Nothing here yet" }) {
  if (!rows || rows.length === 0) {
    return <p className="text-ink-muted dark:text-slate-400 text-sm py-6 text-center">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto border border-navy-950/10 dark:border-slate-700 rounded-xl">
      <table className="min-w-full text-sm">
        <thead className="bg-navy-950/5 dark:bg-slate-800 text-ink-muted dark:text-slate-300 text-left">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-2 font-medium text-xs uppercase tracking-wide">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-navy-950/5 dark:divide-slate-700">
          {rows.map((row, i) => (
            <tr key={row.id || i} className="hover:bg-navy-950/[0.02] dark:hover:bg-slate-800/50">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 dark:text-slate-200">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
