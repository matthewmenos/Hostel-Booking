import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MapPin, SlidersHorizontal, BadgeCheck, X, ChevronDown, Wifi, Snowflake, Zap, Droplets, Shield, Car, WashingMachine, Utensils, GitCompare, Map, LayoutGrid } from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { SkeletonCard } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";
import { useCompare } from "../context/CompareContext.jsx";
import { resolveCoords } from "../utils/campusCoords.js";
const SearchMapLazy = lazy(() => import("../components/HostelMap.jsx").then((m) => ({ default: m.SearchMap })));

const AMENITY_FILTERS = [
  { key: "has_wifi",        label: "WiFi",        icon: Wifi },
  { key: "has_ac",          label: "AC",          icon: Snowflake },
  { key: "has_electricity", label: "Electricity", icon: Zap },
  { key: "has_water",       label: "Water",       icon: Droplets },
  { key: "has_security",    label: "Security",    icon: Shield },
  { key: "has_parking",     label: "Parking",     icon: Car },
  { key: "has_laundry",     label: "Laundry",     icon: WashingMachine },
  { key: "has_kitchen",     label: "Kitchen",     icon: Utensils },
];

const CATEGORY_TABS = [
  { value: "",        label: "All" },
  { value: "public",  label: "Public" },
  { value: "private", label: "Private" },
];

const CAMPUS_BY_CATEGORY = {
  public:  PUBLIC_UNIVERSITIES,
  private: PRIVATE_UNIVERSITIES,
};

