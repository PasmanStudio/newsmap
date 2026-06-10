"use client";

import { Link, usePathname } from "@/i18n/navigation";

export type NavLinkItem = {
  href: string;
  label: string;
};

/**
 * Nav link row with active state: the current page gets an inset 2px
 * oxblood underline (newspaper tab treatment from the design system).
 */
export function NavLinks({ items }: { items: NavLinkItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 sm:gap-1 flex-1 overflow-x-auto scrollbar-hidden -mx-1 px-1">
      {items.map(({ href, label }) => {
        // Match the route segment (href "/feed" is active on "/feed/...")
        const active =
          pathname === href || pathname.startsWith(`${href.split("/").slice(0, 2).join("/")}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`inline-flex items-center px-2 sm:px-3 py-2 min-h-[44px] text-sm whitespace-nowrap shrink-0 transition-colors ${
              active
                ? "rounded-t text-[var(--color-ink-1)] font-semibold shadow-[inset_0_-2px_0_var(--color-oxblood)]"
                : "rounded text-[var(--color-ink-2)] hover:text-[var(--color-ink-1)] hover:bg-[var(--color-paper-2)] active:bg-[var(--color-paper-3)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
