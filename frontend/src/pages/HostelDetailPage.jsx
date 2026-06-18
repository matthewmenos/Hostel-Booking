import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Wifi, Snowflake, Zap, BedDouble, MapPin, BadgeCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { hostelApi, tenantApi, bookingApi } from "../api/endpoints.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
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
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60 transition"
            aria-label="Next image"
          >
            <ChevronRight size={20} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function HostelDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const { addToast } = useToast();

  const [hostel, setHostel] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [roomFilter, setRoomFilter] = useState("all");
  const [status, setStatus] = useState({ loading: true, error: null, booking: null });

  useEffect(() => {
    setStatus((s) => ({ ...s, loading: true }));
    Promise.all([hostelApi.get(slug), tenantApi.rooms(slug)])
      .then(([h, r]) => {
        setHostel(h.data);
        setRooms(r.data.results ?? r.data);
        setStatus((s) => ({ ...s, loading: false }));
      })
      .catch(() => setStatus({ loading: false, error: "Could not load this hostel.", booking: null }));
  }, [slug]);

  const book = async (bedId) => {
    if (!isAuthed) return navigate("/login", { state: { from: { pathname: `/hostels/${slug}` } } });
    if (user?.role !== "student") {
      addToast("info", "Only students can book beds.");
      return;
    }
    try {
      const { data } = await bookingApi.book({ hostel: slug, bed_space_id: bedId, provider: "paystack" });
      setStatus((s) => ({ ...s, booking: data }));
      addToast("success", "Bed reserved! Complete your payment in the dashboard.");
      const r = await tenantApi.rooms(slug);
      setRooms(r.data.results ?? r.data);
    } catch (e) {
      addToast("error", e.response?.data?.detail ?? "Booking failed.");
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
        setStatus({ loading: true, error: null, booking: null });
        Promise.all([hostelApi.get(slug), tenantApi.rooms(slug)])
          .then(([h, r]) => { setHostel(h.data); setRooms(r.data.results ?? r.data); setStatus({ loading: false, error: null, booking: null }); })
          .catch(() => setStatus({ loading: false, error: "Could not load this hostel.", booking: null }));
      }}
    />
  );
  if (!hostel) return null;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <GalleryCarousel hostel={hostel} />
        <div className="p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{hostel.name}</h1>
            {hostel.is_verified && (
              <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand">
                <BadgeCheck size={13} /> Verified
              </span>
            )}
          </div>
          <p className="text-gray-500">
            {hostel.campus_display} · {hostel.location}
          </p>
          <p className="mt-2 text-xl font-bold text-brand">GHS {hostel.base_price} / bed</p>
          {hostel.description && <p className="mt-3 text-gray-600 dark:text-gray-300">{hostel.description}</p>}
        </div>
      </div>

      {status.booking && (
        <div className="card border-green-300 bg-green-50 p-4 text-green-800">
          <p className="font-semibold">Reservation created!</p>
          <p className="text-sm">
            Booking #{status.booking.booking.id} — complete payment via{" "}
            {status.booking.payment.provider}. Track it in your dashboard.
          </p>
        </div>
      )}

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
            <div className="mt-3 space-y-2">
              {room.beds.map((bed) => (
                <div key={bed.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm">
                    <BedDouble size={16} /> {bed.bed_label}
                  </span>
                  {bed.is_occupied ? (
                    <span className="text-xs text-gray-400">Taken</span>
                  ) : (
                    <button onClick={() => book(bed.id)} className="btn-primary px-3 py-1 text-xs">
                      Book
                    </button>
                  )}
                </div>
              ))}
              {room.beds.length === 0 && (
                <p className="text-sm text-gray-400">No beds configured yet.</p>
              )}
            </div>
          </div>
        ))}
        {rooms.filter((r) => roomFilter === "all" || r.room_type === roomFilter).length === 0 && (
          <p className="text-gray-500 col-span-2">
            {rooms.length === 0 ? "No rooms listed yet." : "No rooms match this filter."}
          </p>
        )}
      </div>
    </div>
  );
}
