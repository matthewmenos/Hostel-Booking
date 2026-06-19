import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Download, Wrench, Landmark, GraduationCap, CheckCircle2, MessageSquare, Users, Megaphone } from "lucide-react";
import { bookingApi, authApi, notifApi, tenantApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useChat } from "../context/ChatContext.jsx";
import { SkeletonBookingRow } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";

const UNI_CATEGORIES = [
  { value: "public",  icon: Landmark,      label: "Public",  options: PUBLIC_UNIVERSITIES },
  { value: "private", icon: GraduationCap, label: "Private", options: PRIVATE_UNIVERSITIES },
];

const TABS = [
  { id: "bookings",      label: "My Bookings" },
  { id: "groups",        label: "My Groups" },
  { id: "announcements", label: "Announcements" },
  { id: "report",        label: "Report Issue" },
  { id: "profile",       label: "Profile" },
];

const VALID_TABS = TABS.map((t) => t.id);

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const tab = VALID_TABS.includes(tabParam) ? tabParam : "bookings";
  const setTab = (t) => navigate(`/dashboard/${t}`, { replace: true });

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

      {tab === "bookings"      && <BookingsTab />}
      {tab === "groups"        && <GroupsPreviewTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "report"        && <ReportTab />}
      {tab === "profile"       && <ProfileTab />}
    </div>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextUrl, setNextUrl] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    bookingApi.myBookings()
      .then(({ data }) => {
        setBookings(data.results ?? data);
        setNextUrl(data.next ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loadMore = () => {
    if (!nextUrl || loadingMore) return;
    setLoadingMore(true);
    import("../api/axios.js").then(({ default: api }) =>
      api.get(nextUrl.replace(/^.*\/api/, ""))
        .then(({ data }) => {
          setBookings((prev) => [...prev, ...(data.results ?? data)]);
          setNextUrl(data.next ?? null);
        })
        .finally(() => setLoadingMore(false))
    );
  };

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
                <button
                  onClick={() => bookingApi.downloadReceipt(b.id)}
                  className="btn-ghost px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
                >
                  <Download size={14} /> Download Receipt
                </button>
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

      {nextUrl && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="btn-ghost w-full py-2 text-sm"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      )}
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
  // Derive initial category from the saved university value
  const initCat = () => {
    const saved = user?.university ?? "";
    if (!saved) return "public";
    return PRIVATE_UNIVERSITIES.some((u) => u.value === saved) ? "private" : "public";
  };
  const [uniCat, setUniCat] = useState(initCat);

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

      <div className="space-y-2">
        <label className="label">University</label>
        <div className="grid grid-cols-2 gap-2">
          {UNI_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => {
                setUniCat(cat.value);
                setForm((f) => ({ ...f, university: "" }));
              }}
              className={`flex items-center gap-1.5 rounded-lg border p-2.5 text-sm font-medium transition
                ${uniCat === cat.value
                  ? "border-brand bg-brand/5 text-brand"
                  : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300"}`}
            >
              <cat.icon size={14} className="shrink-0" />
              {cat.label}
            </button>
          ))}
        </div>
        <select className="input" value={form.university}
          onChange={(e) => setForm({...form, university: e.target.value})}>
          <option value="">— Select university —</option>
          {UNI_CATEGORIES.find((c) => c.value === uniCat)?.options.map((u) => (
            <option key={u.value} value={u.value}>{u.label}</option>
          ))}
        </select>
      </div>

      <button className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

// ── Report Issue tab ──────────────────────────────────────────────────────────

function ReportTab() {
  const { addToast } = useToast();
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    bookingApi.myBookings()
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoadingBookings(false));
  }, []);

  const activeBooking = bookings.find((b) =>
    b.payment_status === "paid_awaiting_approval" || b.payment_status === "paid"
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { addToast("Please enter a title for your report.", "error"); return; }
    setBusy(true);
    try {
      await notifApi.report({ title: title.trim(), body: body.trim() });
      setDone(true);
      setTitle("");
      setBody("");
    } catch (err) {
      addToast(err.response?.data?.detail ?? "Failed to submit report.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loadingBookings) return (
    <div className="flex justify-center py-16">
      <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );

  if (!activeBooking) return (
    <div className="card p-8 text-center space-y-3 text-gray-400">
      <Wrench size={36} className="mx-auto" />
      <p className="text-sm">You need an active booking to report an issue.</p>
      <p className="text-xs">Reports are automatically sent to the manager of your booked hostel.</p>
    </div>
  );

  if (done) return (
    <div className="card p-8 text-center space-y-3">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
        <CheckCircle2 size={36} className="text-green-600 dark:text-green-400" />
      </div>
      <h3 className="font-bold text-lg">Report Submitted</h3>
      <p className="text-gray-500 text-sm">
        Your report has been sent to the manager of <strong>{activeBooking.hostel_name}</strong>.
        They will look into it shortly.
      </p>
      <button className="btn-primary" onClick={() => setDone(false)}>Submit another</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-4 max-w-lg">
      <div className="flex items-center gap-2 mb-1">
        <Wrench size={18} className="text-brand" />
        <h3 className="font-semibold">Report a Maintenance Issue</h3>
      </div>
      <p className="text-sm text-gray-500">
        Reporting to: <span className="font-medium text-gray-700 dark:text-gray-300">{activeBooking.hostel_name}</span>
      </p>

      <div>
        <label className="label">Issue Title</label>
        <input
          className="input"
          placeholder="e.g. Broken pipe in bathroom"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div>
        <label className="label">Description (optional)</label>
        <textarea
          className="input min-h-[100px]"
          placeholder="Describe the problem in more detail..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Submitting…" : "Submit Report"}
      </button>
    </form>
  );
}

