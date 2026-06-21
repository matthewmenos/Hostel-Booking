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
      if (payUrl) {
        window.location.href = payUrl;
      } else {
        addToast("success", `Booking #${data.booking.id} created. Complete payment from your dashboard.`);
        navigate("/dashboard/bookings");
      }
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Booking failed. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto mt-10 space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
        <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-xl" />
      </div>
    );
  }

  if (error || !bed || !room) {
    return (
      <div className="max-w-lg mx-auto mt-10 text-center space-y-4">
        <p className="text-red-500">{error ?? "Bed not found."}</p>
        <Link to={`/hostels/${slug}`} className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} /> Back to hostel
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-6 space-y-6">
      {/* Back link */}
      <Link
        to={`/hostels/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-brand transition"
      >
        <ArrowLeft size={15} /> Back to {hostel.name}
      </Link>

      <h1 className="text-2xl font-bold">Confirm Booking</h1>

      {/* Bed summary card */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
            <BedDouble size={20} />
          </span>
          <div>
            <p className="font-semibold">{hostel.name}</p>
            <p className="text-sm text-gray-500">
              Block {room.block} · Room {room.room_number} · {bed.bed_label}
            </p>
          </div>
        </div>
        <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex items-center justify-between text-sm text-gray-500">
          <span>Base price</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">
            GHS {parseFloat(hostel.base_price).toFixed(2)} / month
          </span>
        </div>
        {hostel.min_stay_months > 1 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Minimum stay: {hostel.min_stay_months} months
          </p>
        )}
      </div>

      {/* Booking form */}
      <form onSubmit={handleSubmit} className="card p-5 space-y-5">
        {/* Check-in date */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={15} className="text-brand" /> Check-in date
          </label>
          <input
            type="date"
            min={today()}
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {/* Duration */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Clock size={15} className="text-brand" /> Duration (months)
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMonths((m) => Math.max(minMonths, m - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-40"
              disabled={months <= minMonths}
            >
              −
            </button>
            <span className="w-12 text-center text-xl font-semibold">{months}</span>
            <button
              type="button"
              onClick={() => setMonths((m) => Math.min(12, m + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-lg font-bold hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-40"
              disabled={months >= 12}
            >
              +
            </button>
            <span className="text-sm text-gray-500">month{months > 1 ? "s" : ""}</span>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="rounded-xl bg-brand/5 dark:bg-brand/10 p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">GHS {parseFloat(hostel.base_price).toFixed(2)} × {months} month{months > 1 ? "s" : ""}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t border-brand/20 pt-2">
            <span>Total</span>
            <span className="text-brand">GHS {totalAmount}</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-60"
        >
          {submitting ? "Processing…" : (
            <>Confirm & Pay <ChevronRight size={18} /></>
          )}
        </button>

        <p className="text-center text-xs text-gray-400">
          You'll be redirected to Paystack to complete payment securely.
        </p>
      </form>
    </div>
  );
}
