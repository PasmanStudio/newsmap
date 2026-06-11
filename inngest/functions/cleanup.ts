import { inngest } from "@/inngest/client";
import { db } from "@/lib/db";
import { articles, ogImageJobs } from "@/lib/db/schema";
import { lte, sql } from "drizzle-orm";

/**
 * How many days of articles to keep.
 * The feed only shows recent news; older articles are never surfaced.
 * 7 days gives the full week of history without hoarding months of HTML.
 */
const RETENTION_DAYS = 7;

/** Max rows to delete per batch — avoids long-running transactions */
const BATCH_SIZE = 2_000;

export const cleanupCron = inngest.createFunction(
  {
    id: "cleanup-cron",
    name: "Daily cleanup — prune old articles",
    triggers: [{ cron: "TZ=UTC 0 3 * * *" }], // 3:00 AM UTC every day
  },
  async ({ step }) => {
    const cutoff = await step.run("compute-cutoff", () => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - RETENTION_DAYS);
      return d.toISOString();
    });

    // ── 1. Prune old og_image_jobs ────────────────────────────────────────────
    // These FK-cascade-delete with articles, but pruning them first keeps the
    // delete transaction smaller and the index cleaner.
    const ogPruned = await step.run("prune-og-jobs", async () => {
      const result = await db
        .delete(ogImageJobs)
        .where(lte(ogImageJobs.created_at, sql`${cutoff}::timestamptz`))
        .returning({ id: ogImageJobs.id });
      return result.length;
    });

    // ── 2. Batch-delete old articles ─────────────────────────────────────────
    // Drizzle doesn't support LIMIT on DELETE. We use a subquery so each
    // batch is capped, avoiding long exclusive locks on the hot articles table.
    let totalDeleted = 0;

    for (let batch = 1; batch <= 20; batch++) {
      const deleted = await step.run(`delete-batch-${batch}`, async () => {
        const result = await db.execute(sql`
          DELETE FROM articles
          WHERE id IN (
            SELECT id FROM articles
            WHERE published_at < ${cutoff}::timestamptz
            LIMIT ${BATCH_SIZE}
          )
          RETURNING id
        `);
        // result is a RowList — cast to access length
        return (result as unknown as { id: string }[]).length;
      });

      totalDeleted += deleted;
      if (deleted < BATCH_SIZE) break; // no more rows to prune
    }

    return {
      retention_days: RETENTION_DAYS,
      cutoff,
      articles_deleted: totalDeleted,
      og_jobs_pruned: ogPruned,
    };
  }
);
