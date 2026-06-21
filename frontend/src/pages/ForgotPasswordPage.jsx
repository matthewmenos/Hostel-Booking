import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { authApi } from "../api/endpoints.js";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setBusy(true);
    try {
      await authApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) return (
    <div className="mx-auto max-w-md pt-16">
      <div className="card p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 size={28} className="text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-xl font-bold">Check your email</h1>
        <p className="text-sm text-gray-500">
          If <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span> is
          registered, you'll receive a reset link shortly. Check your spam folder if it doesn't arrive.
        </p>
        <Link to="/login" className="inline-flex items-center gap-1 text-sm text-brand hover:underline">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-md pt-16">
      <div className="card p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Forgot password?</h1>
          <p className="mt-1 text-sm text-gray-500">
            Enter your account email and we'll send you a reset link.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                className="input pl-9"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>

        <Link to="/login" className="flex items-center gap-1 text-sm text-gray-500 hover:text-brand">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </div>
  );
}
