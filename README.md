# peersyst-blog-manager

Shared Keystatic blog CMS for Peersyst websites. Every site that uses it gives
writers the **same authoring experience** — same admin, same core fields, same
PR-based publish flow — while keeping its **own styling** and being able to
**toggle/add fields**. Articles are committed as Markdown (`.mdoc`) into each
site's **own GitHub repo** via PRs, so content never mixes between sites.

What's shared: the Keystatic config (schema + admin), the content types, and the
read API. What stays per-site: rendering (your components) and a few values
(repo, brand name, enabled fields).

## Requirements

Next.js **App Router** (15+), React 18/19. Peer deps (installed in the site):

```bash
npm install @keystatic/core @keystatic/next @markdoc/markdoc
npm install "peersyst-blog-manager@github:Peersyst/peersyst-blog-manager#v0.1.0"
```

> Free, no registry: it's pulled straight from GitHub. Bump the tag (`#v0.2.0`,
> …) to roll out schema changes to a site.

This package ships TypeScript source, so transpile it in **`next.config.ts`**:

```ts
const nextConfig = { transpilePackages: ["peersyst-blog-manager"] };
export default nextConfig;
```

## 1. Config + admin (copy from `templates/`)

- `keystatic.config.ts` (repo root):

```ts
import { createBlogConfig } from "peersyst-blog-manager";

export default createBlogConfig({
  repo: { owner: "Peersyst", name: "your-site-repo" }, // PRs land here
  brandName: "Your Site — Blog",
  // features: { author: false },        // turn off optional fields
  // extraFields: { readingTime: fields.integer({ label: "Reading time (min)" }) },
});
```

- Copy the four wiring files from `templates/app/**` into your `src/app/` (admin
  at `/keystatic`, API at `/api/keystatic/[...params]`). Note the relative
  import depth to `keystatic.config` (`../../../` for the admin, `../../../../../`
  for the API route).

## 2. Render (your own components)

```ts
// src/lib/blog.ts
import { createBlogReader } from "peersyst-blog-manager/reader";
import config from "../../keystatic.config";

export const blog = createBlogReader(config);
// blog.getAllPosts() · blog.getPostSlugs() · blog.getPost(slug)
```

```tsx
// src/app/blog/[slug]/page.tsx  (static generation)
import { blog } from "@/lib/blog";

export const dynamicParams = false;
export async function generateStaticParams() {
  return (await blog.getPostSlugs()).map((slug) => ({ slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;           // params is a Promise in Next 15/16
  const post = await blog.getPost(slug);
  if (!post) return null;                  // or notFound()
  return <article dangerouslySetInnerHTML={{ __html: post.body! }} />;
}
```

Every post has the common fields (`title`, `excerpt`, `publishedAt`,
`updatedAt`, `coverImage`, `coverImageAlt`, `author`, `tags`, `seoTitle`,
`seoDescription`). Disabled features come back empty/null. Site-specific
`extraFields` are available untyped on `post.fields` (e.g. `post.fields.readingTime`).

## 3. Storage / login

- **Dev:** `local` automatically — admin writes files in the repo, no
  credentials needed.
- **Prod:** `github` once you connect the Keystatic GitHub App and set
  `KEYSTATIC_GITHUB_CLIENT_ID`, `KEYSTATIC_GITHUB_CLIENT_SECRET`,
  `KEYSTATIC_SECRET` on the host. Until then it falls back to `local` so builds
  never break. Each site has its own App → its own login → no content mixing.
- Set `metadataBase` in your root layout so cover images resolve to absolute
  URLs in OpenGraph/Twitter tags.

## Gotchas (learned the hard way)

1. **`@keystar/ui` must be ≥ 0.7.20** under Next 16 + Turbopack or the admin is
   a blank screen (keystatic#1501). Current `@keystatic/core` pulls 0.7.21.
2. **On-disk format:** with a content field + image fields that have an explicit
   `directory`, entries are flat `content/posts/<slug>.mdoc`. Match this if you
   ever migrate/hand-write files, or the reader/admin won't find them.
3. **GitHub storage throws at build without the env vars** — that's why the
   storage mode is gated (see `storage: "auto"`).
4. **Bulk-migrated images** render on the site but show as "Choose file" / raw
   markdown in the editor; only assets uploaded through Keystatic are "managed".

## Versioning

Tag releases (`v0.1.0`, `v0.2.0`, …). Sites pin a tag in their dependency and
bump to adopt schema changes — that's how the authoring stays identical across
sites over time.
