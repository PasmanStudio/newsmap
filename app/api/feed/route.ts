import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { articles, sources, userSubscriptions } from "@/lib/db/schema";
import { normalizeSourceLogoUrl } from "@/lib/utils/source-logos";
import {
  eq,
  and,
  lt,
  gt,
  desc,
  getTableColumns,
  sql,
  ilike,
  or,
  inArray,
  count,
} from "drizzle-orm";

const PAGE_SIZE = 20;
/** Overfetch factor — leaves headroom for cluster deduplication */
const OVERFETCH = 3;

type ArticleRow = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  content_html: string | null;
  section_key: string;
  thumbnail_url: string | null;
  cluster_key: string | null;
  published_at: Date;
  source_id: string;
  source_name: string;
  source_logo: string | null;
  source_slug: string;
  country_code: string;
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor"); // ISO timestamp
    const section = searchParams.get("section"); // optional section filter
    const q = searchParams.get("q");             // optional full-text search

    // ── Common filters (apply to both anonymous + authenticated feeds) ──────
    const conditions = [];

    if (cursor) {
      conditions.push(lt(articles.published_at, new Date(cursor)));
    }

    // Full-text search — case-insensitive substring match on title + description
    if (q && q.trim()) {
      const term = `%${q.trim()}%`;
      conditions.push(
        or(ilike(articles.title, term), ilike(articles.description, term))!
      );
    }

    // UI section filter
    if (section) {
      const { sectionKeyEnum } = await import("@/lib/db/schema");
      const validSection = sectionKeyEnum.enumValues.find((v) => v === section);
      if (validSection) {
        conditions.push(eq(articles.section_key, validSection));
      }
    }

    // ── Authenticated: personalized feed (only subscribed sources) ────────
    conditions.push(eq(userSubscriptions.user_id, user.id));

    // Per-subscription section filter (only when no explicit UI section override)
    if (!section) {
      conditions.push(
        sql`(
          ${userSubscriptions.section_keys} IS NULL
          OR ${articles.section_key}::text = ANY(${userSubscriptions.section_keys})
        )`
      );
    }

    const rawRows: ArticleRow[] = await db
      .select({
        ...getTableColumns(articles),
        source_name: sources.name,
        source_logo: sources.logo_url,
        source_slug: sources.slug,
        country_code: sources.country_code,
      })
      .from(articles)
      .innerJoin(sources, eq(articles.source_id, sources.id))
      .innerJoin(
        userSubscriptions,
        and(
          eq(userSubscriptions.source_id, articles.source_id),
          eq(userSubscriptions.user_id, user.id)
        )
      )
      .where(and(...conditions))
      .orderBy(desc(articles.published_at))
      .limit(PAGE_SIZE * OVERFETCH);

    // ── Dedup by cluster_key (most-recent per cluster wins) ─────────────────
    // Singletons (cluster_key === null) are always kept as-is.
    const seenClusters = new Set<string>();
    const primaries: ArticleRow[] = [];
    for (const row of rawRows) {
      if (row.cluster_key) {
        if (seenClusters.has(row.cluster_key)) continue;
        seenClusters.add(row.cluster_key);
      }
      primaries.push(row);
      if (primaries.length > PAGE_SIZE) break;
    }

    const hasMore = primaries.length > PAGE_SIZE;
    const items = hasMore ? primaries.slice(0, PAGE_SIZE) : primaries;
    const nextCursor = hasMore
      ? items[items.length - 1].published_at.toISOString()
      : null;

    // ── Attach cluster_members for any primary that's part of a cluster ─────
    const clusterKeys = [...new Set(
      items.map((i) => i.cluster_key).filter((k): k is string => Boolean(k))
    )];
    let membersByKey = new Map<string, ClusterMember[]>();
    if (clusterKeys.length > 0) {
      const memberRows = await db
        .select({
          id: articles.id,
          title: articles.title,
          url: articles.url,
          cluster_key: articles.cluster_key,
          published_at: articles.published_at,
          source_name: sources.name,
          source_slug: sources.slug,
          country_code: sources.country_code,
        })
        .from(articles)
        .innerJoin(sources, eq(articles.source_id, sources.id))
        .where(inArray(articles.cluster_key, clusterKeys));

      membersByKey = memberRows.reduce((map, m) => {
        if (!m.cluster_key) return map;
        const list = map.get(m.cluster_key) ?? [];
        list.push({
          id: m.id,
          title: m.title,
          url: m.url,
          source_name: m.source_name,
          source_slug: m.source_slug,
          country_code: m.country_code,
          published_at: m.published_at.toISOString(),
        });
        map.set(m.cluster_key, list);
        return map;
      }, new Map<string, ClusterMember[]>());
    }

    const enriched = items.map((row) => {
      const members = row.cluster_key
        ? membersByKey.get(row.cluster_key) ?? []
        : [];
      return {
        ...row,
        source_logo: normalizeSourceLogoUrl(row.source_slug, row.source_logo),
        cluster:
          members.length >= 2
            ? {
                key: row.cluster_key!,
                source_count: members.length,
                members: members.sort((a, b) =>
                  b.published_at.localeCompare(a.published_at)
                ),
              }
            : null,
      };
    });

    // ── Section counts (F-29) — fresh articles per section in the last 24h ──
    // Only computed on the first page so chips can show "Deportes 6" without
    // a separate request. Pagination requests skip the extra query.
    let sectionCounts: Record<string, number> | undefined;
    if (!cursor) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const countRows = await db
        .select({
          section_key: articles.section_key,
          fresh: count(articles.id),
        })
        .from(articles)
        .innerJoin(
          userSubscriptions,
          and(
            eq(userSubscriptions.source_id, articles.source_id),
            eq(userSubscriptions.user_id, user.id)
          )
        )
        .where(
          and(
            gt(articles.published_at, since),
            sql`(
              ${userSubscriptions.section_keys} IS NULL
              OR ${articles.section_key}::text = ANY(${userSubscriptions.section_keys})
            )`
          )
        )
        .groupBy(articles.section_key);

      sectionCounts = Object.fromEntries(
        countRows
          .filter((r) => r.section_key !== null)
          .map((r) => [r.section_key as string, r.fresh])
      );
    }

    return NextResponse.json({ items: enriched, nextCursor, sectionCounts });
  } catch (err) {
    console.error("[GET /api/feed]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

type ClusterMember = {
  id: string;
  title: string;
  url: string;
  source_name: string;
  source_slug: string;
  country_code: string;
  published_at: string;
};
