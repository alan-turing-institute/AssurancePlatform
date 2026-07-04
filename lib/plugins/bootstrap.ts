"use client";

/**
 * THE sanctioned import point for official plugin UI modules (ADR 0002 v2
 * §2.3 implementation decision, cid 2026-07-04).
 *
 * Every official plugin's UI registration module gets one line here — e.g.
 * `import "@/lib/plugins/health/register";` below — and nothing else. Core
 * code imports this barrel only, never a plugin module directly: the
 * one-way dependency rule (ADR §1) stays structural, because there is no
 * other sanctioned path from app code into a plugin's UI module. Marketplace
 * / 1.1 plugins register through the same one-line-per-plugin pattern.
 *
 * `"use client"` here is load-bearing, not decorative. The slot registries
 * this chain populates (`lib/plugins/slots/registry.ts`) are client-side
 * singletons by design — a copy executed on the server would silently
 * desync from the one the browser's `useElementBadgeSlot`/
 * `useElementPanelSlot` hooks read from, registering a plugin that never
 * appears to any real user (see `registry.ts`'s boundary docstring). Putting
 * the directive on this one sanctioned entry point — rather than relying on
 * every register module, or every importer of this file, to also carry
 * it — means the whole chain (this file, `health/register.ts`, the slot
 * registries, `HealthBadge`/`HealthPanel`) rides a single, structural client
 * boundary regardless of where this bare import ends up landing.
 */

import "@/lib/plugins/health/register";
