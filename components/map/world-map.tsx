"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import type { SectionKey } from "@/lib/db/schema";
import { ALPHA2_TO_SLUG } from "@/lib/countries";

/* ── Lazy-load the 3-D globe (Three.js — SSR incompatible) ─────────────────
   The heavy WebGL bundle only loads when the user navigates to /map.        */
const GlobeViewer = dynamic(
  () => import("./globe-viewer").then((m) => ({ default: m.GlobeViewer })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-sm text-[var(--color-text-3)] animate-pulse">
          Cargando globo…
        </span>
      </div>
    ),
  }
);

/* ── Section chip colours (mirrors SectionChip component) ───────────────── */
const SECTION_COLORS: Record<SectionKey, string> = {
  sports:        "bg-blue-500/20 text-blue-500 border-blue-500/30",
  politics:      "bg-red-500/20 text-red-500 border-red-500/30",
  economy:       "bg-yellow-500/20 text-yellow-600 border-yellow-500/30",
  tech:          "bg-purple-500/20 text-purple-500 border-purple-500/30",
  world:         "bg-teal-500/20 text-teal-500 border-teal-500/30",
  culture:       "bg-orange-500/20 text-orange-500 border-orange-500/30",
  health:        "bg-green-500/20 text-green-600 border-green-500/30",
  science:       "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
  entertainment: "bg-pink-500/20 text-pink-500 border-pink-500/30",
};

const INACTIVE_SECTION =
  "bg-[var(--color-bg-3)] text-[var(--color-text-3)] border-[var(--color-border)]";

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

type Props = {
  locale: string;
};

/* ── Component ──────────────────────────────────────────────────────────── */

