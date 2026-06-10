import type { SectionKey } from "@/lib/db/schema";

/**
 * Canonical section colors (F-02) — these reference the --color-section-*
 * tokens defined in globals.css, the single source of truth for section
 * color across feed, map, chips and section pages.
 */
export const SECTION_TOKENS: Record<SectionKey, string> = {
  politics:      "var(--color-section-politics)",
  economy:       "var(--color-section-economy)",
  world:         "var(--color-section-world)",
  sports:        "var(--color-section-sports)",
  tech:          "var(--color-section-tech)",
  culture:       "var(--color-section-culture)",
  health:        "var(--color-section-health)",
  science:       "var(--color-section-science)",
  entertainment: "var(--color-section-entertainment)",
};

type Props = {
  section: SectionKey;
  label: string;
};

/**
 * Stamp-style section chip: near-square corners, small caps, section color
 * over a 10% tint with a 30% border. Color never travels without the label.
 */
export function SectionChip({ section, label }: Props) {
  const token = SECTION_TOKENS[section] ?? "var(--color-ink-3)";
  return (
    <span
      className="inline-flex items-center whitespace-nowrap rounded-[3px] px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-[0.08em]"
      style={{
        color: token,
        background: `color-mix(in srgb, ${token} 10%, transparent)`,
        border: `1px solid color-mix(in srgb, ${token} 30%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
