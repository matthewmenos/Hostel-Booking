import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Check, Upload, Trash2, MapPin,
  AlertCircle, CheckCircle2, X, Flag, Globe,
} from "lucide-react";
import { managerApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { COUNTRIES } from "../utils/countries.js";

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ["Nationality", "ID Verification", "Face / Selfie", "Location", "Review & Pay"];

// ── Helpers ───────────────────────────────────────────────────────────────────

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
                boxShadow: i === current
                  ? "0 0 0 4px color-mix(in srgb, var(--color-brand, #6366f1) 20%, transparent)"
                  : "none",
                transition: "all 0.3s ease",
              }}
            >
              {i < current ? <Check size={16} /> : i + 1}
            </div>
            <span className={`hidden sm:block text-xs font-medium whitespace-nowrap transition-colors duration-300
              ${i === current ? "text-brand" : "text-gray-400"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="mx-2 mb-5 h-0.5 w-6 sm:w-10"
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

function ImageUploadZone({ label, hint, file, onChange }) {
  const inputRef = useRef(null);
  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {file ? (
        <div className="relative">
          <img
            src={preview}
            alt={label}
            className="h-40 w-full rounded-xl object-cover ring-2 ring-brand/30"
          />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
              rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          <span className="absolute bottom-2 left-2 rounded-md bg-brand px-2 py-0.5
            text-[10px] font-semibold text-white shadow">
            {label}
          </span>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border-2
            border-dashed border-brand/40 bg-brand/5 p-8 text-center cursor-pointer
            hover:border-brand hover:bg-brand/10 transition-colors dark:border-brand/30"
        >
          <Upload size={24} className="text-brand/60" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Click to upload</p>
          <p className="text-xs text-gray-400">JPG, PNG, WEBP</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onChange(e.target.files[0] ?? null)}
      />
    </div>
  );
}

// ── Step components ───────────────────────────────────────────────────────────

function Step0({ form, setForm }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Nationality</h2>
        <p className="mt-0.5 text-sm text-gray-500">Tell us where you're from.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {["Ghanaian", "Other"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setForm((f) => ({ ...f, nationality_type: opt, nationality: opt === "Ghanaian" ? "Ghanaian" : "" }))}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-5 transition-all
              ${form.nationality_type === opt
                ? "border-brand bg-brand/10 text-brand dark:bg-brand/20"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 dark:border-gray-600 dark:bg-gray-800"
              }`}
          >
            {opt === "Ghanaian"
              ? <Flag size={28} className="text-green-600" />
              : <Globe size={28} className="text-blue-500" />}
            <span className="font-semibold">{opt}</span>
          </button>
        ))}
      </div>

      {form.nationality_type === "Other" && (
        <div>
          <label className="label">Select your country</label>
          <select
            className="input"
            value={form.nationality}
            onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
          >
            <option value="">— Choose country —</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Step1({ form, setForm }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ghana Card (National ID)</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Upload clear photos of both sides of your Ghana Card.
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Tips:</strong> Ensure all text is readable and no corners are cut off.
          Photos must be taken in good lighting.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploadZone
          label="Front of Ghana Card"
          hint="Photo / scan of the front side"
          file={form.id_front}
          onChange={(f) => setForm((prev) => ({ ...prev, id_front: f }))}
        />
        <ImageUploadZone
          label="Back of Ghana Card"
          hint="Photo / scan of the back side"
          file={form.id_back}
          onChange={(f) => setForm((prev) => ({ ...prev, id_back: f }))}
        />
      </div>
    </div>
  );
}

function Step2({ form, setForm }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Face Verification</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Upload a clear, recent photo of your face (selfie).
        </p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
          <li>• Face must be clearly visible — no sunglasses or hat</li>
          <li>• Plain or neutral background preferred</li>
          <li>• Look directly at the camera</li>
        </ul>
      </div>

      <div className="mx-auto max-w-xs">
        <ImageUploadZone
          label="Your Selfie"
          file={form.selfie}
          onChange={(f) => setForm((prev) => ({ ...prev, selfie: f }))}
        />
      </div>
    </div>
  );
}

function Step3({ form, setForm }) {
  const [geoStatus, setGeoStatus] = useState(
    form.latitude ? "acquired" : "idle"  // idle | loading | acquired | denied
  );

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude:  pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setGeoStatus("acquired");
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Business Location</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Share your GPS location and describe your business address.
        </p>
      </div>

      {/* GPS capture */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">GPS Coordinates</p>
        <button
          type="button"
          onClick={shareLocation}
          disabled={geoStatus === "loading"}
          className="flex items-center gap-2 rounded-xl border-2 border-brand/40 bg-brand/5
            px-5 py-3 text-sm font-medium text-brand hover:border-brand hover:bg-brand/10
            transition-all disabled:opacity-60 dark:border-brand/30"
        >
          <MapPin size={17} />
          {geoStatus === "loading" ? "Getting location…" : "Share My Location"}
        </button>

        {geoStatus === "acquired" && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2
            text-sm text-green-700 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle2 size={15} />
            Location captured: {form.latitude?.toFixed(5)}, {form.longitude?.toFixed(5)}
          </div>
        )}
        {geoStatus === "denied" && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2
            text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle size={15} />
            Location access denied — please enable it in your browser settings.
          </div>
        )}
        {geoStatus === "idle" && (
          <p className="text-xs text-gray-400">Location not yet captured.</p>
        )}
      </div>

      {/* Typed address */}
      <div>
        <label className="label">Business Address / Landmark *</label>
        <textarea
          rows={3}
          className="input resize-none"
          placeholder="e.g. No. 12 Independence Ave, Behind Total Petrol Station, Kumasi"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
        <p className="mt-1 text-xs text-gray-400">
          Include street, area/neighbourhood, and a nearby landmark.
        </p>
      </div>
    </div>
  );
}

