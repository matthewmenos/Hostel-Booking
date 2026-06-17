import { useEffect, useState } from "react";
import { ShieldCheck, Users, Building2, BookOpen } from "lucide-react";
import { adminApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonBookingRow, SkeletonCard } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";

const TABS = [
  { id: "users",    label: "Users",    icon: Users },
  { id: "hostels",  label: "Hostels",  icon: Building2 },
  { id: "bookings", label: "Bookings", icon: BookOpen },
];

const ROLE_STYLES = {
  student:    "bg-blue-100 text-blue-700",
  manager:    "bg-teal-100 text-teal-700",
  superadmin: "bg-purple-100 text-purple-700",
};

export default function AdminPage() {
  const [tab, setTab] = useState("users");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="text-brand" size={28} />
        <h1 className="text-2xl font-bold">Superadmin Dashboard</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors
              ${tab === id ? "border-b-2 border-brand text-brand" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon size={15}/> {label}
          </button>
        ))}
      </div>

      {tab === "users"    && <UsersTab />}
      {tab === "hostels"  && <HostelsTab />}
      {tab === "bookings" && <BookingsTab />}
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { addToast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.users().then(({ data }) => setUsers(data.results ?? data)).finally(() => setLoading(false));
  }, []);

  const updateUser = async (id, payload) => {
    try {
      const { data } = await adminApi.updateUser(id, payload);
      setUsers((prev) => prev.map((u) => u.id === id ? data : u));
      addToast("success", "User updated.");
    } catch {
      addToast("error", "Could not update user.");
    }
  };

  if (loading) return <div className="space-y-3">{[1,2,3,4].map(i=><SkeletonBookingRow key={i}/>)}</div>;
  if (users.length === 0) return <p className="text-gray-500">No users found.</p>;

  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className={`card p-4 flex flex-wrap items-center justify-between gap-3
          ${!u.is_active ? "opacity-60" : ""}`}>
          <div>
            <div className="flex items-center gap-2">
              <p className={`font-semibold ${!u.is_active ? "line-through text-gray-400" : ""}`}>{u.username}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                {u.role}
              </span>
              {!u.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-500">Inactive</span>}
            </div>
            <p className="text-sm text-gray-500">{u.email} {u.university ? `· ${u.university}` : ""}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {u.role !== "superadmin" && (
              <button
                onClick={() => updateUser(u.id, { role: u.role === "manager" ? "student" : "manager" })}
                className="btn-ghost px-2.5 py-1 text-xs">
                → {u.role === "manager" ? "Student" : "Manager"}
              </button>
            )}
            <button
              onClick={() => updateUser(u.id, { is_active: !u.is_active })}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition
                ${u.is_active
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-green-200 text-green-600 hover:bg-green-50"}`}>
              {u.is_active ? "Deactivate" : "Activate"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Hostels tab ───────────────────────────────────────────────────────────────

function HostelsTab() {
  const { addToast } = useToast();
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.hostels().then(({ data }) => setHostels(data.results ?? data)).finally(() => setLoading(false));
  }, []);

  const toggle = async (hostel) => {
    try {
      const fn = hostel.is_active ? adminApi.deactivateHostel : adminApi.activateHostel;
      const { data } = await fn(hostel.slug);
      setHostels((prev) => prev.map((h) => h.slug === hostel.slug ? data : h));
      addToast("success", hostel.is_active ? "Hostel deactivated." : "Hostel activated.");
    } catch {
      addToast("error", "Could not update hostel.");
    }
  };

  if (loading) return <div className="grid gap-4 sm:grid-cols-2">{[1,2,3,4].map(i=><SkeletonCard key={i}/>)}</div>;
  if (hostels.length === 0) return <p className="text-gray-500">No hostels found.</p>;

  return (
    <div className="space-y-2">
      {hostels.map((h) => (
        <div key={h.slug} className={`card p-4 flex flex-wrap items-center justify-between gap-3
          ${!h.is_active ? "opacity-60" : ""}`}>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold">{h.name}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium
                ${h.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"}`}>
                {h.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {h.campus_display} · {h.location} · Owner: {h.owner_username}
            </p>
            <p className="text-xs text-gray-400">
              {h.booking_count} booking{h.booking_count !== 1 ? "s" : ""} · GHS {h.base_price}/bed
            </p>
          </div>
          <button
            onClick={() => toggle(h)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition
              ${h.is_active
                ? "border-red-200 text-red-600 hover:bg-red-50"
                : "border-green-200 text-green-600 hover:bg-green-50"}`}>
            {h.is_active ? "Deactivate" : "Activate"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = (paymentStatus) => {
    setLoading(true);
    adminApi.bookings(paymentStatus ? { payment_status: paymentStatus } : {})
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(statusFilter); }, [statusFilter]);

  const refund = async (id) => {
    try {
      const { data } = await adminApi.refundBooking(id);
      setBookings((prev) => prev.map((b) => b.id === id ? data : b));
      addToast("success", "Booking marked as refunded.");
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not refund booking.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="label mb-0">Filter by status:</label>
        <select className="input max-w-xs" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All</option>
          {Object.entries(STATUS_UI).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading && <div className="space-y-3">{[1,2,3].map(i=><SkeletonBookingRow key={i}/>)}</div>}
      {!loading && bookings.length === 0 && <p className="text-gray-500">No bookings found.</p>}

      <div className="space-y-2">
        {bookings.map((b) => {
          const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
          const Icon = ui.icon;
          return (
            <div key={b.id} className="card p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {b.student_username ?? `Student #${b.student}`}
                  <span className="ml-2 text-sm font-normal text-gray-500">→ {b.hostel_name}</span>
                </p>
                <p className="text-sm text-gray-500">
                  {b.room_type} · GHS {b.amount} · #{b.id}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(b.created_at).toLocaleDateString("en-GH", { day:"numeric", month:"short", year:"numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${ui.cls}`}>
                  <Icon size={16}/> {ui.label}
                </span>
                {b.payment_status === "paid" && (
                  <button
                    onClick={() => refund(b.id)}
                    className="rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50">
                    Refund
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
