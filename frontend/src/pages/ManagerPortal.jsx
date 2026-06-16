import { useEffect, useState } from "react";
import { Building2, Plus, BedDouble, Percent } from "lucide-react";
import { hostelApi, tenantApi } from "../api/endpoints.js";

export default function ManagerPortal() {
  const [hostels, setHostels] = useState([]);
  const [active, setActive] = useState(null); // selected hostel slug
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hostelApi
      .myHostels()
      .then(({ data }) => {
        const list = data.results ?? data;
        setHostels(list);
        if (list[0]) setActive(list[0].slug);
      })
      .finally(() => setLoading(false));
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

  if (loading) return <p className="text-gray-500">Loading…</p>;

  if (hostels.length === 0) {
    return (
      <div className="card p-6">
        <h1 className="mb-2 text-xl font-bold">Manager Portal</h1>
        <p className="text-gray-500">
          You have no hostels listed yet. (Listing creation can be added here —
          the <code>/api/hostels/</code> POST endpoint is ready.)
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manager Portal</h1>
        <select
          className="input max-w-xs"
          value={active ?? ""}
          onChange={(e) => setActive(e.target.value)}
        >
          {hostels.map((h) => (
            <option key={h.slug} value={h.slug}>
              {h.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={Building2} label="Hostels" value={hostels.length} />
        <StatCard icon={BedDouble} label="Beds" value={`${occupancy.taken}/${occupancy.total}`} />
        <StatCard icon={Percent} label="Occupancy" value={`${occupancy.pct}%`} />
      </div>

      <RoomManager slug={active} rooms={rooms} onChange={setRooms} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-brand/10 p-2 text-brand">
        <Icon size={22} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}

function RoomManager({ slug, rooms, onChange }) {
  const [form, setForm] = useState({ block: "", room_number: "", room_type: "2_in_a_room" });
  const [busy, setBusy] = useState(false);

  const addRoom = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await tenantApi.createRoom(slug, form);
      const { data } = await tenantApi.rooms(slug);
      onChange(data.results ?? data);
      setForm({ block: "", room_number: "", room_type: "2_in_a_room" });
    } catch (err) {
      alert(err.response?.data?.detail ?? "Could not add room.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-lg font-semibold">Rooms</h2>
      <form onSubmit={addRoom} className="mb-4 grid gap-2 sm:grid-cols-4">
        <input
          className="input"
          placeholder="Block"
          value={form.block}
          onChange={(e) => setForm({ ...form, block: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Room #"
          value={form.room_number}
          onChange={(e) => setForm({ ...form, room_number: e.target.value })}
          required
        />
        <select
          className="input"
          value={form.room_type}
          onChange={(e) => setForm({ ...form, room_type: e.target.value })}
        >
          <option value="1_in_a_room">1-in-a-room</option>
          <option value="2_in_a_room">2-in-a-room</option>
          <option value="4_in_a_room">4-in-a-room</option>
        </select>
        <button className="btn-primary" disabled={busy}>
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="divide-y">
        {rooms.map((r) => (
          <div key={r.id} className="flex items-center justify-between py-2">
            <span>
              {r.block}-{r.room_number}{" "}
              <span className="text-sm text-gray-500">({r.room_type_display})</span>
            </span>
            <span className="text-sm text-gray-500">
              {r.beds.filter((b) => b.is_occupied).length}/{r.beds.length} beds taken
            </span>
          </div>
        ))}
        {rooms.length === 0 && <p className="py-2 text-sm text-gray-400">No rooms yet.</p>}
      </div>
    </div>
  );
}
