import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { ingestCron } from "@/inngest/functions/ingest-cron";
import { fetchSource } from "@/inngest/functions/fetch-source";
import { resolveOgImage } from "@/inngest/functions/og-image";
import { digestCron } from "@/inngest/functions/digest-cron";
import { enrichContent } from "@/inngest/functions/enrich-content";
import { clusterArticlesCron } from "@/inngest/functions/cluster-articles";
import { cleanupCron } from "@/inngest/functions/cleanup";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ingestCron,
    fetchSource,
    resolveOgImage,
    digestCron,
    enrichContent,
    clusterArticlesCron,
    cleanupCron,
  ],
});
