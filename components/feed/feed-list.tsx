"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import { ArticleCard, type ArticleCardData } from "./article-card";
import { ArticleCardSkeleton } from "./article-card-skeleton";
import { ArticleModal } from "./article-modal";
import { ContinueReadingStrip } from "./continue-reading-strip";
import { EndOfFeed } from "./end-of-feed";
import { AdSlot } from "@/components/ads/ad-slot";
import { SECTION_TOKENS } from "@/components/ui/section-chip";
import type { SectionKey } from "@/lib/db/schema";

/** AdSense in-feed slot ID — set NEXT_PUBLIC_ADSENSE_SLOT_FEED in env. */
const FEED_AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_FEED ?? "";
/** Inject one labeled ad after every Nth article (F-45: 1 per 8). */
const AD_FREQUENCY = 8;

const PAYWALL_SOURCES: string[] = [];

const SECTION_KEYS: SectionKey[] = [
  "politics", "economy", "world", "tech",
  "culture", "sports", "health", "science", "entertainment",
];

/** Preview modal is only worth opening when the body has substantial text */
function previewable(article: ArticleCardData): boolean {
  return Boolean(
    article.content_html &&
      article.content_html.replace(/<[^>]+>/g, "").trim().length > 350
  );
}

type Props = {
  locale: string;
};

