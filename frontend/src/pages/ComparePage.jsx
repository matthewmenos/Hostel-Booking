import { useNavigate } from "react-router-dom";
import { X, BadgeCheck, Wifi, Snowflake, Zap, Droplets, ShieldCheck, Car, WashingMachine, ChefHat, Star } from "lucide-react";
import { useCompare } from "../context/CompareContext.jsx";

const AMENITIES = [
  { key: "has_wifi",        label: "WiFi",         icon: Wifi },
  { key: "has_ac",          label: "AC",            icon: Snowflake },
  { key: "has_electricity", label: "Electricity",   icon: Zap },
  { key: "has_water",       label: "Water",         icon: Droplets },
  { key: "has_security",    label: "Security",      icon: ShieldCheck },
  { key: "has_parking",     label: "Parking",       icon: Car },
  { key: "has_laundry",     label: "Laundry",       icon: WashingMachine },
  { key: "has_kitchen",     label: "Kitchen",       icon: ChefHat },
  { key: "utilities_included", label: "Bills incl.", icon: null },
];

const GENDER_LABEL = { mixed: "Mixed", male: "Male only", female: "Female only" };

function Stars({ value }) {
  if (!value) return <span className="text-xs text-gray-400">No reviews</span>;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map((n) => (
        <Star key={n} size={14}
          className={n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "text-gray-300"}
        />
      ))}
      <span className="ml-1 text-xs text-gray-500">{value.toFixed(1)}</span>
    </span>
  );
}

export default function ComparePage() {
  const navigate = useNavigate();
  const { compared, toggle, clear } = useCompare();

  if (compared.length === 0) {
    return (
      <div className="mx-auto max-w-2xl py-24 text-center text-gray-400">
        <p className="text-lg font-medium mb-2">No hostels to compare</p>
        <p className="text-sm mb-6">Pin up to 3 hostels from the search page using the Compare button.</p>
        <button onClick={() => navigate("/")} className="btn-primary">Browse hostels</button>
      </div>
    );
  }

  const free = (h) => (h.total_capacity || 0) - (h.active_bookings_count || 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Compare Hostels</h1>
        <button onClick={clear} className="btn-ghost text-sm px-3 py-1.5 flex items-center gap-1">
          <X size={14} /> Clear all
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          {/* Header row */}
          <thead>
            <tr>
              <th className="w-36 text-left pb-4 text-gray-400 font-normal pr-4">Hostel</th>
              {compared.map((h) => (
                <th key={h.slug} className="pb-4 px-3 text-left align-top">
                  <div className="card p-3 space-y-1 min-w-[160px]">
                    <div className="flex items-start justify-between gap-1">
                      <button
                        onClick={() => navigate(`/hostels/${h.slug}`)}
                        className="font-semibold text-brand hover:underline text-left leading-tight"
                      >
                        {h.name}
                      </button>
                      <button onClick={() => toggle(h)} className="shrink-0 text-gray-400 hover:text-red-500 mt-0.5">
                        <X size={14} />
                      </button>
                    </div>
                    {h.is_verified && (
                      <span className="flex items-center gap-0.5 text-xs text-brand">
                        <BadgeCheck size={12} /> Verified
                      </span>
                    )}
                    {h.image && (
                      <img src={h.image} alt={h.name}
                        className="w-full h-24 object-cover rounded-lg mt-1" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {/* Rating */}
            <tr>
              <td className="py-3 pr-4 text-gray-500 font-medium">Rating</td>
              {compared.map((h) => (
                <td key={h.slug} className="py-3 px-3"><Stars value={h.avg_rating} /></td>
              ))}
            </tr>

            {/* Price */}
            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
              <td className="py-3 pr-4 text-gray-500 font-medium">Price / bed</td>
              {compared.map((h) => {
                const prices = compared.map((x) => Number(x.base_price));
                const isCheapest = Number(h.base_price) === Math.min(...prices);
                return (
                  <td key={h.slug} className="py-3 px-3">
                    <span className={`font-bold ${isCheapest ? "text-green-600" : "text-brand"}`}>
                      GHS {h.base_price}
                    </span>
                    {isCheapest && compared.length > 1 && (
                      <span className="ml-1 text-xs bg-green-100 text-green-700 rounded-full px-1.5 py-0.5">Cheapest</span>
                    )}
                  </td>
                );
              })}
            </tr>

            {/* Availability */}
            <tr>
              <td className="py-3 pr-4 text-gray-500 font-medium">Beds available</td>
              {compared.map((h) => {
                const f = free(h);
                return (
                  <td key={h.slug} className="py-3 px-3">
                    <span className={f > 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                      {f > 0 ? `${f} free` : "Full"}
                    </span>
                  </td>
                );
              })}
            </tr>

            {/* Campus */}
            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
              <td className="py-3 pr-4 text-gray-500 font-medium">Campus</td>
              {compared.map((h) => (
                <td key={h.slug} className="py-3 px-3 text-gray-700 dark:text-gray-300">{h.campus_display}</td>
              ))}
            </tr>

            {/* Gender policy */}
            <tr>
              <td className="py-3 pr-4 text-gray-500 font-medium">Gender</td>
              {compared.map((h) => (
                <td key={h.slug} className="py-3 px-3">{GENDER_LABEL[h.gender_policy] ?? h.gender_policy}</td>
              ))}
            </tr>

            {/* Min stay */}
            <tr className="bg-gray-50/50 dark:bg-gray-800/30">
              <td className="py-3 pr-4 text-gray-500 font-medium">Min stay</td>
              {compared.map((h) => (
                <td key={h.slug} className="py-3 px-3">
                  {h.min_stay_months ? `${h.min_stay_months} month${h.min_stay_months > 1 ? "s" : ""}` : "—"}
                </td>
              ))}
            </tr>

            {/* Amenities */}
            {AMENITIES.map(({ key, label, icon: Icon }, i) => (
              <tr key={key} className={i % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-gray-800/30"}>
                <td className="py-3 pr-4 text-gray-500 font-medium flex items-center gap-1">
                  {Icon && <Icon size={13} className="shrink-0" />} {label}
                </td>
                {compared.map((h) => (
                  <td key={h.slug} className="py-3 px-3">
                    {h[key]
                      ? <span className="text-green-600 font-bold">✓</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 pt-2">
        {compared.map((h) => (
          <button key={h.slug} onClick={() => navigate(`/hostels/${h.slug}`)}
            className="btn-primary text-sm px-4 py-2">
            Book at {h.name}
          </button>
        ))}
      </div>
    </div>
  );
}
