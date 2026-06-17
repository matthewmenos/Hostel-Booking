import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search } from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { SkeletonCard } from "../components/Skeleton.jsx";
import ErrorPage from "./ErrorPage.jsx";

const CAMPUSES = ["", "KNUST", "LEGON", "UCC", "UPSA", "OTHER"];

export default function SearchPage() {
  const [filters, setFilters] = useState({ campus: "", min_price: "", max_price: "" });
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

  const onSubmit = (e) => {
    e.preventDefault();
    setError(null);
    setNextUrl(null);
    setPrevUrl(null);
    load(filters);
  };

  return (
    <div>
      <section className="mb-6 rounded-2xl bg-brand px-6 py-10 text-white">
        <h1 className="text-3xl font-bold">Find your hostel in Ghana</h1>
        <p className="mt-1 text-white/80">
          Verified hostels near KNUST, Legon, UCC and more — book a bed in minutes.
        </p>
      </section>

      <form onSubmit={onSubmit} className="card mb-6 grid gap-3 p-4 sm:grid-cols-4">
        <div>
          <label className="label">Campus</label>
          <select
            className="input"
            value={filters.campus}
            onChange={(e) => setFilters({ ...filters, campus: e.target.value })}
          >
            {CAMPUSES.map((c) => (
              <option key={c} value={c}>
                {c || "Any campus"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Min price (GHS)</label>
          <input
            type="number"
            className="input"
            value={filters.min_price}
            onChange={(e) => setFilters({ ...filters, min_price: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Max price (GHS)</label>
          <input
            type="number"
            className="input"
            value={filters.max_price}
            onChange={(e) => setFilters({ ...filters, max_price: e.target.value })}
          />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-primary w-full">
            <Search size={16} /> Search
          </button>
        </div>
      </form>

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
      {error && <ErrorPage message={error} onRetry={() => { setError(null); load(filters); }} />}
      {!loading && !error && hostels.length === 0 && (
        <p className="text-gray-500">No hostels match your search yet.</p>
      )}

      {!loading && (
        <>
          {count !== null && hostels.length > 0 && (
            <p className="mb-3 text-sm text-gray-400">{count} hostel{count !== 1 ? "s" : ""} found</p>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {hostels.map((h) => (
              <Link key={h.slug} to={`/hostels/${h.slug}`} className="card overflow-hidden hover:shadow-md">
                <div className="flex h-32 items-center justify-center bg-brand/10 text-brand">
                  {h.image ? (
                    <img src={h.image} alt={h.name} className="h-full w-full object-cover" />
                  ) : (
                    <MapPin size={32} />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{h.name}</h3>
                  <p className="text-sm text-gray-500">
                    {h.campus_display} · {h.location}
                  </p>
                  <p className="mt-2 font-bold text-brand">GHS {h.base_price}</p>
                </div>
              </Link>
            ))}
          </div>

          {(prevUrl || nextUrl) && (
            <div className="mt-6 flex items-center justify-between">
              <button
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                disabled={!prevUrl}
                onClick={() => loadUrl(prevUrl)}>
                ← Previous
              </button>
              <button
                className="btn-ghost px-4 py-2 text-sm disabled:opacity-40"
                disabled={!nextUrl}
                onClick={() => loadUrl(nextUrl)}>
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
