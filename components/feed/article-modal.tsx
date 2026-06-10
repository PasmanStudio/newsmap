"use client";

import { useEffect, useCallback, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { SectionChip } from "@/components/ui/section-chip";
import { timeAgo } from "@/lib/utils/time";
import { normalizeSourceLogoUrl } from "@/lib/utils/source-logos";
import {
  sanitizeArticleHtml,
  sanitizeArticleHtmlDom,
  type DomDocLike,
} from "@/lib/sanitize/article-html";
import type { ArticleCardData } from "./article-card";
import type { SectionKey } from "@/lib/db/schema";

type Props = {
  article: ArticleCardData | null;
  onClose: () => void;
  /** Advance to the next previewable article in the feed (F-16). Omit to hide the button. */
  onNext?: () => void;
  locale: string;
};

type SourceLogoProps = {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  className: string;
  fallback?: ReactNode;
};

function SourceLogo({
  src,
  alt,
  width,
  height,
  className,
  fallback = null,
}: Readonly<SourceLogoProps>) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}

/**
 * Reading modal — the "Lectura completa" differentiator. The article body is
 * read here, without leaving the diary: paper surface, serif display
 * headline, drop cap on the body, and a "next in your diary" step (F-16)
 * so finishing one story flows into the next.
 */
export function ArticleModal({ article, onClose, onNext, locale }: Props) {
  const tSec = useTranslations("Sections");
  const tArt = useTranslations("Article");

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!article) return;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [article, handleKey]);

  const sourceLogo = article
    ? normalizeSourceLogoUrl(article.source_slug, article.source_logo)
    : null;

  // Load social embed SDKs when article contains embeds
  useEffect(() => {
    if (!article?.content_html) return;

    if (article.content_html.includes("instagram-media")) {
      const w = window as Window & { instgrm?: { Embeds: { process: () => void } } };
      if (w.instgrm?.Embeds) {
        w.instgrm.Embeds.process();
      } else if (!document.getElementById("instagram-embed-sdk")) {
        const s = document.createElement("script");
        s.id = "instagram-embed-sdk";
        s.src = "https://www.instagram.com/embed.js";
        s.async = true;
        document.body.appendChild(s);
      }
    }

    if (article.content_html.includes("twitter-tweet")) {
      const w = window as Window & { twttr?: { widgets: { load: () => void } } };
      if (w.twttr?.widgets) {
        w.twttr.widgets.load();
      } else if (!document.getElementById("twitter-widget-sdk")) {
        const s = document.createElement("script");
        s.id = "twitter-widget-sdk";
        s.src = "https://platform.twitter.com/widgets.js";
        s.async = true;
        document.body.appendChild(s);
      }
    }
  }, [article?.id, article?.content_html]);

  // Render-time sanitization handles articles ingested before the shared
  // sanitizer existed — Readability output for many publishers (especially
  // Página 12 + other Arc Publishing sites) was leaking site chrome,
  // "related articles" cards, and social-share rails into content_html.
  //
  // Two-pass: DOMParser-based deep clean (strips elements by class name,
  // handles nested divs which regex can't) + regex safety net for any
  // residual unsafe attributes.
  //
  // useMemo so we don't re-sanitize 30 KB of HTML on every scroll repaint.
  const cleanContent = useMemo(() => {
    const raw = article?.content_html;
    if (!raw) return "";
    if (typeof DOMParser === "undefined") {
      return sanitizeArticleHtml(raw);
    }
    const doc = new DOMParser().parseFromString(raw, "text/html");
    const deepCleaned = sanitizeArticleHtmlDom(doc as unknown as DomDocLike);
    return sanitizeArticleHtml(deepCleaned);
  }, [article?.content_html]);

  if (!article) return null;

  const ago = timeAgo(article.published_at, locale);
  const sectionLabel = tSec(article.section_key as SectionKey);
  const sourceInitials = article.source_name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  // Estimate reading time from sanitized text length (~200 wpm). Using the
  // cleaned HTML means we don't count navigation links toward word count.
  const cleanText = cleanContent.replace(/<[^>]+>/g, " ").trim();
  const readingTimeMin = cleanText.length > 0
    ? Math.max(1, Math.round(cleanText.split(/\s+/).length / 200))
    : null;
  // Fall back to description if the sanitizer stripped the entire content
  // (happens when the original "content_html" was 100% navigation chrome).
  const hasUsableContent = cleanText.length >= 50;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
    >
      {/* Scrim — ink over paper, not pitch black */}
      <div
        className="absolute inset-0 bg-[rgba(26,26,26,0.55)]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — bottom sheet on mobile, centered reading column on desktop */}
      <div className="relative w-full sm:max-w-[640px] sm:mx-4 bg-[var(--color-paper)] rounded-t-lg sm:rounded-md overflow-hidden max-h-[86dvh] flex flex-col"
        style={{ boxShadow: "var(--shadow-overlay)" }}
      >
        {/* Scrollable body */}
        <div className="px-5 sm:px-6 pt-5 pb-6 overflow-y-auto overscroll-contain">

          {/* Meta row — source eyebrow · section chip · time · close */}
          <div className="flex items-center gap-2 mb-2.5 flex-wrap">
            <span className="eyebrow text-[var(--color-ink-2)] truncate min-w-0">
              {article.source_name}
            </span>
            <span className="opacity-30 text-xs">·</span>
            <SectionChip section={article.section_key} label={sectionLabel} />
            {readingTimeMin && (
              <span className="text-[11px] text-[var(--color-ink-3)] shrink-0">
                · {readingTimeMin} min
              </span>
            )}
            <span className="text-[11px] text-[var(--color-ink-3)] shrink-0">
              {ago}
            </span>
            <button
              onClick={onClose}
              aria-label={tArt("close")}
              className="ml-auto inline-flex p-2 -mr-1.5 rounded text-[var(--color-ink-3)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-paper-2)] transition-colors"
            >
              <svg
                width="16"
                height="16"
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
          </div>

          {/* Headline — display serif, reads like a front page */}
          <h2 className="font-display text-2xl font-bold leading-[1.15] text-[var(--color-ink-1)] mb-3">
            {article.title}
          </h2>

          {/* Thumbnail */}
          {article.thumbnail_url ? (
            <div className="relative w-full aspect-video bg-[var(--color-paper-3)] rounded-[2px] overflow-hidden mb-4">
              <Image
                src={article.thumbnail_url}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, 640px"
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}

          {/* Full article HTML — shown when sanitization leaves usable body.
              Falls back to the RSS description when the body was 100% chrome. */}
          {hasUsableContent ? (
            <div
              className="article-content dropcap"
              dangerouslySetInnerHTML={{ __html: cleanContent }}
            />
          ) : article.description ? (
            <p className="dropcap text-[15px] text-[var(--color-ink-2)] leading-[1.75]">
              {article.description}
            </p>
          ) : (
            <div className="flex items-center justify-center py-8">
              <SourceLogo
                src={sourceLogo}
                alt={article.source_name}
                width={56}
                height={56}
                className="opacity-30 object-contain"
                fallback={(
                  <span className="text-3xl font-bold opacity-20 tracking-widest select-none uppercase">
                    {sourceInitials}
                  </span>
                )}
              />
            </div>
          )}

          {/* Footer: next step (F-16) + publisher link */}
          <div className="border-t border-[var(--color-hairline)] mt-4 pt-3 flex items-center gap-2 flex-wrap">
            {onNext && (
              <button
                onClick={onNext}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4.5 py-2.5 rounded-[var(--radius-button)] bg-[var(--color-ink-blue)] border border-[var(--color-ink-blue)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
              >
                {tArt("next_in_diary")}
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
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </button>
            )}
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center min-h-[44px] px-4.5 py-2.5 rounded-[var(--radius-button)] border border-[var(--color-hairline)] text-[var(--color-ink-2)] text-[13px] font-semibold hover:border-[var(--color-ink-2)] transition-colors"
            >
              {tArt("view_on", { source: article.source_name })} ↗
            </a>
          </div>

          {/* Safe area spacer for mobile home indicator */}
          <div className="h-safe-bottom pb-2" />
        </div>
      </div>
    </div>
  );
}
