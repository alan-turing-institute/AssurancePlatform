import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/docs-source";

// Mounted under /docs (not /api) deliberately: proxy.ts returns 401 for any
// unauthenticated `/api/*` request that isn't on its short exemption list,
// and docs search must work for signed-out visitors. `/docs/*` is already a
// public route (lib/routes.ts), so mounting here reaches the same audience
// without widening that middleware's exemption list.
export const { GET } = createFromSource(source);
