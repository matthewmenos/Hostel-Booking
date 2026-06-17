import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const ROLE_OPTIONS = [
  { value: "student", label: "Student — I want to book a bed" },
  { value: "manager", label: "Hostel Manager — I run a hostel" },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "",
    email: "",
    first_name: "",
    last_name: "",
    password: "",
    confirm_password: "",
    role: "student",
    university: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    if (form.password.length < 8) errs.password = "Password must be at least 8 characters.";
    if (form.password !== form.confirm_password) errs.confirm_password = "Passwords do not match.";
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const clientErrors = validate();
    if (Object.keys(clientErrors).length) { setErrors(clientErrors); return; }

    setErrors({});
    setBusy(true);
    try {
      const { confirm_password, ...payload } = form;
      const user = await register(payload);
      navigate(user.role === "superadmin" ? "/admin" : user.role === "manager" ? "/manager" : "/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        setErrors(data);
      } else {
        setErrors({ non_field: "Registration failed. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key) =>
    errors[key] ? (
      <p className="mt-1 text-xs text-red-600">{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold">Create account</h1>
        <p className="mt-1 text-sm text-gray-500">Join HostelHub Ghana — it's free</p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        {errors.non_field && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errors.non_field}
          </div>
        )}

        {/* Role picker */}
        <div>
          <label className="label">I am a</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: o.value }))}
                className={`rounded-lg border p-3 text-left text-sm transition
                  ${form.role === o.value
                    ? "border-brand bg-brand/5 text-brand font-medium"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name row */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" autoComplete="given-name" value={form.first_name} onChange={set("first_name")} />
            {fieldError("first_name")}
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" autoComplete="family-name" value={form.last_name} onChange={set("last_name")} />
            {fieldError("last_name")}
          </div>
        </div>

        <div>
          <label className="label">Username</label>
          <input
            className="input"
            autoComplete="username"
            value={form.username}
            onChange={set("username")}
            required
          />
          {fieldError("username")}
        </div>

        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            required
          />
          {fieldError("email")}
        </div>

        {form.role === "student" && (
          <div>
            <label className="label">University</label>
            <input
              className="input"
              placeholder="e.g. KNUST, University of Ghana…"
              value={form.university}
              onChange={set("university")}
            />
            {fieldError("university")}
          </div>
        )}

        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-400">Minimum 8 characters</p>
          {fieldError("password")}
        </div>

        <div>
          <label className="label">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              required
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {fieldError("confirm_password")}
        </div>

        <button className="btn-primary w-full flex items-center justify-center gap-2" disabled={busy}>
          {busy ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <UserPlus size={16} />
          )}
          {busy ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
