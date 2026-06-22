import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin, SlidersHorizontal, BadgeCheck, X, ChevronDown,
  Wifi, Snowflake, Zap, Droplets, Shield, Car, WashingMachine, Utensils,
  GitCompare, Map, LayoutGrid, Search, Star,
} from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { SkeletonCard } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";
import { useCompare } from "../context/CompareContext.jsx";
import { resolveCoords } from "../utils/campusCoords.js";

const SearchMapLazy = lazy(() =>
  import("../components/HostelMap.jsx").then((m) => ({ default: m.SearchMap }))
);

const AMENITY_FILTERS = [
  { key: "has_wifi",        label: "WiFi",        icon: Wifi },
  { key: "has_ac",          label: "AC",           icon: Snowflake },
  { key: "has_electricity", label: "Electricity",  icon: Zap },
  { key: "has_water",       label: "Water",        icon: Droplets },
  { key: "has_security",    label: "Security",     icon: Shield },
  { key: "has_parking",     label: "Parking",      icon: Car },
  { key: "has_laundry",     label: "Laundry",      icon: WashingMachine },
  { key: "has_kitchen",     label: "Kitchen",      icon: Utensils },
];

const ALL_UNIVERSITIES = [...PUBLIC_UNIVERSITIES, ...PRIVATE_UNIVERSITIES];

