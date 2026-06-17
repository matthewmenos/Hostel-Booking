import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { hostelApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";

const CAMPUSES = [
  { value: "KNUST", label: "KNUST (Kumasi)" },
  { value: "LEGON", label: "University of Ghana, Legon" },
  { value: "UCC",   label: "University of Cape Coast" },
  { value: "UPSA",  label: "University of Professional Studies" },
  { value: "OTHER", label: "Other" },
];

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function NewHostelPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    name: "", slug: "", campus: "KNUST", location: "",
    base_price: "", total_capacity: "", description: "",
  });
  const [image, setImage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name") next.slug = toSlug(value);
      return next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      if (image) fd.append("image", image);
      await hostelApi.create(fd);
      addToast("success", "Hostel created successfully!");
      navigate("/manager");
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object") {
        setErrors(data);
        addToast("error", "Please fix the errors below.");
      } else {
        addToast("error", "Could not create hostel.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Hostel Listing</h1>
        <button onClick={() => navigate("/manager")} className="btn-ghost px-3 py-1.5 text-sm">
          Cancel
        </button>
      </div>

      <form onSubmit={submit} className="card space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Hostel name *</label>
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} required />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="label">Slug (URL identifier) *</label>
            <input className="input" value={form.slug} onChange={(e) => set("slug", e.target.value)} required />
            {errors.slug && <p className="mt-1 text-xs text-red-600">{errors.slug}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Campus *</label>
            <select className="input" value={form.campus} onChange={(e) => set("campus", e.target.value)}>
              {CAMPUSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Location / Landmark *</label>
            <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} required />
            {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Base price per bed (GHS) *</label>
            <input type="number" min="0" step="0.01" className="input" value={form.base_price}
              onChange={(e) => set("base_price", e.target.value)} required />
            {errors.base_price && <p className="mt-1 text-xs text-red-600">{errors.base_price}</p>}
          </div>
          <div>
            <label className="label">Total capacity (beds)</label>
            <input type="number" min="0" className="input" value={form.total_capacity}
              onChange={(e) => set("total_capacity", e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Description</label>
          <textarea rows={3} className="input resize-none" value={form.description}
            onChange={(e) => set("description", e.target.value)} />
        </div>

        <div>
          <label className="label">Hostel image</label>
          <input type="file" accept="image/*" className="block w-full text-sm text-gray-500
            file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-1.5
            file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
            onChange={(e) => setImage(e.target.files[0] ?? null)} />
        </div>

        <button className="btn-primary w-full" disabled={busy}>
          {busy ? "Creating…" : "Create Hostel"}
        </button>
      </form>
    </div>
  );
}
