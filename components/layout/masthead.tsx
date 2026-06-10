import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { sources, userSubscriptions } from "@/lib/db/schema";
import { eq, countDistinct, count } from "drizzle-orm";

type Props = {
  locale: string;
  /** Optional eyebrow above the masthead, e.g. country name on country pages */
  eyebrow?: string;
};

/**
 * Masthead — the personalized newspaper-style header.
 *
 * Layout (top → bottom):
 *   ┌─────────────────────────────────────┐
 *   │ NEWSMAP PRESENTA                    │ (small-caps, oxblood)
 *   │ El Diario de Lucía                  │ (huge serif logotype)        ✎
 *   │ 6 FUENTES · 4 PAÍSES · SIN ALGORITMO│ (subscription stats eyebrow)
 *   │ domingo 25 de mayo · EDICIÓN MAÑANA │ (date + edition tag)
 *   │ ═══════════════════════════════════ │ (2px oxblood rule)
 *   └─────────────────────────────────────┘
 *
 * Falls back to the generic "NewsMap" wordmark + tagline when the visitor
 * is anonymous or hasn't subscribed to any source yet.
 * Renders server-side so the date and stats are fresh on each request.
 */
export async function Masthead({ locale, eyebrow }: Props) {
  const t = await getTranslations({ locale, namespace: "Masthead" });
  const now = new Date();

  // Edition window — keeps the page feeling "live" without showing exact times
  const hour = now.getHours();
  const edition =
    hour >= 4 && hour < 12
      ? t("edition_morning")
      : hour >= 12 && hour < 18
      ? t("edition_afternoon")
      : t("edition_evening");

  // Locale-aware date: "domingo 25 de mayo" / "Sunday, May 25"
  const dateFormatter = new Intl.DateTimeFormat(
    locale === "es" ? "es-AR" : "en-US",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
    }
  );
  const dateLabel = dateFormatter.format(now);

  // ── Personalization: owner name + subscription stats ──────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let ownerName: string | null = null;
  let stats: { sources: number; countries: number } | null = null;

  if (user) {
    const meta = user.user_metadata as { full_name?: string; name?: string };
    const rawName = meta.full_name ?? meta.name ?? user.email?.split("@")[0];
    // First name only — the masthead reads "El Diario de Lucía"
    ownerName = rawName ? rawName.trim().split(/\s+/)[0] : null;
    if (ownerName) {
      ownerName = ownerName.charAt(0).toUpperCase() + ownerName.slice(1);
    }

    const [row] = await db
      .select({
        sources: count(userSubscriptions.source_id),
        countries: countDistinct(sources.country_code),
      })
      .from(userSubscriptions)
      .innerJoin(sources, eq(userSubscriptions.source_id, sources.id))
      .where(eq(userSubscriptions.user_id, user.id));

    if (row && row.sources > 0) {
      stats = { sources: row.sources, countries: row.countries };
    }
  }

  const personalized = Boolean(ownerName && stats);

  return (
    <header className="relative border-b-2 border-[var(--color-oxblood)] pb-3 mb-1 mt-1 mx-3 sm:mx-4 px-10 max-w-[920px] md:mx-auto text-center">
      {eyebrow && (
        <p className="eyebrow text-[var(--color-oxblood)] mb-1">{eyebrow}</p>
      )}

      {personalized && !eyebrow && (
        <p className="eyebrow text-[var(--color-oxblood)] mb-0.5">
          {t("presents")}
        </p>
      )}

      <h1
        className="font-display font-black text-[var(--color-ink-1)] tracking-tight leading-none select-none"
        // Personalized title is longer, so it caps lower than the wordmark.
        style={{
          fontSize: personalized
            ? "clamp(1.75rem, 5vw, 2.6rem)"
            : "clamp(1.75rem, 5vw, 4rem)",
        }}
      >
        {personalized ? t("owner_title", { name: ownerName! }) : "NewsMap"}
      </h1>

      <p className="eyebrow mt-1.5">
        {personalized
          ? t("stats", { sources: stats!.sources, countries: stats!.countries })
          : t("tagline")}
      </p>

      {/* Bottom row: date · edition — wrap-safe on narrow widths */}
      <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-0.5 mt-2 text-[10px] text-[var(--color-ink-3)]">
        <time dateTime={now.toISOString()} className="font-medium capitalize">
          {dateLabel}
        </time>
        <span className="opacity-40">·</span>
        <span className="uppercase tracking-[0.15em] font-semibold">
          {edition}
        </span>
      </div>

      {/* Edit my diary — pencil into settings (sources management) */}
      {personalized && (
        <Link
          href="/settings"
          aria-label={t("edit_aria")}
          className="absolute right-0 top-1/2 -translate-y-1/2 inline-flex p-1.5 rounded text-[var(--color-ink-3)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-paper-2)] transition-colors"
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
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      )}
    </header>
  );
}
