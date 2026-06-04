export { createBlogConfig } from "./config";
export type { CreateBlogConfigOptions, BlogFeatures } from "./config";
export type { Author, BlogPost } from "./types";

// NOTE: `createBlogReader` is intentionally NOT re-exported here. It is
// server-only (filesystem access via node:fs), and this barrel is imported by
// the client Keystatic admin (through keystatic.config). Import the reader from
// its subpath instead, in server code only:
//   import { createBlogReader } from "peersyst-blog-manager/reader";