export function WorldMap({ locale }: Props) {
  const t = useTranslations("Map");
  const tSec = useTranslations("Sections");

  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const [updatingSections, setUpdatingSections] = useState<Record<string, boolean>>({});

  /* ── Data loading ──────────────────────────────────────────────────────── */

  async function loadSources(countryCode: string) {
    setLoadingSources(true);
    setSources([]);
    try {
      const res = await fetch(`/api/sources?country=${countryCode}`);
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

  /* ── Subscribe / unsubscribe ───────────────────────────────────────────── */

  async function toggleSubscription(source: Source) {
    setSubscribing(source.id);
    try {
      if (source.subscribed) {
        await fetch("/api/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: source.id }),
        });
        setSources((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? { ...s, subscribed: false, subscription_sections: null }
              : s
          )
        );
      } else {
        await fetch("/api/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source_id: source.id }),
        });
        setSources((prev) =>
          prev.map((s) =>
            s.id === source.id
              ? { ...s, subscribed: true, subscription_sections: null }
              : s
          )
        );
      }
    } finally {
      setSubscribing(null);
    }
  }

  /* ── Section toggle ────────────────────────────────────────────────────── */

  async function toggleSection(source: Source, sectionKey: string) {
    if (updatingSections[source.id]) return;

    const current = source.subscription_sections;
    const all = source.available_sections;
    let next: string[] | null;

    if (current === null) {
      const rest = all.filter((s) => s !== sectionKey);
      if (rest.length === 0) return;
      next = rest;
    } else {
      const alreadySelected = current.includes(sectionKey);
      if (alreadySelected) {
        const newSections = current.filter((s) => s !== sectionKey);
        if (newSections.length === 0) return;
        next = newSections;
      } else {
        const newSections = [...current, sectionKey];
        next = newSections.length >= all.length ? null : newSections;
      }
    }

    setUpdatingSections((prev) => ({ ...prev, [source.id]: true }));
    try {
      await fetch("/api/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.id, section_keys: next }),
      });
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, subscription_sections: next } : s
        )
      );
    } finally {
      setUpdatingSections((prev) => ({ ...prev, [source.id]: false }));
    }
  }

  /* ── Helpers ───────────────────────────────────────────────────────────── */

  function isSectionActive(source: Source, key: string): boolean {
    return (
      source.subscription_sections === null ||
      source.subscription_sections.includes(key)
    );
  }

  function isOnlySection(source: Source, key: string): boolean {
    return (
      source.subscription_sections !== null &&
      source.subscription_sections.length === 1 &&
      source.subscription_sections[0] === key
    );
  }

  const selectedCountryName = selectedCountry
    ? new Intl.DisplayNames([locale], { type: "region" }).of(selectedCountry)
    : null;

  /* ── Render ────────────────────────────────────────────────────────────── */

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-full">

      {/* ── Globe canvas ──────────────────────────────────────────────────── */}
      <div className="relative aspect-square lg:aspect-auto lg:flex-1 rounded-[var(--radius-card)] overflow-hidden bg-[#05081a] border border-[var(--color-border)]">
        <GlobeViewer
          selectedCountry={selectedCountry}
          onSelectCountry={handleSelectCountry}
          locale={locale}
        />

        {/* Hint — fades once a country is selected */}
        {!selectedCountry && (
          <p className="pointer-events-none absolute bottom-3 left-0 right-0 text-center text-[11px] text-blue-300/60 select-none">
            {t("subtitle")}
          </p>
        )}
      </div>

      {/* ── Source panel ──────────────────────────────────────────────────── */}
      <div className="h-[380px] lg:h-full lg:w-72 rounded-[var(--radius-card)] bg-[var(--color-bg-2)] border border-[var(--color-border)] overflow-hidden">
        {!selectedCountry ? (
          <div className="h-full flex items-center justify-center p-6 text-center">
            <p className="text-sm text-[var(--color-text-2)]">
              {t("subtitle")}
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Panel header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-[var(--color-text)]">
                  {t("panel_title", {
                    country: selectedCountryName ?? selectedCountry,
                  })}
                </h2>
                {selectedCountry && ALPHA2_TO_SLUG[selectedCountry] && (
                  <a
                    href={`/${locale}/news/${ALPHA2_TO_SLUG[selectedCountry]}`}
                    className="shrink-0 text-xs text-[var(--color-blue)] hover:underline mt-0.5"
                  >
                    {t("view_news")} →
                  </a>
                )}
              </div>
              {!loadingSources && (
                <p className="text-xs text-[var(--color-text-2)] mt-0.5">
                  {t("sources_available", { count: sources.length })}
                </p>
              )}
            </div>

            {/* Source list */}
            <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--color-border)]">
              {loadingSources ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-3">
                    <div className="skeleton h-4 w-4 rounded-full" />
                    <div className="skeleton h-3 flex-1" />
                    <div className="skeleton h-7 w-20 rounded" />
                  </div>
                ))
              ) : sources.length === 0 ? (
                <p className="px-4 py-6 text-sm text-[var(--color-text-2)]">
                  {t("no_sources")}
                </p>
              ) : (
                sources.map((source) => (
                  <div key={source.id}>
                    {/* Source row */}
                    <div className="px-4 py-3 flex items-center gap-3">
                      <span className="text-sm font-medium text-[var(--color-text)] flex-1 truncate">
                        {source.name}
                      </span>
                      <button
                        onClick={() => toggleSubscription(source)}
                        disabled={subscribing === source.id}
                        className={`shrink-0 px-3 py-1 rounded-[var(--radius-button)] text-xs font-medium transition-colors disabled:opacity-50 ${
                          source.subscribed
                            ? "bg-[var(--color-green)]/15 text-[var(--color-green)] hover:bg-[var(--color-red)]/15 hover:text-[var(--color-red)]"
                            : "bg-[var(--color-blue)]/15 text-[var(--color-blue)] hover:bg-[var(--color-blue)]/25"
                        }`}
                      >
                        {subscribing === source.id
                          ? "…"
                          : source.subscribed
                          ? t("subscribed")
                          : t("subscribe")}
                      </button>
                    </div>

                    {/* Section chips — only when subscribed */}
                    {source.subscribed && source.available_sections.length > 0 && (
                      <div
                        className={`px-4 pb-3 flex flex-wrap gap-1.5 transition-opacity ${
                          updatingSections[source.id] ? "opacity-50" : ""
                        }`}
                      >
                        {source.available_sections.map((key) => {
                          const active = isSectionActive(source, key);
                          const isOnly = isOnlySection(source, key);
                          const colorClass = active
                            ? (SECTION_COLORS[key as SectionKey] ??
                              "bg-gray-500/20 text-gray-500 border-gray-500/30")
                            : INACTIVE_SECTION;
                          return (
                            <button
                              key={key}
                              onClick={() => toggleSection(source, key)}
                              disabled={isOnly}
                              title={isOnly ? t("section_last") : undefined}
                              className={`text-xs px-2 py-0.5 rounded border font-medium transition-all ${colorClass} ${
                                isOnly
                                  ? "opacity-50 cursor-not-allowed"
                                  : "cursor-pointer hover:opacity-80"
                              }`}
                            >
                              {active ? "✓ " : ""}
                              {tSec(key as SectionKey)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
