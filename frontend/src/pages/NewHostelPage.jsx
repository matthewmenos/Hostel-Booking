import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X, ChevronRight, ChevronLeft, Check, Upload, Trash2 } from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPUSES = [
  { value: "KNUST",  label: "KNUST (Kumasi)" },
  { value: "LEGON",  label: "University of Ghana, Legon" },
  { value: "UCC",    label: "University of Cape Coast" },
  { value: "UPSA",   label: "University of Professional Studies" },
  { value: "OTHER",  label: "Other" },
];

const GENDER_POLICIES = [
  { value: "mixed",  label: "Mixed (any gender)" },
  { value: "male",   label: "Male only" },
  { value: "female", label: "Female only" },
];

const AMENITIES = [
  { key: "has_wifi",        label: "WiFi",             icon: "📶" },
  { key: "has_ac",          label: "Air Conditioning",  icon: "❄️" },
  { key: "has_electricity", label: "Electricity",       icon: "⚡" },
  { key: "has_water",       label: "Water Access",      icon: "💧" },
  { key: "has_security",    label: "Security / Guard",  icon: "🔒" },
  { key: "has_parking",     label: "Parking",           icon: "🚗" },
  { key: "has_laundry",     label: "Laundry Facility",  icon: "🧺" },
  { key: "has_kitchen",     label: "Shared Kitchen",    icon: "🍳" },
];

