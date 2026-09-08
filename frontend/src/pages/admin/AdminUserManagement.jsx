import { useEffect, useState } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import Table from "../../components/Table";
import CredentialModal from "../../components/CredentialModal";
import { listPermanentUsers, resetStaffPassword } from "../../api/resources";

const ROLE_LABELS = { registrar: "Registrar", finance: "Finance" };

// Registrar and Finance are the other permanent accounts (alongside Admin
// itself) — set up directly rather than through an approval flow like
// Teacher/Student/Dept Head. This is just a password-reset panel for them;
// there's no create/deactivate here since those accounts are provisioned
// outside the app (see HANDOVER.md).
export default function AdminUserManagement() {
  const [users, setUsers] = useState([]);
  const [modal, setModal] = useState(null);

  useEffect(() => { listPermanentUsers().then(setUsers); }, []);

  async function handleReset(userId) {
    const result = await resetStaffPassword(userId);
    setModal({ title: "Password Reset Successful", username: result.username, tempPassword: result.tempPassword });
  }

  return (
    <DashboardLayout>
      <Card title="User Management — Registrar & Finance">
        <p className="text-sm text-ink-muted dark:text-slate-400 mb-4">
          Reset the password for a Registrar or Finance account. A new temporary password is
          generated immediately — pass it along to them; they'll be required to change it on
          next login.
        </p>
        <Table
          columns={[
            { key: "role", label: "Role", render: (r) => ROLE_LABELS[r.role] || r.role },
            { key: "username", label: "Username", render: (r) => <span className="id-chip">{r.username}</span> },
            { key: "fullName", label: "Name", render: (r) => r.fullName || "—" },
            { key: "email", label: "Email", render: (r) => r.email || "—" },
            { key: "actions", label: "", render: (r) => (
              <button onClick={() => handleReset(r.id)} className="text-teal-600 text-sm hover:underline">
                Reset Password
              </button>
            ) },
          ]}
          rows={users}
          emptyLabel="No Registrar or Finance accounts found"
        />
      </Card>

      <CredentialModal open={!!modal} onClose={() => setModal(null)} {...modal} />
    </DashboardLayout>
  );
}