export default function SearchPage() {
  const navigate = useNavigate();
  const { compared, toggle, isCompared } = useCompare();
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "map"
  const [hoveredSlug, setHoveredSlug] = useState(null);
  const [activeCategory, setActiveCategory] = useState(""); // "", "public", "private"
  const [activeCampus, setActiveCampus]     = useState(""); // specific university value
  const [minPrice, setMinPrice]             = useState("");
  const [maxPrice, setMaxPrice]             = useState("");
  const [amenities, setAmenities]           = useState({});   // { has_wifi: true, ... }
  const [showFilters, setShowFilters]       = useState(false);
  const [hostels, setHostels]               = useState([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [nextUrl, setNextUrl]               = useState(null);
  const [prevUrl, setPrevUrl]               = useState(null);
  const [count, setCount]                   = useState(null);
  const debounceRef                         = useRef(null);

  const applyResponse = (data) => {
    setHostels(data.results ?? data);
    setNextUrl(data.next ?? null);
    setPrevUrl(data.previous ?? null);
    setCount(data.count ?? null);
  };

  const load = (params = {}) => {
    setError(null);
    setLoading(true);
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    );
    hostelApi
      .search(clean)
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

  useEffect(() => {
    load();
  }, []);

  const triggerLoad = (campus, min, max, ams = amenities) => {
    setNextUrl(null);
    setPrevUrl(null);
    load({ campus, min_price: min, max_price: max, ...ams });
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    setActiveCampus("");
    triggerLoad("", minPrice, maxPrice);
  };

  const handleUniversityChange = (val) => {
    setActiveCampus(val);
    triggerLoad(val, minPrice, maxPrice);
  };

  const handlePriceChange = (field, value) => {
    const newMin = field === "min" ? value : minPrice;
    const newMax = field === "max" ? value : maxPrice;
    if (field === "min") setMinPrice(value);
    else setMaxPrice(value);

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      triggerLoad(activeCampus, newMin, newMax);
    }, 600);
  };

  const toggleAmenity = (key) => {
    setAmenities((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      triggerLoad(activeCampus, minPrice, maxPrice, next);
      return next;
    });
  };

  const activeAmenityCount = Object.keys(amenities).length;

  return (
    <div>
      {/* Hero */}
      <section className="mb-6 rounded-2xl bg-gradient-to-r from-brand to-brand-light px-4 py-10 sm:px-6 sm:py-14 text-white shadow-lg">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Find your hostel in Ghana
        </h1>
        <p className="mt-2 max-w-xl text-white/85 text-sm sm:text-base lg:text-lg">
          Verified hostels near KNUST, Legon, UCC and more — book a bed in minutes.
        </p>

        {/* Filter toggle row */}
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30 transition"
          >
            <SlidersHorizontal size={15} />
            {showFilters ? "Hide filters" : "Filters"}
            {(minPrice || maxPrice || activeAmenityCount > 0) && (
              <span className="ml-1 rounded-full bg-white/30 px-1.5 text-xs">
                {(minPrice || maxPrice ? 1 : 0) + activeAmenityCount}
              </span>
            )}
          </button>
          {(minPrice || maxPrice) && (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white flex items-center gap-1">
              GHS {minPrice || "any"} – {maxPrice || "any"}
              <button
                onClick={() => { setMinPrice(""); setMaxPrice(""); clearTimeout(debounceRef.current); triggerLoad(activeCampus, "", ""); }}
              ><X size={11} /></button>
            </span>
          )}
          {Object.keys(amenities).map((key) => {
            const af = AMENITY_FILTERS.find((a) => a.key === key);
            if (!af) return null;
            const Icon = af.icon;
            return (
              <span key={key} className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white flex items-center gap-1">
                <Icon size={11} /> {af.label}
                <button onClick={() => toggleAmenity(key)}><X size={11} /></button>
              </span>
            );
          })}
        </div>

        {showFilters && (
          <div className="mt-3 space-y-3">
            <div className="flex items-end gap-2 flex-wrap">
              <div className="flex-1 min-w-[100px]">
                <label className="mb-1 block text-xs font-medium text-white/80">Min (GHS)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="0"
                  value={minPrice}
                  onChange={(e) => handlePriceChange("min", e.target.value)}
                />
              </div>
              <div className="flex-1 min-w-[100px]">
                <label className="mb-1 block text-xs font-medium text-white/80">Max (GHS)</label>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-lg border border-white/30 bg-white/20 px-3 py-2 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  placeholder="any"
                  value={maxPrice}
                  onChange={(e) => handlePriceChange("max", e.target.value)}
                />
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-white/80">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITY_FILTERS.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleAmenity(key)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition
                      ${amenities[key]
                        ? "bg-white text-brand shadow"
                        : "bg-white/20 text-white hover:bg-white/30"}`}
                  >
                    <Icon size={12} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Category tabs + university dropdown */}
      <div className="mb-6 space-y-3">
        {/* Row 1: All / Public / Private pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleCategoryClick(tab.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition
                ${activeCategory === tab.value
                  ? "bg-brand text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Row 2: University select — shown always, filtered by category */}
        <div className="relative">
          <select
            value={activeCampus}
            onChange={(e) => handleUniversityChange(e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-10
              text-sm text-gray-700 shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand
              dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            <option value="">All universities{activeCategory ? ` (${activeCategory})` : ""}</option>
            {activeCategory
              ? CAMPUS_BY_CATEGORY[activeCategory].map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))
              : (
                <>
                  <optgroup label="Public Universities">
                    {PUBLIC_UNIVERSITIES.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Private Universities">
                    {PRIVATE_UNIVERSITIES.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </optgroup>
                </>
              )
            }
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      {/* Count label + view toggle */}
      {!loading && !error && count !== null && hostels.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {count} hostel{count !== 1 ? "s" : ""} found
            {activeCampus
              ? ` · ${[...PUBLIC_UNIVERSITIES, ...PRIVATE_UNIVERSITIES].find(u => u.value === activeCampus)?.label ?? activeCampus}`
              : activeCategory ? ` · ${activeCategory} universities` : ""}
          </p>
          <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition
                ${viewMode === "grid"
                  ? "bg-brand text-white"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              <LayoutGrid size={13} /> Grid
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition border-l border-gray-200 dark:border-gray-700
                ${viewMode === "map"
                  ? "bg-brand text-white"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"}`}
            >
              <Map size={13} /> Map
            </button>
          </div>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <ErrorPage message={error} onRetry={() => triggerLoad(activeCampus, minPrice, maxPrice)} />
      )}

      {/* Empty state */}
      {!loading && !error && hostels.length === 0 && (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500">
          <MapPin size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No hostels found</p>
          <p className="mt-1 text-sm">
            {activeCampus || activeCategory ? "Try a different university or clear the filter." : "Check back soon — more hostels are being added."}
          </p>
        </div>
      )}

      {/* Hostel grid / map */}
      {!loading && !error && (
        <>
          {/* Map view — map + scrollable card strip below */}
          {viewMode === "map" && hostels.length > 0 && (() => {
            const hostelCoords = hostels.map((h) => ({ hostel: h, ...resolveCoords(h) }));
            return (
              <div className="mb-4 space-y-3">
                <Suspense fallback={<div className="h-[420px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
                  <SearchMapLazy hostelCoords={hostelCoords} activeSlug={hoveredSlug} height="420px" />
                </Suspense>
                {/* Horizontal card strip so hover-to-highlight still works */}
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {hostels.map((h) => {
                    const free = (h.total_capacity || 0) - (h.active_bookings_count || 0);
                    return (
                      <Link
                        key={h.slug}
                        to={`/hostels/${h.slug}`}
                        onMouseEnter={() => setHoveredSlug(h.slug)}
                        onMouseLeave={() => setHoveredSlug(null)}
                        className={`shrink-0 w-48 rounded-xl border p-3 transition cursor-pointer
                          ${hoveredSlug === h.slug
                            ? "border-brand bg-brand/5 shadow-md"
                            : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand/50"}`}
                      >
                        <p className="font-semibold text-sm truncate text-gray-900 dark:text-gray-100">{h.name}</p>
                        <p className="text-xs text-gray-400 truncate">{h.campus_display}</p>
                        <p className="mt-1 text-sm font-bold text-brand">GHS {h.base_price}<span className="text-xs font-normal text-gray-400">/bed</span></p>
                        <p className={`text-xs mt-0.5 font-medium ${free > 0 ? "text-green-600" : "text-red-500"}`}>
                          {free > 0 ? `${free} bed${free !== 1 ? "s" : ""} free` : "Full"}
                        </p>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <div className={viewMode === "map" ? "hidden" : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
            {hostels.map((h, i) => {
              const pinned = isCompared(h.slug);
              const canPin = pinned || compared.length < 3;
              return (
                <div
                  key={h.slug}
                  className="card overflow-hidden animate-fadeInUp flex flex-col"
                  style={{ animationDelay: `${i * 60}ms` }}
                  onMouseEnter={() => setHoveredSlug(h.slug)}
                  onMouseLeave={() => setHoveredSlug(null)}
                >
                  <Link to={`/hostels/${h.slug}`} className="block">
                    <div className="flex h-36 sm:h-40 items-center justify-center bg-brand/10 text-brand overflow-hidden">
                      {h.image ? (
                        <img src={h.image} alt={h.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                      ) : (
                        <MapPin size={36} className="opacity-50" />
                      )}
                    </div>
                  </Link>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <Link to={`/hostels/${h.slug}`}>
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 hover:text-brand">{h.name}</h3>
                        </Link>
                        {h.is_verified && (
                          <BadgeCheck size={16} className="shrink-0 text-brand" title="Verified hostel" />
                        )}
                      </div>
                      {(() => {
                        const free = (h.total_capacity || 0) - (h.active_bookings_count || 0);
                        if (free <= 0) return (
                          <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">Full</span>
                        );
                        return (
                          <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            {free} bed{free !== 1 ? "s" : ""} left
                          </span>
                        );
                      })()}
                    </div>
                    <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                      {h.campus_display} · {h.location}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-lg font-bold text-brand">
                        GHS {h.base_price}
                        <span className="ml-1 text-xs font-normal text-gray-400">/bed</span>
                      </p>
                      <button
                        onClick={() => toggle(h)}
                        disabled={!canPin}
                        title={pinned ? "Remove from comparison" : canPin ? "Add to comparison" : "Max 3 hostels"}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition shrink-0
                          ${pinned
                            ? "bg-brand text-white"
                            : canPin
                              ? "bg-gray-100 text-gray-600 hover:bg-brand hover:text-white dark:bg-gray-700 dark:text-gray-300"
                              : "opacity-40 cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-gray-700"}`}
                      >
                        <GitCompare size={12} />
                        {pinned ? "Pinned" : "Compare"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {(prevUrl || nextUrl) && (
            <div className="mt-8 flex items-center justify-between">
              <button
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                disabled={!prevUrl}
                onClick={() => loadUrl(prevUrl)}
              >
                ← Previous
              </button>
              <button
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                disabled={!nextUrl}
                onClick={() => loadUrl(nextUrl)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Floating compare bar */}
      {compared.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3
          rounded-2xl bg-gray-900 dark:bg-gray-700 px-4 py-3 shadow-2xl text-white text-sm
          max-w-[min(480px,_calc(100vw-2rem))]">
          <GitCompare size={16} className="shrink-0 text-brand" />
          <span className="flex-1 min-w-0 truncate">
            {compared.length} hostel{compared.length > 1 ? "s" : ""} selected
          </span>
          <button
            onClick={() => navigate("/compare")}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold hover:bg-brand-light transition"
          >
            Compare
          </button>
        </div>
      )}
    </div>
  );
}
