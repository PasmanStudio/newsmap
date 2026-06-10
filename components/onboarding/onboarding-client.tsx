"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams } from "next/navigation";
import { PROFILES, type ProfileId } from "@/lib/profiles";
import { SectionChip } from "@/components/ui/section-chip";
import type { SectionKey } from "@/lib/db/schema";

type Step = "pick" | "adjust" | "done";

type SourceInfo = {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  available_sections: SectionKey[];
};

/** Square initials badge for a source (flag emojis don't render on Windows) */
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

/**
 * Onboarding (F-22..F-25) — newsprint two-step flow:
 *   1. pick a reader profile (cards show the real sources inside)
 *   2. adjust the selection source-by-source (Quitar/Añadir)
 *   → "Tu diario está listo" close, then into the feed.
 */
export function OnboardingClient() {
  const t = useTranslations("Onboarding");
  const tSec = useTranslations("Sections");
  const router = useRouter();
  const { locale } = useParams<{ locale: string }>();

  const [step, setStep] = useState<Step>("pick");
  const [profileId, setProfileId] = useState<ProfileId | null>(null);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [sourcesBySlug, setSourcesBySlug] = useState<Map<string, SourceInfo>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load real source details (names, countries, sections) so the profile
  // cards and the adjust step show actual publications, not just slugs.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sources");
        if (!res.ok) return;
        const data: SourceInfo[] = await res.json();
        if (!cancelled) {
          setSourcesBySlug(new Map(data.map((s) => [s.slug, s])));
        }
      } catch {
        // Cards fall back to humanized slugs when the request fails
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const profile = PROFILES.find((p) => p.id === profileId) ?? null;

  const profileSources = useMemo(() => {
    if (!profile) return [];
    return profile.slugs.map(
      (slug) =>
        sourcesBySlug.get(slug) ?? {
          id: slug,
          name: slug.replace(/-/g, " "),
          slug,
          country_code: "",
          available_sections: [] as SectionKey[],
        }
    );
  }, [profile, sourcesBySlug]);

  const activeSlugs = profile
    ? profile.slugs.filter((s) => enabled[s])
    : [];
  const activeCount = activeSlugs.length;

  function pick(id: ProfileId) {
    setProfileId(id);
    const p = PROFILES.find((x) => x.id === id)!;
    setEnabled(Object.fromEntries(p.slugs.map((s) => [s, true])));
    setStep("adjust");
  }

  async function handleFinish() {
    if (activeCount === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/subscriptions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slugs: activeSlugs }),
      });
      if (!res.ok) throw new Error("Failed to save subscriptions");
      setStep("done");
    } catch {
      setError(t("error_generic"));
    } finally {
      setLoading(false);
    }
  }

  // ── Done — "Tu diario está listo" ──────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="max-w-[560px] mx-auto px-4 pt-18 text-center">
        <div className="ornament mb-3.5 text-base" aria-hidden="true">
          ❦
        </div>
        <h1 className="font-display text-3xl font-black text-[var(--color-ink-1)] mb-2">
          {t("done_title")}
        </h1>
        <p className="text-sm text-[var(--color-ink-2)]">
          {t("done_desc", { count: activeCount })}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/${locale}/feed`)}
          className="inline-flex items-center justify-center gap-2 mt-4 min-h-[44px] px-4.5 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-ink-blue)] border border-[var(--color-ink-blue)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
        >
          {t("done_cta")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Step 1 — pick a reader profile ─────────────────────────────────────────
  if (step === "pick") {
    return (
      <div className="max-w-[560px] mx-auto px-4 pt-9 pb-12">
        <div className="text-center mb-5.5">
          <p className="eyebrow text-[var(--color-oxblood)]">
            {t("step1_eyebrow")}
          </p>
          <h1 className="font-display text-[28px] font-black text-[var(--color-ink-1)] my-1.5">
            {t("step1_title")}
          </h1>
          <p className="text-[13.5px] text-[var(--color-ink-2)]">
            {t("step1_subtitle")}
          </p>
        </div>

        <div className="grid gap-2.5">
          {PROFILES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick(p.id)}
              className="text-left rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-white px-4 py-3.5 cursor-pointer hover:border-[var(--color-ink-blue)] transition-colors"
            >
              <p className="font-display text-[17px] font-bold text-[var(--color-ink-1)] mb-0.5">
                {t(`profile_${p.id}` as Parameters<typeof t>[0])}
              </p>
              <p className="text-[12.5px] text-[var(--color-ink-2)] mb-2">
                {t(`profile_${p.id}_desc` as Parameters<typeof t>[0])}
              </p>
              <span className="inline-flex gap-1.5 flex-wrap">
                {p.slugs.slice(0, 4).map((slug) => {
                  const s = sourcesBySlug.get(slug);
                  return (
                    <span
                      key={slug}
                      className="inline-flex items-center gap-1.5 rounded-[3px] border border-[var(--color-hairline)] bg-[var(--color-paper-2)] px-1.5 py-[3px] text-[11px] text-[var(--color-ink-2)] capitalize"
                    >
                      {s?.country_code && (
                        <span className="text-[8px] font-bold tracking-wider text-[var(--color-ink-3)]">
                          {s.country_code}
                        </span>
                      )}
                      {s?.name ?? slug.replace(/-/g, " ")}
                    </span>
                  );
                })}
                {p.slugs.length > 4 && (
                  <span className="inline-flex items-center px-1.5 py-[3px] text-[11px] text-[var(--color-ink-3)]">
                    +{p.slugs.length - 4}
                  </span>
                )}
              </span>
            </button>
          ))}

          {/* Custom: pick sources on the map — returns into the flow (F-24) */}
          <button
            type="button"
            onClick={() => router.push(`/${locale}/map`)}
            className="flex items-center gap-3 text-left rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-white px-4 py-3.5 cursor-pointer hover:border-[var(--color-ink-blue)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
            <span>
              <span className="font-display block text-base font-bold text-[var(--color-ink-1)]">
                {t("profile_custom")}
              </span>
              <span className="text-xs text-[var(--color-ink-3)]">
                {t("profile_custom_desc")}
              </span>
            </span>
          </button>
        </div>

        <p className="text-center mt-4">
          <button
            type="button"
            onClick={() => router.push(`/${locale}/feed`)}
            className="text-xs text-[var(--color-ink-3)] underline underline-offset-[3px] hover:text-[var(--color-ink-1)] cursor-pointer"
          >
            {t("skip")}
          </button>
        </p>
      </div>
    );
  }

  // ── Step 2 — adjust the selection ──────────────────────────────────────────
  return (
    <div className="max-w-[560px] mx-auto px-4 pt-9 pb-12">
      <div className="text-center mb-4.5">
        <p className="eyebrow text-[var(--color-oxblood)]">
          {t("step2_eyebrow", {
            profile: t(`profile_${profileId}` as Parameters<typeof t>[0]),
          })}
        </p>
        <h1 className="font-display text-[26px] font-black text-[var(--color-ink-1)] my-1.5">
          {t("step2_title")}
        </h1>
        <p className="text-[13px] text-[var(--color-ink-2)]">
          {t("step2_count", { count: activeCount })}
        </p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-hairline)] bg-white mb-4">
        {profileSources.map((s, i) => (
          <div
            key={s.slug}
            className={`flex items-center gap-3 px-3.5 py-2.5 ${
              i ? "border-t border-[var(--color-hairline)]" : ""
            } ${enabled[s.slug] ? "" : "opacity-45"}`}
          >
            <SourceAvatar name={s.name} />
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-semibold text-[var(--color-ink-1)] mb-1 capitalize">
                {s.country_code && (
                  <span className="mr-1.5 text-[9px] font-bold tracking-wider text-[var(--color-ink-3)] align-middle">
                    {s.country_code}
                  </span>
                )}
                {s.name}
              </p>
              {s.available_sections.length > 0 && (
                <span className="inline-flex gap-1 flex-wrap">
                  {s.available_sections.slice(0, 4).map((k) => (
                    <SectionChip key={k} section={k} label={tSec(k)} />
                  ))}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() =>
                setEnabled((e) => ({ ...e, [s.slug]: !e[s.slug] }))
              }
              className="inline-flex items-center justify-center min-h-[34px] px-3 py-1 rounded-[var(--radius-button)] border border-[var(--color-hairline)] text-xs font-semibold text-[var(--color-ink-2)] hover:border-[var(--color-ink-2)] transition-colors"
            >
              {enabled[s.slug] ? t("btn_remove") : t("btn_add")}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => router.push(`/${locale}/map`)}
          className="flex items-center gap-2 w-full px-3.5 py-2.5 border-t border-[var(--color-hairline)] text-[12.5px] font-semibold text-[var(--color-ink-blue)] cursor-pointer hover:bg-[var(--color-paper-2)] transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {t("add_more_from_map")}
        </button>
      </div>

      {error && (
        <p className="text-sm text-[var(--color-oxblood)] text-center mb-3">
          {error}
        </p>
      )}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => setStep("pick")}
          className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--color-hairline)] text-[13px] font-semibold text-[var(--color-ink-2)] hover:border-[var(--color-ink-2)] transition-colors"
        >
          {t("btn_back")}
        </button>
        <button
          type="button"
          disabled={activeCount === 0 || loading}
          onClick={handleFinish}
          className="flex-[1.6] inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-ink-blue)] border border-[var(--color-ink-blue)] text-white text-[13px] font-semibold hover:opacity-90 disabled:opacity-45 disabled:cursor-default transition-opacity"
        >
          {loading ? "…" : t("btn_go_diary", { count: activeCount })}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
