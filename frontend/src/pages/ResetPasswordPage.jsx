import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle2, ArrowLeft } from "lucide-react";
import { authApi } from "../api/endpoints.js";

export default function ResetPasswordPage() {
  const { uid, token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await authApi.confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Invalid or expired reset link.");
    } finally {
      setBusy(false);
    }
  };

  if (done) return (
    <div className="mx-auto max-w-md pt-16">
      <div className="card p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold">Password reset!</h1>
        <p className="text-sm text-gray-500">Your password has been updated. You can now log in.</p>
        <button onClick={() => navigate("/login")} className="btn-primary px-6 py-2.5">
          Go to login
        </button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-md pt-16">
      <div className="card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Set new password</h1>
          <p className="mt-1 text-sm text-gray-500">Choose a strong password for your account.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">New password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPw ? "text" : "password"}
                className="input pl-9 pr-10"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirm password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type={showPw ? "text" : "password"}
                className="input pl-9"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {busy ? "Saving…" : "Reset password"}
          </button>
        </form>

        <Link to="/login" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  );
}
