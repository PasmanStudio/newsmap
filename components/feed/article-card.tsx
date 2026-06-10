"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { SectionChip } from "@/components/ui/section-chip";
import { timeAgo, truncate } from "@/lib/utils/time";
import { useHistory } from "@/lib/storage/use-history";
import { useWeeklyCount } from "@/lib/storage/use-weekly-count";
import { BookmarkButton } from "./bookmark-button";
import { ClusterPill } from "./cluster-pill";
import type { SectionKey } from "@/lib/db/schema";

/**
 * Estimated reading minutes (~200 wpm) for the full-read badge.
 * Returns null for thin bodies (paywall teasers from El País, AS, etc.) so
 * the "Lectura completa" badge only shows when there is a real article.
 */
function readingMinutes(html: string | null): number | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").trim();
  if (text.length <= 350) return null;
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

/** One member of a multi-source story cluster (siblings of the primary article) */
export type ClusterMember = {
  id: string;
  title: string;
  url: string;
  source_name: string;
  source_slug: string;
  country_code: string;
  published_at: string;
};

/** Cluster metadata attached by /api/feed when the article is part of multi-source coverage */
export type ClusterInfo = {
  key: string;
  source_count: number;
  members: ClusterMember[];
};

export type ArticleCardData = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  /** Sanitized HTML from <content:encoded> — null when the feed omits it */
  content_html: string | null;
  section_key: SectionKey;
  thumbnail_url: string | null;
  published_at: string;
  source_name: string;
  source_logo: string | null;
  source_slug: string;
  country_code: string;
  /** Story clustering — null when this article isn't part of a multi-source group */
  cluster?: ClusterInfo | null;
};

/**
 * Visual variant for the card:
 *  - "lead":     "Portada" hero treatment for the most-covered story
 *  - "standard": normal feed card (hairline rule, compact serif headline)
 */
export type ArticleCardVariant = "lead" | "standard";

type Props = {
  article: ArticleCardData;
  sectionLabel: string;
  readLabel: string;
  locale: string;
  /** Called when user clicks thumbnail or title — opens preview modal */
  onOpenPreview?: (article: ArticleCardData) => void;
  /** Show paywall disclaimer (NYT) */
  paywallNotice?: string;
  /** Card variant — defaults to "standard" */
  variant?: ArticleCardVariant;
  /** Hint to Next.js Image to prioritize the LCP image (use true for the lead card) */
  priority?: boolean;
};

/** "Lectura completa · N min" / "Leída" stamp-style badges */
function MetaBadge({
  children,
  tone = "ink",
  icon,
}: {
  children: React.ReactNode;
  tone?: "ink" | "read";
  icon?: "check";
}) {
  const isRead = tone === "read";
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] text-[9px] font-semibold uppercase leading-none tracking-[0.1em]"
      style={
        isRead
          ? { color: "var(--color-ink-3)", padding: "2px 0" }
          : {
              color: "var(--color-ink-blue)",
              background:
                "color-mix(in srgb, var(--color-ink-blue) 10%, transparent)",
              padding: "3px 6px",
            }
      }
    >
      {icon === "check" && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
      {children}
    </span>
  );
}

