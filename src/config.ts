import { config, fields, collection } from "@keystatic/core";

/** Optional shared fields each site can toggle on/off. */
export type BlogFeatures = {
  coverImage?: boolean;
  author?: boolean;
  tags?: boolean;
  seo?: boolean;
  updatedAt?: boolean;
};

export type CreateBlogConfigOptions = {
  /** The site's OWN GitHub repo — articles are committed here via PRs. */
  repo: { owner: string; name: string };
  /** Shown in the Keystatic admin header so editors know which site they're in. */
  brandName: string;
  /** Toggle the optional shared fields. Defaults: all on except `tags`. */
  features?: BlogFeatures;
  /** Site-specific extra post fields, merged into the posts schema. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraFields?: Record<string, any>;
  /** Content directory (default "content" → content/posts, content/authors). */
  contentDir?: string;
  /**
   * Storage mode. "auto" (default) uses GitHub in production when the
   * KEYSTATIC_GITHUB_* env vars are present, else local — so builds succeed
   * before the GitHub App is connected.
   */
  storage?: "auto" | "local" | "github";
};

const DEFAULT_FEATURES: Required<BlogFeatures> = {
  coverImage: true,
  author: true,
  tags: false,
  seo: true,
  updatedAt: true,
};

function shouldUseGithub(mode: CreateBlogConfigOptions["storage"]): boolean {
  if (mode === "local") return false;
  if (mode === "github") return true;
  // "auto": gate on a NEXT_PUBLIC_ var so the SERVER (route handler / reader) and
  // the CLIENT (Keystatic admin SPA) resolve the SAME storage kind. This config
  // is bundled into BOTH runtimes. Server-only vars (KEYSTATIC_GITHUB_CLIENT_ID /
  // _SECRET, KEYSTATIC_SECRET) are `undefined` in the browser, so gating on them
  // makes the client fall back to "local" while the server picks "github" — that
  // mismatch breaks the admin with "Unable to load collection … 'Not Found' is
  // not valid JSON" the moment an editor opens a collection. The GitHub App slug
  // is part of Keystatic's standard github env set and IS inlined client-side, so
  // both runtimes agree on it.
  return !!process.env.NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG;
}

/**
 * Build a Keystatic config shared across Peersyst sites. The authoring
 * mechanics and the common field set are identical everywhere; each site
 * toggles optional fields, adds its own via `extraFields`, and points at its
 * own repo. Render however you like per site (see `createBlogReader`).
 */
export function createBlogConfig(opts: CreateBlogConfigOptions) {
  const f = { ...DEFAULT_FEATURES, ...opts.features };
  const dir = opts.contentDir ?? "content";

  // Dynamic schema (fields vary per site) — typed loosely on purpose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const postSchema: Record<string, any> = {
    title: fields.slug({
      name: { label: "Title", validation: { length: { min: 1 } } },
    }),
    publishedAt: fields.date({
      label: "Published",
      validation: { isRequired: true },
    }),
    ...(f.updatedAt ? { updatedAt: fields.date({ label: "Last updated" }) } : {}),
    excerpt: fields.text({
      label: "Excerpt",
      multiline: true,
      validation: { length: { min: 1 } },
    }),
    ...(f.coverImage
      ? {
          coverImage: fields.image({
            label: "Cover image",
            directory: "public/blog/covers",
            publicPath: "/blog/covers",
          }),
          coverImageAlt: fields.text({ label: "Cover image alt text" }),
        }
      : {}),
    ...(f.author
      ? { author: fields.relationship({ label: "Author", collection: "authors" }) }
      : {}),
    ...(f.tags
      ? {
          tags: fields.array(fields.text({ label: "Tag" }), {
            label: "Tags",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            itemLabel: (props: any) => props.value,
          }),
        }
      : {}),
    ...(f.seo
      ? {
          seoTitle: fields.text({ label: "SEO title" }),
          seoDescription: fields.text({ label: "SEO description", multiline: true }),
        }
      : {}),
    ...(opts.extraFields ?? {}),
    body: fields.markdoc({ label: "Body" }),
  };

  const posts = collection({
    label: "Blog posts",
    slugField: "title",
    path: `${dir}/posts/*`,
    format: { contentField: "body" },
    entryLayout: "content",
    columns: ["title", "publishedAt"],
    schema: postSchema,
  });

  return config({
    storage: shouldUseGithub(opts.storage)
      ? { kind: "github", repo: opts.repo }
      : { kind: "local" },
    ui: { brand: { name: opts.brandName } },
    collections: {
      posts,
      ...(f.author
        ? {
            authors: collection({
              label: "Authors",
              slugField: "name",
              path: `${dir}/authors/*`,
              columns: ["name", "role"],
              schema: {
                name: fields.slug({
                  name: { label: "Name", validation: { length: { min: 1 } } },
                }),
                role: fields.text({ label: "Role" }),
                bio: fields.text({ label: "Bio", multiline: true }),
                avatar: fields.image({
                  label: "Avatar",
                  directory: "public/blog/authors",
                  publicPath: "/blog/authors",
                }),
              },
            }),
          }
        : {}),
    },
  });
}
