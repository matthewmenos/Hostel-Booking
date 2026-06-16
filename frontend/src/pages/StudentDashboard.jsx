import { useEffect, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { bookingApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_UI = {
  paid: { icon: CheckCircle2, cls: "text-green-600", label: "Paid" },
  pending: { icon: Clock, cls: "text-amber-600", label: "Pending payment" },
  failed: { icon: XCircle, cls: "text-red-600", label: "Failed" },
  expired: { icon: XCircle, cls: "text-gray-400", label: "Expired" },
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bookingApi
      .myBookings()
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Welcome, {user?.username}</h1>
      <p className="mb-6 text-gray-500">Your bookings and payment status.</p>

      {loading && <p className="text-gray-500">Loading…</p>}
      {!loading && bookings.length === 0 && (
        <p className="text-gray-500">You have no bookings yet.</p>
      )}

      <div className="space-y-3">
        {bookings.map((b) => {
          const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
          const Icon = ui.icon;
          return (
            <div key={b.id} className="card flex items-center justify-between p-4">
              <div>
                <p className="font-semibold">{b.hostel_name}</p>
                <p className="text-sm text-gray-500">
                  {b.room_type} · GHS {b.amount} · Booking #{b.id}
                </p>
              </div>
              <span className={`flex items-center gap-1 text-sm font-medium ${ui.cls}`}>
                <Icon size={18} /> {ui.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