export function FeedList({ locale }: Props) {
  const t = useTranslations("Feed");
  const tSec = useTranslations("Sections");
  const tArt = useTranslations("Article");

  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<ArticleCardData[]>([]);
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [previewArticle, setPreviewArticle] = useState<ArticleCardData | null>(null);

  const isDev = process.env.NODE_ENV !== "production";

  // ── Debounce search input ──────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function handleDevSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setSyncResult(`✓ Inserted ${data.inserted} articles from ${data.sources} sources`);
        void fetchPage(null, false, activeSection, debouncedQuery);
      } else {
        setSyncResult(`Error: ${data.error}`);
      }
    } catch {
      setSyncResult("Sync failed — check console");
    } finally {
      setSyncing(false);
    }
  }

  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    async (
      cursor: string | null,
      append: boolean,
      section: SectionKey | null,
      query: string
    ) => {
      await Promise.resolve();
      if (append) setLoadingMore(true);
      else setLoading(true);

      try {
        const url = new URL("/api/feed", window.location.origin);
        if (cursor) url.searchParams.set("cursor", cursor);
        if (section) url.searchParams.set("section", section);
        if (query.trim()) url.searchParams.set("q", query.trim());
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error("Failed to load feed");
        const data = await res.json();
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
        if (data.sectionCounts) setSectionCounts(data.sectionCounts);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    []
  );

  // Re-fetch from top whenever activeSection or debouncedQuery changes
  useEffect(() => {
    void fetchPage(null, false, activeSection, debouncedQuery);
  }, [fetchPage, activeSection, debouncedQuery]);

  // Listen for banner "new articles" refresh trigger
  useEffect(() => {
    function handleRefresh() {
      setItems([]);
      setNextCursor(null);
      void fetchPage(null, false, activeSection, debouncedQuery);
    }
    window.addEventListener("feed:refresh", handleRefresh);
    return () => window.removeEventListener("feed:refresh", handleRefresh);
  }, [fetchPage, activeSection, debouncedQuery]);

  // Infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          fetchPage(nextCursor, true, activeSection, debouncedQuery);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, fetchPage, activeSection, debouncedQuery]);

  const handleSection = (key: SectionKey | null) => {
    if (key === activeSection) return;
    setActiveSection(key);
    setItems([]);
    setNextCursor(null);
  };

  const showLead = !activeSection && !debouncedQuery;

  // ── Section band (F-09) — surfaces the busiest section mid-feed ───────────
  // Derived from the loaded page: pick the most frequent section beyond the
  // first 4 cards, lift its first two headlines into a band, and exclude
  // them from the regular flow so they don't appear twice.
  const band = useMemo(() => {
    if (!showLead || items.length < 8) return null;
    const tail = items.slice(4);
    const bySection = new Map<SectionKey, ArticleCardData[]>();
    for (const a of tail) {
      const list = bySection.get(a.section_key) ?? [];
      list.push(a);
      bySection.set(a.section_key, list);
    }
    let best: { section: SectionKey; articles: ArticleCardData[] } | null = null;
    for (const [section, articles] of bySection) {
      if (articles.length >= 2 && (!best || articles.length > best.articles.length)) {
        best = { section, articles };
      }
    }
    if (!best) return null;
    return {
      section: best.section,
      headlines: best.articles.slice(0, 2),
      count: sectionCounts[best.section] ?? best.articles.length,
    };
  }, [showLead, items, sectionCounts]);

  const bandIds = useMemo(
    () => new Set(band?.headlines.map((a) => a.id) ?? []),
    [band]
  );
  const displayItems = useMemo(
    () => items.filter((a) => !bandIds.has(a.id)),
    [items, bandIds]
  );

  // "Next in your diary" — advance the reading modal to the next previewable article
  const handleNextInDiary = useCallback(() => {
    if (!previewArticle) return;
    const idx = displayItems.findIndex((a) => a.id === previewArticle.id);
    const next = displayItems.slice(idx + 1).find(previewable);
    setPreviewArticle(next ?? null);
  }, [previewArticle, displayItems]);

  if (error) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-16 text-center">
        <p className="text-[var(--color-ink-2)]">{error}</p>
      </div>
    );
  }

  const openArticle = (a: ArticleCardData) => {
    const url = new URL(a.url);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
    {/* Article preview modal — rendered outside the feed list so it sits above everything */}
    <ArticleModal
      article={previewArticle}
      onClose={() => setPreviewArticle(null)}
      onNext={handleNextInDiary}
      locale={locale}
    />
    <div className="max-w-[720px] mx-auto pb-4">
      {/* Continue reading rail — only renders when there's history */}
      {showLead && <ContinueReadingStrip />}

      {/* ── Sticky search + filter block (clears the 48/56px nav) ──────── */}
      <div className="sticky top-12 sm:top-14 z-20 bg-[var(--color-paper)] px-3 sm:px-4 pt-2.5 pb-1.5">
        <div className="relative mb-2">
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
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            aria-label={t("search_aria")}
            // 16 px font on mobile prevents iOS Safari from auto-zooming on focus
            className="w-full pl-9 pr-9 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-paper-2)] border border-[var(--color-hairline)] text-[16px] text-[var(--color-ink-1)] placeholder:text-[var(--color-ink-3)] focus:outline-none focus:border-[var(--color-ink-blue)] transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex p-1.5 rounded text-[var(--color-ink-3)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-paper-2)] transition-colors"
              aria-label={t("search_clear")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Section filter chips with fresh-article counts (F-29) */}
        <div className="overflow-x-auto scrollbar-hidden">
          <div className="flex gap-1.5 min-w-max pb-1">
            <button
              onClick={() => handleSection(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium border transition-colors shrink-0 ${
                activeSection === null
                  ? "bg-[var(--color-ink-blue)] text-white border-[var(--color-ink-blue)]"
                  : "text-[var(--color-ink-2)] border-[var(--color-hairline)] hover:border-[var(--color-ink-blue)] hover:text-[var(--color-ink-blue)]"
              }`}
            >
              {t("filter_all")}
            </button>
            {SECTION_KEYS.map((key) => (
              <button
                key={key}
                onClick={() =>
                  handleSection(activeSection === key ? null : key)
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-full text-xs font-medium border transition-colors shrink-0 ${
                  activeSection === key
                    ? "bg-[var(--color-ink-blue)] text-white border-[var(--color-ink-blue)]"
                    : "text-[var(--color-ink-2)] border-[var(--color-hairline)] hover:border-[var(--color-ink-blue)] hover:text-[var(--color-ink-blue)]"
                }`}
              >
                {tSec(key)}
                {(sectionCounts[key] ?? 0) > 0 && (
                  <span className="text-[10px] opacity-60 tabular-nums">
                    {sectionCounts[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feed items ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-4 px-3 sm:px-4 pt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ArticleCardSkeleton key={i} />
          ))}
        </div>
      ) : !items.length ? (
        <div className="px-4 py-14 text-center">
          <p className="font-display font-bold text-xl text-[var(--color-ink-1)] mb-1.5">
            {t("empty_title")}
          </p>
          <p className="text-[13px] text-[var(--color-ink-2)]">
            {debouncedQuery
              ? t("search_no_results", { query: debouncedQuery })
              : activeSection
              ? t("filter_by_section")
              : t("empty_desc")}
          </p>
          {showLead && (
            <a
              href={`/${locale}/map`}
              className="inline-flex items-center justify-center mt-5 px-5 py-2.5 min-h-[44px] rounded-[var(--radius-button)] bg-[var(--color-ink-blue)] text-white text-[13px] font-semibold hover:opacity-90"
            >
              {t("empty_cta")}
            </a>
          )}
          {/* Dev-only: manually trigger RSS fetch without needing Inngest running */}
          {isDev && showLead && (
            <div className="mt-4 space-y-2">
              <button
                onClick={handleDevSync}
                disabled={syncing}
                className="inline-block px-4 py-2 rounded-[var(--radius-button)] border border-[var(--color-hairline)] text-xs text-[var(--color-ink-2)] hover:border-[var(--color-ink-blue)] hover:text-[var(--color-ink-blue)] disabled:opacity-50 transition-colors"
              >
                {syncing ? "Fetching articles…" : "⚡ Dev: Sync articles now"}
              </button>
              {syncResult && (
                <p className="text-xs text-[var(--color-ink-2)]">{syncResult}</p>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-3 sm:px-4 pt-2">
          {displayItems.flatMap((article, index) => {
            // First article in the unfiltered "all" feed becomes the lead story.
            const isLead = index === 0 && showLead;
            const nodes = [
              <ArticleCard
                key={article.id}
                article={article}
                sectionLabel={tSec(article.section_key as SectionKey)}
                readLabel={tArt("read_full")}
                locale={locale}
                variant={isLead ? "lead" : "standard"}
                priority={isLead}
                onOpenPreview={
                  previewable(article) ? setPreviewArticle : undefined
                }
                paywallNotice={
                  PAYWALL_SOURCES.includes(article.source_slug)
                    ? tArt("paywall_notice")
                    : undefined
                }
              />,
            ];

            // Standard cards get vertical rhythm via padding; add spacing wrapper
            if (!isLead) {
              nodes[0] = (
                <div key={article.id} className="pt-3.5">
                  {nodes[0]}
                </div>
              );
            }

            // Section band after the 4th card (F-09)
            if (band && index === 3) {
              nodes.push(
                <section
                  key="section-band"
                  className="mt-3.5 -mx-2 border-t-2 border-[var(--color-ink-1)] bg-[var(--color-paper-2)] px-3.5 pt-2.5 pb-3"
                >
                  <div className="flex items-baseline gap-2.5 mb-1.5">
                    <span
                      className="eyebrow font-bold"
                      style={{ color: SECTION_TOKENS[band.section] }}
                    >
                      {tSec(band.section)}
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-3)]">
                      {t("band_count", { count: band.count })}
                    </span>
                    <button
                      onClick={() => handleSection(band.section)}
                      className="ml-auto text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-blue)] hover:underline"
                    >
                      {t("band_view_section")} →
                    </button>
                  </div>
                  {band.headlines.map((h) => (
                    <button
                      key={h.id}
                      onClick={() =>
                        previewable(h) ? setPreviewArticle(h) : openArticle(h)
                      }
                      className="block w-full text-left headline-serif font-semibold text-[14.5px] py-1.5 border-b border-[var(--color-hairline)] text-[var(--color-ink-1)] hover:text-[var(--color-oxblood)] transition-colors"
                    >
                      {h.title}{" "}
                      <span className="font-sans text-[10px] font-medium text-[var(--color-ink-3)] ml-1.5">
                        {h.source_name}
                      </span>
                    </button>
                  ))}
                </section>
              );
            }

            // Labeled ad unit — 1 per AD_FREQUENCY articles, first after the 6th (F-45)
            if (showLead && (index + 3) % AD_FREQUENCY === 0 && index > 0) {
              nodes.push(
                <div
                  key={`ad-after-${index}`}
                  className="my-3.5 rounded-[var(--radius-card)] border border-dashed border-[var(--color-hairline)] p-4 text-center"
                >
                  <span className="inline-flex items-center rounded-[3px] bg-[var(--color-paper-3)] px-1.5 py-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--color-ink-2)]">
                    {t("ad_label")}
                  </span>
                  <AdSlot slot={FEED_AD_SLOT} className="mt-2" />
                </div>
              );
            }

            return nodes;
          })}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />

          {loadingMore && (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <ArticleCardSkeleton key={`more-${i}`} />
              ))}
            </div>
          )}

          {!nextCursor && displayItems.length > 0 && <EndOfFeed locale={locale} />}
        </div>
      )}
    </div>
    </>
  );
}
