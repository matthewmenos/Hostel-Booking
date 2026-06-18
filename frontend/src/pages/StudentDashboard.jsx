import { useEffect, useState } from "react";
import { ExternalLink, Download } from "lucide-react";
import { bookingApi, authApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonBookingRow } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";

const UNI_GROUPS = [
  { label: "Public Universities",  options: PUBLIC_UNIVERSITIES },
  { label: "Private Universities", options: PRIVATE_UNIVERSITIES },
];

const TABS = [
  { id: "bookings", label: "My Bookings" },
  { id: "profile",  label: "Profile" },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("bookings");

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Welcome, {user?.first_name || user?.username}</h1>
      <p className="mb-5 text-gray-500">Manage your bookings and account details.</p>

      {/* Tab bar */}
      <div className="mb-5 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors
              ${tab === t.id ? "border-b-2 border-brand text-brand" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings" && <BookingsTab />}
      {tab === "profile"  && <ProfileTab />}
    </div>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    bookingApi.myBookings()
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  const confirmCancel = async (bookingId) => {
    try {
      const { data } = await bookingApi.cancel(bookingId);
      setBookings((prev) => prev.map((b) => b.id === bookingId ? data : b));
      addToast("success", "Booking cancelled.");
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not cancel booking.");
    } finally {
      setCancelTarget(null);
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3].map(i=><SkeletonBookingRow key={i}/>)}</div>;
  if (bookings.length === 0) return <p className="text-gray-500">You have no bookings yet.</p>;

  return (
    <div className="space-y-3">
      {bookings.map((b) => {
        const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
        const Icon = ui.icon;
        const payUrl = b.payments?.[0]?.authorization_url;
        const ref = b.payments?.[0]?.reference;
        const isPending = b.payment_status === "pending";
        const isPaid = b.payment_status === "paid" || b.payment_status === "paid_awaiting_approval";

        return (
          <div key={b.id} className="card p-4 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">{b.hostel_name}</p>
                <p className="text-sm text-gray-500">
                  {b.room_type} · GHS {b.amount} · Booking #{b.id}
                </p>
                {ref && <p className="text-xs text-gray-400">Ref: {ref}</p>}
              </div>
              <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${ui.cls}`}>
                <Icon size={16}/> {ui.label}
              </span>
            </div>

            {/* Paid booking — download receipt */}
            {isPaid && (
              <div className="border-t border-gray-100 pt-3 dark:border-gray-700">
                <a
                  href={bookingApi.receiptUrl(b.id)}
                  download
                  className="btn-ghost px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
                >
                  <Download size={14} /> Download Receipt
                </a>
              </div>
            )}

            {/* Pending-booking actions */}
            {isPending && (
              <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                {payUrl && (
                  <a href={payUrl} target="_blank" rel="noopener noreferrer"
                    className="btn-primary px-3 py-1.5 text-sm">
                    <ExternalLink size={14}/> Complete Payment
                  </a>
                )}

                {cancelTarget === b.id ? (
                  <span className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">Cancel this booking?</span>
                    <button onClick={() => confirmCancel(b.id)}
                      className="rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                      Yes, cancel
                    </button>
                    <button onClick={() => setCancelTarget(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50">
                      Keep
                    </button>
                  </span>
                ) : (
                  <button onClick={() => setCancelTarget(b.id)}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                    Cancel booking
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Profile tab ───────────────────────────────────────────────────────────────

function ProfileTab() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    first_name:  user?.first_name  ?? "",
    last_name:   user?.last_name   ?? "",
    phone:       user?.phone       ?? "",
    university:  user?.university  ?? "",
  });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await authApi.updateMe(form);
      updateUser(data);
      addToast("success", "Profile updated.");
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not update profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card max-w-lg space-y-4 p-6">
      <h2 className="font-semibold text-lg">Personal details</h2>
      <p className="text-sm text-gray-500 -mt-2">Username and email cannot be changed here.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">First name</label>
          <input className="input" value={form.first_name}
            onChange={(e) => setForm({...form, first_name: e.target.value})} />
        </div>
        <div>
          <label className="label">Last name</label>
          <input className="input" value={form.last_name}
            onChange={(e) => setForm({...form, last_name: e.target.value})} />
        </div>
      </div>

      <div>
        <label className="label">Phone number</label>
        <input className="input" type="tel" value={form.phone}
          onChange={(e) => setForm({...form, phone: e.target.value})} />
      </div>

      <div>
        <label className="label">University</label>
        <select className="input" value={form.university}
          onChange={(e) => setForm({...form, university: e.target.value})}>
          <option value="">— Select your university —</option>
          {UNI_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