function Step4({ form, busy, onPay }) {
  const rows = [
    { label: "Nationality",  value: form.nationality || "—" },
    { label: "Address",      value: form.address || "—" },
    { label: "GPS",          value: form.latitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : "Not captured" },
    { label: "Ghana Card",   value: (form.id_front && form.id_back) ? "Both sides uploaded ✓" : "Incomplete" },
    { label: "Selfie",       value: form.selfie ? "Uploaded ✓" : "Not uploaded" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; Pay</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Confirm your details and pay the one-time GHS 5 activation fee.
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
              <span className="text-sm text-gray-500">{label}</span>
              <span className={`text-sm font-medium text-right
                ${value.includes("✓") ? "text-green-600 dark:text-green-400"
                  : value === "Not captured" || value === "Not uploaded" || value === "Incomplete"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-800 dark:text-gray-200"}`}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment card */}
      <div className="rounded-xl border border-brand/20 bg-brand/5 px-5 py-4 dark:bg-brand/10">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-200">Activation Fee</p>
            <p className="text-sm text-gray-500">One-time, non-refundable</p>
          </div>
          <span className="text-2xl font-bold text-brand">GHS 5</span>
        </div>
      </div>

      <button
        type="button"
        onClick={onPay}
        disabled={busy}
        className="btn-primary w-full flex items-center justify-center gap-2 py-3
          text-base disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy
          ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Submitting…</>
          : "Pay GHS 5 Activation Fee"}
      </button>

      <p className="text-center text-xs text-gray-400">
        Your details will be reviewed by an admin after payment. Processing usually
        takes 1–2 business days.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  nationality_type: "",   // "Ghanaian" | "Other"
  nationality: "",
  id_front: null,
  id_back: null,
  selfie: null,
  latitude: null,
  longitude: null,
  address: "",
};

export default function ManagerVerificationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep]       = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [busy, setBusy]       = useState(false);
  const [paid, setPaid]       = useState(false);

  const goTo = (next) => {
    setSlideDir(next > step ? 1 : -1);
    setStep(next);
    setAnimKey((k) => k + 1);
  };

  const validate = () => {
    if (step === 0) {
      if (!form.nationality) { addToast("error", "Please select your nationality."); return false; }
    }
    if (step === 1) {
      if (!form.id_front || !form.id_back) { addToast("error", "Upload both sides of your Ghana Card."); return false; }
    }
    if (step === 2) {
      if (!form.selfie) { addToast("error", "Upload your selfie photo."); return false; }
    }
    if (step === 3) {
      if (!form.address.trim()) { addToast("error", "Business address is required."); return false; }
    }
    return true;
  };

  const next = () => { if (validate()) goTo(step + 1); };
  const back = () => { if (step > 0) goTo(step - 1); };

  const handlePay = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("nationality", form.nationality);
      fd.append("id_front", form.id_front);
      fd.append("id_back", form.id_back);
      fd.append("selfie", form.selfie);
      fd.append("address", form.address);
      if (form.latitude != null)  fd.append("latitude",  form.latitude);
      if (form.longitude != null) fd.append("longitude", form.longitude);

      const { data } = await managerApi.submitVerification(fd);

      if (data.stub) {
        // Dev mode: payment auto-confirmed, skip Paystack
        addToast("success", "Verification submitted (dev mode — payment auto-confirmed).");
        setPaid(true);
      } else if (data.authorization_url) {
        window.open(data.authorization_url, "_blank");
        setPaid(true);
        addToast("info", "Complete payment in the new tab, then return here.");
      } else {
        addToast("error", "Payment initiation failed. Please try again.");
      }
    } catch (err) {
      const data = err.response?.data;
      const msg = data?.detail || (typeof data === "object" ? Object.values(data).flat()[0] : null);
      addToast("error", msg ?? "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const slideStyle = {
    animation: `slideIn${slideDir > 0 ? "Right" : "Left"} 0.28s cubic-bezier(0.4,0,0.2,1) forwards`,
  };

  // ── Post-payment waiting screen ───────────────────────────────────────────
  if (paid) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-8 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold">Application Submitted</h2>
          <p className="text-gray-500">
            Your identity verification details have been received. Once payment is confirmed,
            an admin will review your application.
          </p>
          <p className="text-sm text-gray-400">
            This usually takes <strong>1–2 business days</strong>. You will be notified
            when your account is approved.
          </p>
          <button onClick={() => navigate("/manager")} className="btn-primary px-6 py-2.5">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
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
          <div>
            <h1 className="text-2xl font-bold">Identity Verification</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              Required once before you can list your first hostel.
            </p>
          </div>
          <button
            onClick={() => navigate("/manager")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400
              hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <StepBar current={step} />

        <div className="card overflow-hidden p-6 sm:p-8">
          {/* Animated step content */}
          <div key={animKey} style={slideStyle}>
            {step === 0 && <Step0 form={form} setForm={setForm} />}
            {step === 1 && <Step1 form={form} setForm={setForm} />}
            {step === 2 && <Step2 form={form} setForm={setForm} />}
            {step === 3 && <Step3 form={form} setForm={setForm} />}
            {step === 4 && <Step4 form={form} busy={busy} onPay={handlePay} />}
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

            {/* Step dots */}
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
              <div className="w-24" /> // spacer — pay button is inside Step4
            )}
          </div>
        </div>
      </div>
    </>
  );
}
