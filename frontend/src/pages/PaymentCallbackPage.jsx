import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { bookingApi } from "../api/endpoints.js";

export default function PaymentCallbackPage() {
  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const reference   = params.get("reference");
  const [state, setState] = useState("verifying");

  useEffect(() => {
    if (!reference) { setState("no_ref"); return; }
    bookingApi.verifyPayment(reference)
      .then(({ data }) => {
        const s = data.status;
        if (s === "paid_awaiting_approval" || s === "paid") {
          setState("success");
          setTimeout(() => navigate("/dashboard/bookings"), 3000);
        } else {
          setState("pending");
        }
      })
      .catch(() => setState("failed"));
  }, [reference, navigate]);

  if (state === "verifying") return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center animate-fadeIn">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand/10">
        <Loader2 size={36} className="animate-spin text-brand" />
      </div>
      <div>
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verifying your payment…</p>
        <p className="text-sm text-gray-400 mt-1">This only takes a moment.</p>
      </div>
    </div>
  );

  if (state === "success") return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center animate-fadeIn">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 size={40} className="text-green-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payment Successful!</h1>
        <p className="text-gray-500 max-w-sm mt-1.5">
          Your booking is confirmed and awaiting admin approval. You'll receive a notification once it's approved.
        </p>
        <p className="text-sm text-gray-400 mt-2">Redirecting to your dashboard…</p>
      </div>
      <Link to="/dashboard/bookings" className="btn-primary">Go to Dashboard</Link>
    </div>
  );

  if (state === "pending") return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center animate-fadeIn">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
        <Loader2 size={40} className="text-amber-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payment Processing</h1>
        <p className="text-gray-500 max-w-sm mt-1.5">
          Your payment is being processed. Check your dashboard for updates — this usually takes a few minutes.
        </p>
      </div>
      <Link to="/dashboard/bookings" className="btn-primary">View My Bookings</Link>
    </div>
  );

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center animate-fadeIn">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
        <XCircle size={40} className="text-red-500" />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Payment Not Confirmed</h1>
        <p className="text-gray-500 max-w-sm mt-1.5">
          {state === "no_ref"
            ? "No payment reference found in the URL."
            : "We couldn't confirm your payment right now. If you were charged, your booking will update automatically within minutes."}
        </p>
      </div>
      <div className="flex gap-3">
        <Link to="/dashboard/bookings" className="btn-primary">My Bookings</Link>
        <Link to="/" className="btn-ghost">Browse Hostels</Link>
      </div>
    </div>
  );
}
