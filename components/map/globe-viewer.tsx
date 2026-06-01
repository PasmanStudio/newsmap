"use client";

import { useRef, useEffect, useCallback, useState } from "react";
// react-globe.gl is a WebGL lib — SSR-disabled via dynamic() in world-map.tsx
import Globe, { type GlobeMethods } from "react-globe.gl";

/* ── Country coordinates ─────────────────────────────────────────────────── */

const COUNTRY_COORDS: Record<string, { lat: number; lng: number }> = {
  // LATAM
  AR: { lat: -34.6, lng: -58.4 },  // Buenos Aires
  BR: { lat: -15.8, lng: -47.9 },  // Brasília
  CL: { lat: -33.5, lng: -70.7 },  // Santiago
  CO: { lat:   4.7, lng: -74.1 },  // Bogotá
  PE: { lat: -12.0, lng: -77.0 },  // Lima
  MX: { lat:  19.4, lng: -99.1 },  // Ciudad de México
  VE: { lat:  10.5, lng: -66.9 },  // Caracas
  EC: { lat:  -0.2, lng: -78.5 },  // Quito
  PY: { lat: -25.3, lng: -57.6 },  // Asunción
  BO: { lat: -16.5, lng: -68.1 },  // La Paz
  GT: { lat:  14.6, lng: -90.5 },  // Guatemala City
  CR: { lat:   9.9, lng: -84.1 },  // San José
  PA: { lat:   8.9, lng: -79.5 },  // Ciudad de Panamá
  DO: { lat:  18.5, lng: -69.9 },  // Santo Domingo
  SV: { lat:  13.7, lng: -89.2 },  // San Salvador
  // North America
  US: { lat:  38.9, lng: -77.0 },  // Washington D.C.
  // Europe
  GB: { lat:  51.5, lng:  -0.1 },  // Londres
  ES: { lat:  40.4, lng:  -3.7 },  // Madrid
  FR: { lat:  48.9, lng:   2.3 },  // París
  DE: { lat:  52.5, lng:  13.4 },  // Berlín
  IT: { lat:  41.9, lng:  12.5 },  // Roma
  PT: { lat:  38.7, lng:  -9.1 },  // Lisboa
  NL: { lat:  52.4, lng:   4.9 },  // Ámsterdam
  SE: { lat:  59.3, lng:  18.1 },  // Estocolmo
  // Middle East
  QA: { lat:  25.3, lng:  51.5 },  // Doha
};

type MarkerDatum = { lat: number; lng: number; alpha2: string };

const MARKERS: MarkerDatum[] = Object.entries(COUNTRY_COORDS).map(
  ([alpha2, { lat, lng }]) => ({ lat, lng, alpha2 })
);

/* ── GlobeViewer ─────────────────────────────────────────────────────────── */

type Props = {
  selectedCountry: string | null;
  onSelectCountry: (alpha2: string) => void;
  locale?: string;
};

export function GlobeViewer({ selectedCountry, onSelectCountry, locale = "es" }: Props) {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const displayNames = new Intl.DisplayNames([locale], { type: "region" });

  // Track container dimensions for responsive canvas
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
      { lat: coords.lat, lng: coords.lng, altitude: 1.8 },
      900
    );
  }, [selectedCountry]);

  const handlePointClick = useCallback(
    (d: object) => {
      onSelectCountry((d as MarkerDatum).alpha2);
    },
    [onSelectCountry]
  );

  const handlePointHover = useCallback((d: object | null) => {
    if (containerRef.current) {
      containerRef.current.style.cursor = d ? "pointer" : "default";
    }
  }, []);

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

  const pointLabel = useCallback(
    (d: object) => {
      const alpha2 = (d as MarkerDatum).alpha2;
      return displayNames.of(alpha2) ?? alpha2;
    },
    [displayNames]
  );

  return (
    <div ref={containerRef} className="w-full h-full">
      <Globe
        ref={globeRef}
        width={size.width}
        height={size.height}
        /* Earth night texture — city lights give a premium feel */
        globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
        backgroundColor="rgba(0,0,0,0)"
        atmosphereColor="#60a5fa"
        atmosphereAltitude={0.14}
        /* Animated pulsing rings per country */
        ringsData={MARKERS}
        ringColor={ringColor}
        ringMaxRadius={4}
        ringPropagationSpeed={1.5}
        ringRepeatPeriod={2000}
        ringAltitude={0.005}
        /* Solid dot at ring center — the clickable target */
        pointsData={MARKERS}
        pointAltitude={0.015}
        pointRadius={0.6}
        pointColor={pointColor}
        pointLabel={pointLabel}
        onPointClick={handlePointClick}
        onPointHover={handlePointHover}
      />
    </div>
  );
}
