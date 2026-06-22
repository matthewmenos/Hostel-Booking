import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { BedDouble, CalendarDays, Clock, ArrowLeft, ChevronRight } from "lucide-react";
import { hostelApi, tenantApi, bookingApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

function today() {
  return new Date().toISOString().split("T")[0];
}

export default function BookingPage() {
  const { slug, bedId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthed } = useAuth();
  const { addToast } = useToast();

  const [hostel, setHostel] = useState(null);
  const [bed, setBed] = useState(null);
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [checkIn, setCheckIn] = useState(today());
  const [months, setMonths] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthed || user?.role !== "student") {
      navigate("/login");
      return;
    }
    Promise.all([hostelApi.get(slug), tenantApi.rooms(slug)])
      .then(([hRes, rRes]) => {
        const h = hRes.data;
        const rooms = rRes.data.results ?? rRes.data;
        setHostel(h);
        for (const r of rooms) {
          const found = r.beds.find((b) => String(b.id) === String(bedId));
          if (found) {
            if (found.is_occupied) {
              setError("This bed has already been taken.");
            }
            setBed(found);
            setRoom(r);
            break;
          }
        }
        setMonths(h.min_stay_months ?? 1);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load hostel details.");
        setLoading(false);
      });
  }, [slug, bedId, isAuthed, user, navigate]);

  const minMonths = hostel?.min_stay_months ?? 1;
  const totalAmount = hostel ? (parseFloat(hostel.base_price) * months).toFixed(2) : "0.00";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!bed || !hostel) return;
    if (months < minMonths) {
      addToast("error", `Minimum stay is ${minMonths} month${minMonths > 1 ? "s" : ""}.`);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await bookingApi.book({
        hostel: slug,
        bed_space_id: bed.id,
        provider: "paystack",
        check_in_date: checkIn,
        duration_months: months,
      });
      const payUrl = data.payment?.authorization_url;
      // In dev mode the stub URL points to checkout.paystack.com/stub/... which is a dead page.
      // Detect it and fall back to dashboard so the student isn't left stranded.
      const isStub = data.payment?.stub === true || payUrl?.includes("/stub/");
      if (payUrl && !isStub) {
        window.location.href = payUrl;
      } else {
        addToast("success", `Booking #${data.booking.id} created. Complete payment from your dashboard.`);
        navigate("/dashboard/bookings");
      }
    } catch (err) {
      const detail = err.response?.data?.detail ?? "Booking failed. Please try again.";
      // 409 = student already has an active booking
      if (err.response?.status === 409) {
        addToast("error", detail);
        navigate("/dashboard/bookings");
        return;
      }
      addToast("error", detail);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-10 space-y-4 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-2xl" />
      </div>
    );
  }

  if (error || !bed || !room) {
    return (
      <div className="max-w-lg mx-auto mt-10 text-center space-y-4">
        <div className="alert-error">{error ?? "Bed not found."}</div>
        <Link to={`/hostels/${slug}`} className="btn-ghost inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to hostel
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 animate-fadeInUp">
      {/* Back link */}
      <Link to={`/hostels/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition">
        <ArrowLeft size={15} /> Back to {hostel.name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Confirm Booking</h1>
        <p className="text-sm text-gray-500 mt-0.5">Review your selection before proceeding to payment.</p>
      </div>

      {/* Bed summary card */}
      <div className="card p-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <BedDouble size={20} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100">{hostel.name}</p>
            <p className="text-sm text-gray-500">Block {room.block} · Room {room.room_number} · {bed.bed_label}</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between text-sm">
          <span className="text-gray-500">Price per month</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">GHS {parseFloat(hostel.base_price).toFixed(2)}</span>
        </div>
        {hostel.min_stay_months > 1 && (
          <div className="mt-2 alert-warn text-xs">Minimum stay: {hostel.min_stay_months} month{hostel.min_stay_months > 1 ? "s" : ""}</div>
        )}
      </div>

      {/* Booking form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        {/* Check-in date */}
        <div>
          <label className="label flex items-center gap-2"><CalendarDays size={14} className="text-brand" /> Check-in date</label>
          <input type="date" min={today()} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required className="input" />
        </div>

        {/* Duration */}
        <div>
          <label className="label flex items-center gap-2"><Clock size={14} className="text-brand" /> Duration</label>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setMonths((m) => Math.max(minMonths, m - 1))} disabled={months <= minMonths}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-40">−</button>
            <span className="w-12 text-center text-xl font-bold text-gray-900 dark:text-gray-100">{months}</span>
            <button type="button" onClick={() => setMonths((m) => Math.min(12, m + 1))} disabled={months >= 12}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-gray-600 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-40">+</button>
            <span className="text-sm text-gray-500">month{months > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Price summary */}
        <div className="rounded-2xl bg-brand/5 dark:bg-brand/10 border border-brand/10 p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>GHS {parseFloat(hostel.base_price).toFixed(2)} × {months} month{months > 1 ? "s" : ""}</span>
            <span>GHS {totalAmount}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-brand/20 pt-2">
            <span className="text-gray-900 dark:text-gray-100">Total due</span>
            <span className="text-brand">GHS {totalAmount}</span>
          </div>
        </div>

        <button type="submit" disabled={submitting}
          className="btn-primary w-full py-3 text-base disabled:opacity-60">
          {submitting ? "Processing…" : <><ChevronRight size={18} /> Confirm &amp; Pay</>}
        </button>

        <p className="text-center text-xs text-gray-400">
          You'll be redirected to Paystack to complete payment securely.
        </p>
      </form>
    </div>
  );
}
