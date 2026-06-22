import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Download, Wrench, Landmark, GraduationCap, CheckCircle2, MessageSquare, Users, Megaphone, Clock, UserPlus, Heart, RefreshCw, BarChart3 } from "lucide-react";
import { bookingApi, authApi, notifApi, tenantApi, waitlistApi, roommateApi, renewalApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useChat } from "../context/ChatContext.jsx";
import { SkeletonBookingRow } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";

function useCountdown(isoTimestamp) {
  const [remaining, setRemaining] = useState(() => {
    const ms = new Date(isoTimestamp) - Date.now();
    return ms > 0 ? ms : 0;
  });
  const ref = useRef(null);
  useEffect(() => {
    if (!isoTimestamp) return;
    const tick = () => {
      const ms = new Date(isoTimestamp) - Date.now();
      setRemaining(ms > 0 ? ms : 0);
      if (ms <= 0) clearInterval(ref.current);
    };
    tick();
    ref.current = setInterval(tick, 1000);
    return () => clearInterval(ref.current);
  }, [isoTimestamp]);

  if (!isoTimestamp || remaining <= 0) return null;
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}h ${m}m ${s}s`
    : `${m}m ${s}s`;
}

const UNI_CATEGORIES = [
  { value: "public",  icon: Landmark,      label: "Public",  options: PUBLIC_UNIVERSITIES },
  { value: "private", icon: GraduationCap, label: "Private", options: PRIVATE_UNIVERSITIES },
];

const TABS = [
  { id: "bookings",      label: "My Bookings" },
  { id: "waitlist",      label: "Waitlist" },
  { id: "roommates",     label: "Roommates" },
  { id: "renewal",       label: "Renew Stay" },
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
      <div className="mb-5 flex gap-0 border-b border-gray-200 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap
              ${tab === t.id ? "border-b-2 border-brand text-brand" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bookings"      && <BookingsTab />}
      {tab === "waitlist"      && <WaitlistTab />}
      {tab === "roommates"     && <RoommatesTab />}
      {tab === "renewal"       && <RenewalTab />}
      {tab === "groups"        && <GroupsPreviewTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "report"        && <ReportTab />}
      {tab === "profile"       && <ProfileTab />}
    </div>
  );
}

// ── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({ booking: b, cancelTarget, setCancelTarget, confirmCancel }) {
  const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
  const Icon = ui.icon;
  const payUrl = b.payments?.[0]?.authorization_url;
  const payRef = b.payments?.[0]?.reference;
  const isPending = b.payment_status === "pending";
  const isPaid = b.payment_status === "paid" || b.payment_status === "paid_awaiting_approval";
  const countdown = useCountdown(isPending ? b.expiry_timestamp : null);

  return (
    <div className="card p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{b.hostel_name}</p>
          <p className="text-sm text-gray-500 break-words">
            {b.room_type} · GHS {b.amount} · Booking #{b.id}
          </p>
          {(b.check_in_date || b.duration_months) && (
            <p className="text-xs text-gray-400">
              {b.check_in_date && <>Check-in: {new Date(b.check_in_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
              {b.check_in_date && b.duration_months && " · "}
              {b.duration_months && <>{b.duration_months} month{b.duration_months > 1 ? "s" : ""}</>}
            </p>
          )}
          {payRef && <p className="text-xs text-gray-400 break-all">Ref: {payRef}</p>}
        </div>
        <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${ui.cls}`}>
          <Icon size={16} /> {ui.label}
        </span>
      </div>

      {/* Expiry countdown for pending bookings */}
      {isPending && (
        <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm
          ${countdown ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                      : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"}`}>
          <Wrench size={14} className="shrink-0" />
          {countdown
            ? <span>Bed held for <strong>{countdown}</strong> — complete payment before it expires.</span>
            : <span>This booking has expired. Your bed has been released.</span>}
        </div>
      )}

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
              <ExternalLink size={14} /> Complete Payment
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
      {bookings.map((b) => (
        <BookingCard
          key={b.id}
          booking={b}
          cancelTarget={cancelTarget}
          setCancelTarget={setCancelTarget}
          confirmCancel={confirmCancel}
        />
      ))}

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
    <form onSubmit={submit} className="card w-full max-w-lg space-y-4 p-4 sm:p-6">
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
    <form onSubmit={handleSubmit} className="card w-full p-4 sm:p-6 space-y-4 max-w-lg">
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
          className="input min-h-[80px] sm:min-h-[100px]"
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


// ── Waitlist tab ──────────────────────────────────────────────────────────────

function WaitlistTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    waitlistApi.mine()
      .then(({ data }) => setEntries(data))
      .finally(() => setLoading(false));
  }, []);

  const leave = async (hostelSlug, roomType) => {
    try {
      await waitlistApi.leave(hostelSlug, roomType);
      setEntries((prev) => prev.filter((e) => !(e.hostel_slug === hostelSlug && e.room_type === roomType)));
      addToast("success", "Removed from waitlist.");
    } catch { addToast("error", "Could not leave waitlist."); }
  };

  if (loading) return <div className="flex justify-center py-16"><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" /></div>;

  if (entries.length === 0) return (
    <div className="card p-10 text-center space-y-3 text-gray-400">
      <Clock size={40} className="mx-auto opacity-50" />
      <p className="font-medium text-gray-600 dark:text-gray-300">No active waitlists</p>
      <p className="text-sm">When a hostel room type is full, you can join the waitlist from its page.</p>
      <button onClick={() => navigate("/")} className="btn-primary px-5 py-2 mt-1">Browse Hostels</button>
    </div>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">You will be notified by email and in-app when a bed becomes available. You will have 24 hours to book.</p>
      {entries.map((e) => (
        <div key={e.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600">
              <Clock size={18} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{e.hostel_name}</p>
              <p className="text-sm text-gray-500">{e.room_type_display} · Position #{e.position}</p>
              {e.notified_at && (
                <p className="text-xs text-green-600 font-medium mt-0.5">A bed is available — book now!</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {e.notified_at && (
              <button onClick={() => navigate(`/hostels/${e.hostel_slug}`)} className="btn-primary px-3 py-1.5 text-xs">
                Book Now
              </button>
            )}
            <button onClick={() => leave(e.hostel_slug, e.room_type)} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 transition">
              Leave
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}


// ── Roommates tab ─────────────────────────────────────────────────────────────

function RoommatesTab() {
  const { addToast } = useToast();
  const [profile, setProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [requests, setRequests] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ hostel: "", course: "", year_of_study: "", sleep_schedule: "", study_habit: "", is_smoker: false, bio: "", is_visible: true });
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    Promise.all([
      roommateApi.profile().catch(() => ({ data: null })),
      roommateApi.requests().catch(() => ({ data: { sent: [], received: [] } })),
      bookingApi.myBookings().catch(() => ({ data: [] })),
    ]).then(([p, r, b]) => {
      const prof = p.data;
      setProfile(prof);
      setRequests(r.data);
      const bList = b.data?.results ?? b.data ?? [];
      setBookings(bList);
      if (prof) {
        setForm({ ...prof, hostel: prof.hostel_slug });
        roommateApi.list(prof.hostel_slug).then(({ data }) => setProfiles(data.results ?? data));
      }
    }).finally(() => setLoading(false));
  }, []);

  const activeHostelSlug = bookings.find((b) => b.payment_status === "paid" || b.payment_status === "paid_awaiting_approval")?.hostel_slug;

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await roommateApi.saveProfile({ ...form, hostel: form.hostel || activeHostelSlug });
      setProfile(data);
      setEditMode(false);
      addToast("success", "Profile saved!");
      if (data.hostel_slug) roommateApi.list(data.hostel_slug).then(({ data: d }) => setProfiles(d.results ?? d));
    } catch (err) { addToast("error", err.response?.data?.detail ?? "Could not save profile."); }
  };

  const sendRequest = async (receiverId, hostelSlug) => {
    try {
      await roommateApi.sendRequest({ receiver: receiverId, hostel: hostelSlug });
      addToast("success", "Roommate request sent!");
      const { data } = await roommateApi.requests();
      setRequests(data);
    } catch (err) { addToast("error", err.response?.data?.detail ?? "Could not send request."); }
  };

  const decide = async (pk, action) => {
    try {
      await roommateApi.decide(pk, action);
      const { data } = await roommateApi.requests();
      setRequests(data);
      addToast("success", action === "accept" ? "Request accepted!" : "Request declined.");
    } catch { addToast("error", "Could not update request."); }
  };

  if (loading) return <div className="flex justify-center py-16"><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" /></div>;

  if (!profile && !editMode) return (
    <div className="card p-10 text-center space-y-3 text-gray-400">
      <Users size={40} className="mx-auto opacity-50" />
      <p className="font-medium text-gray-600 dark:text-gray-300">Find a compatible roommate</p>
      <p className="text-sm">Create a profile so other students at your hostel can find you.</p>
      {activeHostelSlug
        ? <button onClick={() => { setForm((f) => ({ ...f, hostel: activeHostelSlug })); setEditMode(true); }} className="btn-primary px-5 py-2">Create Profile</button>
        : <p className="text-xs text-amber-500">You need an approved booking first.</p>}
    </div>
  );

  if (editMode) return (
    <form onSubmit={saveProfile} className="card p-5 space-y-4 max-w-lg">
      <h2 className="font-semibold text-lg">Your Roommate Profile</h2>
      <div><label className="label">Course of study</label><input className="input" value={form.course} onChange={(e) => setForm((f) => ({ ...f, course: e.target.value }))} /></div>
      <div><label className="label">Year of study</label><input type="number" min={1} max={8} className="input" value={form.year_of_study} onChange={(e) => setForm((f) => ({ ...f, year_of_study: e.target.value }))} /></div>
      <div><label className="label">Sleep schedule</label>
        <select className="input" value={form.sleep_schedule} onChange={(e) => setForm((f) => ({ ...f, sleep_schedule: e.target.value }))}>
          <option value="">— Select —</option>
          <option value="early">Early bird (before 10 pm)</option>
          <option value="normal">Normal (10 pm – midnight)</option>
          <option value="night">Night owl (after midnight)</option>
        </select>
      </div>
      <div><label className="label">Study habit</label>
        <select className="input" value={form.study_habit} onChange={(e) => setForm((f) => ({ ...f, study_habit: e.target.value }))}>
          <option value="">— Select —</option>
          <option value="quiet">I study in silence</option>
          <option value="music">I study with music/low noise</option>
          <option value="social">I prefer group study</option>
        </select>
      </div>
      <div className="flex items-center gap-2"><input type="checkbox" id="smoker" checked={form.is_smoker} onChange={(e) => setForm((f) => ({ ...f, is_smoker: e.target.checked }))} /><label htmlFor="smoker" className="text-sm">I smoke</label></div>
      <div><label className="label">Short bio <span className="text-gray-400 text-xs">(max 300 chars)</span></label><textarea className="input" rows={3} maxLength={300} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} /></div>
      <div className="flex items-center gap-2"><input type="checkbox" id="visible" checked={form.is_visible} onChange={(e) => setForm((f) => ({ ...f, is_visible: e.target.checked }))} /><label htmlFor="visible" className="text-sm">Visible to other students</label></div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary px-4 py-2">Save Profile</button>
        {profile && <button type="button" onClick={() => setEditMode(false)} className="btn-ghost px-4 py-2">Cancel</button>}
      </div>
    </form>
  );

  return (
    <div className="space-y-6">
      {/* Incoming requests */}
      {requests.received.filter((r) => r.status === "pending").length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold flex items-center gap-2"><Heart size={16} className="text-brand" /> Incoming Requests</h2>
          {requests.received.filter((r) => r.status === "pending").map((r) => (
            <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-medium">{r.sender_name}</p>
                <p className="text-sm text-gray-500">{r.hostel_name}</p>
                {r.message && <p className="text-sm text-gray-400 mt-1 italic">"{r.message}"</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => decide(r.id, "accept")} className="btn-primary px-3 py-1.5 text-xs">Accept</button>
                <button onClick={() => decide(r.id, "decline")} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50">Decline</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My profile card */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Students at {profile.hostel_name}</h2>
        <button onClick={() => setEditMode(true)} className="btn-ghost px-3 py-1.5 text-xs">Edit my profile</button>
      </div>

      {profiles.length === 0 && <p className="text-gray-400 text-sm">No other visible profiles yet at this hostel.</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {profiles.map((p) => {
          const alreadySent = requests.sent.some((r) => r.receiver === p.student && r.hostel_slug === p.hostel_slug);
          return (
            <div key={p.id} className="card p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{p.student_name}</p>
                  <p className="text-xs text-gray-400">{p.course}{p.year_of_study ? ` · Year ${p.year_of_study}` : ""}</p>
                </div>
                <button
                  onClick={() => !alreadySent && sendRequest(p.student, p.hostel_slug)}
                  disabled={alreadySent}
                  className={`shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition
                    ${alreadySent ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-brand/10 text-brand hover:bg-brand hover:text-white"}`}
                >
                  <UserPlus size={12} /> {alreadySent ? "Sent" : "Connect"}
                </button>
              </div>
              {p.bio && <p className="text-sm text-gray-500 leading-snug">{p.bio}</p>}
              <div className="flex flex-wrap gap-1.5 text-xs">
                {p.sleep_schedule && <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5">{p.sleep_schedule === "early" ? "Early bird" : p.sleep_schedule === "night" ? "Night owl" : "Normal hours"}</span>}
                {p.study_habit && <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5">{p.study_habit === "quiet" ? "Studies in silence" : p.study_habit === "music" ? "Studies w/ music" : "Group study"}</span>}
                {p.is_smoker && <span className="rounded-full bg-orange-100 text-orange-600 px-2 py-0.5">Smoker</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ── Renewal tab ───────────────────────────────────────────────────────────────

function RenewalTab() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    renewalApi.eligible()
      .then(({ data: d }) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-16"><span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" /></div>;

  if (!data?.eligible) return (
    <div className="card p-10 text-center space-y-3 text-gray-400">
      <RefreshCw size={40} className="mx-auto opacity-50" />
      <p className="font-medium text-gray-600 dark:text-gray-300">No renewal needed yet</p>
      <p className="text-sm">This tab shows a renewal prompt when your current stay ends within 35 days.</p>
    </div>
  );

  const b = data.booking;
  const endDate = new Date(data.end_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="max-w-lg space-y-4">
      <div className="card p-5 border-l-4 border-amber-400 space-y-2">
        <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <RefreshCw size={16} /> Your stay ends on {endDate}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Renew your bed at <strong>{b.hostel_name}</strong> ({b.room_type}) to keep your spot. Your current bed will be held for renewal.
        </p>
      </div>
      <button
        onClick={() => navigate(`/book/${b.hostel_slug}/${b.bed_space_ref}?renew=1`)}
        className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
      >
        <RefreshCw size={18} /> Renew my bed
      </button>
      <p className="text-xs text-center text-gray-400">Renewing books the same bed for a new term.</p>
    </div>
  );
}
