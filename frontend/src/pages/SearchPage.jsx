import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, SlidersHorizontal, BadgeCheck } from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { SkeletonCard } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";

const CAMPUS_TABS = [
  { value: "",      label: "All" },
  { value: "KNUST", label: "KNUST" },
  { value: "LEGON", label: "Legon" },
  { value: "UCC",   label: "UCC" },
  { value: "UPSA",  label: "UPSA" },
  { value: "OTHER", label: "Other" },
];

export default function SearchPage() {
  const [activeCampus, setActiveCampus] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [nextUrl, setNextUrl] = useState(null);
  const [prevUrl, setPrevUrl] = useState(null);
  const [count, setCount] = useState(null);

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

  const handleTabClick = (campus) => {
    setActiveCampus(campus);
    setNextUrl(null);
    setPrevUrl(null);
    load({ campus, min_price: minPrice, max_price: maxPrice });
  };

  const onPriceSubmit = (e) => {
    e.preventDefault();
    setNextUrl(null);
    setPrevUrl(null);
    load({ campus: activeCampus, min_price: minPrice, max_price: maxPrice });
  };

  return (
    <div>
      {/* Hero */}
      <section className="mb-6 rounded-2xl bg-gradient-to-r from-brand to-brand-light px-6 py-14 text-white shadow-lg">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Find your hostel in Ghana
        </h1>
        <p className="mt-2 max-w-xl text-white/85 sm:text-lg">
          Verified hostels near KNUST, Legon, UCC and more — book a bed in minutes.
        </p>

        {/* Price filter row inside hero */}
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30 transition"
          >
            <SlidersHorizontal size={15} />
            {showFilters ? "Hide filters" : "Price filter"}
          </button>
          {(minPrice || maxPrice) && (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white">
              {minPrice ? `GHS ${minPrice}` : "any"} – {maxPrice ? `GHS ${maxPrice}` : "any"}
              <button
                className="ml-1.5 opacity-75 hover:opacity-100"
                onClick={() => { setMinPrice(""); setMaxPrice(""); load({ campus: activeCampus }); }}
              >×</button>
            </span>
          )}
        </div>

        {showFilters && (
          <form onSubmit={onPriceSubmit} className="mt-3 flex items-end gap-2 flex-wrap">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/80">Min (GHS)</label>
              <input
                type="number"
                min="0"
                className="w-28 rounded-lg border border-white/30 bg-white/20 px-3 py-1.5 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/80">Max (GHS)</label>
              <input
                type="number"
                min="0"
                className="w-28 rounded-lg border border-white/30 bg-white/20 px-3 py-1.5 text-sm text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                placeholder="any"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-brand hover:bg-gray-100 transition"
            >
              <Search size={14} /> Apply
            </button>
          </form>
        )}
      </section>

      {/* Campus tabs */}
      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CAMPUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabClick(tab.value)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition
              ${activeCampus === tab.value
                ? "bg-brand text-white shadow-sm"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count label */}
      {!loading && !error && count !== null && hostels.length > 0 && (
        <p className="mb-3 text-sm text-gray-400 dark:text-gray-500">
          {count} hostel{count !== 1 ? "s" : ""} found
          {activeCampus ? ` · ${CAMPUS_TABS.find(t => t.value === activeCampus)?.label}` : ""}
        </p>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Error */}
      {error && (
        <ErrorPage message={error} onRetry={() => load({ campus: activeCampus, min_price: minPrice, max_price: maxPrice })} />
      )}

      {/* Empty state */}
      {!loading && !error && hostels.length === 0 && (
        <div className="py-16 text-center text-gray-400 dark:text-gray-500">
          <MapPin size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium">No hostels found</p>
          <p className="mt-1 text-sm">
            {activeCampus ? "Try selecting a different campus or clearing the price filter." : "Check back soon — more hostels are being added."}
          </p>
        </div>
      )}

      {/* Hostel grid */}
      {!loading && !error && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hostels.map((h, i) => (
              <Link
                key={h.slug}
                to={`/hostels/${h.slug}`}
                className="card overflow-hidden animate-fadeInUp"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex h-40 items-center justify-center bg-brand/10 text-brand overflow-hidden">
                  {h.image ? (
                    <img src={h.image} alt={h.name} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                  ) : (
                    <MapPin size={36} className="opacity-50" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{h.name}</h3>
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
                  <p className="mt-3 text-lg font-bold text-brand">
                    GHS {h.base_price}
                    <span className="ml-1 text-xs font-normal text-gray-400">/bed</span>
                  </p>
                </div>
              </Link>
            ))}
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
    </div>
  );
}
