import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Wifi, Snowflake, Zap, BedDouble, MapPin, BadgeCheck, ChevronLeft, ChevronRight,
  Droplets, ShieldCheck, Car, WashingMachine, ChefHat, CheckCircle2, XCircle, Users, Star, GitCompare, Trash2, Clock, Images } from "lucide-react";
import { hostelApi, tenantApi, bookingApi, waitlistApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { useCompare } from "../context/CompareContext.jsx";
import { resolveCoords } from "../utils/campusCoords.js";
const HostelMapLazy = lazy(() => import("../components/HostelMap.jsx").then((m) => ({ default: m.HostelMap })));
import { Skeleton } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";

function GalleryCarousel({ hostel }) {
  const images = [
    ...(hostel.image ? [{ id: "main", image: hostel.image, caption: hostel.name }] : []),
    ...(hostel.gallery || []),
  ];
  const [idx, setIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center bg-brand/10 text-brand">
        <MapPin size={48} className="opacity-40" />
      </div>
    );
  }

  const prev = () => setIdx((i) => (i - 1 + images.length) % images.length);
  const next = () => setIdx((i) => (i + 1) % images.length);
  const cur = images[idx];

  return (
    <div className="relative h-56 overflow-hidden bg-gray-100 dark:bg-gray-800 sm:h-72">
      <img
        key={cur.id ?? cur.image}
        src={cur.image}
        alt={cur.caption || hostel.name}
        className="h-full w-full object-cover transition-opacity duration-300"
      />
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white hover:bg-black/60 transition"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Image ${i + 1}`}
                className={`h-3 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-3 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const AMENITY_DEFS = [
  { key: "has_wifi",        label: "WiFi",              Icon: Wifi },
  { key: "has_ac",          label: "Air Conditioning",   Icon: Snowflake },
  { key: "has_electricity", label: "Electricity",        Icon: Zap },
  { key: "has_water",       label: "Water Access",       Icon: Droplets },
  { key: "has_security",    label: "Security",           Icon: ShieldCheck },
  { key: "has_parking",     label: "Parking",            Icon: Car },
  { key: "has_laundry",     label: "Laundry",            Icon: WashingMachine },
  { key: "has_kitchen",     label: "Shared Kitchen",     Icon: ChefHat },
];

const GENDER_LABEL = { mixed: "Mixed", male: "Male only", female: "Female only" };

function HostelAmenities({ hostel }) {
  const activeAmenities = AMENITY_DEFS.filter(({ key }) => hostel[key]);

  return (
    <div className="mt-5 border-t border-gray-100 pt-5 dark:border-gray-700 space-y-4">
      {/* Amenity pills — always render the section, show "none listed" if empty */}
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Amenities</p>
        {activeAmenities.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {activeAmenities.map(({ key, label, Icon }) => (
              <span key={key}
                className="flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/5
                  px-3 py-1 text-xs font-medium text-brand dark:bg-brand/10">
                <Icon size={12} /> {label}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic">No amenities listed.</p>
        )}
      </div>

      {/* Policy row — always visible */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className={`flex items-center gap-1.5 font-medium
          ${hostel.utilities_included ? "text-green-600" : "text-gray-400"}`}>
          {hostel.utilities_included
            ? <><CheckCircle2 size={14} /> Bills included in price</>
            : <><XCircle size={14} /> Bills not included</>}
        </span>

        <span className="flex items-center gap-1.5 text-gray-500">
          <Users size={14} />
          {GENDER_LABEL[hostel.gender_policy] ?? hostel.gender_policy ?? "Mixed"}
        </span>

        {hostel.min_stay_months > 0 && (
          <span className="text-gray-500">
            Min stay: <strong>{hostel.min_stay_months}</strong> month{hostel.min_stay_months > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}

function StarRating({ value, onChange, readonly = false }) {
  const [hovered, setHovered] = useState(null);
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => !readonly && onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(null)}
          className={readonly ? "cursor-default" : "cursor-pointer"}
        >
          <Star size={18}
            className={n <= (hovered ?? value ?? 0)
              ? "fill-amber-400 text-amber-400"
              : "text-gray-300 dark:text-gray-600"}
          />
        </button>
      ))}
    </span>
  );
}

function ReviewsSection({ slug, hostel }) {
  const { isAuthed, user } = useAuth();
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [eligibleBookingId, setEligibleBookingId] = useState(null);
  const [myReview, setMyReview] = useState(null);
  const [form, setForm] = useState({ rating: 0, comment: "" });
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = () => {
    hostelApi.reviews(slug).then(({ data }) => {
      const list = data.results ?? data;
      setReviews(list);
      if (user) {
        setMyReview(list.find((r) => r.student === user.id) ?? null);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => {
    loadReviews();
    if (isAuthed && user?.role === "student") {
      bookingApi.myBookings().then(({ data }) => {
        const bks = data.results ?? data;
        const eligible = bks.find((b) =>
          b.hostel_slug === slug &&
          (b.payment_status === "paid" || b.payment_status === "paid_awaiting_approval") &&
          !b.has_review
        );
        setEligibleBookingId(eligible?.id ?? null);
      }).catch(() => {});
    }
  }, [slug, isAuthed]);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) { addToast("error", "Please select a star rating."); return; }
    setSubmitting(true);
    try {
      await hostelApi.submitReview(slug, { booking: eligibleBookingId, rating: form.rating, comment: form.comment });
      addToast("success", "Review submitted!");
      setForm({ rating: 0, comment: "" });
      setEligibleBookingId(null);
      loadReviews();
    } catch (err) {
      addToast("error", err.response?.data?.detail ?? "Could not submit review.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteReview = async (id) => {
    try {
      await hostelApi.deleteReview(id);
      addToast("success", "Review deleted.");
      loadReviews();
    } catch { addToast("error", "Could not delete review."); }
  };

  const formatDate = (iso) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="card p-5 space-y-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-lg font-semibold">Reviews</h2>
        {hostel.avg_rating && (
          <span className="flex items-center gap-1.5 text-sm text-gray-500">
            <Star size={16} className="fill-amber-400 text-amber-400" />
            {Number(hostel.avg_rating).toFixed(1)} · {hostel.review_count} review{hostel.review_count !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Submit form — only for eligible students */}
      {isAuthed && user?.role === "student" && eligibleBookingId && !myReview && (
        <form onSubmit={submit} className="rounded-xl border border-brand/20 bg-brand/5 p-4 space-y-3">
          <p className="text-sm font-medium text-brand">Leave a review for your stay</p>
          <StarRating value={form.rating} onChange={(r) => setForm((f) => ({ ...f, rating: r }))} />
          <textarea
            rows={3}
            placeholder="Share your experience (optional)"
            value={form.comment}
            onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-600 dark:bg-gray-800"
          />
          <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm">
            {submitting ? "Submitting…" : "Submit Review"}
          </button>
        </form>
      )}

      {loading && <p className="text-sm text-gray-400">Loading reviews…</p>}

      {!loading && reviews.length === 0 && (
        <p className="text-sm text-gray-400 italic">No reviews yet. Be the first to review!</p>
      )}

      <div className="space-y-4">
        {reviews.map((r) => (
          <div key={r.id} className="border-b border-gray-100 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-brand/10 flex items-center justify-center text-brand text-xs font-bold shrink-0">
                  {(r.student_name || r.student_username || "?")[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{r.student_name || r.student_username}</p>
                  <p className="text-xs text-gray-400">{formatDate(r.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <StarRating value={r.rating} readonly />
                {user?.id === r.student && (
                  <button onClick={() => deleteReview(r.id)} className="text-gray-300 hover:text-red-500 transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
            {r.comment && <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 ml-10">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function RoomPhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  if (!photos?.length) return null;
  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);
  const photo = photos[idx];
  return (
    <>
      <div className="relative mt-3 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800" style={{ height: 180 }}>
        <img
          src={photo.image_url}
          alt={photo.caption || `Room photo ${idx + 1}`}
          className="h-full w-full object-cover cursor-zoom-in"
          onClick={() => setLightbox(true)}
        />
        {photos.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60">
              <ChevronLeft size={16} />
            </button>
            <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1 text-white hover:bg-black/60">
              <ChevronRight size={16} />
            </button>
            <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-xs text-white">
              {idx + 1}/{photos.length}
            </span>
          </>
        )}
        {photo.caption && (
          <span className="absolute bottom-2 left-2 rounded bg-black/40 px-2 py-0.5 text-xs text-white max-w-[70%] truncate">
            {photo.caption}
          </span>
        )}
      </div>
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(false)}>
          <div className="relative max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={photo.image_url} alt={photo.caption || ""} className="w-full rounded-xl object-contain max-h-[80vh]" />
            {photos.length > 1 && (
              <>
                <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"><ChevronLeft size={20} /></button>
                <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"><ChevronRight size={20} /></button>
              </>
            )}
            <button onClick={() => setLightbox(false)} className="absolute top-2 right-2 rounded-full bg-black/50 px-3 py-1 text-white text-sm">✕ Close</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function HostelDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const { addToast } = useToast();
  const { toggle, isCompared } = useCompare();

  const [hostel, setHostel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomFilter, setRoomFilter] = useState("all");
  const [status, setStatus] = useState({ loading: true, error: null });
  const [myWaitlist, setMyWaitlist] = useState([]); // room_types student is queued for
  const [roomPhotos, setRoomPhotos] = useState({}); // keyed by room_type

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
          setMyWaitlist(
            entries.filter((e) => e.hostel_slug === slug).map((e) => e.room_type)
          );
        }
        setStatus({ loading: false, error: null });
      })
      .catch(() => setStatus({ loading: false, error: "Could not load this hostel." }));
    // Load room photos (virtual tour)
    hostelApi.roomPhotos(slug).then(({ data }) => {
      const byType = {};
      (data ?? []).forEach((p) => {
        if (!byType[p.room_type]) byType[p.room_type] = [];
        byType[p.room_type].push(p);
      });
      setRoomPhotos(byType);
    }).catch(() => {});
  }, [slug, isAuthed, user]);

  const book = (bedId) => {
    if (!isAuthed) return navigate("/login", { state: { from: { pathname: `/hostels/${slug}` } } });
    if (user?.role !== "student") {
      addToast("info", "Only students can book beds.");
      return;
    }
    navigate(`/book/${slug}/${bedId}`);
  };

  const toggleWaitlist = async (roomType) => {
    if (!isAuthed) return navigate("/login");
    if (user?.role !== "student") { addToast("info", "Only students can join waitlists."); return; }
    const onList = myWaitlist.includes(roomType);
    try {
      if (onList) {
        await waitlistApi.leave(slug, roomType);
        setMyWaitlist((prev) => prev.filter((r) => r !== roomType));
        addToast("success", "Removed from waitlist.");
      } else {
        await waitlistApi.join(slug, roomType);
        setMyWaitlist((prev) => [...prev, roomType]);
        addToast("success", "Added to waitlist! We'll notify you when a bed is free.");
      }
    } catch (e) {
      addToast("error", e.response?.data?.detail ?? "Could not update waitlist.");
    }
  };

  if (status.loading) return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <Skeleton className="h-48 w-full rounded-none" />
        <div className="p-5 space-y-2">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-5 w-1/4 mt-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => <div key={i} className="card p-4 space-y-3"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div>)}
      </div>
    </div>
  );
  if (status.error) return (
    <ErrorPage
      message={status.error}
      onRetry={() => {
        setStatus({ loading: true, error: null });
        Promise.all([hostelApi.get(slug), tenantApi.rooms(slug)])
          .then(([h, r]) => { setHostel(h.data); setRooms(r.data.results ?? r.data); setStatus({ loading: false, error: null }); })
          .catch(() => setStatus({ loading: false, error: "Could not load this hostel." }));
      }}
    />
  );
  if (!hostel) return null;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <GalleryCarousel hostel={hostel} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h1 className="text-2xl font-bold">{hostel.name}</h1>
              {hostel.is_verified && (
                <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                  <BadgeCheck size={13} /> Verified
                </span>
              )}
            </div>
            <button
              onClick={() => toggle(hostel)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition shrink-0
                ${isCompared(slug)
                  ? "bg-brand text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-brand hover:text-white dark:bg-gray-700 dark:text-gray-300"}`}
            >
              <GitCompare size={13} />
              {isCompared(slug) ? "Pinned" : "Compare"}
            </button>
          </div>
          <p className="text-gray-500">
            {hostel.campus_display} · {hostel.location}
          </p>
          <p className="mt-2 text-xl font-bold text-brand">GHS {hostel.base_price} / bed</p>
          {hostel.description && <p className="mt-3 text-gray-600 dark:text-gray-300">{hostel.description}</p>}

          {/* Amenities grid */}
          <HostelAmenities hostel={hostel} />
        </div>
      </div>

<div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold">Rooms &amp; availability</h2>
        {(() => {
          const types = [...new Set(rooms.map((r) => r.room_type))];
          if (types.length < 2) return null;
          return (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setRoomFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-medium transition
                  ${roomFilter === "all" ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                All
              </button>
              {types.map((t) => (
                <button key={t}
                  onClick={() => setRoomFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition
                    ${roomFilter === t ? "bg-brand text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {t.replace(/_/g, " ")}
                </button>
              ))}
              {roomFilter !== "all" && (
                <span className="ml-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                  {rooms.filter((r) => r.room_type === roomFilter && r.beds.some((b) => !b.is_occupied)).length} with free beds
                </span>
              )}
            </div>
          );
        })()}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rooms.filter((r) => roomFilter === "all" || r.room_type === roomFilter).map((room) => (
          <div key={room.id} className="card p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {room.block}-{room.room_number}
              </h3>
              <span className="text-sm text-gray-500">{room.room_type_display}</span>
            </div>
            <div className="mt-2 flex gap-3 text-gray-400">
              {room.has_wifi && <Wifi size={18} title="Wi-Fi" />}
              {room.has_ac && <Snowflake size={18} title="AC" />}
              {room.has_generator && <Zap size={18} title="Generator" />}
            </div>
            {/* Room photo carousel */}
            {roomPhotos[room.room_type]?.length > 0 && (
              <RoomPhotoCarousel photos={roomPhotos[room.room_type]} />
            )}
            <div className="mt-3 space-y-2">
              {room.beds.map((bed) => (
                <div key={bed.id} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-gray-700/50 px-3 py-2.5 gap-2">
                  <span className="flex items-center gap-2 text-sm min-w-0 truncate">
                    <BedDouble size={16} className="shrink-0" /> {bed.bed_label}
                  </span>
                  {bed.is_occupied ? (
                    <span className="text-xs text-gray-400 shrink-0">Taken</span>
                  ) : (
                    <button onClick={() => book(bed.id)} className="btn-primary shrink-0 px-4 py-2 text-xs">
                      Book
                    </button>
                  )}
                </div>
              ))}
              {room.beds.length === 0 && (
                <p className="text-sm text-gray-400">No beds configured yet.</p>
              )}
            </div>
            {/* Waitlist CTA — shown when all beds in this room type are occupied */}
            {isAuthed && user?.role === "student" && room.beds.length > 0 && room.beds.every((b) => b.is_occupied) && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12} /> This room type is full
                </span>
                <button
                  onClick={() => toggleWaitlist(room.room_type)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition
                    ${myWaitlist.includes(room.room_type)
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200"
                      : "bg-brand/10 text-brand hover:bg-brand hover:text-white"}`}
                >
                  <Clock size={12} />
                  {myWaitlist.includes(room.room_type) ? "Leave waitlist" : "Join waitlist"}
                </button>
              </div>
            )}
          </div>
        ))}
        {rooms.filter((r) => roomFilter === "all" || r.room_type === roomFilter).length === 0 && (
          <p className="text-gray-500 col-span-2">
            {rooms.length === 0 ? "No rooms listed yet." : "No rooms match this filter."}
          </p>
        )}
      </div>

      {/* Map */}
      {(() => {
        const { lat, lng } = resolveCoords(hostel);
        return (
          <div className="card overflow-hidden p-5 space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-brand shrink-0" />
              <h2 className="font-semibold">Location</h2>
              <span className="text-sm text-gray-400">{hostel.location}</span>
            </div>
            <Suspense fallback={<div className="h-[280px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
              <HostelMapLazy hostel={hostel} lat={lat} lng={lng} height="280px" />
            </Suspense>
            <p className="text-xs text-gray-400">
              {hostel.latitude != null
                ? "Exact location — set by the hostel manager."
                : `Approximate — pin shows the ${hostel.campus_display} campus area.`}
            </p>
          </div>
        );
      })()}



      <ReviewsSection slug={slug} hostel={hostel} />
    </div>
  );
}
