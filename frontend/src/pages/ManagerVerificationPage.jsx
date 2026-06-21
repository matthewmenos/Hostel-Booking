import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Check, MapPin,
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
  return sum2 / n - mean * mean;
}

function captureFrame(videoEl, canvas) {
  canvas.width  = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext("2d").drawImage(videoEl, 0, 0);
}

function canvasToFile(canvas, name) {
  return new Promise((res) =>
    canvas.toBlob((b) => res(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.92)
  );
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

// ── Landmark geometry helpers ─────────────────────────────────────────────────

function eyeAspectRatio(landmarks, eye) {
  const pts = eye === "left" ? [36,37,38,39,40,41] : [42,43,44,45,46,47];
  const p = pts.map((i) => landmarks.positions[i]);
  const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y);
  const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y);
  const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y);
  return (A + B) / (2 * C);
}

const EAR_THRESHOLD = 0.22;

/**
 * Yaw estimation from face landmarks.
 * Compares horizontal distance from nose tip to left vs right eye outer corners.
 * Returns a value roughly in [-1, 1]: negative = face turned left, positive = right.
 */
function yawScore(landmarks) {
  const pos = landmarks.positions;
  const noseTip   = pos[30];
  const leftEye   = pos[36];  // left eye outer corner
  const rightEye  = pos[45];  // right eye outer corner
  const distLeft  = noseTip.x - leftEye.x;
  const distRight = rightEye.x - noseTip.x;
  const total     = distLeft + distRight;
  if (total < 1) return 0;
  return (distRight - distLeft) / total; // >0 = turned right in real world (mirrored: looks left on screen)
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ["Nationality", "ID Verification", "Face / Selfie", "Location", "Review & Pay"];

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

// ── Step 0: Nationality ───────────────────────────────────────────────────────

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

// ── Live ID Capture (camera-only) ─────────────────────────────────────────────

// COUNTDOWN_SECS: time the user has to position the card before we grab the
// sharpest frame seen so far.  3 s is long enough to steady the hand.
const ID_COUNTDOWN_SECS = 3;

function LiveIdCapture({ label, file, onChange }) {
  const videoRef      = useRef(null);
  const canvasRef     = useRef(null);
  const bestCanvasRef = useRef(null); // holds the sharpest frame seen
  const streamRef     = useRef(null);
  const rafRef        = useRef(null);

  const [camState, setCamState]     = useState("idle"); // idle|starting|live|capturing|captured|denied
  const [countdown, setCountdown]   = useState(ID_COUNTDOWN_SECS);
  const [bestScore, setBestScore]   = useState(0);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const openCamera = async () => {
    setCamState("starting");
    setCountdown(ID_COUNTDOWN_SECS);
    setBestScore(0);

    // Ensure best-frame canvas exists
    if (!bestCanvasRef.current) {
      bestCanvasRef.current = document.createElement("canvas");
    }

    try {
      const stream = await startCamera(videoRef.current, "environment");
      streamRef.current = stream;
      setCamState("live");

      let currentBestScore = 0;
      let secondsLeft      = ID_COUNTDOWN_SECS;
      let lastTick         = performance.now();

      const check = (now) => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(check);
          return;
        }

        // Capture current frame into the working canvas
        captureFrame(videoRef.current, canvasRef.current);
        const score = blurScore(canvasRef.current);

        // Keep a copy of the sharpest frame
        if (score > currentBestScore) {
          currentBestScore = score;
          setBestScore(score);
          const bc = bestCanvasRef.current;
          bc.width  = canvasRef.current.width;
          bc.height = canvasRef.current.height;
          bc.getContext("2d").drawImage(canvasRef.current, 0, 0);
        }

        // Count down in whole seconds
        const elapsed = (now - lastTick) / 1000;
        if (elapsed >= 1) {
          lastTick = now;
          secondsLeft = Math.max(0, secondsLeft - 1);
          setCountdown(secondsLeft);

          if (secondsLeft === 0) {
            // Grab the best frame we collected
            setCamState("capturing");
            canvasToFile(bestCanvasRef.current, `${label.replace(/\s+/g, "_")}.jpg`).then((f) => {
              onChange(f);
              stopCamera();
              setCamState("captured");
            });
            return;
          }
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
    setCountdown(ID_COUNTDOWN_SECS);
    setBestScore(0);
  };

  const preview = file ? URL.createObjectURL(file) : null;
  // Rough quality indicator based on blur score (0-100 display scale)
  const qualityPct = Math.min(100, Math.round(bestScore / 0.5));

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>

      {camState === "idle" && !file && (
        <button
          type="button"
          onClick={openCamera}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2
            border-dashed border-brand/40 bg-brand/5 p-6 text-center cursor-pointer
            hover:border-brand hover:bg-brand/10 transition-colors"
        >
          <Camera size={28} className="text-brand/70" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Open Camera</p>
          <p className="text-xs text-gray-400">Hold card steady — auto-captures in {ID_COUNTDOWN_SECS}s</p>
        </button>
      )}

      {(camState === "starting" || camState === "live" || camState === "capturing") && (
        <div className="relative rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} muted playsInline className="w-full rounded-xl" />

          {/* Card guide overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="border-4 rounded-lg transition-colors duration-500"
              style={{
                width:     "85%",
                height:    "55%",
                borderColor: countdown <= 1 ? "#4ade80" : "rgba(255,255,255,0.7)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
              }}
            />
          </div>

          {/* Countdown ring */}
          {camState === "live" && (
            <div className="absolute top-2 right-2">
              <svg width="44" height="44" className="-rotate-90">
                <circle cx="22" cy="22" r="18" fill="rgba(0,0,0,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
                <circle
                  cx="22" cy="22" r="18"
                  fill="none"
                  stroke={countdown <= 1 ? "#4ade80" : "#a5b4fc"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 18}`}
                  strokeDashoffset={`${2 * Math.PI * 18 * (countdown / ID_COUNTDOWN_SECS)}`}
                  style={{ transition: "stroke-dashoffset 0.9s linear, stroke 0.3s" }}
                />
                <text
                  x="22" y="22"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="13"
                  fontWeight="bold"
                  style={{ transform: "rotate(90deg)", transformOrigin: "22px 22px" }}
                >
                  {countdown}
                </text>
              </svg>
            </div>
          )}

          {/* Status label */}
          <div className="absolute bottom-3 left-0 right-0 flex flex-col items-center gap-1">
            {camState === "capturing"
              ? <span className="rounded-full bg-green-500 px-3 py-1 text-xs text-white font-semibold animate-pulse">Saving best frame…</span>
              : camState === "live"
                ? <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                    Fit the card in the frame — capturing in {countdown}s
                  </span>
                : null
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
          <button
            type="button"
            onClick={retake}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
              rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {camState === "denied" && (
        <div className="rounded-xl border border-red-100 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 p-4 space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle size={15} /> Camera access denied.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Allow camera access in your browser settings, then retry.
          </p>
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600
              px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={14} /> Retry Camera
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Step 1: ID Capture ────────────────────────────────────────────────────────

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
          The camera auto-captures once the card is sharp and steady for ~1.5 seconds.
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

// ── Liveness selfie (camera-only, automatic multi-challenge) ──────────────────

/*
 Challenge sequence (all automatic, no user taps):
   1. DETECT  — wait for a face to appear in the oval
   2. TURN_LEFT  — yaw score drops below -0.12 (face turns to their left)
   3. TURN_RIGHT — yaw score rises above  +0.12 (face turns to their right)
   4. BLINK   — EAR drops below threshold then recovers
   5. CAPTURE — grab frame + descriptor, done
*/

const CHALLENGES = [
  { id: "detect",     label: "Look at the camera",          icon: "👀" },
  { id: "turn_left",  label: "Slowly turn your head LEFT",  icon: "←" },
  { id: "turn_right", label: "Slowly turn your head RIGHT", icon: "→" },
  { id: "blink",      label: "Now blink naturally",         icon: "😑" },
];

function LiveSelfie({ file, onChange, onDescriptor }) {
  const videoRef     = useRef(null);
  const canvasRef    = useRef(null);
  const streamRef    = useRef(null);
  const intervalRef  = useRef(null);

  const [camState, setCamState]   = useState("idle");    // idle|loading|live|captured|denied|error
  const [challenge, setChallenge] = useState(0);         // index into CHALLENGES
  const [statusMsg, setStatusMsg] = useState("");
  const [faceBox, setFaceBox]     = useState(null);      // {x,y,w,h} normalised 0-1
  const [blinkFlash, setBlinkFlash] = useState(false);

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current);
    stopStream(streamRef.current);
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const openCamera = async () => {
    setCamState("loading");
    setChallenge(0);
    setFaceBox(null);
    setStatusMsg("Loading face detection…");

    let fapi;
    try {
      fapi = await loadFaceApi();
    } catch {
      setCamState("error");
      setStatusMsg("Face detection failed to load. Check your internet connection.");
      return;
    }

    let stream;
    try {
      stream = await startCamera(videoRef.current, "user");
    } catch {
      setCamState("denied");
      return;
    }

    streamRef.current = stream;
    setCamState("live");
    setStatusMsg(CHALLENGES[0].label);

    const tinyOpts = new fapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 });

    // Per-challenge state (kept in closure, reset on challenge advance)
    let challengeIdx  = 0;
    let detectFrames  = 0;   // consecutive frames with face for DETECT phase
    let turnLeftDone  = false;
    let turnRightDone = false;
    let eyesWereClosed = false;

    const DETECT_NEEDED = 8;   // must see face for N consecutive frames before advancing

    const tick = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const result = await fapi
        .detectSingleFace(videoRef.current, tinyOpts)
        .withFaceLandmarks(true);

      if (!result) {
        detectFrames = 0;
        setFaceBox(null);
        setStatusMsg("No face detected — position your face in the oval");
        return;
      }

      // Update face box for the animated overlay
      const vw = videoRef.current.videoWidth  || 1;
      const vh = videoRef.current.videoHeight || 1;
      const b  = result.detection.box;
      setFaceBox({ x: b.x / vw, y: b.y / vh, w: b.width / vw, h: b.height / vh });

      const lm       = result.landmarks;
      const leftEAR  = eyeAspectRatio(lm, "left");
      const rightEAR = eyeAspectRatio(lm, "right");
      const avgEAR   = (leftEAR + rightEAR) / 2;
      const closed   = avgEAR < EAR_THRESHOLD;
      const yaw      = yawScore(lm);

      // ── Challenge state machine ───────────────────────────────────────────

      if (challengeIdx === 0) {
        // DETECT: need N stable frames
        detectFrames++;
        if (detectFrames >= DETECT_NEEDED) {
          challengeIdx = 1;
          setChallenge(1);
          setStatusMsg(CHALLENGES[1].label);
        } else {
          setStatusMsg("Hold still…");
        }

      } else if (challengeIdx === 1) {
        // TURN_LEFT: wait for yaw < -0.12
        setStatusMsg(CHALLENGES[1].label);
        if (yaw < -0.12) {
          turnLeftDone = true;
          challengeIdx = 2;
          setChallenge(2);
          setStatusMsg(CHALLENGES[2].label);
        }

      } else if (challengeIdx === 2) {
        // TURN_RIGHT: wait for yaw > +0.12
        setStatusMsg(CHALLENGES[2].label);
        if (yaw > 0.12) {
          turnRightDone = true;
          challengeIdx = 3;
          setChallenge(3);
          setStatusMsg(CHALLENGES[3].label);
        }

      } else if (challengeIdx === 3) {
        // BLINK: detect close then reopen
        setStatusMsg(closed ? "Blink detected — keep going…" : CHALLENGES[3].label);
        if (closed) {
          eyesWereClosed = true;
          setBlinkFlash(true);
        } else if (eyesWereClosed) {
          // Eyes just reopened → blink confirmed
          clearInterval(intervalRef.current);
          setStatusMsg("All done — capturing selfie…");
          setChallenge(4); // past last challenge = done

          // Capture frame
          captureFrame(videoRef.current, canvasRef.current);
          const selfieFile = await canvasToFile(canvasRef.current, "selfie.jpg");
          onChange(selfieFile);
          stopCamera();
          setCamState("captured");
          setBlinkFlash(false);

          // Extract descriptor for face-match check (non-critical)
          try {
            const desc = await fapi
              .detectSingleFace(canvasRef.current, tinyOpts)
              .withFaceLandmarks(true)
              .withFaceDescriptor();
            if (desc) onDescriptor(desc.descriptor);
          } catch { /* non-critical */ }
        }
      }
    };

    intervalRef.current = setInterval(tick, 150);
  };

  const retake = () => {
    onChange(null);
    onDescriptor(null);
    setCamState("idle");
    setChallenge(0);
    setFaceBox(null);
    setBlinkFlash(false);
  };

  const preview = file ? URL.createObjectURL(file) : null;

  return (
    <div className="space-y-3">

      {/* ── Idle ── */}
      {camState === "idle" && !file && (
        <button
          type="button"
          onClick={openCamera}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2
            border-dashed border-brand/40 bg-brand/5 p-8 text-center cursor-pointer
            hover:border-brand hover:bg-brand/10 transition-colors"
        >
          <Eye size={32} className="text-brand/70" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Start Liveness Check</p>
          <p className="text-xs text-gray-400">Camera guides you through automatic motions — no tapping needed</p>
        </button>
      )}

      {/* ── Loading / Live ── */}
      {(camState === "loading" || camState === "live") && (
        <div className="space-y-3">
          {/* Challenge progress pills */}
          {camState === "live" && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {CHALLENGES.map((ch, i) => (
                <span
                  key={ch.id}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-300
                    ${i < challenge
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : i === challenge
                        ? "bg-brand text-white shadow-md scale-105"
                        : "bg-gray-100 text-gray-400 dark:bg-gray-700"
                    }`}
                >
                  {i < challenge ? <CheckCircle2 size={11} /> : <span>{ch.icon}</span>}
                  {ch.label.split(" ").slice(0, 3).join(" ")}
                </span>
              ))}
            </div>
          )}

          {/* Camera viewport */}
          <div className={`relative rounded-xl overflow-hidden bg-black transition-all duration-300
            ${blinkFlash ? "ring-4 ring-green-400" : ""}`}>
            <video
              ref={videoRef}
              muted
              playsInline
              className="w-full rounded-xl"
              style={{ transform: "scaleX(-1)" }}
            />

            {/* Oval face guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`rounded-full border-4 transition-all duration-300
                  ${faceBox
                    ? challenge < 4
                      ? "border-green-400 shadow-[0_0_16px_4px_rgba(74,222,128,0.4)]"
                      : "border-brand"
                    : "border-white/50"
                  }`}
                style={{
                  width:      160,
                  height:     200,
                  boxShadow: `${faceBox
                    ? "0 0 0 9999px rgba(0,0,0,0.35), 0 0 16px 4px rgba(74,222,128,0.3)"
                    : "0 0 0 9999px rgba(0,0,0,0.5)"}`,
                }}
              />
            </div>

            {/* Challenge arrow hint for turn steps */}
            {camState === "live" && challenge === 1 && (
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-4xl text-white/80 animate-bounce select-none">←</div>
            )}
            {camState === "live" && challenge === 2 && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-4xl text-white/80 animate-bounce select-none">→</div>
            )}

            {/* Status pill */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center">
              <span className={`rounded-full px-3 py-1 text-xs font-medium text-white transition-colors duration-300
                ${challenge >= 4 || blinkFlash ? "bg-green-500" : faceBox ? "bg-brand/80" : "bg-black/70"}`}>
                {statusMsg || "Starting…"}
              </span>
            </div>

            {/* Loading overlay */}
            {camState === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
                <Loader2 size={32} className="text-white animate-spin" />
                <p className="text-xs text-white/70">Loading models…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Captured ── */}
      {(camState === "captured" || file) && preview && (
        <div className="relative mx-auto max-w-xs">
          <img
            src={preview}
            alt="Selfie"
            className="w-full rounded-xl object-cover ring-2 ring-green-400/60"
            style={{ transform: "scaleX(-1)" }}
          />
          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            <CheckCircle2 size={10} /> Liveness verified
          </div>
          <button
            type="button"
            onClick={retake}
            className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center
              rounded-full bg-black/60 text-white hover:bg-red-600 transition-colors"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      )}

      {/* ── Denied / Error ── */}
      {(camState === "denied" || camState === "error") && (
        <div className="rounded-xl border border-red-100 bg-red-50 dark:border-red-900/40 dark:bg-red-900/20 p-4 space-y-3">
          <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
            <AlertCircle size={15} />
            {camState === "denied" ? "Camera access denied." : statusMsg}
          </p>
          {camState === "denied" && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Allow camera access in your browser settings, then retry.
            </p>
          )}
          <button
            type="button"
            onClick={openCamera}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600
              px-3 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

// ── Step 2: Face / Selfie ─────────────────────────────────────────────────────

function Step2({ form, setForm, setSelfieDescriptor }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Face Verification</h2>
        <p className="mt-0.5 text-sm text-gray-500">
          We'll confirm you're a real person using a short motion sequence.
        </p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-300">
          <li>• Remove sunglasses, hats, or anything covering your face</li>
          <li>• Ensure your face is well lit and centred in the oval</li>
          <li>• Follow the on-screen prompts — turn left, turn right, then blink</li>
          <li>• Everything happens automatically — no tapping needed</li>
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

// ── Step 3: Location ──────────────────────────────────────────────────────────

function Step3({ form, setForm }) {
  const [geoStatus, setGeoStatus] = useState(
    form.latitude ? "acquired" : "idle"
  );

  const shareLocation = () => {
    if (!navigator.geolocation) { setGeoStatus("denied"); return; }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
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

// ── Step 4: Review & Pay ──────────────────────────────────────────────────────

function Step4({ form, busy, onPay, faceWarning }) {
  const rows = [
    { label: "Nationality", value: form.nationality || "—" },
    { label: "Address",     value: form.address || "—" },
    { label: "GPS",         value: form.latitude ? `${form.latitude.toFixed(5)}, ${form.longitude.toFixed(5)}` : "Not captured" },
    { label: "Ghana Card",  value: (form.id_front && form.id_back) ? "Both sides captured ✓" : "Incomplete" },
    { label: "Selfie",      value: form.selfie ? "Liveness verified ✓" : "Not captured" },
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
            Ensure both images clearly show your face. You can still submit — an admin will review.
          </p>
        </div>
      )}

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
  nationality_type: "",
  nationality: "",
  id_front:  null,
  id_back:   null,
  selfie:    null,
  latitude:  null,
  longitude: null,
  address:   "",
};

export default function ManagerVerificationPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [step, setStep]         = useState(0);
  const [animKey, setAnimKey]   = useState(0);
  const [slideDir, setSlideDir] = useState(1);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [busy, setBusy]         = useState(false);
  const [paid, setPaid]         = useState(false);
  const [selfieDescriptor, setSelfieDescriptor] = useState(null);
  const [faceWarning, setFaceWarning]           = useState(false);

  const goTo = async (next) => {
    setSlideDir(next > step ? 1 : -1);
    setStep(next);
    setAnimKey((k) => k + 1);

    if (next === 4 && selfieDescriptor && form.id_front) {
      try {
        const fapi     = await loadFaceApi();
        const tinyOpts = new fapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
        const img      = document.createElement("img");
        img.src        = URL.createObjectURL(form.id_front);
        await new Promise((res) => { img.onload = res; });
        const idResult = await fapi
          .detectSingleFace(img, tinyOpts)
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (idResult) {
          const dist = fapi.euclideanDistance(selfieDescriptor, idResult.descriptor);
          setFaceWarning(dist > 0.5);
        }
        URL.revokeObjectURL(img.src);
      } catch { /* non-critical */ }
    }
  };

  const validate = () => {
    if (step === 0 && !form.nationality) {
      addToast("error", "Please select your nationality."); return false;
    }
    if (step === 1 && (!form.id_front || !form.id_back)) {
      addToast("error", "Capture both sides of your Ghana Card."); return false;
    }
    if (step === 2 && !form.selfie) {
      addToast("error", "Complete the liveness check to continue."); return false;
    }
    if (step === 3 && !form.address.trim()) {
      addToast("error", "Business address is required."); return false;
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
      fd.append("id_front",   form.id_front);
      fd.append("id_back",    form.id_back);
      fd.append("selfie",     form.selfie);
      fd.append("address",    form.address);
      if (form.latitude  != null) fd.append("latitude",  form.latitude);
      if (form.longitude != null) fd.append("longitude", form.longitude);

      const { data } = await managerApi.submitVerification(fd);

      if (data.stub) {
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
      const d   = err.response?.data;
      const msg = d?.detail || (typeof d === "object" ? Object.values(d).flat()[0] : null);
      addToast("error", msg ?? "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const slideStyle = {
    animation: `slideIn${slideDir > 0 ? "Right" : "Left"} 0.28s cubic-bezier(0.4,0,0.2,1) forwards`,
  };

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
          <div key={animKey} style={slideStyle}>
            {step === 0 && <Step0 form={form} setForm={setForm} />}
            {step === 1 && <Step1 form={form} setForm={setForm} />}
            {step === 2 && <Step2 form={form} setForm={setForm} setSelfieDescriptor={setSelfieDescriptor} />}
            {step === 3 && <Step3 form={form} setForm={setForm} />}
            {step === 4 && <Step4 form={form} busy={busy} onPay={handlePay} faceWarning={faceWarning} />}
          </div>

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

            <div className="flex gap-2">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width:      i === step ? "20px" : "6px",
                    height:     "6px",
                    background: i === step ? "var(--color-brand, #6366f1)" : i < step ? "#a5b4fc" : "#e5e7eb",
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
              <div className="w-24" />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
