"use client";

import { useTranslations } from "next-intl";
import { useSaved } from "@/lib/storage/use-saved";
import { useStreak } from "@/lib/storage/use-streak";
import { useWeeklyCount } from "@/lib/storage/use-weekly-count";

type Props = {
  locale: string;
};

/**
 * Edition close (F-27) — shown when the user reaches the bottom of the feed.
 * Newspaper-style "you're caught up" moment: closing ornament, streak +
 * weekly reading stats, and CTAs that keep the session going (map, saved,
 * back to top) plus the small-print footer links.
 */
export function EndOfFeed({ locale }: Props) {
  const t = useTranslations("Habits");
  const { items: saved } = useSaved();
  const streak = useStreak();
  const { count: weeklyCount } = useWeeklyCount();

  return (
    <div className="text-center pt-10 px-4 border-t border-[var(--color-hairline)] mt-4">
      {/* Ornamental flourish — newspaper end-of-section mark */}
      <div className="ornament mb-3.5 text-sm" aria-hidden="true">
        ❦
      </div>

      <h3 className="font-display text-2xl font-bold text-[var(--color-ink-1)] mb-2">
        {t("end_of_feed_title")}
      </h3>
      <p className="text-[13px] text-[var(--color-ink-2)] max-w-[380px] mx-auto leading-[1.55]">
        {t("end_of_feed_desc")}
        {streak > 0 && weeklyCount > 0 && (
          <>
            {" "}
            {t("end_of_feed_stats", { streak, count: weeklyCount })}
          </>
        )}
      </p>

      <div className="mt-4.5 flex items-center justify-center gap-2 flex-wrap">
        <a
          href={`/${locale}/map`}
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--color-hairline)] text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-ink-blue)] hover:border-[var(--color-ink-blue)] transition-colors"
        >
          {t("end_of_feed_cta_map")}
        </a>
        {saved.length > 0 && (
          <a
            href={`/${locale}/saved`}
            className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-[var(--radius-button)] border border-[var(--color-oxblood)]/40 text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-oxblood)] hover:border-[var(--color-oxblood)] transition-colors"
          >
            {t("end_of_feed_cta_saved", { count: saved.length })}
          </a>
        )}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] font-semibold text-[var(--color-ink-3)] hover:text-[var(--color-ink-1)] transition-colors"
        >
          ↑ {t("end_of_feed_cta_top")}
        </button>
      </div>

      {/* Small-print footer links */}
      <p className="mt-6 pt-3 border-t border-[var(--color-hairline)] text-[10.5px] text-[var(--color-ink-3)] flex items-center justify-center gap-2 flex-wrap">
        <a
          href={`/${locale}/privacy`}
          className="hover:text-[var(--color-ink-1)] hover:underline"
        >
          {t("footer_privacy")}
        </a>
        <span className="opacity-40">·</span>
        <a
          href={`/${locale}/map`}
          className="hover:text-[var(--color-ink-1)] hover:underline"
        >
          {t("footer_sources")}
        </a>
      </p>
    </div>
  );
}
