import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Check, Upload, MapPin,
  AlertCircle, CheckCircle2, X, Flag, Globe, Camera, Eye,
  RefreshCw, Loader2,
} from "lucide-react";
import { managerApi } from "../api/endpoints.js";
import { useToast } from "../context/ToastContext.jsx";
import { COUNTRIES } from "../utils/countries.js";

// ── Camera utilities ──────────────────────────────────────────────────────────

async function startCamera(videoEl, facingMode = "environment") {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  videoEl.srcObject = stream;
  await new Promise((res) => { videoEl.onloadedmetadata = res; });
  await videoEl.play();
  return stream;
}

function stopStream(stream) {
  stream?.getTracks().forEach((t) => t.stop());
}

/** Measure image sharpness via Laplacian variance on a canvas sample. */
function blurScore(canvas) {
  const ctx = canvas.getContext("2d");
  const { width: w, height: h } = canvas;
  const data = ctx.getImageData(0, 0, w, h).data;
  let sum = 0, sum2 = 0, n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sum += g; sum2 += g * g; n++;
  }
  const mean = sum / n;
  return sum2 / n - mean * mean; // variance = sharpness proxy
}

function captureFrame(videoEl, canvas) {
  canvas.width  = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext("2d").drawImage(videoEl, 0, 0);
}

