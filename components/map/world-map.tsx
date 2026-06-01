"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { SectionKey } from "@/lib/db/schema";
import { ALPHA2_TO_SLUG } from "@/lib/countries";

/* ── Lazy-load the 3-D globe (Three.js — SSR incompatible) ─────────────── */
const GlobeViewer = dynamic(
  () => import("./globe-viewer").then((m) => ({ default: m.GlobeViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-blue-300/50 animate-pulse">Cargando globo…</span>
      </div>
    ),
  }
);

/* ── Section chip colours ───────────────────────────────────────────────── */
const SECTION_COLORS: Record<SectionKey, string> = {
  sports:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  politics:      "bg-red-500/20 text-red-400 border-red-500/30",
  economy:       "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  tech:          "bg-purple-500/20 text-purple-400 border-purple-500/30",
  world:         "bg-teal-500/20 text-teal-400 border-teal-500/30",
  culture:       "bg-orange-500/20 text-orange-400 border-orange-500/30",
  health:        "bg-green-500/20 text-green-400 border-green-500/30",
  science:       "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  entertainment: "bg-pink-500/20 text-pink-400 border-pink-500/30",
};
const INACTIVE_SECTION =
  "bg-white/5 text-white/30 border-white/10";

/* ── Types ──────────────────────────────────────────────────────────────── */
type Source = {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  logo_url: string | null;
  subscribed: boolean;
  available_sections: string[];
  subscription_sections: string[] | null;
};

type Props = { locale: string };

/* ════════════════════════════════════════════════════════════════════════════
   WorldMap
   ══════════════════════════════════════════════════════════════════════════ */
export function WorldMap({ locale }: Props) {
  const t    = useTranslations("Map");
  const tSec = useTranslations("Sections");

  const [selectedCountry, setSelectedCountry]     = useState<string | null>(null);
  const [sources, setSources]                     = useState<Source[]>([]);
  const [loadingSources, setLoadingSources]       = useState(false);
  const [subscribing, setSubscribing]             = useState<string | null>(null);
  const [updatingSections, setUpdatingSections]   = useState<Record<string, boolean>>({});

  /* ── Data ─────────────────────────────────────────────────────────────── */
  async function loadSources(code: string) {
    setLoadingSources(true);
    setSources([]);
    try {
      const res  = await fetch(`/api/sources?country=${code}`);
      const data = await res.json();
      setSources(data);
    } finally {
      setLoadingSources(false);
    }
  }

  function handleSelectCountry(alpha2: string) {
    setSelectedCountry(alpha2);
    loadSources(alpha2);
  }

  function handleClose() {
    setSelectedCountry(null);
    setSources([]);
  }

  /* ── Subscribe / unsubscribe ──────────────────────────────────────────── */
  async function toggleSubscription(source: Source) {
    setSubscribing(source.id);
    try {
      if (source.subscribed) {
        await fetch("/api/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: source.id }),
        });
        setSources((p) =>
          p.map((s) => s.id === source.id
            ? { ...s, subscribed: false, subscription_sections: null } : s)
        );
      } else {
        await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: source.id }),
        });
        setSources((p) =>
          p.map((s) => s.id === source.id
            ? { ...s, subscribed: true, subscription_sections: null } : s)
        );
      }
    } finally {
      setSubscribing(null);
    }
  }

  /* ── Section toggle ───────────────────────────────────────────────────── */
  async function toggleSection(source: Source, sectionKey: string) {
    if (updatingSections[source.id]) return;
    const current = source.subscription_sections;
    const all     = source.available_sections;
    let next: string[] | null;

    if (current === null) {
      const rest = all.filter((s) => s !== sectionKey);
      if (rest.length === 0) return;
      next = rest;
    } else {
      const already = current.includes(sectionKey);
      if (already) {
        const ns = current.filter((s) => s !== sectionKey);
        if (ns.length === 0) return;
        next = ns;
      } else {
        const ns = [...current, sectionKey];
        next = ns.length >= all.length ? null : ns;
      }
    }

    setUpdatingSections((p) => ({ ...p, [source.id]: true }));
    try {
      await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.id, section_keys: next }),
      });
      setSources((p) =>
        p.map((s) => s.id === source.id ? { ...s, subscription_sections: next } : s)
      );
    } finally {
      setUpdatingSections((p) => ({ ...p, [source.id]: false }));
    }
  }

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  const isSectionActive = (source: Source, key: string) =>
    source.subscription_sections === null || source.subscription_sections.includes(key);

  const isOnlySection = (source: Source, key: string) =>
    source.subscription_sections !== null &&
    source.subscription_sections.length === 1 &&
    source.subscription_sections[0] === key;

  const selectedCountryName = selectedCountry
    ? new Intl.DisplayNames([locale], { type: "region" }).of(selectedCountry)
    : null;

  const newsSlug = selectedCountry ? ALPHA2_TO_SLUG[selectedCountry] : null;

  /* ── Render ───────────────────────────────────────────────────────────── */
  return (
    <div className="relative w-full h-full rounded-[var(--radius-card)] overflow-hidden bg-[#05081a]">

      {/* Globe — fills the entire container */}
      <GlobeViewer
        selectedCountry={selectedCountry}
        onSelectCountry={handleSelectCountry}
        locale={locale}
      />

      {/* Hint when nothing selected */}
      {!selectedCountry && (
        <p className="pointer-events-none absolute bottom-4 inset-x-0 text-center text-xs text-blue-300/40 select-none">
          {t("subtitle")}
        </p>
      )}

      {/* ── Country modal ─────────────────────────────────────────────────
          Appears as a centered card overlay (bottom-sheet on mobile).
          Inspired by visitors.now: dark card, flag, stats, source list.  */}
      {selectedCountry && (
        <div className="absolute inset-0 z-20 flex items-end sm:items-center justify-center p-0 sm:p-6 pointer-events-none">
          {/* Backdrop — only behind modal, not blocking globe */}
          <div
            className="absolute inset-0 pointer-events-auto"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Card */}
          <div className="relative pointer-events-auto w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl border border-white/10"
               style={{ background: "linear-gradient(160deg, #0d1a2e 0%, #080f1c 100%)" }}>

            {/* Close */}
            <button
              onClick={handleClose}
              aria-label="Cerrar"
              className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>

            {/* Header */}
            <div className="pt-5 pb-4 px-5 border-b border-white/8">
              <div className="flex items-center gap-3">
                {/* Country code badge — flag emojis render as letters on Windows,
                    so we use a styled gradient circle with the ISO code instead */}
                <div className="w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white tracking-wider select-none"
                     style={{ background: "linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%)", border: "1px solid rgba(96,165,250,0.25)" }}>
                  {selectedCountry}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-white leading-tight truncate">
                    {selectedCountryName ?? selectedCountry}
                  </h2>
                  {!loadingSources && (
                    <p className="text-xs text-white/40 mt-0.5">
                      {t("sources_available", { count: sources.length })}
                    </p>
                  )}
                </div>

                {/* "Ver noticias" link */}
                {newsSlug && (
                  <a
                    href={`/${locale}/news/${newsSlug}`}
                    className="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-500/15 text-blue-300 border border-blue-500/20 hover:bg-blue-500/25 transition-colors whitespace-nowrap"
                  >
                    {t("view_news")} →
                  </a>
                )}
              </div>
            </div>

            {/* Source list */}
            {/* Max ~4.5 rows visible before scroll */}
            <div className="overflow-y-auto overscroll-contain"
                 style={{ maxHeight: "min(45vh, 300px)" }}>
              {loadingSources ? (
                <div className="divide-y divide-white/5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex items-center gap-3">
                      <div className="skeleton h-3 flex-1 opacity-20" />
                      <div className="skeleton h-7 w-20 rounded-full opacity-20" />
                    </div>
                  ))}
                </div>
              ) : sources.length === 0 ? (
                <p className="px-5 py-6 text-sm text-white/30 text-center">
                  {t("no_sources")}
                </p>
              ) : (
                <div className="divide-y divide-white/5">
                  {sources.map((source) => (
                    <div key={source.id} className="px-4 py-2.5">
                      {/* Source row */}
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-white/80 flex-1 truncate">
                          {source.name}
                        </span>
                        <button
                          onClick={() => toggleSubscription(source)}
                          disabled={subscribing === source.id}
                          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                            source.subscribed
                              ? "bg-green-500/15 text-green-400 border border-green-500/20 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/20"
                              : "bg-blue-500/15 text-blue-400 border border-blue-500/20 hover:bg-blue-500/25"
                          }`}
                        >
                          {subscribing === source.id
                            ? "…"
                            : source.subscribed
                            ? t("subscribed")
                            : t("subscribe")}
                        </button>
                      </div>

                      {/* Section chips */}
                      {source.subscribed && source.available_sections.length > 0 && (
                        <div className={`mt-2 flex flex-wrap gap-1 transition-opacity ${updatingSections[source.id] ? "opacity-40" : ""}`}>
                          {source.available_sections.map((key) => {
                            const active = isSectionActive(source, key);
                            const isOnly = isOnlySection(source, key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleSection(source, key)}
                                disabled={isOnly}
                                title={isOnly ? t("section_last") : undefined}
                                className={`text-[10px] px-2 py-0.5 rounded border font-medium transition-all ${
                                  active
                                    ? (SECTION_COLORS[key as SectionKey] ?? "bg-gray-500/20 text-gray-400 border-gray-500/30")
                                    : INACTIVE_SECTION
                                } ${isOnly ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:opacity-80"}`}
                              >
                                {active ? "✓ " : ""}{tSec(key as SectionKey)}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Safe area for mobile */}
              <div className="h-safe-bottom pb-3" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
