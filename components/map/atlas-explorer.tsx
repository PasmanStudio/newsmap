"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { SectionChip } from "@/components/ui/section-chip";
import { ALPHA2_TO_SLUG } from "@/lib/countries";
import type { SectionKey } from "@/lib/db/schema";

type Source = {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  region: string;
  subscribed: boolean;
  available_sections: SectionKey[];
};

type Country = {
  code: string;
  name: string;
  region: string;
  sources: Source[];
};

const REGION_ORDER = ["latam", "north_america", "europe", "asia", "africa"];

/** Square initials badge — flag emojis render as letter pairs on Windows */
function SourceAvatar({ name }: { name: string }) {
  return (
    <span className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded bg-[var(--color-paper-3)] text-[10px] font-bold uppercase text-[var(--color-ink-2)]">
      {name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}

/** Small ISO country-code stamp used in place of flag emoji */
function CountryBadge({ code, size = "sm" }: { code: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-[3px] border border-[var(--color-hairline)] bg-[var(--color-paper-2)] font-bold tracking-wider text-[var(--color-ink-2)] ${
        size === "md" ? "h-6 px-1.5 text-[11px]" : "h-5 px-1 text-[9px]"
      }`}
      aria-hidden="true"
    >
      {code}
    </span>
  );
}

type Props = { locale: string };

/**
 * Atlas explorer (F-19/F-42) — the accessible, list-first way to browse and
 * follow sources: search box + countries grouped by region + a country panel
 * with follow/unfollow per source. Subscribed countries get an oxblood dot
 * (F-20); follow actions confirm via a toast with a way back to the diary
 * (F-21). The interactive globe lives further down the page as an atlas
 * plate — this list is the fast path to the task.
 */
export function AtlasExplorer({ locale }: Props) {
  const t = useTranslations("Map");
  const tSec = useTranslations("Sections");

  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sources");
        if (!res.ok) return;
        const data: Source[] = await res.json();
        if (!cancelled) setSources(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const countryNames = useMemo(
    () => new Intl.DisplayNames([locale], { type: "region" }),
    [locale]
  );

  const countries = useMemo<Country[]>(() => {
    const byCode = new Map<string, Country>();
    for (const s of sources) {
      const existing = byCode.get(s.country_code);
      if (existing) {
        existing.sources.push(s);
      } else {
        byCode.set(s.country_code, {
          code: s.country_code,
          name: countryNames.of(s.country_code) ?? s.country_code,
          region: s.region,
          sources: [s],
        });
      }
    }
    return [...byCode.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [sources, countryNames, locale]);

  const subCount = sources.filter((s) => s.subscribed).length;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.sources.some((s) => s.name.toLowerCase().includes(term))
    );
  }, [countries, q]);

  const regions = useMemo(() => {
    const present = [...new Set(filtered.map((c) => c.region))];
    return present.sort(
      (a, b) => REGION_ORDER.indexOf(a) - REGION_ORDER.indexOf(b)
    );
  }, [filtered]);

  const country =
    countries.find((c) => c.code === selected) ?? filtered[0] ?? null;

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  async function toggle(source: Source) {
    if (pending) return;
    setPending(source.id);
    try {
      const res = await fetch("/api/subscriptions", {
        method: source.subscribed ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: source.id }),
      });
      if (!res.ok) return;
      const nowSubscribed = !source.subscribed;
      const nextCount = subCount + (nowSubscribed ? 1 : -1);
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id ? { ...s, subscribed: nowSubscribed } : s
        )
      );
      showToast(
        nowSubscribed
          ? t("toast_added", { name: source.name, count: nextCount })
          : t("toast_removed", { name: source.name, count: nextCount })
      );
    } finally {
      setPending(null);
    }
  }

  const regionLabel = (region: string) => {
    switch (region) {
      case "latam": return t("region_latam");
      case "north_america": return t("region_north_america");
      case "europe": return t("region_europe");
      case "asia": return t("region_asia");
      case "africa": return t("region_africa");
      default: return region;
    }
  };

  const newsSlug = country ? ALPHA2_TO_SLUG[country.code] : null;

  return (
    <div className="max-w-[920px] mx-auto">
      {/* Header */}
      <div className="text-center mb-4">
        <p className="eyebrow text-[var(--color-oxblood)]">
          {t("explore_eyebrow")}
        </p>
        <h1 className="font-display text-[28px] font-black text-[var(--color-ink-1)] my-1">
          {t("atlas_title")}
        </h1>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          {t("atlas_subtitle", { count: subCount })}
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-[480px] mx-auto mb-4.5">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 inline-flex text-[var(--color-ink-3)]">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={t("atlas_search_aria")}
          placeholder={t("atlas_search_placeholder")}
          className="w-full pl-9 pr-3 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-paper-2)] border border-[var(--color-hairline)] text-[16px] text-[var(--color-ink-1)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:border-[var(--color-ink-blue)] transition-colors"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-4">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="skeleton h-11" />
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.1fr] gap-4 items-start">
          {/* ── Country list grouped by region ─────────────────────────── */}
          <div>
            {filtered.length === 0 && (
              <p className="text-[13px] text-[var(--color-ink-2)] text-center py-8">
                {t("atlas_no_results", { query: q })}
              </p>
            )}
            {regions.map((r) => (
              <div key={r} className="mb-3.5">
                <p className="eyebrow border-b-2 border-[var(--color-ink-1)] pb-1 mb-1.5">
                  {regionLabel(r)}
                </p>
                <div className="flex flex-col">
                  {filtered
                    .filter((c) => c.region === r)
                    .map((c) => {
                      const subbed = c.sources.filter((s) => s.subscribed).length;
                      const isSel = country?.code === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setSelected(c.code)}
                          className={`flex items-center gap-2.5 text-left min-h-[44px] px-2.5 py-2 border-b border-[var(--color-hairline)] transition-colors ${
                            isSel
                              ? "bg-[var(--color-paper-2)] border-l-[3px] border-l-[var(--color-oxblood)]"
                              : "border-l-[3px] border-l-transparent hover:bg-[var(--color-paper-2)]/60"
                          }`}
                        >
                          <CountryBadge code={c.code} />
                          <span
                            className={`text-[13.5px] text-[var(--color-ink-1)] ${
                              isSel ? "font-bold" : "font-medium"
                            }`}
                          >
                            {c.name}
                          </span>
                          <span className="ml-auto text-[11px] text-[var(--color-ink-3)] tabular-nums">
                            {t("sources_count", { count: c.sources.length })}
                          </span>
                          {subbed > 0 && (
                            <span
                              title={t("subscribed_dot", { count: subbed })}
                              className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-oxblood)]"
                            />
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
            <p className="text-[10.5px] text-[var(--color-ink-3)] mt-1">
              {t("atlas_globe_note")}
            </p>
          </div>

          {/* ── Country panel ───────────────────────────────────────────── */}
          <div className="rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-white px-4 py-3.5 self-start">
            {country ? (
              <>
                <div className="flex items-baseline gap-2 border-b-2 border-[var(--color-oxblood)] pb-2 mb-1">
                  <CountryBadge code={country.code} size="md" />
                  <h2 className="font-display text-xl font-black text-[var(--color-ink-1)]">
                    {country.name}
                  </h2>
                  <span className="ml-auto text-[11px] text-[var(--color-ink-3)]">
                    {t("sources_count", { count: country.sources.length })}
                  </span>
                </div>
                {country.sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2.5 py-2.5 border-b border-[var(--color-hairline)]"
                  >
                    <SourceAvatar name={s.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-[var(--color-ink-1)] mb-1">
                        {s.name}
                      </p>
                      <span className="inline-flex gap-1 flex-wrap">
                        {s.available_sections.map((k) => (
                          <SectionChip key={k} section={k} label={tSec(k)} />
                        ))}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggle(s)}
                      disabled={pending === s.id}
                      className={`inline-flex items-center justify-center gap-1.5 min-h-[34px] px-3 py-1 rounded-[var(--radius-button)] text-xs font-semibold transition-colors disabled:opacity-50 ${
                        s.subscribed
                          ? "border border-[var(--color-hairline)] text-[var(--color-ink-2)] hover:border-[var(--color-ink-2)]"
                          : "bg-[var(--color-ink-blue)] border border-[var(--color-ink-blue)] text-white hover:opacity-90"
                      }`}
                    >
                      {s.subscribed ? (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          {t("following")}
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14" />
                            <path d="M12 5v14" />
                          </svg>
                          {t("follow")}
                        </>
                      )}
                    </button>
                  </div>
                ))}
                {newsSlug && (
                  <a
                    href={`/${locale}/news/${newsSlug}`}
                    className="inline-block mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-blue)] hover:underline"
                  >
                    {t("view_front_page", { country: country.name })} →
                  </a>
                )}
              </>
            ) : (
              <p className="text-[13px] text-[var(--color-ink-2)] text-center py-8">
                {t("no_sources")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Confirmation toast with a way back to the diary (F-21) ───────── */}
      {toast && (
        <div
          role="status"
          className="fixed left-1/2 bottom-[22px] -translate-x-1/2 z-[60] flex items-center gap-3 rounded-[var(--radius-button)] bg-[var(--color-ink-1)] px-4 py-2.5 text-[12.5px] text-[var(--color-paper)]"
          style={{ boxShadow: "var(--shadow-overlay)" }}
        >
          <span>{toast}</span>
          <a
            href={`/${locale}/feed`}
            className="font-bold text-white underline underline-offset-[3px] whitespace-nowrap"
          >
            {t("toast_view_diary")}
          </a>
        </div>
      )}
    </div>
  );
}
