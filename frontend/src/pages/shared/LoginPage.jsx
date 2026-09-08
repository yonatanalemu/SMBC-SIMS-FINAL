import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import PasswordInput from "../../components/PasswordInput";
import smbcLogo from "../../assets/smbc-logo.png";

const ROLE_ROUTES = {
  admin: "/admin", registrar: "/registrar/students", finance: "/finance",
  dept_head: "/dept-head/attendance", teacher: "/teacher/grades", student: "/student/payments",
};

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const sessionExpired = searchParams.get("expired") === "true";

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(username, password);
      navigate(ROLE_ROUTES[data.user.role] || "/login");
    } catch (err) {
      if (err?.response?.status === 401) setError("Invalid username or password");
      else if (err?.code === "ERR_NETWORK" || !err?.response) setError("Can't reach the server — try again shortly");
      else setError(err?.response?.data?.error || "Something went wrong logging in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md w-full max-w-xs sm:w-80 overflow-hidden">
          <div className="bg-slate-900 px-6 sm:px-8 py-6 flex flex-col items-center gap-2">
            <img src={smbcLogo} alt="SMBC" className="h-14 sm:h-16 w-auto" />
            <p className="font-display text-slate-300 text-sm text-center tracking-wide">
              Login to your account
            </p>
          </div>
          <div className="p-6 sm:p-8 space-y-4">
            {sessionExpired && !error && (
              <p className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded px-3 py-2">
                Your session expired — please sign in again.
              </p>
            )}
            <input
              className="w-full border rounded px-3 py-2"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <PasswordInput
              className="w-full border rounded px-3 py-2"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button className="w-full bg-teal-600 text-white rounded-lg py-2 disabled:opacity-50" type="submit" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </div>
        </form>
      </div>

      <footer className="bg-slate-900 pt-8 sm:pt-10 pb-6 px-6">
        <div className="w-full grid grid-cols-3 items-start gap-6">
          <div className="flex flex-col items-start gap-2 text-left">
            <img src={smbcLogo} alt="SMBC" className="h-10 sm:h-12 w-auto" />
            <p className="font-display text-slate-300 text-xs sm:text-sm">
              Sitti Medical and Business College
            </p>
          </div>

          <div className="flex flex-col items-center text-center">
            <h3 className="font-display text-slate-100 text-xs sm:text-sm font-semibold tracking-wide mb-3">
              Quick Links
            </h3>
            <a
              href="https://smbcet.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-300 text-xs sm:text-sm hover:text-white transition-colors"
            >
              Website
            </a>
          </div>

          <div className="flex flex-col items-end text-right">
            <h3 className="font-display text-slate-100 text-xs sm:text-sm font-semibold tracking-wide mb-3">
              Social Media
            </h3>
            <a
              href="#"
              className="text-slate-300 text-xs sm:text-sm hover:text-white transition-colors"
            >
              Telegram
            </a>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-6 sm:mt-8 pt-4 text-center">
          <p className="text-slate-400 text-xs">
            © {new Date().getFullYear()} Sitti Medical and Business College. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}