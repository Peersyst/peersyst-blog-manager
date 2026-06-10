import "server-only";
import { createReader } from "@keystatic/core/reader";
import Markdoc from "@markdoc/markdoc";
import type { Author, BlogPost } from "./types";

const COVERS_BASE = "/blog/covers";
const AVATARS_BASE = "/blog/authors";

/** Image fields may read back as a bare filename or an already-public path. */
function resolveImage(value: unknown, base: string): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.startsWith("/") ? value : `${base}/${value}`;
}

/**
 * Build the read API for the public site. Filesystem-based (reads committed
 * files), so it works for SSG regardless of the configured storage mode.
 * `keystaticConfig` is intentionally untyped — the schema varies per site.
 */
export function createBlogReader(keystaticConfig: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reader = createReader(process.cwd(), keystaticConfig as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collections = reader.collections as any;

  async function resolveAuthor(slug: unknown): Promise<Author | null> {
    if (typeof slug !== "string" || !slug || !collections.authors) return null;
    const a = await collections.authors.read(slug);
    if (!a) return null;
    return {
      slug,
      name: a.name,
      role: a.role ?? "",
      bio: a.bio ?? "",
      avatar: resolveImage(a.avatar, AVATARS_BASE),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function normalize(slug: string, entry: any, author: Author | null): BlogPost {
    return {
      slug,
      title: entry.title,
      excerpt: entry.excerpt ?? "",
      publishedAt: entry.publishedAt ?? "",
      updatedAt: entry.updatedAt ?? null,
      coverImage: resolveImage(entry.coverImage, COVERS_BASE),
      coverImageAlt: entry.coverImageAlt ?? "",
      author,
      tags: Array.isArray(entry.tags) ? entry.tags : [],
      seoTitle: entry.seoTitle ?? "",
      seoDescription: entry.seoDescription ?? "",
      fields: entry,
    };
  }

  /** Resolve a Markdoc body field (function or value) and render it to HTML. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function renderBody(entry: any): Promise<string> {
    const content =
      typeof entry.body === "function" ? await entry.body() : entry.body;
    return Markdoc.renderers.html(Markdoc.transform(content.node));
  }

  return {
    /** Slugs of every post — feed to generateStaticParams. */
    async getPostSlugs(): Promise<string[]> {
      return collections.posts.list();
    },

    /**
     * All posts, newest first. By default each post carries metadata only.
     * Pass `{ withBody: true }` to also render every post's HTML `body` (e.g.
     * for reading-time estimates) — note this resolves and renders every entry,
     * so it's O(N) reads at build time.
     */
    async getAllPosts(opts?: { withBody?: boolean }): Promise<BlogPost[]> {
      const all = await collections.posts.all();
      const posts = await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        all.map(async ({ slug, entry }: any) => {
          const post = normalize(slug, entry, await resolveAuthor(entry.author));
          if (opts?.withBody) post.body = await renderBody(entry);
          return post;
        }),
      );
      return posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    },

    /** A single post with its rendered HTML body, or null. */
    async getPost(slug: string): Promise<BlogPost | null> {
      const entry = await collections.posts.read(slug);
      if (!entry) return null;
      return {
        ...normalize(slug, entry, await resolveAuthor(entry.author)),
        body: await renderBody(entry),
      };
    },
  };
}
