import type { MetadataRoute } from "next";

/**
 * Web app manifest (PLAN/DEKKA_PWA_APP.md §2) — what makes the site installable
 * from the browser on Android, and what iOS reads for the home-screen launch.
 *
 * Static on purpose: nothing here depends on the request, so Next serves it as
 * a cached route. Colours are `ink-black` from design-system/01-colors.md, so the
 * launch screen and status bar match the app's own background rather than
 * flashing white before the first paint.
 *
 * Arabic-first like the rest of the site: `lang`/`dir` describe the name and
 * description below. The home-screen label (`short_name`) is the Latin "Dekka"
 * because it has to read on phones set to either language.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "دكة — Dekka",
    short_name: "Dekka",
    description: "قهوة وموسيقى حيّة — احجز مكانك في حفلات دكة القادمة.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#18120d",
    theme_color: "#18120d",
    categories: ["food", "entertainment", "music"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
