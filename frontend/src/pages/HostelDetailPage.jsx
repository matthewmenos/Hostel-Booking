import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  Wifi, Snowflake, Zap, BedDouble, MapPin, BadgeCheck, ChevronLeft, ChevronRight,
  Droplets, ShieldCheck, Car, WashingMachine, ChefHat, CheckCircle2, XCircle,
  Users, Star, GitCompare, Trash2, Clock, ArrowLeft, Images,
} from "lucide-react";
import { hostelApi, tenantApi, bookingApi, waitlistApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCompare } from "../context/CompareContext.jsx";
import { resolveCoords } from "../utils/campusCoords.js";
import { Skeleton } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";

const HostelMapLazy = lazy(() => import("../components/HostelMap.jsx").then((m) => ({ default: m.HostelMap })));

// ── Gallery ───────────────────────────────────────────────────────────────────

function GalleryCarousel({ hostel }) {
  const images = [
    ...(hostel.image ? [{ id: "main", image: hostel.image, caption: hostel.name }] : []),
    ...(hostel.gallery || []),
  ];
  const [idx, setIdx]         = useState(0);
  const [lightbox, setLightbox] = useState(false);

  if (images.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center bg-brand/8 text-brand">
        <MapPin size={48} className="opacity-25" />
      </div>
    );
  }

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  const cur  = images[idx];

  return (
    <>
      <div className="relative h-64 sm:h-80 overflow-hidden bg-gray-100 dark:bg-gray-900 cursor-zoom-in" onClick={() => setLightbox(true)}>
        <img
          key={cur.id ?? cur.image}
          src={cur.image}
          alt={cur.caption || hostel.name}
          className="h-full w-full object-cover"
        />
        {/* Gradient overlay for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

        {images.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition"
              aria-label="Previous">
              <ChevronLeft size={20} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition"
              aria-label="Next">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`} />
              ))}
            </div>
          </>
        )}
        <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-xs text-white backdrop-blur-sm">
          <Images size={12} /> {idx + 1}/{images.length}
        </span>
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fadeIn" onClick={() => setLightbox(false)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={cur.image} alt={cur.caption || ""} className="w-full max-h-[85vh] rounded-xl object-contain" />
            {images.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronLeft size={22} /></button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"><ChevronRight size={22} /></button>
              </>
            )}
            <button onClick={() => setLightbox(false)} className="absolute top-3 right-3 rounded-full bg-black/50 px-3 py-1 text-sm text-white hover:bg-black/70">✕ Close</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Amenities ─────────────────────────────────────────────────────────────────

const AMENITY_DEFS = [
  { key: "has_wifi",        label: "WiFi",           Icon: Wifi },
  { key: "has_ac",          label: "Air Con",         Icon: Snowflake },
  { key: "has_electricity", label: "Electricity",     Icon: Zap },
  { key: "has_water",       label: "Water",           Icon: Droplets },
  { key: "has_security",    label: "Security",        Icon: ShieldCheck },
  { key: "has_parking",     label: "Parking",         Icon: Car },
  { key: "has_laundry",     label: "Laundry",         Icon: WashingMachine },
  { key: "has_kitchen",     label: "Kitchen",         Icon: ChefHat },
];

const GENDER_LABEL = { mixed: "Mixed gender", male: "Male only", female: "Female only" };

// ── Room photo carousel ───────────────────────────────────────────────────────

function RoomPhotoCarousel({ photos }) {
  const [idx, setIdx]         = useState(0);
  const [lightbox, setLightbox] = useState(false);
  if (!photos?.length) return null;
  const prev  = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next  = () => setIdx((i) => (i + 1) % photos.length);
  const photo = photos[idx];
  return (
    <>
      <div className="relative mt-3 h-40 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 cursor-zoom-in" onClick={() => setLightbox(true)}>
        <img src={photo.image_url} alt={photo.caption || `Photo ${idx + 1}`} className="h-full w-full object-cover" />
        {photos.length > 1 && (
          <>
            <button onClick={(e) => { e.stopPropagation(); prev(); }} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"><ChevronLeft size={14} /></button>
            <button onClick={(e) => { e.stopPropagation(); next(); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60"><ChevronRight size={14} /></button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] text-white">{idx+1}/{photos.length}</span>
          </>
        )}
        {photo.caption && <span className="absolute bottom-2 left-2 rounded bg-black/40 px-2 py-0.5 text-xs text-white max-w-[65%] truncate">{photo.caption}</span>}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setLightbox(false)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={photo.image_url} alt="" className="w-full rounded-xl object-contain max-h-[80vh]" />
            {photos.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"><ChevronLeft size={20} /></button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"><ChevronRight size={20} /></button>
              </>
            )}
            <button onClick={() => setLightbox(false)} className="absolute top-2 right-2 rounded-full bg-black/50 px-3 py-1 text-sm text-white">✕</button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Reviews ───────────────────────────────────────────────────────────────────

function StarRating({ value, onChange, readonly = false, size = 18 }) {
  const [hovered, setHovered] = useState(null);
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <button key={n} type="button" disabled={readonly}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(null)}
          className={readonly ? "cursor-default" : "cursor-pointer"}>
          <Star size={size}
            className={n <= (hovered ?? value ?? 0) ? "fill-amber-400 text-amber-400" : "text-gray-300 dark:text-gray-600"} />
        </button>
      ))}
    </span>
  );
}

function ReviewsSection({ slug, hostel }) {
  const { isAuthed, user } = useAuth();
  const { addToast }        = useToast();
  const [reviews, setReviews]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [eligibleBookingId, setEligible]    = useState(null);
  const [myReview, setMyReview]             = useState(null);
  const [form, setForm]                     = useState({ rating: 0, comment: "" });
  const [submitting, setSubmitting]         = useState(false);

  const load = () => {
    hostelApi.reviews(slug).then(({ data }) => {
      const list = data.results ?? data;
      setReviews(list);
      if (user) setMyReview(list.find((r) => r.student === user.id) ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (isAuthed && user?.role === "student") {
      bookingApi.myBookings().then(({ data }) => {
        const bks = data.results ?? data;
        const eligible = bks.find((b) =>
          b.hostel_slug === slug &&
          (b.payment_status === "paid" || b.payment_status === "paid_awaiting_approval") &&
          !b.has_review
        );
        setEligible(eligible?.id ?? null);
      }).catch(() => {});
    }
  }, [slug, isAuthed]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) { addToast("error", "Please choose a star rating."); return; }
    setSubmitting(true);
    try {
      await hostelApi.submitReview(slug, { booking: eligibleBookingId, rating: form.rating, comment: form.comment });
      addToast("success", "Review submitted!");
      setForm({ rating: 0, comment: "" });
      setEligible(null);
      load();
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not submit review.");
    } finally { setSubmitting(false); }
  };

  const deleteReview = async (id) => {
    try { await hostelApi.deleteReview(id); addToast("success", "Review deleted."); load(); }
    catch { addToast("error", "Could not delete review."); }
  };

  const fmtDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <section className="card p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {hostel.avg_rating ? (
          <span className="flex items-center gap-1.5 text-sm">
            <Star size={15} className="fill-amber-400 text-amber-400" />
            <span className="font-semibold text-gray-800 dark:text-gray-200">{Number(hostel.avg_rating).toFixed(1)}</span>
            <span className="text-gray-400">· {hostel.review_count} review{hostel.review_count !== 1 ? "s" : ""}</span>
          </span>
        ) : (
          <span className="text-sm text-gray-400">No reviews yet</span>
        )}
      </div>

      {/* Review form */}
      {isAuthed && user?.role === "student" && eligibleBookingId && !myReview && (
        <form onSubmit={submit} className="rounded-2xl border-2 border-brand/20 bg-brand/5 dark:bg-brand/10 p-4 space-y-3">
          <p className="text-sm font-semibold text-brand">Share your experience at {hostel.name}</p>
          <div className="flex items-center gap-3">
            <StarRating value={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} size={22} />
            <span className="text-sm text-gray-500">{form.rating ? ["", "Poor", "Fair", "Good", "Very good", "Excellent"][form.rating] : "Tap to rate"}</span>
          </div>
          <textarea rows={3} placeholder="What did you love? What could be better? (optional)"
            value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            className="input" />
          <button type="submit" disabled={submitting} className="btn-primary btn-sm">
            {submitting ? "Submitting…" : "Submit review"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading reviews…</p>}
      {!loading && reviews.length === 0 && (
        <div className="py-6 text-center text-gray-400">
          <Star size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No reviews yet. Be the first to share your experience!</p>
        </div>
      )}

      <div className="space-y-4 divide-y divide-gray-100 dark:divide-gray-700">
        {reviews.map((r) => (
          <div key={r.id} className="pt-4 first:pt-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand text-sm font-bold">
                  {(r.student_name || r.student_username || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{r.student_name || r.student_username}</p>
                  <p className="text-xs text-gray-400">{fmtDate(r.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StarRating value={r.rating} readonly size={14} />
                {user?.id === r.student && (
                  <button onClick={() => deleteReview(r.id)} className="text-gray-300 hover:text-red-500 transition ml-1">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {r.comment && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 pl-11 leading-relaxed">{r.comment}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function HostelDetailPage() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const { isAuthed, user } = useAuth();
  const { addToast }       = useToast();
  const { toggle, isCompared } = useCompare();

  const [hostel, setHostel]       = useState(null);
  const [rooms,  setRooms]        = useState([]);
  const [roomFilter, setRoomFilter] = useState("all");
  const [status, setStatus]       = useState({ loading: true, error: null });
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [roomPhotos, setRoomPhotos] = useState({});

  useEffect(() => {
    setStatus((s) => ({ ...s, loading: true }));
    const fetches = [hostelApi.get(slug), tenantApi.rooms(slug)];
    if (isAuthed && user?.role === "student") fetches.push(waitlistApi.mine());
    Promise.all(fetches)
      .then(([h, r, wl]) => {
        setHostel(h.data);
        setRooms(r.data.results ?? r.data);
        if (wl) {
          const entries = wl.data ?? [];
          setMyWaitlist(entries.filter((e) => e.hostel_slug === slug).map((e) => e.room_type));
        }
        setStatus({ loading: false, error: null });
      })
      .catch(() => setStatus({ loading: false, error: "Could not load this hostel." }));
    hostelApi.roomPhotos(slug).then(({ data }) => {
      const byType = {};
      (data ?? []).forEach((p) => { if (!byType[p.room_type]) byType[p.room_type] = []; byType[p.room_type].push(p); });
      setRoomPhotos(byType);
    }).catch(() => {});
  }, [slug, isAuthed, user]);

  const book = (bedId) => {
    if (!isAuthed) return navigate("/login", { state: { from: { pathname: `/hostels/${slug}` } } });
    if (user?.role !== "student") { addToast("info", "Only students can book beds."); return; }
    navigate(`/book/${slug}/${bedId}`);
  };

  const toggleWaitlist = async (roomType) => {
    if (!isAuthed) return navigate("/login");
    if (user?.role !== "student") { addToast("info", "Only students can join waitlists."); return; }
    const onList = myWaitlist.includes(roomType);
    try {
      if (onList) {
        await waitlistApi.leave(slug, roomType);
        setMyWaitlist((p) => p.filter((r) => r !== roomType));
        addToast("success", "Removed from waitlist.");
      } else {
        await waitlistApi.join(slug, roomType);
        setMyWaitlist((p) => [...p, roomType]);
        addToast("success", "Added to waitlist! We'll notify you when a bed opens up.");
      }
    } catch (e) { addToast("error", e.response?.data?.detail ?? "Could not update waitlist."); }
  };

  // ── Loading ──
  if (status.loading) return (
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <Skeleton className="h-64 w-full rounded-none" />
        <div className="p-5 space-y-3">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-6 w-1/4 mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1,2].map((i) => <div key={i} className="card p-4 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div>)}
      </div>
    </div>
  );

  if (status.error) return (
    <ErrorPage message={status.error} onRetry={() => {
      setStatus({ loading: true, error: null });
      Promise.all([hostelApi.get(slug), tenantApi.rooms(slug)])
        .then(([h, r]) => { setHostel(h.data); setRooms(r.data.results ?? r.data); setStatus({ loading: false, error: null }); })
        .catch(() => setStatus({ loading: false, error: "Could not load this hostel." }));
    }} />
  );
  if (!hostel) return null;

  const activeAmenities = AMENITY_DEFS.filter(({ key }) => hostel[key]);
  const roomTypes       = [...new Set(rooms.map((r) => r.room_type))];
  const filteredRooms   = rooms.filter((r) => roomFilter === "all" || r.room_type === roomFilter);
  const { lat, lng }    = resolveCoords(hostel);
  const freeBeds        = (hostel.total_capacity || 0) - (hostel.active_bookings_count || 0);

  return (
    <div className="space-y-5 pb-8 animate-fadeInUp">

      {/* Back link */}
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand transition">
        <ArrowLeft size={15} /> Back to search
      </Link>

      {/* ── Hero card: gallery + info ── */}
      <div className="card overflow-hidden">
        <GalleryCarousel hostel={hostel} />

        <div className="p-5 sm:p-6">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 leading-tight">{hostel.name}</h1>
                {hostel.is_verified && (
                  <span className="badge-brand flex items-center gap-1 shrink-0">
                    <BadgeCheck size={12} /> Verified
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 flex items-center gap-1.5">
                <MapPin size={14} className="shrink-0 text-brand" />
                {hostel.campus_display} · {hostel.location}
              </p>
              {hostel.avg_rating && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{Number(hostel.avg_rating).toFixed(1)}</span>
                  <span className="text-sm text-gray-400">({hostel.review_count} reviews)</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => toggle(hostel)}
                className={`btn btn-sm ${isCompared(slug) ? "btn-primary" : "btn-ghost"}`}
              >
                <GitCompare size={13} />
                {isCompared(slug) ? "Pinned" : "Compare"}
              </button>
            </div>
          </div>

          {/* Price + availability */}
          <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-3xl font-bold text-brand leading-none">GHS {hostel.base_price}</p>
              <p className="text-sm text-gray-400 mt-0.5">per bed / month</p>
            </div>
            <span className={`badge text-sm px-3 py-1.5 ${freeBeds > 0 ? "badge-green" : "badge-red"}`}>
              {freeBeds > 0 ? `${freeBeds} bed${freeBeds !== 1 ? "s" : ""} available` : "Currently full"}
            </span>
          </div>

          {/* Description */}
          {hostel.description && (
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{hostel.description}</p>
          )}

          {/* Amenities */}
          {activeAmenities.length > 0 && (
            <div className="mt-5">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {activeAmenities.map(({ key, label, Icon }) => (
                  <span key={key} className="flex items-center gap-1.5 rounded-xl border border-brand/20 bg-brand/5 px-3 py-1.5 text-xs font-medium text-brand dark:bg-brand/10">
                    <Icon size={13} /> {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Policy row */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm border-t border-gray-100 dark:border-gray-700 pt-4">
            <span className={`flex items-center gap-1.5 font-medium ${hostel.utilities_included ? "text-green-600 dark:text-green-400" : "text-gray-400"}`}>
              {hostel.utilities_included
                ? <><CheckCircle2 size={14} /> Bills included</>
                : <><XCircle size={14} /> Bills not included</>}
            </span>
            <span className="flex items-center gap-1.5 text-gray-500">
              <Users size={14} /> {GENDER_LABEL[hostel.gender_policy] ?? "Mixed gender"}
            </span>
            {hostel.min_stay_months > 0 && (
              <span className="flex items-center gap-1.5 text-gray-500">
                <Clock size={14} /> Min {hostel.min_stay_months} month{hostel.min_stay_months > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Rooms & availability ── */}
      <section>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Rooms &amp; Availability</h2>
          {roomTypes.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRoomFilter("all")}
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition
                  ${roomFilter === "all" ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"}`}>
                All
              </button>
              {roomTypes.map((t) => (
                <button key={t} onClick={() => setRoomFilter(t)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition capitalize
                    ${roomFilter === t ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"}`}>
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredRooms.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-icon"><BedDouble size={24} /></div>
            <p className="empty-title">{rooms.length === 0 ? "No rooms listed yet" : "No rooms match this filter"}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredRooms.map((room) => {
              const freeBeds = room.beds.filter((b) => !b.is_occupied).length;
              const allFull  = room.beds.length > 0 && freeBeds === 0;
              const onWaitlist = myWaitlist.includes(room.room_type);
              return (
                <div key={room.id} className="card overflow-hidden">
                  {/* Room photo carousel */}
                  {roomPhotos[room.room_type]?.length > 0 && (
                    <RoomPhotoCarousel photos={roomPhotos[room.room_type]} />
                  )}

                  <div className="p-4">
                    {/* Room header */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                          Block {room.block} · Room {room.room_number}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">{room.room_type_display || room.room_type.replace(/_/g," ")}</p>
                      </div>
                      <span className={`badge shrink-0 ${freeBeds > 0 ? "badge-green" : "badge-red"}`}>
                        {freeBeds > 0 ? `${freeBeds} free` : "Full"}
                      </span>
                    </div>

                    {/* Room amenities */}
                    {(room.has_wifi || room.has_ac || room.has_generator) && (
                      <div className="flex gap-2 mb-3 text-gray-400">
                        {room.has_wifi && <span className="flex items-center gap-1 text-xs"><Wifi size={13} /> WiFi</span>}
                        {room.has_ac && <span className="flex items-center gap-1 text-xs"><Snowflake size={13} /> AC</span>}
                        {room.has_generator && <span className="flex items-center gap-1 text-xs"><Zap size={13} /> Generator</span>}
                      </div>
                    )}

                    {/* Beds */}
                    <div className="space-y-2">
                      {room.beds.map((bed) => (
                        <div key={bed.id} className={`flex items-center justify-between rounded-xl px-3 py-2.5 gap-2
                          ${bed.is_occupied ? "bg-gray-50 dark:bg-gray-700/30" : "bg-brand/5 dark:bg-brand/10"}`}>
                          <span className="flex items-center gap-2 text-sm min-w-0 truncate">
                            <BedDouble size={15} className={`shrink-0 ${bed.is_occupied ? "text-gray-300" : "text-brand"}`} />
                            <span className={bed.is_occupied ? "text-gray-400" : "text-gray-700 dark:text-gray-200"}>{bed.bed_label}</span>
                          </span>
                          {bed.is_occupied ? (
                            <span className="badge-gray text-[11px] shrink-0">Taken</span>
                          ) : (
                            <button onClick={() => book(bed.id)} className="btn-primary btn-sm shrink-0">Book this bed</button>
                          )}
                        </div>
                      ))}
                      {room.beds.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-2">No beds listed for this room.</p>
                      )}
                    </div>

                    {/* Waitlist CTA */}
                    {isAuthed && user?.role === "student" && allFull && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                        <p className="text-xs text-gray-400">All beds are taken</p>
                        <button
                          onClick={() => toggleWaitlist(room.room_type)}
                          className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition
                            ${onWaitlist
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200"
                              : "bg-brand text-white hover:bg-brand-dark"}`}
                        >
                          <Clock size={12} />
                          {onWaitlist ? "Leave waitlist" : "Join waitlist"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Location ── */}
      <section className="card overflow-hidden">
        <div className="p-4 pb-0 flex items-center gap-2">
          <MapPin size={16} className="text-brand shrink-0" />
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Location</h2>
          <span className="text-sm text-gray-400">{hostel.location}</span>
        </div>
        <div className="mt-3">
          <Suspense fallback={<div className="h-64 bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
            <HostelMapLazy hostel={hostel} lat={lat} lng={lng} height="260px" />
          </Suspense>
        </div>
        <p className="px-4 py-2 text-xs text-gray-400">
          {hostel.latitude != null
            ? "Exact location provided by the hostel manager."
            : `Approximate — pin shows the ${hostel.campus_display} campus area.`}
        </p>
      </section>

      {/* ── Reviews ── */}
      <ReviewsSection slug={slug} hostel={hostel} />
    </div>
  );
}
