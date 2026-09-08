export default function CredentialModal({ open, onClose, username, tempPassword, title }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-full">
        <h3 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-4">
          {title || "Password Reset Successful"}
        </h3>
        <div className="space-y-2 text-sm mb-4">
          <p className="text-slate-700 dark:text-slate-200">
            Username: <span className="font-mono font-medium">{username}</span>
          </p>
          <p className="text-slate-700 dark:text-slate-200">
            New Temporary Password: <span className="font-mono font-medium">{tempPassword}</span>
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Please copy and pass this temporary password to the user. They can log in with this
          immediately or change it under their Settings tab.
        </p>
        <button onClick={onClose} className="w-full bg-slate-900 dark:bg-slate-700 text-white rounded px-4 py-2 text-sm">
          Done
        </button>
      </div>
    </div>
  );
}