// ── Groups preview tab ────────────────────────────────────────────────────────

function GroupsPreviewTab() {
  const navigate = useNavigate();
  const { rooms, loadingRooms, unreadCount } = useChat();

  if (loadingRooms) return (
    <div className="flex justify-center py-16">
      <span className="h-7 w-7 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );

  if (rooms.length === 0) return (
    <div className="flex flex-col items-center gap-3 py-20 text-gray-400 text-center">
      <MessageSquare size={40} />
      <p className="font-medium text-gray-600">No groups yet</p>
      <p className="text-sm max-w-xs">Your roommate and hostel groups will appear here once your booking is approved.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {rooms.map((room) => (
        <div key={room.id}
          className="card flex items-center gap-4 p-4 cursor-pointer hover:shadow-md transition"
          onClick={() => navigate(`/chat/${room.id}`)}>
          <div className="h-10 w-10 shrink-0 rounded-full bg-brand/10 flex items-center justify-center">
            {room.room_type === "room_group"
              ? <Users size={18} className="text-brand" />
              : <MessageSquare size={18} className="text-brand" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm truncate">{room.name}</p>
              {room.unread_count > 0 && (
                <span className="shrink-0 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                  {room.unread_count > 9 ? "9+" : room.unread_count}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Users size={10} /> {room.member_count} member{room.member_count !== 1 ? "s" : ""}
            </p>
            {room.last_message ? (
              <p className="text-xs text-gray-500 truncate mt-0.5">
                <span className="font-medium">{room.last_message.author_username}:</span>{" "}
                {room.last_message.body_preview}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic mt-0.5">No messages yet</p>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/chat/${room.id}`); }}
            className="btn-secondary text-xs shrink-0">
            Open Chat
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Announcements tab ─────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString();
}

function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hostelName, setHostelName] = useState("");

  useEffect(() => {
    // Get the student's active (approved) booking to find the hostel slug
    bookingApi.myBookings()
      .then(({ data }) => {
        const bookings = data.results ?? data;
        const active = bookings.find((b) => b.payment_status === "approved");
        if (!active?.hostel_slug) {
          setLoading(false);
          return;
        }
        setHostelName(active.hostel_name ?? "Your Hostel");
        return tenantApi.announcements(active.hostel_slug)
          .then(({ data: ann }) => {
            setAnnouncements(Array.isArray(ann) ? ann : (ann.results ?? []));
          });
      })
      .catch(() => setError("Could not load announcements."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <span className="h-7 w-7 animate-spin rounded-full border-4 border-brand border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="py-10 text-center text-sm text-red-500">{error}</div>
  );

  if (!announcements.length) return (
    <div className="flex flex-col items-center gap-3 py-20 text-gray-400 text-center">
      <Megaphone size={40} />
      <p className="font-medium text-gray-600">No announcements yet</p>
      <p className="text-sm max-w-xs">
        {hostelName
          ? `${hostelName} hasn't posted any announcements yet.`
          : "You don't have an approved booking. Announcements appear here once your booking is approved."}
      </p>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Announcements from <span className="font-semibold text-gray-700 dark:text-gray-300">{hostelName}</span></p>
      {announcements.map((ann) => (
        <div key={ann.id} className="card p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-brand/10 flex items-center justify-center">
                <Megaphone size={15} className="text-brand" />
              </div>
              <p className="font-semibold text-sm">{ann.title}</p>
            </div>
            <span className="text-xs text-gray-400 shrink-0">{timeAgo(ann.created_at)}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed pl-10">{ann.body}</p>
        </div>
      ))}
    </div>
  );
}
