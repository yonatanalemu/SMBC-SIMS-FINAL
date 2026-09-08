import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "../../components/DashboardLayout";
import Card from "../../components/Card";
import PasswordInput from "../../components/PasswordInput";
import api from "../../api/client";
import { useTheme } from "../../context/ThemeContext";

function passwordStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
  const colors = ["bg-red-500", "bg-red-400", "bg-amber-400", "bg-yellow-400", "bg-teal-500", "bg-teal-600"];
  return { score, label: labels[score], color: colors[score] };
}

export default function SettingsPage() {
  const { tabParam } = useParams();
  const tab = tabParam ? tabParam[0].toUpperCase() + tabParam.slice(1) : "Profile";
  const [profile, setProfile] = useState(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const { dark, toggle } = useTheme();

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState("");

  useEffect(() => {
    api.get("/auth/me").then(({ data }) => {
      setProfile(data);
      setPhone(data.phone || "");
      setEmail(data.email || "");
    });
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setProfileMsg("");
    try {
      await api.patch("/auth/me", { phone, email });
      setProfileMsg("Saved.");
    } catch (err) {
      setProfileMsg(err?.response?.data?.error || "Could not save");
    }
  }

  async function changePassword(e) {
    e.preventDefault();
    setPwMsg("");
    if (pwForm.next !== pwForm.confirm) return setPwMsg("New passwords don't match");
    try {
      await api.post("/auth/change-password", { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwMsg("Password updated.");
      setPwForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwMsg(err?.response?.data?.error || "Could not change password");
    }
  }

  const strength = passwordStrength(pwForm.next);

  return (
    <DashboardLayout>
      {tab === "Profile" && profile && (
        <Card title="Profile">
          <form onSubmit={saveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg text-sm">
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Full Name</label>
              <p className="dark:text-slate-100">{profile.fullName || "—"}</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Username (Read-Only)</label>
              <p className="dark:text-slate-100 font-mono">{profile.username}</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Department</label>
              <p className="dark:text-slate-100">{profile.department || "—"}</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Level</label>
              <p className="dark:text-slate-100">{profile.level || "—"}</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Phone Number</label>
              <input className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1"
                value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-400 text-xs">Email Address</label>
              <input className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-2 py-1"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="col-span-2 bg-teal-600 text-white rounded-lg py-2 text-sm mt-2" type="submit">
              Save Changes
            </button>
            {profileMsg && <p className="col-span-2 text-sm text-slate-600 dark:text-slate-300">{profileMsg}</p>}
          </form>
        </Card>
      )}

      {tab === "Display" && (
        <Card title="Display">
          <div className="flex items-center justify-between max-w-sm">
            <span className="text-sm dark:text-slate-200">Dark Mode</span>
            <button
              onClick={toggle}
              className={`w-12 h-6 rounded-full relative transition-colors ${dark ? "bg-slate-700" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 bg-white rounded-full transition-transform ${dark ? "translate-x-6" : "translate-x-0.5"}`} />
            </button>
          </div>
        </Card>
      )}

      {tab === "Password" && (
        <Card title="Change Password">
          <form onSubmit={changePassword} className="max-w-sm space-y-3 text-sm">
            <PasswordInput
              placeholder="Current Password"
              className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={pwForm.current} onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
            />
            <PasswordInput
              placeholder="New Password"
              className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={pwForm.next} onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
            />
            {pwForm.next && (
              <div>
                <div className="h-1.5 rounded bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div className={`h-full ${strength.color}`} style={{ width: `${(strength.score / 5) * 100}%` }} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{strength.label}</p>
              </div>
            )}
            <PasswordInput
              placeholder="Confirm New Password"
              className="w-full border border-navy-950/15 dark:border-slate-600 dark:bg-slate-700 dark:text-white rounded-lg px-3 py-2"
              value={pwForm.confirm} onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
            />
            <button className="w-full bg-teal-600 text-white rounded-lg py-2" type="submit">Update Password</button>
            {pwMsg && <p className="text-slate-600 dark:text-slate-300">{pwMsg}</p>}
          </form>
        </Card>
      )}
    </DashboardLayout>
  );
}
