import { getTranslations } from "next-intl/server";
import { WorldMap } from "@/components/map/world-map";
import { AtlasExplorer } from "@/components/map/atlas-explorer";
import type { Metadata } from "next";
import { requirePageUser } from "@/lib/supabase/auth-guards";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Map" });
  return { title: t("title") };
}

/**
 * Explore page — list-first atlas (search + regions + country panel) with
 * the interactive globe demoted to an "atlas plate" further down (F-19/F-42:
 * the list is the accessible fast path; the globe is the lámina).
 */
export default async function MapPage({
  params,
}: Readonly<{
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  await requirePageUser(locale, `/${locale}/map`);
  const t = await getTranslations({ locale, namespace: "Map" });

  return (
    <div className="min-h-screen px-4 pt-5 pb-12">
      <AtlasExplorer locale={locale} />

      {/* Atlas plate — the interactive globe, secondary to the list */}
      <section className="max-w-[920px] mx-auto mt-10">
        <p className="eyebrow border-b-2 border-[var(--color-ink-1)] pb-1 mb-3">
          {t("globe_plate_title")}
        </p>
        <div className="h-[420px] lg:h-[520px]">
          <WorldMap locale={locale} />
        </div>
      </section>
    </div>
  );
}
