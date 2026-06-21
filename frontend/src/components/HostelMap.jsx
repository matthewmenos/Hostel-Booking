/**
 * HostelMap  — single-hostel detail map (one marker, popup with name + directions link)
 * SearchMap  — multi-hostel search results map (one marker per hostel, click to open detail)
 * LocationPicker — interactive map for manager to drag-drop a pin to set lat/lng
 *
 * All three are thin wrappers around react-leaflet. Leaflet's CSS is imported once here.
 */
import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's broken default icon paths when bundled with Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:       markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl:     markerShadow,
});

// Custom brand-coloured marker for the active/selected hostel
const brandIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:28px; height:28px; border-radius:50% 50% 50% 0;
    background:var(--color-brand,#6366f1); border:3px solid #fff;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);
    transform:rotate(-45deg);
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -30],
});

// Smaller dot icon for search results
const dotIcon = new L.DivIcon({
  className: "",
  html: `<div style="
    width:20px; height:20px; border-radius:50% 50% 50% 0;
    background:var(--color-brand,#6366f1); border:2px solid #fff;
    box-shadow:0 1px 4px rgba(0,0,0,0.3);
    transform:rotate(-45deg);
  "></div>`,
  iconSize:   [20, 20],
  iconAnchor: [10, 20],
  popupAnchor:[0, -22],
});

// Recenter helper — flies to a new position when `center` prop changes
function Recenter({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}

// FitBounds helper — zooms map to show all markers on mount
function FitBounds({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView([coords[0].lat, coords[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(coords.map((c) => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
  }, []); // only on mount
  return null;
}

// Draggable pin for LocationPicker
function DraggableMarker({ position, onChange }) {
  const markerRef = useRef(null);

  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });

  return position ? (
    <Marker
      position={position}
      draggable
      icon={brandIcon}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const m = markerRef.current;
          if (m) {
            const { lat, lng } = m.getLatLng();
            onChange({ lat, lng });
          }
        },
      }}
    >
      <Popup>Drag me or click the map to move</Popup>
    </Marker>
  ) : null;
}

// ── HostelMap ─────────────────────────────────────────────────────────────────

/**
 * Shows a single hostel on a map with a popup.
 * Props:
 *   hostel  — hostel object (needs lat/lng resolved via resolveCoords upstream)
 *   lat, lng — resolved coordinates
 *   height  — CSS height string (default "280px")
 */
export function HostelMap({ hostel, lat, lng, height = "280px" }) {
  const center = [lat, lng];
  const directionsUrl = `https://www.openstreetmap.org/directions?from=&to=${lat},${lng}`;

  return (
    <div className="rounded-xl overflow-hidden" style={{ height }}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={center} icon={brandIcon}>
          <Popup>
            <div className="text-sm space-y-1" style={{ minWidth: 140 }}>
              <p className="font-semibold">{hostel.name}</p>
              <p className="text-gray-500 text-xs">{hostel.location}</p>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-xs text-indigo-600 hover:underline"
              >
                Get directions ↗
              </a>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

// ── SearchMap ─────────────────────────────────────────────────────────────────

/**
 * Displays all search result hostels as pins on a map.
 * Props:
 *   hostels      — array of hostel objects with resolved lat/lng (pass resolveCoords result)
 *   hostelCoords — array of { hostel, lat, lng } objects
 *   activeSlug   — slug of the hovered/selected card (highlights that pin)
 *   height       — CSS height string
 */
export function SearchMap({ hostelCoords, activeSlug, height = "480px" }) {
  const navigate = useNavigate();
  const [flyTo, setFlyTo] = useState(null);

  // Fly to the hovered card's pin
  useEffect(() => {
    if (!activeSlug) return;
    const match = hostelCoords.find((h) => h.hostel.slug === activeSlug);
    if (match) setFlyTo([match.lat, match.lng]);
  }, [activeSlug, hostelCoords]);

  if (hostelCoords.length === 0) return null;

  // Placeholder center (overridden by FitBounds on mount)
  const first = hostelCoords[0];

  return (
    <div className="rounded-xl overflow-hidden shadow-sm" style={{ height }}>
      <MapContainer
        center={[first.lat, first.lng]}
        zoom={7}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds coords={hostelCoords} />
        {flyTo && <Recenter center={flyTo} zoom={15} />}
        {hostelCoords.map(({ hostel: h, lat, lng }) => {
          const isActive = h.slug === activeSlug;
          const free = (h.total_capacity || 0) - (h.active_bookings_count || 0);
          return (
            <Marker
              key={h.slug}
              position={[lat, lng]}
              icon={isActive ? brandIcon : dotIcon}
              zIndexOffset={isActive ? 1000 : 0}
            >
              <Popup>
                <div className="text-sm space-y-1" style={{ minWidth: 160 }}>
                  <p className="font-semibold leading-tight">{h.name}</p>
                  <p className="text-gray-500 text-xs">{h.campus_display}</p>
                  <p className="font-bold text-brand">GHS {h.base_price}<span className="font-normal text-gray-400 text-xs">/bed</span></p>
                  <p className={`text-xs font-medium ${free > 0 ? "text-green-600" : "text-red-500"}`}>
                    {free > 0 ? `${free} bed${free !== 1 ? "s" : ""} free` : "Full"}
                  </p>
                  <button
                    onClick={() => navigate(`/hostels/${h.slug}`)}
                    className="mt-1 w-full rounded bg-brand px-2 py-1 text-xs text-white hover:opacity-90 transition"
                  >
                    View hostel
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

// ── LocationPicker ────────────────────────────────────────────────────────────

/**
 * Interactive map for manager to pin their hostel location.
 * Props:
 *   lat, lng   — current values (null = no pin yet)
 *   onChange   — called with { lat, lng } when pin moves
 *   defaultCenter — [lat, lng] to centre the map initially (use campus coords)
 */
export function LocationPicker({ lat, lng, onChange, defaultCenter = [7.9465, -1.0232] }) {
  const position = lat != null && lng != null ? { lat, lng } : null;
  const center   = position ? [lat, lng] : defaultCenter;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700" style={{ height: 300 }}>
      <MapContainer
        center={center}
        zoom={position ? 15 : 13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <DraggableMarker position={position ? [lat, lng] : null} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
