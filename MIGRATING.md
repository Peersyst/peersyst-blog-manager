# Migrating an existing in-repo Keystatic blog to `peersyst-blog-manager`

This guide is for a site that **already has a Keystatic blog implemented inline**
(its config + reader live in the website repo) and wants to switch to the shared
**`peersyst-blog-manager`** package so authoring is identical across Peersyst
sites. You keep your **blog pages, styling, and content**; only the CMS layer
(Keystatic config + reader + types) becomes the package.

> Hand this whole file to the agent doing the migration. It stands alone — no
> other context needed.

- **Package repo:** `Peersyst/peersyst-blog-manager` (public — installs anonymously, no auth)
- **Consume:** the latest release tag — **`v0.1.1`** at time of writing
- **Requires:** Next.js App Router (15+), the Keystatic peer deps

---

## 0. Audit the current blog first (drives the reconcile step)

Record:
1. The current `keystatic.config.*`: the `posts`/`authors` schema — exact
   **field names + types**, plus `path`, `format`, and image
   `directory`/`publicPath`.
2. Content on disk: location, and shape — **flat** `content/posts/<slug>.mdoc`
   vs **folder** `content/posts/<slug>/index.mdoc`; the frontmatter keys used;
   where cover/author images live.
3. The reader + which pages/components import it, and the post types.
4. Next.js version (must be App Router); whether `next.config` exists.

This matters because the package defines a **canonical schema with fixed field
names** — your existing content must line up with it (see step 6).

## The package in one breath

- `createBlogConfig({ repo, brandName, features?, extraFields?, contentDir?, storage? })`
  → the Keystatic config. **Client-safe; import from the package root.**
- `createBlogReader(config)` → `{ getAllPosts, getPostSlugs, getPost }`.
  **Server-only; import from `peersyst-blog-manager/reader`.**
- Types `BlogPost`, `Author` — import from the package root.
- **Canonical `posts` fields (fixed names):** `title` (slug), `publishedAt`
  (date, required), `updatedAt` (date, optional), `excerpt` (text, required),
  `coverImage` (image) + `coverImageAlt` (text), `author` (→ `authors`),
  `seoTitle`, `seoDescription`, optional `tags`, `body` (Markdoc).
  **`authors`:** `name` (slug), `role`, `bio`, `avatar` (image).
- **On disk:** flat `content/posts/<slug>.mdoc` + `content/authors/<slug>.yaml`;
  images in `public/blog/covers` and `public/blog/authors`.
- Toggle optional fields with `features: { author, coverImage, seo, updatedAt, tags }`
  (defaults: all on except `tags`). Add site-specific fields with
  `extraFields: { … }` and read them off `post.fields.<name>`.

---

## Steps

### 1. Install (public repo → no token/auth needed, anywhere)
```bash
npm install "peersyst-blog-manager@github:Peersyst/peersyst-blog-manager#v0.1.1"
```
Use **`v0.1.1`** or later — `v0.1.0` had a client-bundling bug.

### 2. `next.config` — transpile it (the package ships TS source)
```ts
const nextConfig = {
  transpilePackages: ["peersyst-blog-manager"],
  /* ...keep your existing config */
};
```

### 3. Replace `keystatic.config.ts`
```ts
import { createBlogConfig } from "peersyst-blog-manager";
// import { fields } from "@keystatic/core"; // only if you use extraFields

export default createBlogConfig({
  repo: { owner: "Peersyst", name: "<THIS_SITE_REPO>" }, // article PRs land here
  brandName: "<SITE> — Blog",
  // features: { author: false },   // drop optional fields this site doesn't use
  // extraFields: { readingTime: fields.integer({ label: "Reading time (min)" }) },
  // contentDir: "content",         // override if content lives elsewhere
});
```
Set `features`/`extraFields` so the schema matches what THIS site's content has.

