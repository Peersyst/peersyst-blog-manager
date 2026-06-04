import { createBlogConfig } from "peersyst-blog-manager";
// import { fields } from "@keystatic/core"; // only if you add extraFields

export default createBlogConfig({
  // This site's OWN repo — articles are committed here via PRs.
  repo: { owner: "Peersyst", name: "YOUR_SITE_REPO" },
  brandName: "YOUR SITE — Blog",

  // Toggle the optional shared fields (defaults: all on except `tags`):
  // features: { author: false, tags: true },

  // Add site-specific fields (kept consistent for THIS site only):
  // extraFields: {
  //   readingTime: fields.integer({ label: "Reading time (min)" }),
  // },
});
