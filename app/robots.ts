import type { MetadataRoute } from "next";
import { site } from "@/lib/site";
import { PRIVATE_PATHS } from "@/lib/seo";

/**
 * `/robots.txt` (`PLAN/SITE_ROADMAP.md` D1). Everything public may be crawled; personal and
 * back-office pages may not. Those pages also send `X-Robots-Tag: noindex` (next.config.ts)
 * and their own `robots` metadata, since robots.txt is only a request.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