### 4. Keep (or copy) the four wiring files
`src/app/keystatic/keystatic.ts`, `src/app/keystatic/layout.tsx`,
`src/app/keystatic/[[...params]]/page.tsx`, and
`src/app/api/keystatic/[...params]/route.ts` just import `keystatic.config` — keep
them. If missing, copy from the package's `templates/`.

> **Critical:** `keystatic.config` is loaded by the **client** admin, so it must
> only import `createBlogConfig` from the package **root**. Never import
> `createBlogReader` (or anything that does) into a client path — the reader is
> server-only and pulls `node:fs`.

### 5. Point the reader at the package
```ts
// src/lib/blog.ts (adjust the relative path to keystatic.config)
import { createBlogReader } from "peersyst-blog-manager/reader";
import keystaticConfig from "../../keystatic.config";

const reader = createBlogReader(keystaticConfig);
export const getAllPosts = reader.getAllPosts;
export const getPostSlugs = reader.getPostSlugs;
export const getPost = reader.getPost;
```
Switch your post types to the package's `BlogPost`/`Author` (or alias them in your
existing types file). `getPost().body` is rendered HTML (optional on the type —
guard with `?? ""`). Delete the old inline config + reader code.

### 6. Reconcile existing content to the canonical schema — the make-or-break step
- **Field names must match** the package's (`publishedAt`, `excerpt`,
  `coverImage`, `author`, …). Rename existing frontmatter keys if they differ
  (e.g. `date` → `publishedAt`, `description` → `excerpt`) or reads come back empty.
- **Layout must be flat** `content/posts/<slug>.mdoc`. If currently
  folder-per-entry, flatten it.
- **Images:** move covers to `public/blog/covers/`, author avatars to
  `public/blog/authors/`; set the frontmatter values to the filenames.
- **Authors:** with `features.author` on, each post's `author` is a slug pointing
  to `content/authors/<slug>.yaml`.
- Genuinely site-specific fields → `extraFields`, read via `post.fields.<name>`.

### 7. Verify
```bash
npm run build      # /blog/[slug] must prerender (SSG) → proves the reader read content
npm run dev        # open /keystatic (dashboard + collections, NOT blank) and /blog (cards render)
```
If `/keystatic` is blank, or the build complains about `node:fs` in a client
chunk → the reader leaked into a client import. Keep it server-only (the
`/reader` subpath), out of `keystatic.config` and any `"use client"` file.

---

## Storage & deploy
- **Dev** uses `local` storage automatically (no credentials).
- **Prod** uses GitHub PR-based editing once `KEYSTATIC_GITHUB_CLIENT_ID` /
  `KEYSTATIC_GITHUB_CLIENT_SECRET` / `KEYSTATIC_SECRET` are set (connect the
  Keystatic GitHub App from `/keystatic`). Each site uses its **own** App → its
  own login → no content mixing between sites.
- **Deploy:** `peersyst-blog-manager` is a **public** git dependency, so it
  installs anonymously over HTTPS — no tokens, deploy keys, or registry. Vercel
  and other CI build it with no extra access configuration. (npm normalizes the
  lockfile URL to `git+ssh`, but falls back to HTTPS automatically when no SSH
  key is present — verified against an SSH-less install.)

## Gotchas (already handled in the package — don't undo them)
- `@keystar/ui` must be ≥ 0.7.20 (current `@keystatic/core` pulls it) or the
  admin renders blank under Next 16 Turbopack.
- Reader is server-only — import from `peersyst-blog-manager/reader`; the package
  root is client-safe by design.
- `params` is a Promise in Next 15/16 — `await params` in pages / `generateMetadata`.
- Set `metadataBase` in the root layout so OG/Twitter image paths resolve to
  absolute URLs.

## Need a field that ALL sites should have?
Don't fork — add it to `peersyst-blog-manager` (a `features` toggle or a core
field), cut a new tag, and bump each site's dependency. Per-site-only fields stay
in `extraFields`.
