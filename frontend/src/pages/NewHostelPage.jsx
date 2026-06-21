import { useState, useRef, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import {
  X, ChevronRight, ChevronLeft, Check, Upload, Trash2,
  Wifi, Snowflake, Zap, Droplets, Shield, Car, WashingMachine, Utensils,
  Landmark, GraduationCap, School, MapPin,
} from "lucide-react";
import { hostelApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { PUBLIC_UNIVERSITIES, PRIVATE_UNIVERSITIES } from "../utils/universities.js";
import { CAMPUS_COORDS } from "../utils/campusCoords.js";
const LocationPickerLazy = lazy(() => import("../components/HostelMap.jsx").then((m) => ({ default: m.LocationPicker })));

// ── Constants ─────────────────────────────────────────────────────────────────

const CAMPUS_CATEGORIES = [
  { value: "public",  icon: Landmark,       label: "Public",  options: PUBLIC_UNIVERSITIES },
  { value: "private", icon: GraduationCap,  label: "Private", options: PRIVATE_UNIVERSITIES },
  { value: "other",   icon: School,         label: "Other",   options: [{ value: "OTHER", label: "Other" }] },
];

const GENDER_POLICIES = [
  { value: "mixed",  label: "Mixed (any gender)" },
  { value: "male",   label: "Male only" },
  { value: "female", label: "Female only" },
];

const AMENITIES = [
  { key: "has_wifi",        label: "WiFi",             icon: Wifi },
  { key: "has_ac",          label: "Air Conditioning",  icon: Snowflake },
  { key: "has_electricity", label: "Electricity",       icon: Zap },
  { key: "has_water",       label: "Water Access",      icon: Droplets },
  { key: "has_security",    label: "Security / Guard",  icon: Shield },
  { key: "has_parking",     label: "Parking",           icon: Car },
  { key: "has_laundry",     label: "Laundry Facility",  icon: WashingMachine },
  { key: "has_kitchen",     label: "Shared Kitchen",    icon: Utensils },
];

const STEPS = ["Basic Info", "Amenities & Policy", "Photos"];
const MIN_PHOTOS = 3;
const MAX_PHOTOS = 5;

function toSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

const EMPTY_FORM = {
  name: "", slug: "", campus: "UG", location: "",
  base_price: "", total_capacity: "", description: "",
  gender_policy: "mixed", min_stay_months: "1",
  utilities_included: false,
  has_wifi: false, has_ac: false, has_electricity: true,
  has_water: true, has_security: false, has_parking: false,
  has_laundry: false, has_kitchen: false,
  latitude: null, longitude: null,
};

// ── Step bar ──────────────────────────────────────────────────────────────────

function StepBar({ current }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold"
              style={{
                background: i <= current ? "var(--color-brand, #6366f1)" : "#e5e7eb",
                color: i <= current ? "#fff" : "#9ca3af",
                boxShadow: i === current ? "0 0 0 4px color-mix(in srgb, var(--color-brand, #6366f1) 20%, transparent)" : "none",
                transition: "all 0.3s ease",
              }}>
              {i < current ? <Check size={16} /> : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap transition-colors duration-300
              ${i === current ? "text-brand" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-2 mb-5 h-0.5 w-10 sm:w-16"
              style={{
                background: i < current ? "var(--color-brand, #6366f1)" : "#e5e7eb",
                transition: "background 0.4s ease",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Amenity toggle pill ───────────────────────────────────────────────────────

function AmenityToggle({ label, icon: Icon, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-medium
        transition-all duration-200 select-none text-left
        ${checked
          ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"}`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="flex-1">{label}</span>
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-all
        ${checked ? "bg-brand" : "border border-gray-300 dark:border-gray-600"}`}>
        {checked && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2
        transition-colors duration-200
        ${checked ? "border-brand bg-brand" : "border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700"}`}
    >
      <span
        className="h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
        style={{ transform: checked ? "translateX(20px)" : "translateX(2px)" }}
      />
    </button>
  );
}

// ── Photo picker ──────────────────────────────────────────────────────────────

function PhotoPicker({ photos, onChange }) {
  const inputRef = useRef(null);

  const addFiles = (files) => {
    const incoming = Array.from(files).filter(f => f.type.startsWith("image/"));
    onChange([...photos, ...incoming].slice(0, MAX_PHOTOS));
  };

  const remove = (i) => onChange(photos.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Upload <strong>{MIN_PHOTOS}–{MAX_PHOTOS} photos</strong>. The first photo becomes the cover image.
      </p>

      {/* Drop zone */}
      <div
        onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => photos.length < MAX_PHOTOS && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8
          text-center transition-colors duration-200
          ${photos.length >= MAX_PHOTOS
            ? "cursor-not-allowed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/40"
            : "cursor-pointer border-brand/40 bg-brand/5 hover:border-brand hover:bg-brand/10 dark:border-brand/30"}`}
      >
        <Upload size={26} className="mb-2 text-brand/60" />
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {photos.length >= MAX_PHOTOS ? "Maximum photos reached" : "Drag & drop or click to browse"}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {photos.length} / {MAX_PHOTOS} added
          {photos.length < MIN_PHOTOS && ` — need ${MIN_PHOTOS - photos.length} more`}
        </p>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => addFiles(e.target.files)} />
      </div>

      {/* Preview grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {photos.map((file, i) => (
            <div key={i} className="group relative aspect-square">
              <img
                src={URL.createObjectURL(file)}
                alt=""
                className="h-full w-full rounded-xl object-cover ring-2 ring-transparent
                  group-hover:ring-brand/40 transition-all"
              />
              {i === 0 && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-brand px-1.5 py-0.5
                  text-[10px] font-semibold text-white shadow">Cover</span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full
                  bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && photos.length < MIN_PHOTOS && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
          Add {MIN_PHOTOS - photos.length} more photo{MIN_PHOTOS - photos.length > 1 ? "s" : ""} to continue.
        </p>
      )}
      {photos.length >= MIN_PHOTOS && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
          ✓ Looks great — you can submit now.
        </p>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NewHostelPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep]     = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [slideDir, setSlideDir] = useState(1); // 1 = forward, -1 = back
  const [form, setForm]     = useState(EMPTY_FORM);
  const [campusCat, setCampusCat] = useState("public");
  const [photos, setPhotos] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy]     = useState(false);

  const set = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name") next.slug = toSlug(value);
      return next;
    });
    if (errors[field]) setErrors((p) => { const n = { ...p }; delete n[field]; return n; });
  };

  const goTo = (next) => {
    setSlideDir(next > step ? 1 : -1);
    setStep(next);
    setAnimKey((k) => k + 1);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validateStep0 = () => {
    const e = {};
    if (!form.name.trim())              e.name       = "Required";
    if (!form.slug.trim())              e.slug       = "Required";
    if (!form.location.trim())          e.location   = "Required";
    if (!form.base_price)               e.base_price = "Required";
    else if (Number(form.base_price) <= 0) e.base_price = "Must be greater than 0";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (step === 0 && !validateStep0()) return;
    if (step < STEPS.length - 1) goTo(step + 1);
  };

  const back = () => { if (step > 0) goTo(step - 1); };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const submit = async () => {
    if (photos.length < MIN_PHOTOS) {
      addToast("error", `Add at least ${MIN_PHOTOS} photos to continue.`);
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v === null || v === undefined) return; // skip unset optional fields
        fd.append(k, typeof v === "boolean" ? String(v) : v);
      });
      fd.append("image", photos[0]); // cover

      const { data: hostel } = await hostelApi.create(fd);

      // Remaining photos → gallery
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
        const step0Fields = ["name", "slug", "location", "base_price", "total_capacity", "description"];
        if (step0Fields.some((f) => f in data)) {
          goTo(0);
          addToast("error", "Fix the errors on step 1.");
        } else {
          addToast("error", "Please fix the highlighted errors.");
        }
      } else {
        addToast("error", "Could not create hostel. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Slide animation style ───────────────────────────────────────────────────
  // We use a CSS keyframe animation driven by data-attr so the same direction
  // works even when clicked twice in a row (animKey always increments).
  const slideStyle = {
    animation: `slideIn${slideDir > 0 ? "Right" : "Left"} 0.28s cubic-bezier(0.4,0,0.2,1) forwards`,
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inject keyframes once */}
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-36px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">New Hostel Listing</h1>
          <button
            onClick={() => navigate("/manager")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400
              hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <StepBar current={step} />

        {/* Card */}
        <div className="card overflow-hidden p-6 sm:p-8">

          {/* Animated step content */}
          <div key={animKey} style={slideStyle}>
            {step === 0 && <Step0 form={form} set={set} errors={errors} campusCat={campusCat} setCampusCat={setCampusCat} onCoords={(lat, lng) => { set("latitude", lat); set("longitude", lng); }} />}
            {step === 1 && <Step1 form={form} set={set} />}
            {step === 2 && <Step2 photos={photos} setPhotos={setPhotos} />}
          </div>

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={back}
              className={`flex items-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition
                ${step === 0
                  ? "pointer-events-none opacity-0"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"}`}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {/* Dot indicators */}
            <div className="flex gap-2">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? "20px" : "6px",
                    height: "6px",
                    background: i === step
                      ? "var(--color-brand, #6366f1)"
                      : i < step ? "#a5b4fc" : "#e5e7eb",
                  }}
                />
              ))}
            </div>

            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}
                className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                onClick={submit}
                disabled={busy || photos.length < MIN_PHOTOS}
                className="btn-primary flex items-center gap-1.5 px-5 py-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Creating…" : <><Check size={16} /> Create Listing</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Step 0: Basic Info ────────────────────────────────────────────────────────

function Step0({ form, set, errors, campusCat, setCampusCat, onCoords }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Basic Information</h2>
        <p className="mt-0.5 text-sm text-gray-500">The essentials students see on the listing.</p>
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
        <div className="space-y-2">
          <label className="label">Campus *</label>
          {/* Category radio cards */}
          <div className="grid grid-cols-3 gap-2">
            {CAMPUS_CATEGORIES.map(({ value, icon: Icon, label, options }) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setCampusCat(value);
                  set("campus", options[0].value);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition
                  ${campusCat === value
                    ? "border-brand bg-brand/5 text-brand"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:text-gray-300"}`}
              >
                <Icon size={13} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>
          {/* Filtered dropdown — hidden when "Other" (only one choice) */}
          {campusCat !== "other" ? (
            <select className="input" value={form.campus} onChange={(e) => set("campus", e.target.value)}>
              {CAMPUS_CATEGORIES.find((c) => c.value === campusCat)?.options.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-gray-500 px-1">Campus will be set to "Other".</p>
          )}
        </div>
        <div>
          <label className="label">Location / Landmark *</label>
          <input className="input" placeholder="e.g. Behind KNUST SRC"
            value={form.location} onChange={(e) => set("location", e.target.value)} />
          {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
        </div>
      </div>

      {/* Map pin */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="label mb-0">Pin exact location on map</label>
          <span className="text-xs text-gray-400">(optional — helps students find you)</span>
        </div>
        {form.latitude != null
          ? <p className="text-xs text-green-600 flex items-center gap-1">
              <MapPin size={12} /> {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
              <button type="button" className="ml-2 text-gray-400 hover:text-red-500 underline"
                onClick={() => { set("latitude", null); set("longitude", null); }}>
                Clear
              </button>
            </p>
          : <p className="text-xs text-gray-400">Click on the map to drop a pin</p>
        }
        <Suspense fallback={<div className="h-[300px] rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />}>
          <LocationPickerLazy
            lat={form.latitude}
            lng={form.longitude}
            onChange={({ lat, lng }) => onCoords(lat, lng)}
            defaultCenter={(() => {
              const c = CAMPUS_COORDS[form.campus];
              return c ? [c.lat, c.lng] : [7.9465, -1.0232];
            })()}
          />
        </Suspense>
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

// ── Step 1: Amenities & Policy ────────────────────────────────────────────────

function Step1({ form, set }) {
  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold">Amenities &amp; Policy</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Tick what's available — this appears on the hostel listing.
        </p>
      </div>

      {/* Amenity toggles */}
      <div>
        <p className="label mb-3">Available amenities</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2">
          {AMENITIES.map(({ key, label, icon }) => (
            <AmenityToggle
              key={key}
              label={label}
              icon={icon}
              checked={!!form[key]}
              onChange={(v) => set(key, v)}
            />
          ))}
        </div>
      </div>

      {/* Utilities included */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200
        bg-amber-50 px-4 py-3.5 dark:border-amber-800/50 dark:bg-amber-900/20">
        <div>
          <p className="font-medium text-gray-800 dark:text-gray-200">Utility bills included in price?</p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Electricity, water, and WiFi costs covered by the listed price.
          </p>
        </div>
        <ToggleSwitch checked={!!form.utilities_included} onChange={(v) => set("utilities_included", v)} />
      </div>

      {/* House policy */}
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
            value={form.min_stay_months}
            onChange={(e) => set("min_stay_months", e.target.value)} />
          <p className="mt-1 text-xs text-gray-400">How long must a student commit to stay?</p>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Photos ────────────────────────────────────────────────────────────

function Step2({ photos, setPhotos }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Hostel Photos</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Great photos get more bookings. Add at least 3, up to 5.
        </p>
      </div>
      <PhotoPicker photos={photos} onChange={setPhotos} />
    </div>
  );
}
