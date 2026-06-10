"use client";

import { useTranslations } from "next-intl";
import { useSaved } from "@/lib/storage/use-saved";
import type { ArticleCardData } from "./article-card";

type Props = {
  article: ArticleCardData;
  /** Visual variant — lead gets a slightly larger touch target */
  size?: "sm" | "md";
};

/**
 * Bookmark toggle — saves/unsaves the article to localStorage. No auth needed.
 * Renders as an unobtrusive icon button; filled when saved, outlined when not.
 */
export function BookmarkButton({ article, size = "sm" }: Props) {
  const t = useTranslations("Habits");
  const { isSaved, toggle } = useSaved();
  const saved = isSaved(article.id);

  // Touch target minimums per WCAG 2.1 AA: ≥44×44 px (we get close while
  // staying visually unobtrusive — 40 px sm / 44 px md).
  const dimensions = size === "md" ? "w-11 h-11" : "w-10 h-10";
  const iconSize = size === "md" ? 20 : 18;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(article);
      }}
      aria-label={saved ? t("remove_from_saved") : t("save_for_later")}
      title={saved ? t("remove_from_saved") : t("save_for_later")}
      className={`${dimensions} inline-flex items-center justify-center rounded-sm transition-colors ${
        saved
          ? "text-[var(--color-ink-blue)] hover:bg-[var(--color-ink-blue)]/10"
          : "text-[var(--color-text-3)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-2)]"
      }`}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill={saved ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={saved ? 0 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}
