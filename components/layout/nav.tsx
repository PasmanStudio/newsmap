import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/settings/sign-out-button";
import { StatsBadge } from "./stats-badge";
import { UserMenu } from "./user-menu";
import { NavLinks } from "./nav-links";

type Props = {
  locale: string;
};

/**
 * Sticky top nav. Designed mobile-first:
 *
 * - Height collapses to 48 px on phones (h-12 → h-14 ≥sm) to claw back
 *   above-the-fold space — masthead + nav was eating ~120 px on 360 px screens.
 * - The link row is horizontally scrollable so a 5th/6th item (or wider
 *   localized labels like "Comparar países") never wraps the bar.
 * - Each link has `min-h-[44px]` for WCAG 2.1 AA touch target compliance,
 *   even though the visible padding is tighter on mobile.
 * - "NewsMap" wordmark hides below `xs` (under ~400 px) so the link row
 *   gets full breathing room on the smallest phones.
 */
export async function Nav({ locale }: Props) {
  const t = await getTranslations({ locale, namespace: "Nav" });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <nav className="sticky top-0 z-40 h-12 sm:h-14 flex items-center px-3 sm:px-4 border-b border-[var(--color-border)] bg-[var(--color-bg)]/90 backdrop-blur-sm">
      <Link
        href="/"
        className="font-display font-black text-[var(--color-text)] mr-2 sm:mr-6 text-sm sm:text-[17px] shrink-0"
      >
        NewsMap
      </Link>

      {user ? (
        <>
          {/* Scrollable link row — overflows horizontally on very narrow viewports
              rather than wrapping or squashing labels. Active page gets the
              oxblood inset underline. */}
          <NavLinks
            items={[
              { href: "/feed", label: t("feed") },
              { href: "/map", label: t("map") },
              { href: "/compare/argentina/mexico", label: t("compare") },
              { href: "/saved", label: t("saved") },
            ]}
          />

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <StatsBadge />
            {/* Mobile: single avatar circle with dropdown — collapses
                "Ajustes" + "Cerrar sesión" into one tap target so the nav
                doesn't crowd on 360 px phones. */}
            <div className="sm:hidden">
              <UserMenu email={user.email ?? ""} locale={locale} />
            </div>
            {/* Desktop: keep the inline text links — there's room for them
                and they're zero-click discoverable. */}
            <Link
              href="/settings"
              className="hidden sm:inline-flex items-center px-3 py-2 min-h-[44px] rounded text-sm text-[var(--color-text-2)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-2)] transition-colors"
            >
              {t("settings")}
            </Link>
            <div className="hidden sm:block">
              <SignOutButton label={t("signout")} locale={locale} />
            </div>
          </div>
        </>
      ) : (
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            href="/auth"
            className="inline-flex items-center px-3 sm:px-4 py-2 min-h-[40px] rounded-[var(--radius-button)] bg-[var(--color-blue)] text-white text-xs sm:text-sm font-medium hover:opacity-90 active:opacity-80"
          >
            {t("signin")}
          </Link>
        </div>
      )}
    </nav>
  );
}
