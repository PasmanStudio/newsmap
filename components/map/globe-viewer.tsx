"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";

/* ── Country coordinates ─────────────────────────────────────────────────── */

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  // LATAM
  AR: { lat: -34.6, lng: -58.4 },
  BR: { lat: -15.8, lng: -47.9 },
  CL: { lat: -33.5, lng: -70.7 },
  CO: { lat:   4.7, lng: -74.1 },
  PE: { lat: -12.0, lng: -77.0 },
  MX: { lat:  19.4, lng: -99.1 },
  VE: { lat:  10.5, lng: -66.9 },
  EC: { lat:  -0.2, lng: -78.5 },
  PY: { lat: -25.3, lng: -57.6 },
  BO: { lat: -16.5, lng: -68.1 },
  GT: { lat:  14.6, lng: -90.5 },
  CR: { lat:   9.9, lng: -84.1 },
  PA: { lat:   8.9, lng: -79.5 },
  DO: { lat:  18.5, lng: -69.9 },
  SV: { lat:  13.7, lng: -89.2 },
  // North America
  US: { lat:  38.9, lng: -77.0 },
  // Europe
  GB: { lat:  51.5, lng:  -0.1 },
  ES: { lat:  40.4, lng:  -3.7 },
  FR: { lat:  48.9, lng:   2.3 },
  DE: { lat:  52.5, lng:  13.4 },
  IT: { lat:  41.9, lng:  12.5 },
  PT: { lat:  38.7, lng:  -9.1 },
  NL: { lat:  52.4, lng:   4.9 },
  SE: { lat:  59.3, lng:  18.1 },
  // Middle East
  QA: { lat:  25.3, lng:  51.5 },
};

type MarkerDatum = { lat: number; lng: number; alpha2: string };

const MARKERS: MarkerDatum[] = Object.entries(COUNTRY_COORDS).map(
  ([alpha2, { lat, lng }]) => ({ lat, lng, alpha2 })
);

/* ── Props ───────────────────────────────────────────────────────────────── */

type Props = {
  selectedCountry: string | null;
  onSelectCountry: (alpha2: string) => void;
  locale?: string;
};

/* ── Component ───────────────────────────────────────────────────────────── */

export function GlobeViewer({ selectedCountry, onSelectCountry, locale = "es" }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const displayNames = new Intl.DisplayNames([locale], { type: "region" });

  // Responsive canvas size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Init: auto-rotate + initial altitude
  useEffect(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate = true;
    ctrl.autoRotateSpeed = 0.4;
    ctrl.enableDamping = true;
    globeRef.current.pointOfView({ altitude: 2.2 }, 0);
  }, []);

  // Fly to selected country and pause rotation
  useEffect(() => {
    if (!selectedCountry || !globeRef.current) return;
    const coords = COUNTRY_COORDS[selectedCountry];
    if (!coords) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView(
      { lat: coords.lat, lng: coords.lng, altitude: 1.6 },
      900
    );
  }, [selectedCountry]);

  // Zoom helpers
  const adjustAltitude = useCallback((factor: number) => {
    if (!globeRef.current) return;
    const pov = globeRef.current.pointOfView();
    const next = Math.min(Math.max((pov.altitude ?? 2.2) * factor, 0.3), 5.0);
    globeRef.current.pointOfView({ altitude: next }, 300);
  }, []);

  const handleZoomIn  = useCallback(() => adjustAltitude(0.65), [adjustAltitude]);
  const handleZoomOut = useCallback(() => adjustAltitude(1.55), [adjustAltitude]);
  const handleReset   = useCallback(() => {
    if (!globeRef.current) return;
    globeRef.current.controls().autoRotate = true;
    globeRef.current.pointOfView({ lat: 20, lng: 0, altitude: 2.2 }, 800);
  }, []);

  const handlePointClick = useCallback(
    (d: object) => onSelectCountry((d as MarkerDatum).alpha2),
    [onSelectCountry]
  );

  const handlePointHover = useCallback((d: object | null) => {
    if (containerRef.current)
      containerRef.current.style.cursor = d ? "pointer" : "default";
  }, []);

  // Per-marker colour helpers — memoised to avoid per-frame re-creation
  const ringColor = useCallback(
    (d: object) =>
      (d as MarkerDatum).alpha2 === selectedCountry
        ? "rgba(255,255,255,0.9)"
        : "rgba(96,165,250,0.65)",
    [selectedCountry]
  );

  const pointColor = useCallback(
    (d: object) =>
      (d as MarkerDatum).alpha2 === selectedCountry ? "#ffffff" : "#93c5fd",
    [selectedCountry]
  );

  // Strip diacritics: globe.gl canvas font doesn't support accented chars
  // (e.g. "Perú" → "Peru"). Full name still appears in the modal.
  const labelText = useCallback(
    (d: object) => {
      const alpha2 = (d as MarkerDatum).alpha2;
      const name   = displayNames.of(alpha2) ?? alpha2;
      return name.normalize("NFD").replace(/\p{Diacritic}/gu, "");
    },
    [displayNames]
  );

  const labelColor = useCallback(
    (d: object) =>
      (d as MarkerDatum).alpha2 === selectedCountry
        ? "rgba(255,255,255,1)"
        : "rgba(255,255,255,0.55)",
    [selectedCountry]
  );

  const labelSize = useCallback(
    (d: object) =>
      (d as MarkerDatum).alpha2 === selectedCountry ? 1.4 : 1.0,
    [selectedCountry]
  );

  const btnCls =
    "w-7 h-7 flex items-center justify-center rounded bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 hover:text-white text-sm font-bold transition-colors shadow-sm backdrop-blur-sm";

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#60a5fa"
        atmosphereAltitude={0.14}
        /* Animated pulsing rings */
        ringsData={MARKERS}
        ringColor={ringColor}
        ringMaxRadius={4}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={2000}
        ringAltitude={0.005}
        /* Centre dot — clickable target */
        pointsData={MARKERS}
        pointAltitude={0.015}
        pointRadius={1.4}
        pointColor={pointColor}
        onPointClick={handlePointClick}
        onPointHover={handlePointHover}
        /* Persistent country name labels */
        labelsData={MARKERS}
        labelLat={(d: object) => (d as MarkerDatum).lat}
        labelLng={(d: object) => (d as MarkerDatum).lng}
        labelText={labelText}
        labelSize={labelSize}
        labelColor={labelColor}
        labelDotRadius={0}
        labelResolution={2}
        labelAltitude={0.03}
      />

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <button onClick={handleZoomIn}  className={btnCls} aria-label="Acercar">+</button>
        <button onClick={handleZoomOut} className={btnCls} aria-label="Alejar">−</button>
        <button onClick={handleReset}   className={`${btnCls} text-[11px]`} aria-label="Reset">⌂</button>
      </div>
    </div>
  );
}
