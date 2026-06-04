export type Author = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  /** Public path (e.g. /blog/authors/jane.png) or null. */
  avatar: string | null;
};

/**
 * Normalized post shape returned by the reader. The common fields are always
 * present (empty/null when a site disables that feature); site-specific fields
 * defined via `extraFields` are available untyped under `fields`.
 */
export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  /** ISO date, YYYY-MM-DD. */
  publishedAt: string;
  /** ISO date or null. */
  updatedAt: string | null;
  /** Public path to the cover image, or null when disabled/unset. */
  coverImage: string | null;
  /** Cover alt text (empty string falls back to the title at render time). */
  coverImageAlt: string;
  author: Author | null;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  /** Raw Keystatic entry — read any site-specific `extraFields` from here. */
  fields: Record<string, unknown>;
  /** Rendered HTML for the Markdoc body. Only present on single-post reads. */
  body?: string;
};
