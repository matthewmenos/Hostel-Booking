import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Building2, GraduationCap, Landmark, BookOpen, ArrowRight } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";

const UNI_CATEGORIES = [
  { value: "public",  icon: Landmark,      label: "Public",  options: PUBLIC_UNIVERSITIES },
  { value: "private", icon: GraduationCap, label: "Private", options: PRIVATE_UNIVERSITIES },
];

const ROLES = [
  {
    value: "student",
    icon:  BookOpen,
    label: "Student",
    desc:  "I want to find and book a hostel bed",
  },
  {
    value: "manager",
    icon:  Building2,
    label: "Hostel Manager",
    desc:  "I manage a hostel and want to list it",
  },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate      = useNavigate();

  const [form, setForm] = useState({
    username: "", email: "", first_name: "", last_name: "",
    password: "", confirm_password: "", role: "student", university: "",
  });
  const [showPw, setShowPw]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors]         = useState({});
  const [busy, setBusy]             = useState(false);
  const [uniCat, setUniCat]         = useState("public");

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }));
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const validate = () => {
    const errs = {};
    if (!form.username.trim()) errs.username = "Username is required.";
    if (!form.email.trim())    errs.email    = "Email is required.";
    if (form.password.length < 8) errs.password = "Must be at least 8 characters.";
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
      navigate(user.role === "manager" ? "/manager" : "/dashboard", { replace: true });
    } catch (err) {
      const data = err.response?.data;
      setErrors(data && typeof data === "object" ? data : { non_field: "Registration failed. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const fieldError = (key) =>
    errors[key] ? (
      <p className="field-error">{Array.isArray(errors[key]) ? errors[key][0] : errors[key]}</p>
    ) : null;

  return (
    <div className="mx-auto max-w-md py-8 animate-fadeInUp">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-white shadow-lg">
          <Building2 size={26} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Create your account</h1>
          <p className="mt-1 text-sm text-gray-500">Join HostelHub Ghana — it's free</p>
        </div>
      </div>

      <form onSubmit={submit} className="card p-6 space-y-5">
        {errors.non_field && (
          <div className="alert-error">{errors.non_field}</div>
        )}

        {/* Role picker */}
        <div>
          <label className="label">I am a…</label>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = form.role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, role: r.value }))}
                  className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3.5 text-left transition
                    ${active
                      ? "border-brand bg-brand/5 dark:bg-brand/10"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500"}`}
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-brand text-white" : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"}`}>
                    <Icon size={16} />
                  </div>
                  <span className={`text-sm font-semibold mt-1 ${active ? "text-brand" : "text-gray-800 dark:text-gray-200"}`}>{r.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{r.desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" autoComplete="given-name" placeholder="Ada" value={form.first_name} onChange={set("first_name")} />
            {fieldError("first_name")}
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" autoComplete="family-name" placeholder="Mensah" value={form.last_name} onChange={set("last_name")} />
            {fieldError("last_name")}
          </div>
        </div>

        {/* Username */}
        <div>
          <label className="label">Username</label>
          <input className="input" autoComplete="username" placeholder="ada_mensah" value={form.username} onChange={set("username")} required />
          {fieldError("username")}
        </div>

        {/* Email */}
        <div>
          <label className="label">Email address</label>
          <input type="email" className="input" autoComplete="email" placeholder="ada@example.com" value={form.email} onChange={set("email")} required />
          {fieldError("email")}
        </div>

        {/* University — student only */}
        {form.role === "student" && (
          <div>
            <label className="label">University</label>
            <div className="flex rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden mb-2">
              {UNI_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => { setUniCat(cat.value); setForm((f) => ({ ...f, university: "" })); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition
                      ${uniCat === cat.value
                        ? "bg-brand text-white"
                        : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"}`}
                  >
                    <Icon size={13} /> {cat.label}
                  </button>
                );
              })}
            </div>
            <select className="input" value={form.university} onChange={set("university")}>
              <option value="">— Select your university —</option>
              {UNI_CATEGORIES.find((c) => c.value === uniCat)?.options.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
            {fieldError("university")}
          </div>
        )}

        {/* Password */}
        <div>
          <label className="label">Password</label>
          <div className="relative">
            <input
              type={showPw ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              value={form.password}
              onChange={set("password")}
              required minLength={8}
            />
            <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600">
              {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldError("password")}
        </div>

        {/* Confirm */}
        <div>
          <label className="label">Confirm password</label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              className="input pr-10"
              autoComplete="new-password"
              placeholder="Repeat password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              required
            />
            <button type="button" tabIndex={-1} onClick={() => setShowConfirm((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {fieldError("confirm_password")}
        </div>

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            : <ArrowRight size={16} />}
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand hover:underline">Sign in</Link>
      </p>
    </div>
  );
}
