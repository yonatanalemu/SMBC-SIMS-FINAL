const STYLES = {
  paid: "bg-teal-100 text-teal-600",
  approved: "bg-teal-100 text-teal-600",
  verified: "bg-teal-100 text-teal-600",
  active: "bg-teal-100 text-teal-600",
  unpaid: "bg-gold-100 text-gold-600",
  pending: "bg-gold-100 text-gold-600",
  pending_dept_head: "bg-gold-100 text-gold-600",
  pending_admin: "bg-blue-100 text-blue-700",
  interim: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  rejected_by_dept_head: "bg-red-100 text-red-700",
  rejected_by_admin: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  graduated: "bg-navy-950/10 text-navy-900 dark:bg-white/10 dark:text-slate-200",
};

const LABELS = {
  pending_dept_head: "Pending Dept Head",
  rejected_by_dept_head: "Rejected — Dept Head",
  pending_admin: "Pending Admin",
  rejected_by_admin: "Rejected — Admin",
};

export default function StatusPill({ status }) {
  const cls = STYLES[status] || "bg-slate-100 text-slate-600";
  const label = LABELS[status] || status?.replace(/_/g, " ");
  return <span className={`status-pill ${cls}`}>{label}</span>;
}
