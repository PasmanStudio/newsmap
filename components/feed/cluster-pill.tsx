"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClusterModal } from "./cluster-modal";
import type { ArticleCardData, ClusterInfo } from "./article-card";

type Props = {
  /** The primary article — its title is used as the modal heading */
  article: ArticleCardData;
  cluster: ClusterInfo;
  locale: string;
  /** Visual variant — pill is bigger on lead cards */
  size?: "sm" | "md";
};

/** Stacked circular initials for the first sources covering the story */
function SourceAvatars({ names, dim }: { names: string[]; dim: number }) {
  return (
    <span className="inline-flex">
      {names.slice(0, 4).map((n, i) => (
        <span
          key={n + i}
          title={n}
          className="inline-flex items-center justify-center rounded-full bg-[var(--color-paper-3)] font-bold uppercase text-[var(--color-ink-2)]"
          style={{
            width: dim,
            height: dim,
            border: "1.5px solid var(--color-paper)",
            marginLeft: i === 0 ? 0 : -dim * 0.35,
            fontSize: dim * 0.42,
          }}
        >
          {n
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)}
        </span>
      ))}
    </span>
  );
}

/**
 * Pill button that surfaces a story cluster: stacked source avatars +
 * "N fuentes cubren esto". Click opens ClusterModal listing every publisher.
 *
 * Cross-border stories (3+ countries) keep the ink-blue pill but the modal
 * surfaces the country spread — color alone never carries that signal.
 */
export function ClusterPill({ article, cluster, locale, size = "sm" }: Props) {
  const t = useTranslations("Cluster");
  const [open, setOpen] = useState(false);

  const sourceNames = cluster.members.map((m) => m.source_name);
  const dim = size === "md" ? 18 : 15;

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--color-ink-blue)_12%,transparent)]"
        style={{
          background: "color-mix(in srgb, var(--color-ink-blue) 7%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-ink-blue) 25%, transparent)",
          padding: size === "md" ? "3px 10px 3px 4px" : "2px 8px 2px 3px",
        }}
        aria-label={t("aria_open", { count: cluster.source_count })}
      >
        <SourceAvatars names={sourceNames} dim={dim} />
        <span
          className="whitespace-nowrap font-semibold text-[var(--color-ink-blue)]"
          style={{ fontSize: size === "md" ? 11 : 10 }}
        >
          {t("pill_label", { count: cluster.source_count })}
        </span>
      </button>

      <ClusterModal
        open={open}
        onClose={() => setOpen(false)}
        primaryTitle={article.title}
        members={cluster.members}
        locale={locale}
      />
    </>
  );
}
