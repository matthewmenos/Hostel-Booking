import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Eye, EyeOff, Building2, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [form, setForm]     = useState({ username: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError]   = useState(null);
  const [busy, setBusy]     = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(form.username, form.password);
      const dest = location.state?.from?.pathname
        ?? (user.role === "superadmin" ? "/admin" : user.role === "manager" ? "/manager" : "/dashboard");
      navigate(dest, { replace: true });
    } catch {
      setError("Incorrect username or password. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-sm py-8 animate-fadeInUp">
      {/* Brand mark */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg">
          <Building2 size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Welcome back</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your HostelHub account</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-4">
        {error && (
          <div className="alert-error text-sm">
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="label">Username</label>
          <input
            className="input"
            autoComplete="username"
            placeholder="your_username"
            value={form.username}
            onChange={set("username")}
            required
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs font-medium text-brand hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-10"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={set("password")}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
            >
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary w-full mt-1"
          disabled={busy}
        >
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <ArrowRight size={16} />
          )}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Don't have an account?{" "}
        <Link to="/register" className="font-semibold text-brand hover:underline">
          Create one free
        </Link>
      </p>
    </div>
  );
}
