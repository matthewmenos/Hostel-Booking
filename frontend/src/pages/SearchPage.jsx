import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search } from "lucide-react";
import { hostelApi } from "../api/endpoints.js";

const CAMPUSES = ["", "KNUST", "LEGON", "UCC", "UPSA", "OTHER"];

export default function SearchPage() {
  const [filters, setFilters] = useState({ campus: "", min_price: "", max_price: "" });
  const [hostels, setHostels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = (params = {}) => {
    setLoading(true);
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== "" && v != null)
    );
    hostelApi
      .search(clean)
      .then(({ data }) => setHostels(data.results ?? data))
      .catch(() => setError("Could not load hostels."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    setError(null);
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

      {loading && <p className="text-gray-500">Loading hostels…</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && hostels.length === 0 && (
        <p className="text-gray-500">No hostels match your search yet.</p>
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
    </div>
  );
}
