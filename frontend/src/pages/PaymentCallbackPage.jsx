import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { bookingApi } from "../api/endpoints.js";

export default function PaymentCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get("reference");

  const [state, setState] = useState("verifying"); // verifying | success | failed | no_ref

  useEffect(() => {
    if (!reference) {
      setState("no_ref");
      return;
    }
    bookingApi.verifyPayment(reference)
      .then(({ data }) => {
        const s = data.status;
        if (s === "paid_awaiting_approval" || s === "paid") {
          setState("success");
          // Redirect to dashboard after brief success display.
          setTimeout(() => navigate("/dashboard/bookings"), 3000);
        } else {
          setState("pending");
        }
      })
      .catch(() => setState("failed"));
  }, [reference, navigate]);

  if (state === "verifying") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Loader2 size={48} className="animate-spin text-brand" />
        <p className="text-lg font-medium">Verifying your payment…</p>
        <p className="text-sm text-gray-400">Please wait, this only takes a moment.</p>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <CheckCircle2 size={56} className="text-green-500" />
        <h1 className="text-2xl font-bold">Payment Successful!</h1>
        <p className="text-gray-500 max-w-sm">
          Your booking is confirmed and awaiting admin approval. You'll receive an email once it's approved.
        </p>
        <p className="text-sm text-gray-400">Redirecting to your dashboard…</p>
        <Link to="/dashboard/bookings" className="btn-primary px-6 py-2 mt-2">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Loader2 size={48} className="text-amber-500" />
        <h1 className="text-2xl font-bold">Payment Pending</h1>
        <p className="text-gray-500 max-w-sm">
          Your payment is being processed. Check your dashboard for updates — it may take a few minutes.
        </p>
        <Link to="/dashboard/bookings" className="btn-primary px-6 py-2 mt-2">
          View My Bookings
        </Link>
      </div>
    );
  }

  // failed or no_ref
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <XCircle size={56} className="text-red-500" />
      <h1 className="text-2xl font-bold">Payment Not Confirmed</h1>
      <p className="text-gray-500 max-w-sm">
        {state === "no_ref"
          ? "No payment reference found in the URL."
          : "We couldn't confirm your payment right now. If you were charged, your booking will update automatically within a few minutes via webhook."}
      </p>
      <div className="flex gap-3 mt-2">
        <Link to="/dashboard/bookings" className="btn-primary px-5 py-2">
          My Bookings
        </Link>
        <Link to="/" className="btn-ghost px-5 py-2">
          Browse Hostels
        </Link>
      </div>
    </div>
  );
}
