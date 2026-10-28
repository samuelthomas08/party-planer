import type { MetadataRoute } from "next";

/** Web app manifest so the app can be installed on a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Party Planer",
    short_name: "Party Planer",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f4fb",
    theme_color: "#5672e4",
    icons: [{ src: "/icon.png", sizes: "256x256", type: "image/png", purpose: "any" }],
  };
}