export function ArticleCard({
  article,
  sectionLabel,
  readLabel,
  locale,
  onOpenPreview,
  paywallNotice,
  variant = "standard",
  priority = false,
}: Props) {
  const tArt = useTranslations("Article");
  const tFeed = useTranslations("Feed");
  const ago = timeAgo(article.published_at, locale);
  const isLead = variant === "lead";

  // Lead gets a fuller dek; standard gets a short truncated one
  const description = article.description
    ? truncate(article.description, isLead ? 280 : 180)
    : null;
  const fullReadMin = readingMinutes(article.content_html);

  // Read state (F-10): attenuate read articles, never hide them.
  // useHistory is localStorage-backed, so this works for anonymous users too.
  const { items: history, markRead } = useHistory();
  const isRead = history.some((e) => e.id === article.id);

  const { bump } = useWeeklyCount();
  const trackRead = useCallback(() => {
    markRead(article);
    bump();
  }, [article, markRead, bump]);

  const handlePreview = onOpenPreview
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        trackRead();
        onOpenPreview(article);
      }
    : undefined;

  // ── Lead variant — "Portada" hero treatment ───────────────────────────────
  if (isLead) {
    return (
      <article
        className={`fade-in-up border-b border-[var(--color-hairline)] pb-6 sm:pb-7 mb-2 group ${
          isRead ? "is-read" : ""
        }`}
      >
        {/* Eyebrow row: Portada · cluster pill */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="eyebrow text-[var(--color-oxblood)]">
            {tFeed("lead_eyebrow")}
          </span>
          {article.cluster && (
            <>
              <span className="opacity-30 text-xs">·</span>
              <ClusterPill
                article={article}
                cluster={article.cluster}
                locale={locale}
                size="md"
              />
            </>
          )}
        </div>

        {/* Big hero image */}
        {handlePreview ? (
          <button
            onClick={handlePreview}
            className="block w-full text-left mb-4"
            aria-label={`Preview: ${article.title}`}
            tabIndex={-1}
          >
            <ThumbnailContent article={article} large priority={priority} />
          </button>
        ) : (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={-1}
            onClick={trackRead}
            className="block mb-4"
          >
            <ThumbnailContent article={article} large priority={priority} />
          </a>
        )}

        {/* Serif headline — the dominant visual element */}
        {handlePreview ? (
          <button
            onClick={handlePreview}
            className="block w-full text-left headline-serif text-[var(--color-ink-1)] group-hover:text-[var(--color-oxblood)] transition-colors"
            style={{ fontSize: "clamp(1.35rem, 2.8vw, 2rem)" }}
          >
            {article.title}
          </button>
        ) : (
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={trackRead}
            className="block headline-serif text-[var(--color-ink-1)] group-hover:text-[var(--color-oxblood)] transition-colors"
            style={{ fontSize: "clamp(1.35rem, 2.8vw, 2rem)" }}
          >
            {article.title}
          </a>
        )}

        {/* Dek (subtitle paragraph) */}
        {description && (
          <p className="mt-2.5 text-[15px] text-[var(--color-ink-2)] leading-[1.55]">
            {description}
          </p>
        )}

        {/* Footer row: source · time · badges · bookmark */}
        <div className="mt-3 flex items-center gap-2.5 flex-wrap text-[11px] text-[var(--color-ink-3)]">
          <span className="eyebrow text-[var(--color-ink-2)]">
            {article.source_name}
          </span>
          <span>{ago}</span>
          {fullReadMin && (
            <MetaBadge>{tArt("full_read", { minutes: fullReadMin })}</MetaBadge>
          )}
          {isRead && (
            <MetaBadge tone="read" icon="check">
              {tArt("read_badge")}
            </MetaBadge>
          )}
          {paywallNotice && (
            <span className="text-[var(--color-yellow)] opacity-80">
              · {paywallNotice}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <BookmarkButton article={article} size="md" />
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackRead}
              className="text-[var(--color-ink-blue)] font-semibold hover:underline uppercase tracking-wider"
            >
              {readLabel} →
            </a>
          </div>
        </div>

        {/* What "Portada" means — transparency over the (non-)algorithm */}
        <p className="mt-2.5 text-[10px] text-[var(--color-ink-3)]">
          {tFeed("lead_footnote")}
        </p>
      </article>
    );
  }

  // ── Standard variant — newspaper-row treatment ────────────────────────────
  return (
    <article
      className={`fade-in-up border-b border-[var(--color-hairline)] pb-4 sm:pb-5 group ${
        isRead ? "is-read" : ""
      }`}
    >
      <div className="flex gap-3 sm:gap-4">
        <div className="flex-1 min-w-0">
          {/* Meta row — source eyebrow · section chip · read badge · time */}
          <div className="flex items-center gap-2 mb-1.5 text-[11px] text-[var(--color-ink-3)] min-w-0">
            <span className="eyebrow text-[var(--color-ink-2)] truncate min-w-0">
              {article.source_name}
            </span>
            <span className="opacity-30 shrink-0">·</span>
            <SectionChip section={article.section_key} label={sectionLabel} />
            {isRead && (
              <MetaBadge tone="read" icon="check">
                {tArt("read_badge")}
              </MetaBadge>
            )}
            <span className="ml-auto shrink-0">{ago}</span>
          </div>

          {/* Title — serif */}
          {handlePreview ? (
            <button
              onClick={handlePreview}
              className="block w-full text-left headline-serif text-[var(--color-ink-1)] group-hover:text-[var(--color-oxblood)] transition-colors"
              style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)" }}
            >
              {article.title}
            </button>
          ) : (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={trackRead}
              className="block headline-serif text-[var(--color-ink-1)] group-hover:text-[var(--color-oxblood)] transition-colors"
              style={{ fontSize: "clamp(1.05rem, 2vw, 1.25rem)" }}
            >
              {article.title}
            </a>
          )}

          {/* Description */}
          {description && (
            <p className="mt-1.5 text-[13px] text-[var(--color-ink-2)] leading-[1.45] line-clamp-2">
              {description}
            </p>
          )}

          {/* Paywall notice */}
          {paywallNotice && (
            <p className="mt-1 text-[11px] text-[var(--color-yellow)] opacity-80">
              {paywallNotice}
            </p>
          )}

          {/* Bottom row: cluster pill · full-read badge · bookmark · CTA */}
          <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-[var(--color-ink-3)]">
            {article.cluster && (
              <ClusterPill
                article={article}
                cluster={article.cluster}
                locale={locale}
                size="sm"
              />
            )}
            {fullReadMin && (
              <MetaBadge>
                {tArt("full_read", { minutes: fullReadMin })}
              </MetaBadge>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <BookmarkButton article={article} size="sm" />
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={trackRead}
                className="text-[var(--color-ink-blue)] hover:underline"
              >
                {readLabel} →
              </a>
            </div>
          </div>
        </div>

        {/* Thumbnail — narrow on phones so the headline gets real estate */}
        <div className="shrink-0 w-[88px] sm:w-[100px]">
          {handlePreview ? (
            <button
              onClick={handlePreview}
              className="block w-full text-left"
              aria-label={`Preview: ${article.title}`}
              tabIndex={-1}
            >
              <ThumbnailContent article={article} />
            </button>
          ) : (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={-1}
              onClick={trackRead}
            >
              <ThumbnailContent article={article} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ThumbnailContent({
  article,
  large = false,
  priority = false,
}: {
  article: ArticleCardData;
  /** Lead-card hero image */
  large?: boolean;
  /** Pass priority to Next.js Image for LCP optimization */
  priority?: boolean;
}) {
  const [logoError, setLogoError] = useState(false);

  return (
    <div
      className={`relative ${
        large ? "aspect-[16/9]" : "aspect-[4/3]"
      } bg-[var(--color-paper-3)] rounded-[2px] overflow-hidden`}
    >
      {article.thumbnail_url ? (
        <Image
          src={article.thumbnail_url}
          alt=""
          fill
          sizes={large ? "(max-width: 768px) 100vw, 720px" : "100px"}
          className="object-cover"
          unoptimized
          priority={priority}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {article.source_logo && !logoError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={article.source_logo}
              alt={article.source_name}
              width={large ? 96 : 36}
              height={large ? 96 : 36}
              className="opacity-40 object-contain"
              onError={() => setLogoError(true)}
            />
          ) : (
            // Flag emojis render as letter pairs on Windows — use source initials instead
            <span
              className={`font-bold opacity-20 tracking-widest select-none uppercase text-[var(--color-ink-1)] ${
                large ? "text-2xl" : "text-[10px]"
              }`}
            >
              {article.source_name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 3)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