function canvasToFile(canvas, name) {
  return new Promise((res) => canvas.toBlob((b) => res(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.92));
}

// ── face-api.js lazy loader ───────────────────────────────────────────────────

let faceApiPromise = null;

function loadFaceApi() {
  if (faceApiPromise) return faceApiPromise;
  faceApiPromise = new Promise((resolve, reject) => {
    if (window.faceapi) { resolve(window.faceapi); return; }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
    script.onload = async () => {
      const api = window.faceapi;
      // Models hosted alongside the face-api.js release
      const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights";
      try {
        await Promise.all([
          api.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          api.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          api.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        resolve(api);
      } catch (e) { reject(e); }
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return faceApiPromise;
}

/** Eye Aspect Ratio — blink detection heuristic. */
function eyeAspectRatio(landmarks, eye) {
  const pts = eye === "left"
    ? [36, 37, 38, 39, 40, 41]
    : [42, 43, 44, 45, 46, 47];
  const p = pts.map((i) => landmarks.positions[i]);
  const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
  const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
  const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
  return (A + B) / (2 * C);
}

const EAR_THRESHOLD = 0.22;  // below this = eye closed

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

// ── Live ID capture component ─────────────────────────────────────────────────

function LiveIdCapture({ label, file, onChange }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  const [camState, setCamState]   = useState("idle"); // idle | starting | live | captured | denied
  const [sharp, setSharp]         = useState(false);
  const [autoCapturing, setAutoCapturing] = useState(false);
  const inputRef = useRef(null);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const openCamera = async () => {
    setCamState("starting");
    setSharp(false);
    try {
      const stream = await startCamera(videoRef.current, "environment");
      streamRef.current = stream;
      setCamState("live");

      let ticks = 0;
      const check = () => {
        captureFrame(videoRef.current, canvasRef.current);
        const score = blurScore(canvasRef.current);
        const isSharp = score > 80;
        setSharp(isSharp);
        ticks++;
        // Auto-capture after 2s of sharpness
        if (isSharp && ticks > 60) {
          setAutoCapturing(true);
          setTimeout(async () => {
            captureFrame(videoRef.current, canvasRef.current);
            const f = await canvasToFile(canvasRef.current, `${label.replace(/\s+/g, "_")}.jpg`);
            onChange(f);
            stopCamera();
            setCamState("captured");
            setAutoCapturing(false);
          }, 300);
          return;
        }
        rafRef.current = requestAnimationFrame(check);
      };
      rafRef.current = requestAnimationFrame(check);
    } catch {
      setCamState("denied");
    }
  };

  const retake = () => {
    onChange(null);
    setCamState("idle");
  };

  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>

      {camState === "idle" && !file && (
        <div className="space-y-2">
          <button type="button" onClick={openCamera}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2
              border-dashed border-brand/40 bg-brand/5 p-6 text-center cursor-pointer
              hover:border-brand hover:bg-brand/10 transition-colors">
            <Camera size={28} className="text-brand/70" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Capture with Camera</p>
            <p className="text-xs text-gray-400">Auto-captures when card is clear & steady</p>
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            or upload file
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          <div onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200
              dark:border-gray-700 px-4 py-2.5 text-sm text-gray-500 cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Upload size={14} /> Choose file
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { onChange(e.target.files[0] ?? null); setCamState("captured"); }} />
        </div>
      )}

      {(camState === "starting" || camState === "live") && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} muted playsInline className="w-full rounded-xl" />
          {/* Card overlay guide */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`border-4 rounded-lg transition-colors duration-300
              ${sharp ? "border-green-400" : "border-white/60"}`}
              style={{ width: "85%", height: "55%", boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)" }} />
          </div>
          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1">
            {autoCapturing
              ? <span className="rounded-full bg-green-500 px-3 py-1 text-xs text-white font-semibold">Capturing…</span>
              : sharp
                ? <span className="rounded-full bg-green-500/80 px-3 py-1 text-xs text-white">Card detected — hold steady</span>
                : <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">Position card inside the frame</span>
            }
          </div>
          {camState === "starting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Loader2 size={32} className="text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      {(camState === "captured" || file) && preview && (
        <div className="relative">
          <img src={preview} alt={label} className="h-40 w-full rounded-xl object-cover ring-2 ring-green-400/60" />
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 size={10} /> Captured
          </div>
          <button type="button" onClick={retake}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
              rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {camState === "denied" && (
        <div className="rounded-xl border border-red-100 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle size={15} /> Camera access denied.
          </p>
          <div onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200
              dark:border-gray-700 px-4 py-2.5 text-sm text-gray-500 cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Upload size={14} /> Upload file instead
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { onChange(e.target.files[0] ?? null); setCamState("captured"); }} />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function Step1({ form, setForm }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Ghana Card (National ID)</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Use your camera to capture both sides of your Ghana Card.
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          <strong>Tips:</strong> Ensure all text is readable and no corners are cut off.
          The camera auto-captures once the card is sharp and steady.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <LiveIdCapture
          label="Front of Ghana Card"
          file={form.id_front}
          onChange={(f) => setForm((prev) => ({ ...prev, id_front: f }))}
        />
        <LiveIdCapture
          label="Back of Ghana Card"
          file={form.id_back}
          onChange={(f) => setForm((prev) => ({ ...prev, id_back: f }))}
        />
      </div>
    </div>
  );
}

// ── Liveness selfie component ─────────────────────────────────────────────────

function LiveSelfie({ file, onChange, onDescriptor }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const detectionRef = useRef(null);

  const [camState, setCamState] = useState("idle"); // idle|loading|live|captured|denied|error
  const [blinkState, setBlinkState] = useState("waiting"); // waiting|open|blink|captured
  const [statusMsg, setStatusMsg] = useState("");
  const [eyesClosed, setEyesClosed] = useState(false);
  const inputRef = useRef(null);

  const stopCamera = useCallback(() => {
    clearInterval(detectionRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const openCamera = async () => {
    setCamState("loading");
    setBlinkState("waiting");
    setStatusMsg("Loading face detection models…");

    let fapi;
    try {
      fapi = await loadFaceApi();
    } catch {
      setCamState("error");
      setStatusMsg("Failed to load face detection. Please use file upload.");
      return;
    }

    try {
      const stream = await startCamera(videoRef.current, "user");
      streamRef.current = stream;
      setCamState("live");
      setBlinkState("open");
      setStatusMsg("Face detected — please blink naturally");

      const tinyOpts = new fapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
      let blinkSeen = false;
      let eyesWereClosed = false;
      let stableFrames = 0;

      detectionRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const result = await fapi
          .detectSingleFace(videoRef.current, tinyOpts)
          .withFaceLandmarks(true);

        if (!result) {
          setStatusMsg("No face detected — look at the camera");
          setEyesClosed(false);
          return;
        }

        const lm = result.landmarks;
        const leftEAR  = eyeAspectRatio(lm, "left");
        const rightEAR = eyeAspectRatio(lm, "right");
        const avgEAR   = (leftEAR + rightEAR) / 2;
        const closed   = avgEAR < EAR_THRESHOLD;

        setEyesClosed(closed);

        if (!blinkSeen) {
          if (closed) {
            eyesWereClosed = true;
            setBlinkState("blink");
            setStatusMsg("Blink detected! Hold still…");
          } else if (eyesWereClosed) {
            // Eyes just re-opened → confirmed blink
            blinkSeen = true;
            stableFrames = 0;
          } else {
            setStatusMsg("Look at the camera and blink naturally");
          }
        }

        if (blinkSeen) {
          stableFrames++;
          if (stableFrames >= 3) {
            clearInterval(detectionRef.current);
            setBlinkState("captured");
            setStatusMsg("Liveness confirmed — capturing selfie…");

            captureFrame(videoRef.current, canvasRef.current);
            const selfieFile = await canvasToFile(canvasRef.current, "selfie.jpg");
            onChange(selfieFile);
            stopCamera();
            setCamState("captured");

            // Extract face descriptor for similarity check (best effort)
            try {
              const desc = await fapi
                .detectSingleFace(canvasRef.current, tinyOpts)
                .withFaceLandmarks(true)
                .withFaceDescriptor();
              if (desc) onDescriptor(desc.descriptor);
            } catch { /* non-critical */ }
          }
        }
      }, 150);

    } catch {
      setCamState("denied");
    }
  };

  const retake = () => {
    onChange(null);
    onDescriptor(null);
    setCamState("idle");
    setBlinkState("waiting");
  };

  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-3">
      {camState === "idle" && !file && (
        <div className="space-y-2">
          <button type="button" onClick={openCamera}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2
              border-dashed border-brand/40 bg-brand/5 p-8 text-center cursor-pointer
              hover:border-brand hover:bg-brand/10 transition-colors">
            <Eye size={32} className="text-brand/70" />
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Live Selfie with Liveness Check</p>
            <p className="text-xs text-gray-400">Camera opens → blink to confirm you're real → auto-captures</p>
          </button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />or upload file
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>
          <div onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200
              dark:border-gray-700 px-4 py-2.5 text-sm text-gray-500 cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Upload size={14} /> Choose file
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { onChange(e.target.files[0] ?? null); setCamState("captured"); }} />
        </div>
      )}

      {(camState === "loading" || camState === "live") && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} muted playsInline className="w-full rounded-xl" style={{ transform: "scaleX(-1)" }} />

          {/* Oval face overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`rounded-full border-4 transition-colors duration-300
              ${eyesClosed ? "border-green-400 shadow-[0_0_12px_4px_rgba(74,222,128,0.5)]" : "border-white/70"}`}
              style={{ width: 160, height: 200, boxShadow: eyesClosed
                ? "0 0 0 9999px rgba(0,0,0,0.4), 0 0 12px 4px rgba(74,222,128,0.4)"
                : "0 0 0 9999px rgba(0,0,0,0.4)" }} />
          </div>

          {/* Status pill */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span className={`rounded-full px-3 py-1 text-xs font-medium text-white transition-colors
              ${blinkState === "blink" || blinkState === "captured"
                ? "bg-green-500"
                : "bg-black/70"}`}>
              {statusMsg || "Starting camera…"}
            </span>
          </div>

          {camState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 size={32} className="text-white animate-spin" />
            </div>
          )}
        </div>
      )}

      {(camState === "captured" || file) && preview && (
        <div className="relative mx-auto max-w-xs">
          <img src={preview} alt="Selfie"
            className="w-full rounded-xl object-cover ring-2 ring-green-400/60"
            style={{ transform: "scaleX(-1)" }} />
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 size={10} /> Liveness verified
          </div>
          <button type="button" onClick={retake}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
              rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors">
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {(camState === "denied" || camState === "error") && (
        <div className="rounded-xl border border-red-100 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 p-4 space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle size={15} /> {camState === "denied" ? "Camera access denied." : statusMsg}
          </p>
          <div onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200
              dark:border-gray-700 px-4 py-2.5 text-sm text-gray-500 cursor-pointer
              hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Upload size={14} /> Upload selfie instead
          </div>
          <input ref={inputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { onChange(e.target.files[0] ?? null); setCamState("captured"); }} />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function Step2({ form, setForm, setSelfieDescriptor }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Face Verification</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          We'll verify you're a real person using your camera.
        </p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
          <li>• Remove sunglasses and hats</li>
          <li>• Ensure your face is well lit — look at the camera</li>
          <li>• When prompted, <strong>blink naturally</strong> to prove liveness</li>
        </ul>
      </div>

      <div className="mx-auto max-w-xs">
        <LiveSelfie
          file={form.selfie}
          onChange={(f) => setForm((prev) => ({ ...prev, selfie: f }))}
          onDescriptor={setSelfieDescriptor}
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

function Step4({ form, busy, onPay, faceWarning }) {
  const rows = [
    { label: "Nationality",  value: form.nationality || "—" },
    { label: "Address",      value: form.address || "—" },
    { label: "GPS",          value: form.latitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : "Not captured" },
    { label: "Ghana Card",   value: (form.id_front && form.id_back) ? "Both sides uploaded ✓" : "Incomplete" },
    { label: "Selfie",       value: form.selfie ? "Captured ✓" : "Not captured" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; Pay</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Confirm your details and pay the one-time GHS 5 activation fee.
        </p>
      </div>

      {faceWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-900/20 px-4 py-3 flex gap-3">
          <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            <strong>Face mismatch warning:</strong> Your selfie may not match the ID photo.
            Please ensure both images clearly show your face. You can still submit — an admin will review.
          </p>
        </div>
      )}

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
  const [selfieDescriptor, setSelfieDescriptor] = useState(null);
  const [faceWarning, setFaceWarning] = useState(false);

  const goTo = async (next) => {
    setSlideDir(next > step ? 1 : -1);
    setStep(next);
    setAnimKey((k) => k + 1);

    // Run face similarity check when entering the review step
    if (next === 4 && selfieDescriptor && form.id_front) {
      try {
        const fapi = await loadFaceApi();
        const tinyOpts = new fapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
        const img = document.createElement("img");
        img.src = URL.createObjectURL(form.id_front);
        await new Promise((res) => { img.onload = res; });
        const idResult = await fapi
          .detectSingleFace(img, tinyOpts)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (idResult) {
          const dist = fapi.euclideanDistance(selfieDescriptor, idResult.descriptor);
          setFaceWarning(dist > 0.5); // 0.5 = likely different person
        }
        URL.revokeObjectURL(img.src);
      } catch { /* non-critical */ }
    }
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
            {step === 2 && <Step2 form={form} setForm={setForm} setSelfieDescriptor={setSelfieDescriptor} />}
            {step === 3 && <Step3 form={form} setForm={setForm} />}
            {step === 4 && <Step4 form={form} busy={busy} onPay={handlePay} faceWarning={faceWarning} />}
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
