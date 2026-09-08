import { forwardRef } from "react";

const StudentsReportDocument = forwardRef(({ track, rows, generatedAt }, ref) => {
  const totals = rows.reduce(
    (acc, r) => ({ male: acc.male + r.male, female: acc.female + r.female, total: acc.total + r.total }),
    { male: 0, female: 0, total: 0 }
  );

  return (
    <div ref={ref} className="bg-white text-black p-8" style={{ fontFamily: "Public Sans, sans-serif" }}>
      <div className="text-center mb-6">
        <h2 className="font-bold text-lg">SITTI MEDICAL AND BUSINESS COLLEGE</h2>
        <p className="text-sm text-gray-600">Student Population Report</p>
        <p className="text-xs text-gray-400 mt-1">Generated {generatedAt}</p>
      </div>

      <p className="font-bold text-2xl tracking-wide mb-4">{track === "tvet" ? "TVET" : "DEGREE"}</p>

      <table className="print-table text-sm">
        <thead>
          <tr className="bg-gray-100" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <th className="text-left">
              {track === "tvet" ? "Department / Level" : "Department"}
            </th>
            <th className="w-24">Male</th>
            <th className="w-24">Female</th>
            <th className="w-24">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td className="text-center">{r.male}</td>
              <td className="text-center">{r.female}</td>
              <td className="text-center font-medium">{r.total}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={4} className="text-center py-4 text-gray-500">No active students</td></tr>
          )}
          <tr className="font-bold bg-gray-50" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            <td>Total {track === "tvet" ? "TVET" : "Degree"} Students</td>
            <td className="text-center">{totals.male}</td>
            <td className="text-center">{totals.female}</td>
            <td className="text-center">{totals.total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

StudentsReportDocument.displayName = "StudentsReportDocument";
export default StudentsReportDocument;