import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(form.username, form.password);
      const dest =
        location.state?.from?.pathname ??
        (user.role === "superadmin" ? "/admin" : user.role === "manager" ? "/manager" : "/dashboard");
      navigate(dest, { replace: true });
    } catch {
      setError("Invalid username or password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your HostelHub account</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="label">Username</label>
          <input
            className="input"
            autoComplete="username"
            value={form.username}
            onChange={set("username")}
            required
          />
        </div>

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-10"
              autoComplete="current-password"
              value={form.password}
              onChange={set("password")}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy}>
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <LogIn size={16} />
          )}
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-gray-500">
          No account?{" "}
          <Link to="/register" className="font-medium text-brand hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </div>
  );
}
