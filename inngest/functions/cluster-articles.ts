import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles } from "@/lib/db/schema";
import { gte, inArray, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { clusterArticles, WINDOW_HOURS } from "@/lib/clustering/cluster";

/**
 * Story clustering cron — runs every 5 minutes.
 *
 * Steps:
 *   1. Load every article from the last WINDOW_HOURS (id, title, source_id, published_at)
 *   2. Run the clustering algorithm (Jaccard on tokenised titles, cross-source only)
 *   3. For each multi-article cluster, assign a fresh cluster_key
 *   4. Clear cluster_key for any article that's no longer part of a cluster
 *      (drifted out of the window or no longer has matching siblings)
 *
 * This is idempotent — re-running it within the same window produces identical
 * groupings but new uuids. The UI doesn't care about key stability across
 * runs; it only cares about which articles share a key right now.
 */
export const clusterArticlesCron = inngest.createFunction(
  {
    id: "cluster-articles",
    name: "Cluster articles by story (Jaccard on titles)",
    triggers: [{ cron: "TZ=UTC */30 * * * *" }],
    /** Single concurrent run — clustering is a global operation */
    concurrency: { limit: 1 },
  },
  async ({ step }) => {
    const cutoff = new Date(Date.now() - WINDOW_HOURS * 3_600_000);

    // ── 1. Load candidate articles ──────────────────────────────────────────
    const candidates = await step.run("load-window", async () => {
      const rows = await db
        .select({
          id: articles.id,
          title: articles.title,
          source_id: articles.source_id,
          published_at: articles.published_at,
        })
        .from(articles)
        .where(gte(articles.published_at, cutoff));
      return rows;
    });

    if (candidates.length < 2) {
      return { window_count: candidates.length, clusters: 0, assigned: 0 };
    }

    // ── 2. Run the algorithm ────────────────────────────────────────────────
    const clusters = await step.run("compute-clusters", async () => {
      return clusterArticles(
        candidates.map((c) => ({
          id: c.id,
          title: c.title,
          source_id: c.source_id,
          published_at: c.published_at,
        }))
      );
    });

    // ── 3. Assign cluster_keys to multi-article groups ──────────────────────
    let assigned = 0;
    const clusteredIds = new Set<string>();

    if (clusters.length > 0) {
      await step.run("assign-cluster-keys", async () => {
        for (const cluster of clusters) {
          const key = randomUUID();
          await db
            .update(articles)
            .set({ cluster_key: key })
            .where(inArray(articles.id, cluster.ids));
          assigned += cluster.ids.length;
          for (const id of cluster.ids) clusteredIds.add(id);
        }
      });
    }

    // ── 4. Clear stale cluster_keys (articles in the window that no longer
    //     belong to any cluster). Articles outside the window keep their
    //     historical keys — we don't touch them. ─────────────────────────────
    const stale = candidates
      .map((c) => c.id)
      .filter((id) => !clusteredIds.has(id));

    let cleared = 0;
    if (stale.length > 0) {
      cleared = await step.run("clear-stale-keys", async () => {
        const result = await db
          .update(articles)
          .set({ cluster_key: null })
          .where(
            sql`${articles.id} = ANY(${stale}) AND ${articles.cluster_key} IS NOT NULL`
          );
        return result.count ?? 0;
      });
    }

    return {
      window_count: candidates.length,
      clusters: clusters.length,
      assigned,
      cleared,
    };
  }
);
