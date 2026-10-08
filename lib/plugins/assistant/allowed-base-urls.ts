import { z } from "zod";
import { logger } from "@/lib/logger";

const log = logger.child({ component: "assistant-allowed-base-urls" });

const urlSchema = z.url();
const TRAILING_SLASHES = /\/+$/;

/** Trims an endpoint and drops trailing slashes, so equal endpoints compare equal. */
export function normaliseBaseUrl(url: string): string {
	return url.trim().replace(TRAILING_SLASHES, "");
}

/**
 * The base URLs an OpenAI-compatible provider may use, from the
 * comma-separated `ASSISTANT_ALLOWED_BASE_URLS` environment variable. Users
 * choose from this list; they never type a URL. Each entry is trimmed, has
 * its trailing slash removed and is checked as a URL; an invalid entry is
 * dropped on its own and logged by position only, since an entry can hold a
 * credential. Read on every call so tests can change it per case.
 */
export function listAllowedBaseUrls(): string[] {
	const raw = process.env.ASSISTANT_ALLOWED_BASE_URLS;
	if (!raw) {
		return [];
	}
	const urls: string[] = [];
	raw.split(",").forEach((entry, index) => {
		const trimmed = entry.trim();
		if (!trimmed) {
			return;
		}
		const url = normaliseBaseUrl(trimmed);
		if (urlSchema.safeParse(url).success) {
			urls.push(url);
		} else {
			log.warn("Ignoring an invalid ASSISTANT_ALLOWED_BASE_URLS entry", {
				position: index + 1,
			});
		}
	});
	return urls;
}
