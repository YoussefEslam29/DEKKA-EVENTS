import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { connectDB } from "@/lib/db";
import { Event } from "@/models/Event";

// Read per request, never at build: the build (and CI) has no database, and a stale list
// would hide a night announced since the last deploy.
export const dynamic = "force-dynamic";

/** The public pages plus every night that's ever been public (`PLAN/SITE_ROADMAP.md` D1). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, changeFrequency: "daily", priority: 1 },
    { url: `${site.url}/menu`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${site.url}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site.url}/submit-show`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${site.url}/get-app`, changeFrequency: "monthly", priority: 0.4 },
    ...["privacy", "terms", "cookies", "refund-policy"].map((p) => ({
      url: `${site.url}/${p}`,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];

  try {
    await connectDB();
    const events = await Event.find({ status: { $in: ["published", "closed", "happened", "archived"] } })
      .select("_id updatedAt startsAt")
      .sort({ startsAt: -1 })
      .limit(500)
      .lean();
    return [
      ...pages,
      ...events.map((e) => ({
        url: `${site.url}/events/${e._id}`,
        lastModified: e.updatedAt,
        changeFrequency: "weekly" as const,
        priority: new Date(e.startsAt).getTime() > Date.now() ? 0.9 : 0.3,
      })),
    ];
  } catch {
    // A sitemap without the events beats a 500 for a crawler.
    return pages;
  }
}