export default function SearchPage() {
  const navigate = useNavigate();
  const { compared, toggle, isCompared } = useCompare();

  const [viewMode,       setViewMode]       = useState("grid");
  const [hoveredSlug,    setHoveredSlug]    = useState(null);
  const [activeCampus,   setActiveCampus]   = useState("");
  const [minPrice,       setMinPrice]       = useState("");
  const [maxPrice,       setMaxPrice]       = useState("");
  const [amenities,      setAmenities]      = useState({});
  const [showFilters,    setShowFilters]    = useState(false);
  const [hostels,        setHostels]        = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [nextUrl,        setNextUrl]        = useState(null);
  const [prevUrl,        setPrevUrl]        = useState(null);
  const [count,          setCount]          = useState(null);
  const debounceRef = useRef(null);

  const applyResponse = (data) => {
    setHostels(data.results ?? data);
    setNextUrl(data.next ?? null);
    setPrevUrl(data.previous ?? null);
    setCount(data.count ?? null);
  };

  const load = (params = {}) => {
    setError(null);
    setLoading(true);
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));
    hostelApi.search(clean)
      .then(({ data }) => applyResponse(data))
      .catch(() => setError("Could not load hostels."))
      .finally(() => setLoading(false));
  };

  const loadUrl = (url) => {
    if (!url) return;
    setLoading(true);
    import("../api/axios.js").then(({ default: api }) =>
      api.get(url.replace(/^.*\/api/, ""))
        .then(({ data }) => applyResponse(data))
        .catch(() => setError("Could not load hostels."))
        .finally(() => setLoading(false))
    );
  };

  useEffect(() => { load(); }, []);

  const triggerLoad = (campus = activeCampus, min = minPrice, max = maxPrice, ams = amenities) => {
    setNextUrl(null);
    setPrevUrl(null);
    load({ campus, min_price: min, max_price: max, ...ams });
  };

  const handlePriceChange = (field, value) => {
    const newMin = field === "min" ? value : minPrice;
    const newMax = field === "max" ? value : maxPrice;
    if (field === "min") setMinPrice(value); else setMaxPrice(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => triggerLoad(activeCampus, newMin, newMax), 600);
  };

  const toggleAmenity = (key) => {
    setAmenities((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key]; else next[key] = true;
      triggerLoad(activeCampus, minPrice, maxPrice, next);
      return next;
    });
  };

  const clearAllFilters = () => {
    setActiveCampus(""); setMinPrice(""); setMaxPrice(""); setAmenities({});
    clearTimeout(debounceRef.current);
    load({});
  };

  const activeFilterCount = (minPrice || maxPrice ? 1 : 0) + Object.keys(amenities).length + (activeCampus ? 1 : 0);

  return (
    <div className="space-y-6">

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-2xl bg-brand px-6 py-12 text-white shadow-lg">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative max-w-xl">
          <p className="mb-1 text-sm font-medium text-brand-light/80 uppercase tracking-wider">HostelHub Ghana</p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Find your hostel,<br/>book in minutes</h1>
          <p className="mt-3 text-white/75 text-sm sm:text-base">
            Verified hostels near KNUST, Legon, UCC and more.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative mt-6 max-w-xl">
          <div className="flex items-center gap-2 rounded-xl bg-white/15 border border-white/25 backdrop-blur px-3 py-2.5">
            <Search size={16} className="text-white/60 shrink-0" />
            <select
              value={activeCampus}
              onChange={(e) => { setActiveCampus(e.target.value); triggerLoad(e.target.value); }}
              className="flex-1 bg-transparent text-white text-sm focus:outline-none appearance-none cursor-pointer"
              style={{ colorScheme: "dark" }}
            >
              <option value="" className="text-gray-900">Filter by university…</option>
              <optgroup label="Public" className="text-gray-900">
                {PUBLIC_UNIVERSITIES.map((u) => <option key={u.value} value={u.value} className="text-gray-900">{u.label}</option>)}
              </optgroup>
              <optgroup label="Private" className="text-gray-900">
                {PRIVATE_UNIVERSITIES.map((u) => <option key={u.value} value={u.value} className="text-gray-900">{u.label}</option>)}
              </optgroup>
            </select>
            {activeCampus && (
              <button onClick={() => { setActiveCampus(""); triggerLoad(""); }} className="text-white/60 hover:text-white shrink-0" aria-label="Clear university filter">
                <X size={14} />
              </button>
            )}
            <div className="w-px h-5 bg-white/20 shrink-0" />
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition shrink-0
                ${showFilters ? "bg-white text-brand" : "bg-white/20 text-white hover:bg-white/30"}`}
            >
              <SlidersHorizontal size={13} />
              Filters
              {activeFilterCount > 0 && (
                <span className={`rounded-full px-1.5 text-[11px] font-bold ${showFilters ? "bg-brand text-white" : "bg-white/30"}`}>
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Active filter pills */}
        {activeFilterCount > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 max-w-xl">
            {activeCampus && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs text-white">
                {ALL_UNIVERSITIES.find((u) => u.value === activeCampus)?.label ?? activeCampus}
                <button onClick={() => { setActiveCampus(""); triggerLoad(""); }}><X size={11} /></button>
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs text-white">
                GHS {minPrice || "0"} – {maxPrice || "∞"}
                <button onClick={() => { setMinPrice(""); setMaxPrice(""); triggerLoad(activeCampus, "", ""); }}><X size={11} /></button>
              </span>
            )}
            {Object.keys(amenities).map((key) => {
              const af = AMENITY_FILTERS.find((a) => a.key === key);
              if (!af) return null;
              const Icon = af.icon;
              return (
                <span key={key} className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs text-white">
                  <Icon size={11} /> {af.label}
                  <button onClick={() => toggleAmenity(key)}><X size={11} /></button>
                </span>
              );
            })}
            <button onClick={clearAllFilters} className="flex items-center gap-1 rounded-full bg-white/10 border border-white/30 px-2.5 py-1 text-xs text-white/70 hover:bg-white/20">
              Clear all
            </button>
          </div>
        )}

        {/* Expanded filters */}
        {showFilters && (
          <div className="mt-4 max-w-xl rounded-xl border border-white/20 bg-white/10 p-4 space-y-4 backdrop-blur">
            {/* University */}
            <div>
              <p className="mb-2 text-xs font-medium text-white/80">University</p>
              <select
                value={activeCampus}
                onChange={(e) => { setActiveCampus(e.target.value); triggerLoad(e.target.value); }}
                className="w-full rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                style={{ colorScheme: "dark" }}
              >
                <option value="" className="text-gray-900">All universities</option>
                <optgroup label="Public" className="text-gray-900">
                  {PUBLIC_UNIVERSITIES.map((u) => <option key={u.value} value={u.value} className="text-gray-900">{u.label}</option>)}
                </optgroup>
                <optgroup label="Private" className="text-gray-900">
                  {PRIVATE_UNIVERSITIES.map((u) => <option key={u.value} value={u.value} className="text-gray-900">{u.label}</option>)}
                </optgroup>
              </select>
            </div>

            {/* Price range */}
            <div>
              <p className="mb-2 text-xs font-medium text-white/80">Price range (GHS / month)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="number" min="0"
                    className="w-full rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                    placeholder="Min"
                    value={minPrice}
                    onChange={(e) => handlePriceChange("min", e.target.value)}
                  />
                </div>
                <div>
                  <input
                    type="number" min="0"
                    className="w-full rounded-lg border border-white/25 bg-white/15 px-3 py-2 text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                    placeholder="Max"
                    value={maxPrice}
                    onChange={(e) => handlePriceChange("max", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <p className="mb-2 text-xs font-medium text-white/80">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITY_FILTERS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAmenity(key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition
                      ${amenities[key] ? "bg-white text-brand shadow-sm" : "bg-white/15 text-white hover:bg-white/25"}`}
                  >
                    <Icon size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Results toolbar ── */}
      {!loading && !error && count !== null && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-800 dark:text-gray-200">{count}</span>{" "}
            hostel{count !== 1 ? "s" : ""} found
            {activeCampus && ` · ${ALL_UNIVERSITIES.find((u) => u.value === activeCampus)?.label ?? activeCampus}`}
          </p>
          {hostels.length > 0 && (
            <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition
                  ${viewMode === "grid" ? "bg-brand text-white" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}
              >
                <LayoutGrid size={13} /> Grid
              </button>
              <button
                onClick={() => setViewMode("map")}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-l border-gray-200 dark:border-gray-700 transition
                  ${viewMode === "map" ? "bg-brand text-white" : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}
              >
                <Map size={13} /> Map
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── States ── */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {error && (
        <ErrorPage message={error} onRetry={() => triggerLoad()} />
      )}

      {!loading && !error && hostels.length === 0 && (
        <div className="empty-state py-20">
          <div className="empty-icon"><MapPin size={28} /></div>
          <p className="empty-title">No hostels found</p>
          <p className="empty-body">
            {activeFilterCount > 0
              ? "Try adjusting your filters or clearing them to see more results."
              : "No hostels are listed yet. Check back soon!"}
          </p>
          {activeFilterCount > 0 && (
            <button onClick={clearAllFilters} className="btn-secondary btn-sm mt-1">Clear filters</button>
          )}
        </div>
      )}

      {/* ── Results ── */}
      {!loading && !error && hostels.length > 0 && (
        <>
          {/* Map view */}
          {viewMode === "map" && (() => {
            const hostelCoords = hostels.map((h) => ({ hostel: h, ...resolveCoords(h) }));
            return (
              <div className="space-y-3">
                <Suspense fallback={<div className="h-[420px] rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
                  <SearchMapLazy hostelCoords={hostelCoords} activeSlug={hoveredSlug} height="420px" />
                </Suspense>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {hostels.map((h) => {
                    const free = (h.total_capacity || 0) - (h.active_bookings_count || 0);
                    return (
                      <Link
                        key={h.slug}
                        to={`/hostels/${h.slug}`}
                        onMouseEnter={() => setHoveredSlug(h.slug)}
                        onMouseLeave={() => setHoveredSlug(null)}
                        className={`shrink-0 w-52 rounded-xl border p-3 transition
                          ${hoveredSlug === h.slug
                            ? "border-brand bg-brand/5 shadow-md"
                            : "border-gray-200 bg-white hover:border-brand/40 dark:border-gray-700 dark:bg-gray-800"}`}
                      >
                        <p className="font-semibold text-sm truncate">{h.name}</p>
                        <p className="text-xs text-gray-400 truncate">{h.campus_display}</p>
                        <div className="mt-1.5 flex items-center justify-between">
                          <p className="text-sm font-bold text-brand">GHS {h.base_price}<span className="text-xs font-normal text-gray-400">/bed</span></p>
                          <span className={`text-xs font-medium ${free > 0 ? "text-green-600" : "text-red-500"}`}>
                            {free > 0 ? `${free} free` : "Full"}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Grid view */}
          <div className={viewMode === "map" ? "hidden" : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
            {hostels.map((h, i) => {
              const free   = (h.total_capacity || 0) - (h.active_bookings_count || 0);
              const pinned = isCompared(h.slug);
              const canPin = pinned || compared.length < 3;
              return (
                <div
                  key={h.slug}
                  className="card-hover overflow-hidden flex flex-col animate-fadeInUp"
                  style={{ animationDelay: `${i * 50}ms` }}
                  onMouseEnter={() => setHoveredSlug(h.slug)}
                  onMouseLeave={() => setHoveredSlug(null)}
                >
                  {/* Image */}
                  <Link to={`/hostels/${h.slug}`} className="block relative">
                    <div className="h-44 bg-brand/10 text-brand overflow-hidden">
                      {h.image ? (
                        <img src={h.image} alt={h.name} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <MapPin size={40} className="opacity-30" />
                        </div>
                      )}
                    </div>
                    {/* Availability badge over image */}
                    <span className={`absolute top-3 right-3 badge shadow-sm ${free > 0 ? "badge-green" : "badge-red"}`}>
                      {free > 0 ? `${free} bed${free !== 1 ? "s" : ""} free` : "Full"}
                    </span>
                    {h.is_verified && (
                      <span className="absolute top-3 left-3 badge badge-brand shadow-sm bg-white/90 dark:bg-gray-900/80">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                  </Link>

                  {/* Content */}
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <Link to={`/hostels/${h.slug}`} className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 hover:text-brand transition truncate">{h.name}</h3>
                      </Link>
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 truncate">
                      {h.campus_display} · {h.location}
                    </p>

                    {/* Rating */}
                    {h.avg_rating && (
                      <div className="mt-1.5 flex items-center gap-1">
                        <Star size={13} className="text-amber-400 fill-amber-400" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{h.avg_rating}</span>
                        <span className="text-xs text-gray-400">({h.review_count})</span>
                      </div>
                    )}

                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xl font-bold text-brand leading-none">GHS {h.base_price}</p>
                        <p className="text-xs text-gray-400 mt-0.5">per bed / month</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggle(h)}
                          disabled={!canPin}
                          title={pinned ? "Remove" : canPin ? "Compare" : "Max 3"}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition
                            ${pinned ? "bg-brand text-white" : canPin
                              ? "border border-gray-200 text-gray-500 hover:border-brand hover:text-brand dark:border-gray-600"
                              : "opacity-30 cursor-not-allowed border border-gray-200 text-gray-400"}`}
                        >
                          <GitCompare size={12} />
                          {pinned ? "Pinned" : "Compare"}
                        </button>
                        <Link to={`/hostels/${h.slug}`} className="btn-primary btn-sm">
                          View
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {(prevUrl || nextUrl) && (
            <div className="flex items-center justify-between pt-2">
              <button className="btn-ghost disabled:opacity-40" disabled={!prevUrl} onClick={() => loadUrl(prevUrl)}>
                ← Previous
              </button>
              <button className="btn-ghost disabled:opacity-40" disabled={!nextUrl} onClick={() => loadUrl(nextUrl)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Floating compare bar ── */}
      {compared.length > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
          rounded-2xl bg-gray-900 dark:bg-gray-700 px-5 py-3 shadow-2xl text-white text-sm
          max-w-[min(440px,_calc(100vw-2rem))] animate-fadeInUp">
          <GitCompare size={16} className="shrink-0 text-brand-light" />
          <span className="flex-1 min-w-0 truncate font-medium">
            {compared.length} hostel{compared.length > 1 ? "s" : ""} selected
          </span>
          <button onClick={() => navigate("/compare")}
            className="shrink-0 rounded-xl bg-brand px-4 py-1.5 text-xs font-semibold hover:bg-brand-dark transition">
            Compare now
          </button>
        </div>
      )}
    </div>
  );
}