const STEPS = ["Basic Info", "Details & Amenities", "Photos"];

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold
              transition-all duration-300
              ${i < current  ? "bg-brand text-white scale-95"
              : i === current ? "bg-brand text-white ring-4 ring-brand/25"
              : "bg-gray-100 text-gray-400 dark:bg-gray-700"}`}>
              {i < current ? <Check size={16} /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap
              ${i === current ? "text-brand" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mx-2 mb-5 h-0.5 w-12 sm:w-20 transition-all duration-500
              ${i < current ? "bg-brand" : "bg-gray-200 dark:bg-gray-700"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Animated panel wrapper ────────────────────────────────────────────────────

function SlidePanel({ children, dir }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = dir === "forward" ? "translateX(40px)" : "translateX(-40px)";
    el.animate(
      [{ opacity: 0, transform: from }, { opacity: 1, transform: "translateX(0)" }],
      { duration: 280, easing: "cubic-bezier(0.4,0,0.2,1)", fill: "forwards" }
    );
  }, [dir]);
  return <div ref={ref}>{children}</div>;
}

// ── Toggle checkbox pill ──────────────────────────────────────────────────────

function AmenityToggle({ label, icon, checked, onChange }) {
  return (
    <button type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-medium
        transition-all duration-200 select-none
        ${checked
          ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
          : "border-gray-200 bg-white text-gray-600 hover:border-brand/40 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}>
      <span>{icon}</span>
      {label}
      {checked && <Check size={13} className="ml-auto" />}
    </button>
  );
}

// ── Photo dropzone ────────────────────────────────────────────────────────────

function PhotoPicker({ photos, onChange }) {
  const inputRef = useRef(null);
  const MIN = 3;
  const MAX = 5;

  const addFiles = (files) => {
    const incoming = Array.from(files).filter(f => f.type.startsWith("image/"));
    const combined = [...photos, ...incoming].slice(0, MAX);
    onChange(combined);
  };

  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i));

  const onDrop = (e) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload <strong>{MIN}–{MAX} photos</strong> of the hostel. The first photo will be the cover image.
      </p>

      {/* Dropzone */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => photos.length < MAX && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed
          p-8 text-center transition-colors duration-200
          ${photos.length >= MAX
            ? "cursor-not-allowed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
            : "cursor-pointer border-brand/40 bg-brand/5 hover:border-brand hover:bg-brand/10 dark:border-brand/30 dark:bg-brand/5"}`}>
        <Upload size={28} className="mb-2 text-brand/60" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {photos.length >= MAX ? "Maximum photos reached" : "Drag & drop or click to add photos"}
        </p>
        <p className="mt-1 text-xs text-gray-400">{photos.length}/{MAX} added</p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => addFiles(e.target.files)} />
      </div>

      {/* Previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {photos.map((file, i) => (
            <div key={i} className="group relative aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="h-full w-full rounded-xl object-cover"
              />
              {i === 0 && (
                <span className="absolute bottom-1 left-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  Cover
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full
                  bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && photos.length < MIN && (
        <p className="text-xs text-amber-600">
          Add {MIN - photos.length} more photo{MIN - photos.length > 1 ? "s" : ""} to continue.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  // Step 1
  name: "", slug: "", campus: "KNUST", location: "",
  base_price: "", total_capacity: "", description: "",
  // Step 2
  gender_policy: "mixed", min_stay_months: "1",
  utilities_included: false,
  has_wifi: false, has_ac: false, has_electricity: true,
  has_water: true, has_security: false, has_parking: false,
  has_laundry: false, has_kitchen: false,
};

export default function NewHostelPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep]   = useState(0);
  const [dir, setDir]     = useState("forward");
  const [form, setForm]   = useState(EMPTY_FORM);
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy]   = useState(false);

  const set = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name") next.slug = toSlug(value);
      return next;
    });
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const goTo = (next) => {
    setDir(next > step ? "forward" : "back");
    setStep(next);
  };

  // ── Step validators ─────────────────────────────────────────────────────────

  const validateStep1 = () => {
    const e = {};
    if (!form.name.trim())       e.name       = "Required";
    if (!form.slug.trim())       e.slug       = "Required";
    if (!form.location.trim())   e.location   = "Required";
    if (!form.base_price)        e.base_price = "Required";
    if (Number(form.base_price) <= 0) e.base_price = "Must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep3 = () => photos.length >= 3;

  // ── Navigation ──────────────────────────────────────────────────────────────

  const next = () => {
    if (step === 0 && !validateStep1()) return;
    if (step < STEPS.length - 1) goTo(step + 1);
  };

  const back = () => {
    if (step > 0) goTo(step - 1);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (!validateStep3()) {
      addToast("error", "Please add at least 3 photos.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      // First photo as the cover image
      fd.append("image", photos[0]);
      const { data: hostel } = await hostelApi.create(fd);

      // Upload remaining photos as gallery images
      if (photos.length > 1) {
        await Promise.all(
          photos.slice(1).map((file) => {
            const gfd = new FormData();
            gfd.append("image", file);
            return hostelApi.uploadImage(hostel.slug, gfd);
          })
        );
      }

      addToast("success", "Hostel listed successfully!");
      navigate("/manager");
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setErrors(data);
        // If the error is in step 1 fields, go back
        const step1Fields = ["name", "slug", "location", "base_price", "total_capacity"];
        if (step1Fields.some((f) => f in data)) {
          goTo(0);
          addToast("error", "Fix the errors in step 1.");
        } else {
          addToast("error", "Please fix the errors.");
        }
      } else {
        addToast("error", "Could not create hostel. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">New Hostel Listing</h1>
        <button onClick={() => navigate("/manager")}
          className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400
            hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors">
          <X size={20} />
        </button>
      </div>

      <StepBar current={step} />

      {/* Modal card */}
      <div className="card overflow-hidden p-6 sm:p-8">
        <SlidePanel key={step} dir={dir}>
          {step === 0 && <Step1 form={form} set={set} errors={errors} />}
          {step === 1 && <Step2 form={form} set={set} />}
          {step === 2 && <Step3 photos={photos} setPhotos={setPhotos} />}
        </SlidePanel>

        {/* Navigation buttons */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button type="button" onClick={back}
            disabled={step === 0}
            className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition
              ${step === 0
                ? "invisible"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"}`}>
            <ChevronLeft size={16} /> Back
          </button>

          <div className="flex gap-1.5">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300
                ${i === step ? "w-6 bg-brand" : "w-1.5 bg-gray-200 dark:bg-gray-600"}`} />
            ))}
          </div>

          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm">
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={busy || photos.length < 3}
              className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm disabled:opacity-50">
              {busy ? "Creating…" : <><Check size={16} /> Create Listing</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 1: Basic Info ────────────────────────────────────────────────────────

function Step1({ form, set, errors }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <p className="mt-0.5 text-sm text-gray-500">Tell students the essentials about your hostel.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Hostel name *</label>
          <input className="input" placeholder="e.g. Sunshine Hostel"
            value={form.name} onChange={(e) => set("name", e.target.value)} />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
        </div>
        <div>
          <label className="label">URL slug *</label>
          <input className="input font-mono text-sm" placeholder="sunshine-hostel"
            value={form.slug} onChange={(e) => set("slug", e.target.value)} />
          {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug}</p>}
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
          <input className="input" placeholder="e.g. Behind KNUST SRC"
            value={form.location} onChange={(e) => set("location", e.target.value)} />
          {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Price per bed / year (GHS) *</label>
          <input type="number" min="0" step="0.01" className="input" placeholder="e.g. 1200"
            value={form.base_price} onChange={(e) => set("base_price", e.target.value)} />
          {errors.base_price && <p className="mt-1 text-xs text-red-500">{errors.base_price}</p>}
        </div>
        <div>
          <label className="label">Total bed capacity</label>
          <input type="number" min="0" className="input" placeholder="e.g. 40"
            value={form.total_capacity} onChange={(e) => set("total_capacity", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Description</label>
        <textarea rows={3} className="input resize-none"
          placeholder="Describe what makes your hostel great…"
          value={form.description} onChange={(e) => set("description", e.target.value)} />
      </div>
    </div>
  );
}

// ── Step 2: Amenities & Details ───────────────────────────────────────────────

function Step2({ form, set }) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold">Amenities & Details</h2>
        <p className="mt-0.5 text-sm text-gray-500">Let students know what's included and your house policies.</p>
      </div>

      {/* Amenity toggles */}
      <div>
        <label className="label mb-3">Amenities available</label>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {AMENITIES.map(({ key, label, icon }) => (
            <AmenityToggle key={key} label={label} icon={icon}
              checked={!!form[key]} onChange={(v) => set(key, v)} />
          ))}
        </div>
      </div>

      {/* Utilities included */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-dashed border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex-1">
          <p className="font-medium text-gray-800 dark:text-gray-200">Utility bills included?</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Check this if electricity, water, or WiFi bills are covered by the listed price.
          </p>
        </div>
        <button type="button" onClick={() => set("utilities_included", !form.utilities_included)}
          className={`mt-0.5 flex h-7 w-12 shrink-0 items-center rounded-full border-2 p-0.5 transition-all duration-200
            ${form.utilities_included
              ? "border-brand bg-brand justify-end"
              : "border-gray-300 bg-white justify-start dark:border-gray-600 dark:bg-gray-700"}`}>
          <div className="h-5 w-5 rounded-full bg-white shadow-sm" />
        </button>
      </div>

      {/* House rules */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Gender policy</label>
          <select className="input" value={form.gender_policy}
            onChange={(e) => set("gender_policy", e.target.value)}>
            {GENDER_POLICIES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Minimum stay (months)</label>
          <input type="number" min="1" max="12" className="input"
            value={form.min_stay_months} onChange={(e) => set("min_stay_months", e.target.value)} />
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Photos ────────────────────────────────────────────────────────────

function Step3({ photos, setPhotos }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Hostel Photos</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Great photos get more bookings. Add at least 3 — up to 5.
        </p>
      </div>
      <PhotoPicker photos={photos} onChange={setPhotos} />
    </div>
  );
}
