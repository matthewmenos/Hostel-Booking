import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Building2, Plus, BedDouble, Percent, ChevronDown, ChevronUp, Trash2,
  Megaphone, BookOpen, Pencil, X, BarChart2, Image, Upload, TrendingUp,
  ShieldAlert, Clock, AlertCircle, MessageSquare, Wrench,
} from "lucide-react";
import { hostelApi, tenantApi, bookingApi, managerApi, notifApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { SkeletonStatCard, SkeletonBookingRow } from "../components/Skeleton.jsx";
import { STATUS_UI } from "../utils/bookingStatus.js";

const TABS = [
  { id: "overview",      label: "Overview" },
  { id: "rooms",         label: "Rooms & Beds" },
  { id: "gallery",       label: "Gallery" },
  { id: "announcements", label: "Announcements" },
  { id: "bookings",      label: "Bookings" },
  { id: "messages",      label: "Messages" },
  { id: "analytics",     label: "Analytics" },
];

const VALID_TABS = TABS.map((t) => t.id);

export default function ManagerPortal() {
  const navigate = useNavigate();
  const { tab: tabParam } = useParams();
  const { user } = useAuth();
  const [hostels, setHostels] = useState([]);
  const [active, setActive] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const tab = VALID_TABS.includes(tabParam) ? tabParam : "overview";
  const setTab = (t) => navigate(`/manager/${t}`, { replace: true });
  const [verif, setVerif] = useState(null);
  const [verifLoading, setVerifLoading] = useState(true);

  // Fetch verification status unless already verified
  useEffect(() => {
    if (user?.is_verified) { setVerifLoading(false); return; }
    managerApi.getVerification()
      .then(({ data }) => setVerif(data))
      .catch(() => setVerif(null))
      .finally(() => setVerifLoading(false));
  }, [user?.is_verified]);

  useEffect(() => {
    hostelApi.myHostels().then(({ data }) => {
      const list = data.results ?? data;
      setHostels(list);
      if (list[0]) setActive(list[0].slug);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active) return;
    tenantApi.rooms(active).then(({ data }) => setRooms(data.results ?? data));
  }, [active]);

  const occupancy = (() => {
    const beds = rooms.flatMap((r) => r.beds);
    const total = beds.length;
    const taken = beds.filter((b) => b.is_occupied).length;
    return { total, taken, pct: total ? Math.round((taken / total) * 100) : 0 };
  })();

  if (loading || verifLoading) return <div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map(i=><SkeletonStatCard key={i}/>)}</div>;

  // ── Verification gate ───────────────────────────────────────────────────────
  if (!user?.is_verified) {
    const isPending  = verif?.status === "pending";
    const isRejected = verif?.status === "rejected";

    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center space-y-5">
          <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full
            ${isPending ? "bg-amber-100 dark:bg-amber-900/30" : "bg-brand/10"}`}>
            {isPending
              ? <Clock size={32} className="text-amber-500" />
              : <ShieldAlert size={32} className="text-brand" />}
          </div>

          {isPending ? (
            <>
              <h2 className="text-xl font-bold">Verification Under Review</h2>
              <p className="text-gray-500">
                Your identity verification application has been submitted and is awaiting
                admin review. This usually takes <strong>1–2 business days</strong>.
              </p>
              <p className="text-sm text-gray-400">
                You will be able to list hostels once your account is approved.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold">Identity Verification Required</h2>
              <p className="text-gray-500">
                Before listing your first hostel, you must verify your identity.
                This is a one-time process that takes about 5 minutes.
              </p>

              {isRejected && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3
                  dark:border-red-900/40 dark:bg-red-900/20 text-left">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                    <div>
                      <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                        Previous application rejected
                      </p>
                      {verif?.rejection_reason && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                          {verif.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="text-left space-y-2 text-sm text-gray-500">
                <p className="font-medium text-gray-700 dark:text-gray-300">What you'll need:</p>
                <ul className="space-y-1 pl-1 list-disc list-inside">
                  <li>Your nationality</li>
                  <li>Ghana Card (front &amp; back photo)</li>
                  <li>A selfie / facial photo</li>
                  <li>Your business GPS location &amp; address</li>
                  <li>GHS 5 activation fee (via Paystack)</li>
                </ul>
              </div>

              <button
                onClick={() => navigate("/manager/verification")}
                className="btn-primary w-full py-3"
              >
                {isRejected ? "Resubmit Application" : "Start Verification"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (hostels.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Building2 className="mx-auto mb-3 text-brand" size={40} />
        <h1 className="mb-2 text-xl font-bold">No hostels yet</h1>
        <p className="mb-4 text-gray-500">Create your first hostel listing to get started.</p>
        <button onClick={() => navigate("/manager/new-hostel")} className="btn-primary">
          <Plus size={16} /> New Hostel
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Manager Portal</h1>
        <div className="flex items-center gap-2">
          <select className="input max-w-xs" value={active ?? ""} onChange={(e) => setActive(e.target.value)}>
            {hostels.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
          </select>
          <button onClick={() => navigate("/manager/new-hostel")} className="btn-primary whitespace-nowrap">
            <Plus size={16} /> New Hostel
          </button>
        </div>
      </div>

      {/* Tab bar — scrollable on mobile */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto dark:border-gray-700">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2 text-sm font-medium transition-colors
              ${tab === t.id ? "border-b-2 border-brand text-brand" : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <OverviewTab
          hostels={hostels}
          occupancy={occupancy}
          activeHostel={hostels.find((h) => h.slug === active)}
          onHostelUpdated={(updated) =>
            setHostels((prev) => prev.map((h) => h.slug === updated.slug ? updated : h))
          }
        />
      )}
      {tab === "rooms"         && <RoomsTab slug={active} rooms={rooms} onRoomsChange={setRooms} />}
      {tab === "gallery"       && <GalleryTab slug={active} hostels={hostels} active={active} onHostelUpdated={(updated) => setHostels((prev) => prev.map((h) => h.slug === updated.slug ? updated : h))} />}
      {tab === "announcements" && <AnnouncementsTab slug={active} />}
      {tab === "bookings"      && <BookingsTab slug={active} hostels={hostels} />}
      {tab === "messages"      && <MessagesTab hostels={hostels} activeSlug={active} />}
      {tab === "analytics"     && <AnalyticsTab />}
    </div>
  );
}

const CAMPUS_OPTIONS = [
  { value: "KNUST", label: "KNUST (Kumasi)" },
  { value: "LEGON", label: "University of Ghana, Legon" },
  { value: "UCC",   label: "University of Cape Coast" },
  { value: "UPSA",  label: "University of Professional Studies" },
  { value: "OTHER", label: "Other" },
];

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ hostels, occupancy, activeHostel, onHostelUpdated }) {
  const { addToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const startEdit = () => {
    if (!activeHostel) return;
    setForm({
      name:           activeHostel.name,
      campus:         activeHostel.campus,
      location:       activeHostel.location,
      base_price:     activeHostel.base_price,
      total_capacity: activeHostel.total_capacity,
      description:    activeHostel.description ?? "",
    });
    setErrors({});
    setEditing(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const { data } = await hostelApi.update(activeHostel.slug, form);
      onHostelUpdated(data);
      addToast("success", "Hostel updated.");
      setEditing(false);
    } catch (err) {
      const d = err.response?.data ?? {};
      if (typeof d === "object") setErrors(d);
      addToast("error", d.detail ?? "Could not update hostel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Hostels" value={hostels.length} />
        <StatCard icon={BedDouble} label="Beds" value={`${occupancy.taken}/${occupancy.total}`} />
        <StatCard icon={Percent} label="Occupancy" value={`${occupancy.pct}%`} />
      </div>

      {activeHostel && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-lg">{activeHostel.name}</h2>
            {!editing ? (
              <button onClick={startEdit} className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-sm">
                <Pencil size={14}/> Edit hostel
              </button>
            ) : (
              <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18}/>
              </button>
            )}
          </div>

          {!editing ? (
            <div className="text-sm text-gray-500 space-y-1">
              <p>{activeHostel.campus_display} · {activeHostel.location}</p>
              <p>GHS {activeHostel.base_price}/bed · Capacity: {activeHostel.total_capacity}</p>
              {activeHostel.description && <p className="text-gray-600 dark:text-gray-300">{activeHostel.description}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Hostel name</label>
                  <input className="input" value={form.name}
                    onChange={(e) => setForm({...form, name: e.target.value})} required />
                  {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
                </div>
                <div>
                  <label className="label">Campus</label>
                  <select className="input" value={form.campus}
                    onChange={(e) => setForm({...form, campus: e.target.value})}>
                    {CAMPUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Location / area</label>
                  <input className="input" value={form.location}
                    onChange={(e) => setForm({...form, location: e.target.value})} required />
                  {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
                </div>
                <div>
                  <label className="label">Base price (GHS)</label>
                  <input className="input" type="number" min="0" step="0.01" value={form.base_price}
                    onChange={(e) => setForm({...form, base_price: e.target.value})} required />
                  {errors.base_price && <p className="mt-1 text-xs text-red-600">{errors.base_price}</p>}
                </div>
                <div>
                  <label className="label">Total capacity</label>
                  <input className="input" type="number" min="0" value={form.total_capacity}
                    onChange={(e) => setForm({...form, total_capacity: e.target.value})} />
                </div>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea rows={3} className="input resize-none" value={form.description}
                  onChange={(e) => setForm({...form, description: e.target.value})} />
              </div>
              <div className="flex gap-2">
                <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
                <button type="button" className="btn-ghost px-4 py-2" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-brand/10 p-2 text-brand"><Icon size={22} /></div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

// ── Rooms & Beds tab ──────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { value: "1_in_a_room", label: "1-in-a-room", capacity: 1 },
  { value: "2_in_a_room", label: "2-in-a-room", capacity: 2 },
  { value: "3_in_a_room", label: "3-in-a-room", capacity: 3 },
  { value: "4_in_a_room", label: "4-in-a-room", capacity: 4 },
  { value: "6_in_a_room", label: "6-in-a-room", capacity: 6 },
];

function RoomsTab({ slug, rooms, onRoomsChange }) {
  const { addToast } = useToast();
  const [form, setForm] = useState({ block: "", room_number: "", room_type: "2_in_a_room" });
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const selectedType = ROOM_TYPES.find((t) => t.value === form.room_type);

  const refreshRooms = () =>
    tenantApi.rooms(slug).then(({ data }) => onRoomsChange(data.results ?? data));

  const addRoom = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await tenantApi.createRoom(slug, form);
      await refreshRooms();
      setForm({ block: "", room_number: "", room_type: "2_in_a_room" });
      addToast("success", `Room added with ${selectedType?.capacity ?? "?"} bed(s) auto-created.`);
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? Object.values(err.response?.data ?? {}).flat().join(" ") ?? "Could not add room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="font-semibold text-lg">Add Room</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Beds are auto-created based on room type — e.g. room 101 (2-in-a-room) creates beds 101A and 101B.
        </p>
      </div>
      <form onSubmit={addRoom} className="grid gap-2 sm:grid-cols-4">
        <input className="input" placeholder="Block e.g. A" value={form.block}
          onChange={(e) => setForm({ ...form, block: e.target.value })} required />
        <input className="input" placeholder="Room No. e.g. 101" value={form.room_number}
          onChange={(e) => setForm({ ...form, room_number: e.target.value })} required />
        <select className="input" value={form.room_type} onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
          {ROOM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label} ({t.capacity} bed{t.capacity > 1 ? "s" : ""})</option>
          ))}
        </select>
        <button className="btn-primary flex items-center gap-1 justify-center" disabled={busy}>
          <Plus size={16} /> Add Room
        </button>
      </form>

      <div className="divide-y dark:divide-gray-700">
        {rooms.map((r) => {
          const taken = r.beds.filter((b) => b.is_occupied).length;
          const total = r.beds.length;
          const cap   = ROOM_TYPES.find((t) => t.value === r.room_type)?.capacity ?? total;
          return (
            <div key={r.id}>
              <button
                className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800 px-1 rounded transition"
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                <span className="font-medium">
                  Block {r.block} · Room {r.room_number}
                  <span className="ml-2 text-sm font-normal text-gray-500">({r.room_type_display})</span>
                </span>
                <span className="flex items-center gap-2 text-sm text-gray-500">
                  <span className={taken === cap ? "text-red-500 font-medium" : taken > 0 ? "text-amber-500" : "text-green-600"}>
                    {taken}/{cap} occupied
                  </span>
                  {expanded === r.id ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                </span>
              </button>
              {expanded === r.id && (
                <BedManager slug={slug} room={r} cap={cap} onRefresh={refreshRooms} />
              )}
            </div>
          );
        })}
        {rooms.length === 0 && <p className="py-3 text-sm text-gray-400">No rooms yet. Add your first room above.</p>}
      </div>
    </div>
  );
}

function BedManager({ slug, room, cap, onRefresh }) {
  const { addToast } = useToast();

  const vacateBed = async (bedId) => {
    try {
      await tenantApi.vacateBed(slug, bedId);
      await onRefresh();
      addToast("success", "Bed marked as vacant.");
    } catch {
      addToast("error", "Could not vacate bed.");
    }
  };

  const deleteBed = async (bedId) => {
    try {
      await tenantApi.deleteBed(slug, bedId);
      await onRefresh();
      addToast("success", "Bed removed.");
    } catch {
      addToast("error", "Could not remove bed.");
    }
  };

  return (
    <div className="ml-4 mb-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-3 space-y-1.5">
      <p className="text-xs text-gray-400 mb-2">
        {room.beds.length}/{cap} beds present · {room.beds.filter(b => b.is_occupied).length} occupied
      </p>
      {room.beds.map((bed) => (
        <div key={bed.id} className="flex items-center justify-between rounded bg-white dark:bg-gray-800 px-3 py-2 text-sm shadow-sm">
          <span className="flex items-center gap-2">
            <BedDouble size={14} className="shrink-0 text-gray-400" />
            <span className="font-medium">{bed.bed_label}</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium
              ${bed.is_occupied
                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
              {bed.is_occupied ? "Occupied" : "Vacant"}
            </span>
          </span>
          <div className="flex items-center gap-2">
            {bed.is_occupied ? (
              <button
                onClick={() => vacateBed(bed.id)}
                className="text-xs text-amber-600 hover:text-amber-700 border border-amber-200 rounded px-2 py-0.5 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              >
                Vacate
              </button>
            ) : (
              <button onClick={() => deleteBed(bed.id)} className="text-gray-400 hover:text-red-500" title="Remove bed">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
      {room.beds.length === 0 && <p className="text-xs text-gray-400 py-1">No beds in this room.</p>}
    </div>
  );
}

// ── Gallery tab ───────────────────────────────────────────────────────────────

function GalleryTab({ slug }) {
  const { addToast } = useToast();
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");

  const load = () => {
    setLoading(true);
    hostelApi.gallery(slug)
      .then(({ data }) => setImages(data.results ?? data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (slug) load(); }, [slug]);

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    if (caption) fd.append("caption", caption);
    try {
      await hostelApi.uploadImage(slug, fd);
      setCaption("");
      e.target.value = "";
      load();
      addToast("success", "Image uploaded.");
    } catch {
      addToast("error", "Could not upload image.");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    try {
      await hostelApi.deleteImage(id);
      setImages((prev) => prev.filter((img) => img.id !== id));
      addToast("success", "Image removed.");
    } catch {
      addToast("error", "Could not remove image.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2"><Image size={18}/> Upload Gallery Photo</h2>
        <div className="space-y-2">
          <div>
            <label className="label">Caption (optional)</label>
            <input className="input" placeholder="e.g. Common room" value={caption}
              onChange={(e) => setCaption(e.target.value)} />
          </div>
          <label className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-6 text-sm text-gray-500 hover:border-brand hover:text-brand transition ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            <Upload size={18} />
            {uploading ? "Uploading…" : "Click to select a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading gallery…</p>}

      {!loading && images.length === 0 && (
        <p className="text-sm text-gray-400">No gallery images yet. Upload your first photo above.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {images.map((img) => (
          <div key={img.id} className="card overflow-hidden group relative">
            <img src={img.image} alt={img.caption || "Gallery"} className="h-40 w-full object-cover" />
            {img.caption && (
              <p className="p-2 text-xs text-gray-500 dark:text-gray-400">{img.caption}</p>
            )}
            <button
              onClick={() => remove(img.id)}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Announcements tab ─────────────────────────────────────────────────────────

function AnnouncementsTab({ slug }) {
  const { addToast } = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: "", body: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    tenantApi.announcements(slug)
      .then(({ data }) => setAnnouncements(data.results ?? data))
      .finally(() => setLoading(false));
  }, [slug]);

  const post = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await tenantApi.createAnnouncement(slug, form);
      const { data } = await tenantApi.announcements(slug);
      setAnnouncements(data.results ?? data);
      setForm({ title: "", body: "" });
      addToast("success", "Announcement posted.");
    } catch {
      addToast("error", "Could not post announcement.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      await tenantApi.deleteAnnouncement(slug, id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
      addToast("success", "Announcement deleted.");
    } catch {
      addToast("error", "Could not delete announcement.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2"><Megaphone size={18}/> Post Announcement</h2>
        <form onSubmit={post} className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} required />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea rows={3} className="input resize-none" value={form.body}
              onChange={(e) => setForm({...form, body: e.target.value})} required />
          </div>
          <button className="btn-primary" disabled={busy}>{busy ? "Posting…" : "Post"}</button>
        </form>
      </div>

      {loading && <p className="text-gray-500 text-sm">Loading…</p>}
      {!loading && announcements.length === 0 && (
        <p className="text-gray-500 text-sm">No announcements yet.</p>
      )}
      <div className="space-y-3">
        {announcements.map((a) => (
          <div key={a.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{a.body}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(a.created_at).toLocaleDateString("en-GH", { day:"numeric", month:"short", year:"numeric" })}
                </p>
              </div>
              <button onClick={() => remove(a.id)} className="shrink-0 text-gray-400 hover:text-red-500">
                <Trash2 size={16}/>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bookings tab ──────────────────────────────────────────────────────────────

function BookingsTab({ slug: initialSlug, hostels }) {
  const [slug, setSlug] = useState(initialSlug);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = (hostelSlug) => {
    setLoading(true);
    bookingApi.managerBookings(hostelSlug)
      .then(({ data }) => setBookings(data.results ?? data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(slug); }, [slug]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="label mb-0 whitespace-nowrap">Filter hostel:</label>
        <select className="input max-w-xs" value={slug ?? ""} onChange={(e) => setSlug(e.target.value)}>
          <option value="">All hostels</option>
          {hostels.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
        </select>
      </div>

      {loading && <div className="space-y-3">{[1,2,3].map(i=><SkeletonBookingRow key={i}/>)}</div>}
      {!loading && bookings.length === 0 && <p className="text-gray-500 text-sm">No bookings yet.</p>}

      <div className="space-y-3">
        {bookings.map((b) => {
          const ui = STATUS_UI[b.payment_status] ?? STATUS_UI.pending;
          const Icon = ui.icon;
          return (
            <div key={b.id} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold">{b.student_username ?? `Student #${b.student}`}</p>
                <p className="text-sm text-gray-500">
                  {b.hostel_name} · {b.room_type} · GHS {b.amount} · #{b.id}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(b.created_at).toLocaleDateString("en-GH")}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-1 text-sm font-medium ${ui.cls}`}>
                <Icon size={16}/> {ui.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    bookingApi.managerAnalytics()
      .then(({ data: d }) => setData(d))
      .catch(() => setError("Could not load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="grid gap-4 sm:grid-cols-3">{[1,2,3].map(i=><SkeletonStatCard key={i}/>)}</div>;
  if (error) return <p className="text-red-500 text-sm">{error}</p>;
  if (!data) return null;

  const maxRevenue = Math.max(...data.monthly.map((m) => m.revenue), 1);

  return (
    <div className="space-y-6">
      {/* Top-line stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} label="Total Revenue" value={`GHS ${data.total_revenue.toLocaleString("en-GH", { minimumFractionDigits: 2 })}`} />
        <StatCard icon={BookOpen} label="Paid Bookings" value={(data.by_status?.paid ?? 0) + (data.by_status?.paid_awaiting_approval ?? 0)} />
        <StatCard icon={BarChart2} label="Pending" value={data.by_status?.pending ?? 0} />
      </div>

      {/* Monthly revenue bar chart */}
      {data.monthly.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-lg flex items-center gap-2"><BarChart2 size={18}/> Monthly Revenue (GHS)</h2>
          <div className="flex items-end gap-2 overflow-x-auto pb-2" style={{ height: 160 }}>
            {data.monthly.map((m) => {
              const pct = (m.revenue / maxRevenue) * 100;
              return (
                <div key={m.month} className="flex flex-col items-center gap-1 shrink-0" style={{ width: 48 }}>
                  <span className="text-xs text-gray-500">{m.revenue > 0 ? `${(m.revenue/1000).toFixed(1)}k` : ""}</span>
                  <div
                    className="w-full rounded-t bg-brand transition-all"
                    style={{ height: `${Math.max(pct, 2)}%`, minHeight: 4 }}
                    title={`GHS ${m.revenue} — ${m.bookings} bookings`}
                  />
                  <span className="text-xs text-gray-400 truncate w-full text-center">{m.month.split(" ")[0]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-hostel breakdown */}
      <div className="card p-5">
        <h2 className="mb-4 font-semibold text-lg">Per-Hostel Breakdown</h2>
        <div className="space-y-3">
          {data.hostels.map((h) => (
            <div key={h.slug} className="flex items-center justify-between gap-4 rounded-lg bg-gray-50 dark:bg-gray-800 px-4 py-3">
              <div>
                <p className="font-medium">{h.name}</p>
                <p className="text-xs text-gray-500">{h.paid_bookings} paid bookings · GHS {h.revenue.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(h.occupancy_pct, 100)}%` }} />
                </div>
                <span className="text-sm font-medium text-brand">{h.occupancy_pct}%</span>
              </div>
            </div>
          ))}
          {data.hostels.length === 0 && <p className="text-sm text-gray-400">No hostel data yet.</p>}
        </div>
      </div>
    </div>
  );
}

// ── Messages tab ──────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function MessagesTab({ hostels, activeSlug }) {
  const { addToast } = useToast();
  const [subTab, setSubTab]       = useState("send");
  const [msgType, setMsgType]     = useState("broadcast");
  const [hostelSlug, setHostelSlug] = useState(activeSlug ?? "");
  const [title, setTitle]         = useState("");
  const [body, setBody]           = useState("");
  const [studentId, setStudentId] = useState("");
  const [students, setStudents]   = useState([]);
  const [sending, setSending]     = useState(false);
  const [reports, setReports]     = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Load students for the selected hostel when switching to direct
  useEffect(() => {
    if (msgType !== "direct" || !hostelSlug) return;
    bookingApi.managerBookings(hostelSlug).then(({ data }) => {
      const list = data.results ?? data;
      const seen = new Set();
      const unique = [];
      list.forEach((b) => {
        if (!seen.has(b.student)) {
          seen.add(b.student);
          unique.push({ id: b.student, username: b.student_username });
        }
      });
      setStudents(unique);
    }).catch(() => setStudents([]));
  }, [msgType, hostelSlug]);

  // Load incoming reports
  useEffect(() => {
    if (subTab !== "reports") return;
    setLoadingReports(true);
    notifApi.list({ type: "report" })
      .then(({ data }) => setReports(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setReports([]))
      .finally(() => setLoadingReports(false));
  }, [subTab]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim()) { addToast("Please enter a message title.", "error"); return; }
    if (!hostelSlug) { addToast("Please select a hostel.", "error"); return; }
    if (msgType === "direct" && !studentId) { addToast("Please select a student.", "error"); return; }
    setSending(true);
    try {
      const payload = { type: msgType, hostel_slug: hostelSlug, title: title.trim(), body: body.trim() };
      if (msgType === "direct") payload.student_id = studentId;
      const { data } = await notifApi.send(payload);
      addToast(`Message sent to ${data.sent_to} student${data.sent_to !== 1 ? "s" : ""}.`, "success");
      setTitle(""); setBody(""); setStudentId("");
    } catch (err) {
      addToast(err.response?.data?.detail ?? "Failed to send message.", "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[{ id: "send", label: "Send Message", icon: MessageSquare },
          { id: "reports", label: "Maintenance Reports", icon: Wrench }].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setSubTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition
              ${subTab === id ? "border-brand text-brand" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {subTab === "send" && (
        <form onSubmit={handleSend} className="card p-6 space-y-4 max-w-xl">
          {/* Hostel picker */}
          <div>
            <label className="label">Hostel</label>
            <select className="input" value={hostelSlug} onChange={(e) => setHostelSlug(e.target.value)}>
              {hostels.map((h) => <option key={h.slug} value={h.slug}>{h.name}</option>)}
            </select>
          </div>

          {/* Message type */}
          <div>
            <label className="label">Send to</label>
            <div className="flex gap-3">
              {[{ v: "broadcast", label: "All tenants" }, { v: "direct", label: "Specific student" }].map(({ v, label }) => (
                <label key={v} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition
                  ${msgType === v ? "border-brand bg-brand/5 text-brand" : "border-gray-200 dark:border-gray-700"}`}>
                  <input type="radio" className="hidden" value={v} checked={msgType === v} onChange={() => setMsgType(v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Student picker (direct only) */}
          {msgType === "direct" && (
            <div>
              <label className="label">Student</label>
              <select className="input" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">— Select student —</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.username}</option>)}
              </select>
              {students.length === 0 && (
                <p className="text-xs text-gray-400 mt-1">No students with active bookings at this hostel.</p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="label">Title</label>
            <input className="input" placeholder="e.g. Water outage notice" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          {/* Body */}
          <div>
            <label className="label">Message (optional)</label>
            <textarea className="input min-h-[80px]" placeholder="Additional details..." value={body} onChange={(e) => setBody(e.target.value)} />
          </div>

          <button type="submit" disabled={sending} className="btn-primary">
            {sending ? "Sending…" : "Send Message"}
          </button>
        </form>
      )}

      {subTab === "reports" && (
        <div className="space-y-2">
          {loadingReports ? (
            <div className="flex justify-center py-10">
              <span className="h-8 w-8 animate-spin rounded-full border-4 border-brand border-t-transparent" />
            </div>
          ) : reports.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Wrench size={32} className="mx-auto mb-2" />
              <p className="text-sm">No maintenance reports yet</p>
            </div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className={`card px-4 py-3 flex items-start gap-3 ${!r.is_read ? "border-l-4 border-amber-400" : ""}`}>
                <Wrench size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!r.is_read ? "font-semibold" : ""}`}>{r.title}</p>
                  {r.body && <p className="text-sm text-gray-500 mt-0.5">{r.body}</p>}
                  <p className="text-xs text-gray-400 mt-1">{r.sender_username} · {timeAgo(r.created_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
